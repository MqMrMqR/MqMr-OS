import { attachmentImageType, renderMessageBody } from './mail-format.js?v=inbox-workspace-1';
import { richComposer } from './mail-compose.js?v=inbox-workspace-1';
import { openDrafts } from './mail-drafts.js?v=inbox-workspace-1';
import { gmailMailQuery, hasMailSearch, matchesMailSearch, parseMailSearch } from './mail-search.js?v=inbox-workspace-1';

/* Gmail tokens stay in memory and never pass through the site backend. */
export function initializeInbox(siteBackend) {
 let firstPage = siteBackend.initialInbox;
 siteBackend.initialInbox = undefined;
 const $=s=>document.querySelector(s), {header,resolveParts,mime,b64bytes}=MailCore;
 const mailbox = $('#mailbox');
 const preview = mailbox.dataset.preview === 'true';
 let previewOpened = false, lastMessageButton = null;
 const onMobile = matchMedia('(max-width: 760px)');
 const sidebar = $('.mail-sidebar');
 const drawer = $('#mobile-mailboxes');
 const drawerButton = $('#open-folders');
 const imageDialog = $('#image-dialog');
 const imagePreview = $('#image-preview');
 const imageStatus = $('#image-status');
 $('#close-image').onclick = () => imageDialog.close();
 imageDialog.onclose = () => {
  if (!imageDialog.open) imagePreview.replaceChildren();
 };
 function placeSidebar() {
  if (onMobile.matches) drawer.append(sidebar);
  else {
   if (drawer.open) drawer.close();
   mailbox.insertBefore(sidebar, $('.mail-main'));
  }
 }
 placeSidebar();
 onMobile.addEventListener('change', placeSidebar);
 drawerButton.onclick = () => {
  drawer.showModal();
  drawerButton.setAttribute('aria-expanded', 'true');
 };
 $('#close-folders').onclick = () => drawer.close();
 drawer.onclose = () => drawerButton.setAttribute('aria-expanded', 'false');
 drawer.onclick = event => {
  if (event.target !== drawer) return;
  const bounds = drawer.getBoundingClientRect();
  if (event.clientX > bounds.right) drawer.close();
 };
 const showList = () => { delete mailbox.dataset.reading; };
 const resetReader = () => {
  readerTicket++;
  readerMedia?.dispose();
  readerMedia = null;
  showList();
  lastMessageButton = null;
  $('#reader').replaceChildren(text('p', 'Select a message to read it.', 'mail-empty'));
 };
 $('#back-to-list').onclick = () => { showList(); lastMessageButton?.focus(); };
 const folders={INBOX:'Inbox',ALL:'All Mail',STARRED:'Starred',SENT:'Sent',LOCAL_DRAFTS:'Drafts',DRAFT:'Gmail drafts',SPAM:'Junk',TRASH:'Trash'};
 const accounts = new Map();
 const lists = new Map();
 const summaries = new Map();
 const bodies = new Map();
 const listFreshness = 12000;
 const rowDates = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
 const draftStorage = openDrafts().catch(() => null);
 let current = null, folder = 'INBOX', view = null, readerTicket = 0;
 let readerMedia = null;
 let draft = null, composing = false, sending = false, closing = false;
 let activeSearch = null;
 const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value||'';if(className)el.className=className;return el;};
 const status=value=>$('#mail-status').textContent=value;
 const fail=error=>status(error.message||'Mail could not load. Please try again.');
 function controls(){const connected=current&&accounts.has(current);$('#compose').disabled=$('#mobile-compose').disabled=!connected;$('#disconnect').disabled=!connected||current==='domain';$('#aliases').hidden=current!=='domain';}
 function renderAccounts(){const box=$('#accounts');box.replaceChildren();accounts.forEach((account,key)=>{const button=text('button',account.email,'account-button');button.setAttribute('aria-current',String(key===current));button.onclick=()=>selectAccount(key);box.append(button);});controls();}
 function renderFolders(){const box=$('#folders');box.replaceChildren();Object.entries(folders).forEach(([id,name])=>{if(current==='domain'&&['DRAFT','SPAM'].includes(id))return;const button=text('button',name);button.setAttribute('aria-current',String(folder===id));button.onclick=()=>{if(drawer.open)drawer.close();folder=id;resetSearch();renderFolders();load();};box.append(button);});$('#mailbox-title').textContent=folders[folder];}
 function selectAccount(key){if(drawer.open)drawer.close();current=key;folder='INBOX';resetSearch();renderAccounts();renderFolders();load();}
 async function gmail(path,options={},key=current){const account=accounts.get(key);if(!account||Date.now()>=account.expires)throw Error('Mail access expired. Use Add Google account to reconnect.');const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,headers:{Authorization:'Bearer '+account.token,'Content-Type':'application/json',...options.headers}});if(response.status===401){account.expires=0;throw Error('Mail access expired. Reconnect this Google account.');}const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Google mail request failed.');return data;}
 async function domain(action,data={}){const result=await siteBackend.functions.invoke('mail-domain',{body:{action,...data}});if(result.error){let detail;try{detail=await result.error.context?.json();}catch{}throw Error(detail?.error||'Domain mail is unavailable. Please check its connection.');}if(result.data?.error)throw Error(result.data.error);return result.data;}
 $('#connect').onclick=async()=>{
  if(!InboxConfig.googleClientId){status('Google mail connection is being configured. Your site sign-in is unaffected.');return;}
  if(!window.google?.accounts?.oauth2){status('Google connection could not load. Check your connection and retry.');return;}
  google.accounts.oauth2.initTokenClient({client_id:InboxConfig.googleClientId,scope:'https://www.googleapis.com/auth/gmail.modify',include_granted_scopes:false,error_callback:()=>status('Google connection was closed. You can try again.'),callback:async result=>{
   if(result.error){status('Google mail permission was not granted.');return;}
   if(!google.accounts.oauth2.hasGrantedAllScopes(result,'https://www.googleapis.com/auth/gmail.modify')){status('Grant Gmail access to connect this account.');return;}
   try{const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+result.access_token}});const profile=await response.json();if(!response.ok)throw Error(profile.error?.message||'Google account could not connect.');forgetAccount(profile.emailAddress);accounts.set(profile.emailAddress,{email:profile.emailAddress,token:result.access_token,expires:Date.now()+Number(result.expires_in)*1000});selectAccount(profile.emailAddress);}catch(error){fail(error);}
  }}).requestAccessToken({prompt:'select_account'});
 };
 $('#disconnect').onclick = () => {
  if (!current || current === 'domain') return;
  forgetAccount(current);
  accounts.delete(current);
  selectAccount('domain');
 };
 function summary(message,key){if(key==='domain')return message;return {id:message.id,threadId:message.threadId,from:header(message,'From'),to:header(message,'To'),subject:header(message,'Subject')||'(No subject)',snippet:message.snippet,date:Number(message.internalDate),unread:message.labelIds?.includes('UNREAD'),starred:message.labelIds?.includes('STARRED')};}
 function senderName(value) {
  return String(value || '').replace(/\s*<[^>]*>\s*$/, '').replace(/^"|"$/g, '').trim() || String(value || 'Unknown sender');
 }
 function renderRow(message) {
  const button = text('button', '', `message-row${message.unread ? ' unread' : ''}`);
  button.dataset.id = message.id;
  const top = text('span', '', 'message-top');
  const sender = text('span', senderName(message.from), 'message-sender');
  sender.dir = 'auto';
  const date = new Date(message.date || message.created_at);
  const dateLabel = text('time', Number.isFinite(date.getTime()) ? rowDates.format(date) : '', 'message-date');
  const rowState = text('span', message.starred ? '★' : '', 'row-star');
  rowState.setAttribute('aria-label', 'Starred');
  rowState.hidden = !message.starred;
  top.append(sender, rowState, dateLabel);
  const subject = text('span', message.subject || '(No subject)', 'message-subject');
  const teaser = text('span', (message.snippet || '').split(/\s+On\s.{0,220}?\bwrote\s*:|\n\s*>/i)[0], 'message-snippet');
  subject.dir = teaser.dir = 'auto';
  const entry = text('span', '', 'message-entry');
  entry.append(top, subject, teaser);
  button.append(entry);
  button.onclick = () => message.localDraft ? compose(null, message.localDraft) : read(message, button);
  return button;
 }
 function cacheKey(...parts) { return JSON.stringify(parts); }
 function remember(cache, id, entry, limit) {
  cache.delete(id);
  cache.set(id, entry);
  if (cache.size > limit) cache.delete(cache.keys().next().value);
 }
 function forgetAccount(key) {
  for (const cache of [lists, summaries, bodies]) {
   for (const [id, entry] of cache) if (entry.key === key) cache.delete(id);
  }
 }
 function paintRows(request) {
  const selected = lastMessageButton?.dataset.id;
  const focused = document.activeElement?.dataset.id;
  const box = $('#messages');
  box.replaceChildren(...request.rows.map(renderRow));
  for (const button of box.children) {
   if (button.dataset.id === selected) {
    button.classList.add('selected');
    button.setAttribute('aria-current', 'true');
    lastMessageButton = button;
   }
   if (button.dataset.id === focused) button.focus({ preventScroll: true });
  }
 }
 function cacheList(request) {
  if (request.rows.length > 150) {
   lists.delete(request.id);
   return;
  }
  remember(lists, request.id, {
   key: request.key, rows: request.rows, page: request.page, time: Date.now()
  }, 12);
 }
 async function gmailSummaries(ids, request, force) {
  const { key, controller } = request;
  const rows = new Array(ids.length);
  let index = 0;
  const worker = async () => {
   while (!controller.signal.aborted && index < ids.length) {
    const position = index++;
    const messageId = ids[position].id;
    const id = cacheKey(key, messageId);
    const cached = summaries.get(id);
    if (!force && cached && Date.now() - cached.time < listFreshness) {
     rows[position] = cached.value;
     continue;
    }
    const message = await gmail(`messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
     { signal: controller.signal }, key);
    rows[position] = summary(message, key);
    if (!controller.signal.aborted) remember(summaries, id, { key, value: rows[position], time: Date.now() }, 250);
   }
  };
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker));
  return rows;
 }
 async function load(append = false, force = false) {
  if (!current || (append && (!view?.page || view.loading))) return;
  let cached;
  if (!append) {
   view?.controller.abort();
   const criteria = activeSearch?.criteria || { terms: [] };
   const target = activeSearch?.scope === 'all' && folder !== 'LOCAL_DRAFTS' ? 'ALL' : folder;
   const id = cacheKey(current, target, criteria);
   const activeAccount = accounts.get(current);
   cached = target !== 'LOCAL_DRAFTS' && (current === 'domain' || activeAccount?.expires > Date.now()) && lists.get(id);
   view = { id, key: current, folder: target, criteria, page: cached?.page, rows: cached?.rows || [], controller: new AbortController() };
   resetReader();
   $('.message-list').scrollTop = 0;
   $('#mailbox-count').textContent = current === 'domain' ? (preview ? 'preview@example.test' : 'All addresses at @mqmr.bio') : current;
   if (target === 'LOCAL_DRAFTS') $('#mailbox-count').textContent = 'Saved on this device';
   $('#mailbox-title').textContent = hasMailSearch(criteria) ? 'Search results' : folders[folder];
   paintRows(view);
   status(cached && !view.rows.length ? 'No messages in this mailbox.' : '');
   if (!force && cached && Date.now() - cached.time < listFreshness) {
    $('#more').hidden = !view.page;
    return;
   }
  }

  const request = view;
  const { key, criteria, folder: targetFolder, controller } = request;
  const searching = hasMailSearch(criteria);
  const page = append ? request.page : null;
  request.loading = true;
  $('#more').disabled = true;
  if (!cached || !request.rows.length || force) status(append ? 'Loading more…' : 'Loading mail…');
  try {
   let rows, next;
   if (targetFolder === 'LOCAL_DRAFTS') {
    const storage = await requireDraftStorage();
    rows = (await storage.list(key)).sort((a, b) => b.updatedAt - a.updatedAt)
     .map(item => ({ id: item.id, from: item.from, to: item.to, subject: item.subject, body: item.text, snippet: item.text,
      date: item.updatedAt, hasAttachments: item.hasAttachments, localDraft: item }))
     .filter(item => matchesMailSearch(item, criteria));
   } else if (key === 'domain') {
    const result = !page && !searching && targetFolder === 'INBOX' && firstPage
     ? firstPage : await domain('list', { folder: targetFolder, criteria, cursor: page });
    firstPage = undefined;
    rows = result.messages;
    next = result.next;
   } else {
    const params = new URLSearchParams({ maxResults: '25' });
    if (targetFolder !== 'ALL') params.set('labelIds', targetFolder);
    if (targetFolder === 'SPAM' || targetFolder === 'TRASH') params.set('includeSpamTrash', 'true');
    if (searching) params.set('q', gmailMailQuery(criteria));
    if (page) params.set('pageToken', page);
    const result = await gmail('messages?' + params, { signal: controller.signal }, key);
    next = result.nextPageToken;
    rows = await gmailSummaries(result.messages || [], request, force);
   }
   if (view !== request || controller.signal.aborted) return;
   const existingIds = new Set(append ? request.rows.map(row => row.id) : []);
   request.rows = [...(append ? request.rows : []), ...rows.filter(row => !existingIds.has(row.id))];
   request.page = next || null;
   paintRows(request);
   if (targetFolder !== 'LOCAL_DRAFTS') cacheList(request);
   status(rows.length ? '' : append ? 'No more messages.' : searching ? 'No messages match these filters.'
    : targetFolder === 'LOCAL_DRAFTS' ? 'No drafts on this device.' : 'No messages in this mailbox.');
   if (preview && !previewOpened) {
    previewOpened = true;
    if (rows.length && targetFolder !== 'LOCAL_DRAFTS' && matchMedia('(min-width: 761px)').matches) read(rows[0], $('#messages').firstElementChild);
   }
  } catch (error) {
   if (view === request && !controller.signal.aborted) fail(error);
  } finally {
   if (request.controller === controller) request.loading = false;
   if (view === request && request.controller === controller) {
    $('#more').hidden = !request.page;
    $('#more').disabled = false;
   }
  }
 }

 $('#refresh').onclick = () => load(false, true);
 $('#more').onclick = () => load(true);
 const searchForm = $('#mail-search');
 const searchInput = $('#search');
 const searchOptions = $('#search-options');
 const searchToggle = $('#open-search');
 function showSearch(open) {
  searchOptions.hidden = !open;
  searchToggle.setAttribute('aria-expanded', String(open));
 }
 function resetSearch() {
  activeSearch = null;
  searchForm.reset();
  searchToggle.textContent = 'Filters';
  $('#search-error').textContent = '';
  showSearch(false);
 }
 searchInput.addEventListener('focus', () => showSearch(true));
 searchInput.addEventListener('click', () => showSearch(true));
 searchInput.addEventListener('search', () => { if (!searchInput.value && activeSearch) searchForm.requestSubmit(); });
 searchToggle.onclick = () => showSearch(searchOptions.hidden);
 searchForm.onsubmit = event => {
  event.preventDefault();
  try {
   const fields = Object.fromEntries(new FormData(searchForm));
   const criteria = parseMailSearch(searchInput.value, fields);
   activeSearch = hasMailSearch(criteria) ? { criteria, scope: fields.scope } : null;
   const count = Object.keys(criteria).length - 1;
   searchToggle.textContent = count ? `Filters (${count})` : 'Filters';
   $('#search-error').textContent = '';
   if (searchOptions.contains(document.activeElement)) searchInput.focus();
   showSearch(false);
   load();
  } catch (error) { $('#search-error').textContent = error.message; showSearch(true); }
 };
 $('#clear-search').onclick = () => { resetSearch(); searchInput.focus(); showSearch(true); load(); };
 searchForm.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || searchOptions.hidden) return;
  event.preventDefault();
  searchInput.focus();
  showSearch(false);
 });
 document.addEventListener('pointerdown', event => { if (!searchForm.contains(event.target)) showSearch(false); });

 async function messageContent(key, messageId) {
  const id = cacheKey(key, messageId);
  const cached = bodies.get(id);
  if (cached && Date.now() - cached.time < 60000) return cached.value;
  const account = accounts.get(key);
  const full = key === 'domain'
   ? await domain('read', { id: messageId })
   : await gmail('messages/' + messageId + '?format=full', {}, key);
  const content = key === 'domain' ? { text: full.text_body, html: full.html_body, files: full.attachments || [] }
   : await resolveParts(full.payload, id => gmail(`messages/${messageId}/attachments/${encodeURIComponent(id)}`, {}, key), { includeHtml: true });
  const value = { full, content };
  if (accounts.get(key) === account && JSON.stringify(value).length < 250000) {
   remember(bodies, id, { key, time: Date.now(), value }, 12);
  }
  return value;
 }

 function messageMedia(files, loadFile) {
  const urls = new Map();
  const inline = new Map();
  const deferred = [];
  let disposed = false;
  let observer;
  for (const file of files) {
   const id = file.contentId?.trim().replace(/^<|>$/g, '');
   if (id && attachmentImageType(file) && !inline.has(id)) inline.set(id, file);
  }

  function previewUrl(file) {
   if (!urls.has(file)) {
    const pending = loadFile(file).then(bytes => disposed ? null
     : URL.createObjectURL(new Blob([bytes], { type: attachmentImageType(file) })));
    urls.set(file, pending);
    pending.catch(() => { if (urls.get(file) === pending) urls.delete(file); });
   }
   return urls.get(file);
  }

  function queueImage(alt, source, file) {
   const frame = text('span', '', 'mail-image-frame');
   const description = text('span', alt || 'Image', 'mail-image-caption');
   const image = new Image();
   image.alt = alt;
   image.decoding = 'async';
   image.referrerPolicy = 'no-referrer';
   image.hidden = true;
   const unavailable = () => {
    image.hidden = true;
    description.textContent = alt ? `${alt} · Image unavailable` : 'Image unavailable';
   };
   image.onload = () => { description.hidden = true; };
   image.onerror = unavailable;
   frame.append(image, description);
   deferred.push({ frame, file, async start() {
    if (disposed || !frame.isConnected) return;
    try {
     const url = await source();
     if (disposed || !frame.isConnected) return;
     if (!url) return unavailable();
     image.hidden = false;
     image.src = url;
    } catch { if (!disposed) unavailable(); }
   } });
   return frame;
  }

  function renderImage(source, alt) {
   if (source.kind !== 'cid') return queueImage(alt, () => source.url);
   const file = inline.get(source.id);
   return queueImage(alt, () => file && previewUrl(file), file);
  }

  function inlineFiles(body) {
   return new Set(deferred.filter(({ frame, file }) => file && body.contains(frame)).map(({ file }) => file));
  }

  function mount(reader) {
   const pending = new Map(deferred.filter(({ frame }) => reader.contains(frame)).map(item => [item.frame, item.start]));
   if (!pending.size) return;
   observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
     if (!entry.isIntersecting) continue;
     observer.unobserve(entry.target);
     pending.get(entry.target)?.();
     pending.delete(entry.target);
    }
   }, { root: $('.reader-pane'), rootMargin: '160px' });
   for (const frame of pending.keys()) observer.observe(frame);
  }

  async function previewFile(file) {
   const image = new Image();
   image.alt = file.name;
   image.decoding = 'async';
   image.hidden = true;
   imagePreview.replaceChildren(image);
   $('#image-title').textContent = file.name;
   imageStatus.textContent = 'Loading image…';
   imageDialog.showModal();
   const viewing = () => !disposed && imageDialog.open && imagePreview.contains(image);
   const unavailable = () => { if (viewing()) imageStatus.textContent = 'Could not preview this image. You can still download it.'; };
   image.onerror = unavailable;
   image.onload = () => {
    if (!viewing()) return;
    imageStatus.textContent = '';
    image.hidden = false;
   };
   try {
    const url = await previewUrl(file);
    if (viewing() && url) image.src = url;
   } catch { unavailable(); }
  }

  return { renderImage, inlineFiles, mount, previewFile,
   thumbnail: file => queueImage(file.name, () => previewUrl(file)), dispose() {
   disposed = true;
   observer?.disconnect();
   if (imageDialog.open) imageDialog.close();
   for (const pending of urls.values()) pending.then(url => { if (url) URL.revokeObjectURL(url); }, () => {});
   urls.clear();
  } };
 }

 function updateRows(key, message, flags, remove = false) {
  // Do not let a list request started before a mutation restore older flags.
  const request = view;
  if (request?.key === key && request.loading) {
   request.controller.abort();
   request.controller = new AbortController();
   request.loading = false;
   $('#more').disabled = false;
   $('#more').hidden = !request.page;
  }
  Object.assign(message, flags);
  for (const [id, entry] of lists) {
   if (entry.key !== key) continue;
   if (remove) lists.delete(id);
   else {
    entry.time = 0;
    entry.rows.forEach(row => { if (row.id === message.id) Object.assign(row, flags); });
   }
  }
  summaries.delete(cacheKey(key, message.id));
  if (request?.key !== key) return;
  if (remove) {
   request.rows = request.rows.filter(row => row.id !== message.id);
   paintRows(request);
  } else {
   request.rows.forEach(row => { if (row.id === message.id) Object.assign(row, flags); });
   for (const row of $('#messages').children) {
    if (row.dataset.id !== message.id) continue;
    if ('unread' in flags) row.classList.toggle('unread', flags.unread);
    if ('starred' in flags) {
     const star = row.querySelector('.row-star');
     star.textContent = flags.starred ? '★' : '';
     star.hidden = !flags.starred;
    }
   }
  }
 }

 async function read(message, button) {
  const context = view;
  const { key, folder: targetFolder } = context;
  const ticket = ++readerTicket;
  const active = () => view === context && ticket === readerTicket;
  if (!bodies.has(cacheKey(key, message.id))) status('Opening message…');
  try {
   const { full, content } = await messageContent(key, message.id);
   if (!active()) return;

   button = [...$('#messages').children].find(row => row.dataset.id === message.id) || button;
   document.querySelectorAll('.message-row').forEach(row => {
    row.classList.toggle('selected', row === button);
    if (row === button) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
   });
   lastMessageButton = button;
   mailbox.dataset.reading = 'true';
   const reader = $('#reader');
   readerMedia?.dispose();
   const title = text('h2', message.subject, 'reader-subject');
   title.tabIndex = -1;
   title.dir = 'auto';
   reader.replaceChildren(title);
   if (onMobile.matches) {
    $('.reader-pane').scrollTop = 0;
    title.focus({ preventScroll: true });
   }
   const meta = text('div', '', 'reader-meta');
   const from = text('strong', message.from || 'Unknown sender');
   const to = text('span', 'To ' + (message.to || '—'));
   const date = text('time', new Date(message.date || message.created_at).toLocaleString());
   from.dir = to.dir = 'auto';
   meta.append(from, to, date);
   reader.append(meta);

   const actions = text('div', '', 'reader-actions');
   const action = (label, run) => {
    const control = text('button', label, label === 'Reply' ? 'reply-action' : '');
    control.onclick = async () => {
     if (!active()) return;
     control.disabled = true;
     try { await run(control); }
     catch (error) { if (active()) fail(error); }
     finally { control.disabled = false; }
    };
    actions.append(control);
   };
   action('Reply', () => compose({ ...message, full }));
   action(message.starred ? 'Unstar' : 'Star', async control => {
    const starred = !message.starred;
    await modify(message.id, { starred }, key);
    const remove = !starred && view === context && targetFolder === 'STARRED';
    updateRows(key, message, { starred }, remove);
    control.textContent = starred ? 'Unstar' : 'Star';
    if (active() && remove) resetReader();
   });
   const marking = message.unread ? modify(message.id, { unread: false }, key)
    .then(() => updateRows(key, message, { unread: false }))
    .catch(error => { if (active()) fail(error); }) : null;
   action('Mark unread', async () => {
    await marking;
    await modify(message.id, { unread: true }, key);
    updateRows(key, message, { unread: true });
   });
   const changeAndRefresh = async change => {
    await modify(message.id, change, key);
    if (view === context) updateRows(key, message, {}, true);
    else for (const [id, entry] of lists) if (entry.key === key) lists.delete(id);
    if (active()) {
     resetReader();
     status(context.rows.length ? '' : 'No messages in this mailbox.');
    }
   };
   if (targetFolder === 'TRASH') action('Restore', () => changeAndRefresh({ trash: false }));
   else action('Move to Trash', () => changeAndRefresh({ trash: true }));
   if (targetFolder === 'INBOX') action('Archive', () => changeAndRefresh({ archive: true }));
   reader.append(actions);

   const body = text('div', '', 'mail-text');
   body.dir = 'auto';
   async function loadFile(file) {
    const result = file.data ? { data: file.data }
     : key === 'domain' ? await domain('attachment', { id: message.id, attachment: file.id })
      : await gmail(`messages/${message.id}/attachments/${encodeURIComponent(file.id)}`, {}, key);
    if (typeof result.data !== 'string') throw Error('This attachment is unavailable.');
    return b64bytes(result.data);
   }
   const media = messageMedia(content.files, loadFile);
   readerMedia = media;
   renderMessageBody(body, content, media.renderImage);
   reader.append(body);
   const inlineFiles = media.inlineFiles(body);
   const files = text('div', '', 'file-list');
   for (const file of content.files) {
    const download = text('button', '↓ ' + file.name);
    download.onclick = async () => {
     download.disabled = true;
     try {
      const bytes = await loadFile(file);
      if (!active()) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
     } catch (error) { if (active()) fail(error); }
     finally { download.disabled = false; }
    };
    if (attachmentImageType(file) && !inlineFiles.has(file)) {
     const item = text('div', '', 'file-image');
     const open = text('button', '', 'file-thumbnail');
     open.setAttribute('aria-label', `Open ${file.name}`);
     open.append(media.thumbnail(file));
     open.onclick = () => { if (active()) media.previewFile(file); };
     item.append(open, download);
     files.append(item);
    } else files.append(download);
   }
   reader.append(files);
   media.mount(reader);
   status('');
  } catch (error) { if (active()) fail(error); }
 }
 async function modify(id,change,key=current){if(key==='domain')return domain('modify',{id,...change});if('trash'in change)return gmail(`messages/${id}/${change.trash?'trash':'untrash'}`,{method:'POST'},key);const addLabelIds=[],removeLabelIds=[];if('starred'in change)(change.starred?addLabelIds:removeLabelIds).push('STARRED');if('unread'in change)(change.unread?addLabelIds:removeLabelIds).push('UNREAD');if(change.archive)removeLabelIds.push('INBOX');return gmail(`messages/${id}/modify`,{method:'POST',body:JSON.stringify({addLabelIds,removeLabelIds})},key);}
 let addressCache, addressRequest;
 async function addresses() {
  if (addressCache && Date.now() - addressCache.time < 60000) return addressCache.items;
  addressRequest ??= domain('addresses').then(result => {
   addressCache = { time: Date.now(), items: result.addresses };
   return addressCache.items;
  }).finally(() => { addressRequest = null; });
  return addressRequest;
 }
 const composeDialog = $('#compose-dialog');
 const composeForm = $('#compose-form');
 const composer = richComposer($('#body'), $('#format-toolbar'), $('#link-panel'));
 const saveStatus = $('#draft-status');
 let saveTimer;
 async function requireDraftStorage() {
  const storage = await draftStorage;
  if (!storage) throw Error('This browser could not open draft storage.');
  return storage;
 }
 const composerFields = () => ({
  from: $('#from').value,
  to: $('#to').value,
  subject: $('#subject').value,
  ...composer.fields()
 });
 async function compose(message = null, saved = null) {
  if (!current || composing || sending || composeDialog.open) return;
  const account = current;
  composing = true;
  try {
   const [values, files] = await Promise.all([
    account === 'domain' ? addresses().then(items => items.map(item => item.address)) : [account],
    saved ? requireDraftStorage().then(storage => storage.files(saved)) : []
   ]);
   if (current !== account) return;
   const from = $('#from');
   from.replaceChildren(...values.map(value => {
    const option = text('option', value);
    option.value = value;
    return option;
   }));
   if (saved && values.includes(saved.from)) from.value = saved.from;
   else if (account === 'domain' && message?.full?.recipients) {
    const match = message.full.recipients.find(recipient => values.includes(recipient));
    if (match) from.value = match;
   }
   const recipient = !message ? '' : account === 'domain' ? message.full.reply_to || message.from
    : header(message.full, 'Reply-To') || message.from;
   $('#to').value = saved?.to ?? (recipient.match(/<([^>]+)>/)?.[1] || recipient);
   $('#subject').value = saved?.subject ?? (message ? (/^Re:/i.test(message.subject) ? message.subject : 'Re: ' + message.subject) : '');
   composer.reset();
   if (saved) composer.restore(saved);
   $('#compose-title').textContent = saved ? 'Edit draft' : message ? 'Reply' : 'New message';
   $('#attachments').value = '';
   $('#compose-status').textContent = '';
   saveStatus.textContent = saved ? 'Saved on this device.' : '';
   const record = saved || { account, id: crypto.randomUUID(), revision: 0, filesVersion: '',
    replyId: message && account !== 'domain' ? header(message.full, 'Message-ID') : '', threadId: message?.threadId || '' };
   const initial = JSON.stringify(composerFields());
   draft = { record, files, initial, filesVersion: record.filesVersion, sendKey: record.sendKey, sendState: record.sendState,
    queued: saved ? JSON.stringify([initial, record.filesVersion, record.sendKey]) : '', pending: Promise.resolve(true) };
   renderDraftFiles();
   composeDialog.showModal();
   if (message || saved) composer.focus();
   else $('#to').focus();
  } catch (error) { fail(error); }
  finally { composing = false; }
 }

 function saveDraft() {
  clearTimeout(saveTimer);
  if (!draft) return Promise.resolve(true);
  const state = draft;
  const fields = composerFields();
  const plain = JSON.stringify(fields);
  const { files, filesVersion, sendKey, sendState } = state;
  const signature = JSON.stringify([plain, filesVersion, sendKey]);
  if (signature === state.queued) return state.pending;
  if (!state.record.revision && !state.queued && plain === state.initial && !files.length && !sendKey) return state.pending;
  state.queued = signature;
  if (draft === state) saveStatus.textContent = 'Saving draft…';
  state.pending = state.pending.then(async () => {
   const storage = await requireDraftStorage();
   const entry = { ...state.record, ...fields, filesVersion, sendKey, sendState, hasAttachments: files.length > 0, updatedAt: Date.now() };
   let stored = await storage.save(entry, filesVersion !== state.record.filesVersion ? files : undefined);
   if (!stored) stored = await storage.save({ ...entry, id: crypto.randomUUID(), revision: 0 }, files);
   state.record = stored;
   if (draft === state && state.queued === signature) saveStatus.textContent = 'Saved on this device.';
   return true;
  }).catch(() => {
   if (state.queued === signature) state.queued = '';
   if (draft === state) saveStatus.textContent = 'Draft could not be saved on this device.';
   return false;
  });
  return state.pending;
 }

 function scheduleDraft() {
  if (!draft || sending || closing) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 170);
 }

 function finishDraft() {
  composeDialog.close();
  draft = null;
  if (folder === 'LOCAL_DRAFTS') load(false, true);
 }

 async function closeDraft() {
  if (sending || closing || !draft) return;
  const state = draft;
  const saving = saveDraft();
  closing = composeForm.inert = true;
  try { if (await saving && draft === state) finishDraft(); }
  finally { closing = composeForm.inert = false; }
 }

 function renderDraftFiles() {
  const list = $('#draft-files');
  list.replaceChildren(...draft.files.map((file, index) => {
   const row = text('li');
   const remove = text('button', 'Remove');
   remove.type = 'button';
   remove.setAttribute('aria-label', `Remove ${file.name}`);
   remove.onclick = () => {
    draft.files = draft.files.filter((_, position) => position !== index);
    draft.filesVersion = crypto.randomUUID();
    renderDraftFiles();
    saveDraft();
   };
   row.append(text('span', file.name), remove);
   return row;
  }));
  list.hidden = !draft.files.length;
 }

 $('#attachments').onchange = event => {
  if (!draft) return;
  const files = [...draft.files, ...Array.from(event.target.files, file => ({ name: file.name, type: file.type, blob: file }))];
  event.target.value = '';
  if (files.length > 20 || files.reduce((total, file) => total + file.blob.size, 0) > 10 * 1024 * 1024) {
   $('#compose-status').textContent = 'Add up to 20 attachments totaling 10 MB or less.';
   return;
  }
  $('#compose-status').textContent = '';
  draft.files = files;
  draft.filesVersion = crypto.randomUUID();
  renderDraftFiles();
  saveDraft();
 };
 composeForm.addEventListener('input', scheduleDraft);
 composeForm.addEventListener('change', scheduleDraft);
 $('#format-toolbar').addEventListener('click', scheduleDraft);
 $('#link-panel').addEventListener('click', scheduleDraft);
 document.addEventListener('visibilitychange', () => { if (document.hidden && !sending) saveDraft(); });
 window.addEventListener('pagehide', () => { if (!sending) saveDraft(); }, { capture: true });
 $('#discard-draft').onclick = async () => {
  if (!draft || sending || closing || !confirm('Discard this unsent message?')) return;
  const state = draft;
  clearTimeout(saveTimer);
  closing = composeForm.inert = true;
  try {
   await state.pending;
   if (state.record.revision) await (await requireDraftStorage()).remove(state.record);
   if (draft === state) finishDraft();
  } catch { saveStatus.textContent = 'Draft could not be discarded. Try again.'; }
  finally { closing = composeForm.inert = false; }
 };
 $('#compose').onclick = () => compose();
 $('#mobile-compose').onclick = () => compose();
 $('#close-compose').onclick = closeDraft;
 composeDialog.addEventListener('cancel', event => { event.preventDefault(); closeDraft(); });

 composeForm.onsubmit = async event => {
  event.preventDefault();
  if (!draft || sending || closing || !composeDialog.open) return;

  const state = draft;
  const { account, replyId, threadId } = state.record;
  const message = composerFields();
  if (!message.text) {
   $('#compose-status').textContent = 'Write a message before sending.';
   composer.focus();
   return;
  }
  const sendState = JSON.stringify([message, state.filesVersion]);
  if (state.sendState !== sendState) {
   state.sendState = sendState;
   state.sendKey = crypto.randomUUID();
  }
  const saving = saveDraft();
  const controls = [...composeDialog.querySelectorAll('button, input, select, textarea')].filter(control => !control.disabled);
  sending = true;
  $('#body').contentEditable = 'false';
  controls.forEach(control => { control.disabled = true; });
  $('#compose-status').textContent = 'Sending…';
  try {
   await saving;
   const files = [];
   for (const file of state.files) {
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    files.push({ name: file.name, type: file.type, content: btoa(binary) });
   }
   const data = { ...message, files, idempotencyKey: state.sendKey };
   if (account === 'domain') await domain('send', data);
   else {
    const raw = mime({ ...data, replyId });
    await gmail('messages/send', {
     method: 'POST',
     body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) })
    }, account);
   }
   let removed = true;
   if (state.record.revision) {
    try { removed = await (await requireDraftStorage()).remove(state.record); }
    catch { removed = false; }
   }
   finishDraft();
   for (const [cacheId, entry] of lists) if (entry.key === account) lists.delete(cacheId);
   if (current === account && folder === 'SENT') await load(false, true);
   status(!removed ? 'Message sent. A copy of the draft remains on this device.' : preview ? 'Sample message saved to Sent.' : 'Message sent.');
  } catch (error) { $('#compose-status').textContent = error.message; }
  finally {
   sending = false;
   $('#body').contentEditable = 'true';
   controls.forEach(control => { control.disabled = false; });
  }
 };
 async function listAliases(){const items=await addresses();$('#alias-list').replaceChildren(...items.map(a=>text('li',a.address)));}
 $('#aliases').onclick=async()=>{try{await listAliases();if(drawer.open)drawer.close();$('#alias-dialog').showModal();}catch(error){fail(error);}};
 $('#close-aliases').onclick=()=>$('#alias-dialog').close();
 $('#alias-form').onsubmit=async event=>{
  event.preventDefault();
  try {
   await domain('add-address',{name:$('#alias-name').value});
   addressCache = null;
   await listAliases();
   $('#alias-name').value='';
   $('#alias-status').textContent='Address added.';
  } catch(error) { $('#alias-status').textContent=error.message; }
 };
 if (preview) $('#disconnect').hidden = true;
 accounts.set('domain', { email: preview ? 'Sample mailbox' : 'All @mqmr.bio' });
 selectAccount('domain');
}
