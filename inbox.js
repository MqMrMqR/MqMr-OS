import { attachmentImageType, renderMessageBody } from './mail-format.js?v=images';
import { richComposer } from './mail-compose.js';

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
 const folders={INBOX:'Inbox',ALL:'All Mail',STARRED:'Starred',SENT:'Sent',DRAFT:'Drafts',SPAM:'Junk',TRASH:'Trash'};
 const accounts = new Map();
 const lists = new Map();
 const summaries = new Map();
 const bodies = new Map();
 const listFreshness = 12000;
 const rowDates = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
 let current = null, folder = 'INBOX', view = null, readerTicket = 0;
 let readerMedia = null;
 let draft = null, composing = false, sending = false;
 const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value||'';if(className)el.className=className;return el;};
 const status=value=>$('#mail-status').textContent=value;
 const fail=error=>status(error.message||'Mail could not load. Please try again.');
 function controls(){const connected=current&&accounts.has(current);$('#compose').disabled=$('#mobile-compose').disabled=!connected;$('#disconnect').disabled=!connected||current==='domain';$('#aliases').hidden=current!=='domain';}
 function renderAccounts(){const box=$('#accounts');box.replaceChildren();accounts.forEach((account,key)=>{const button=text('button',account.email,'account-button');button.setAttribute('aria-current',String(key===current));button.onclick=()=>selectAccount(key);box.append(button);});controls();}
 function renderFolders(){const box=$('#folders');box.replaceChildren();Object.entries(folders).forEach(([id,name])=>{if(current==='domain'&&['DRAFT','SPAM'].includes(id))return;const button=text('button',name);button.setAttribute('aria-current',String(folder===id));button.onclick=()=>{if(drawer.open)drawer.close();folder=id;renderFolders();load();};box.append(button);});$('#mailbox-title').textContent=folders[folder];}
 function selectAccount(key){if(drawer.open)drawer.close();current=key;folder='INBOX';$('#search').value='';renderAccounts();renderFolders();load();}
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
  button.onclick = () => read(message, button);
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
   const query = $('#search').value.trim();
   const id = cacheKey(current, folder, query);
   const activeAccount = accounts.get(current);
   cached = (current === 'domain' || activeAccount?.expires > Date.now()) && lists.get(id);
   view = { id, key: current, folder, query, page: cached?.page, rows: cached?.rows || [], controller: new AbortController() };
   resetReader();
   $('.message-list').scrollTop = 0;
   $('#mailbox-count').textContent = current === 'domain' ? (preview ? 'preview@example.test' : 'All addresses at @mqmr.bio') : current;
   paintRows(view);
   status(cached && !view.rows.length ? 'No messages in this mailbox.' : '');
   if (!force && cached && Date.now() - cached.time < listFreshness) {
    $('#more').hidden = !view.page;
    return;
   }
  }

  const request = view;
  const { key, query, folder: targetFolder, controller } = request;
  const page = append ? request.page : null;
  request.loading = true;
  $('#more').disabled = true;
  if (!cached || !request.rows.length || force) status(append ? 'Loading more…' : 'Loading mail…');
  try {
   let rows, next;
   if (key === 'domain') {
    const result = !page && !query && targetFolder === 'INBOX' && firstPage
     ? firstPage : await domain('list', { folder: targetFolder, search: query, cursor: page });
    firstPage = undefined;
    rows = result.messages;
    next = result.next;
   } else {
    const params = new URLSearchParams({ maxResults: '25' });
    if (targetFolder !== 'ALL') params.set('labelIds', targetFolder);
    if (targetFolder === 'SPAM' || targetFolder === 'TRASH') params.set('includeSpamTrash', 'true');
    if (query) params.set('q', query);
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
   cacheList(request);
   status(rows.length ? '' : append ? 'No more messages.' : 'No messages in this mailbox.');
   if (preview && !previewOpened) {
    previewOpened = true;
    if (rows.length && matchMedia('(min-width: 761px)').matches) read(rows[0], $('#messages').firstElementChild);
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
 $('#search').onkeydown = event => { if (event.key === 'Enter') load(); };
 $('#search').onsearch = () => load();

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

  function renderImage(source, alt) {
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
   deferred.push({ frame, remote: source.kind === 'remote', async start() {
    try {
     const file = source.kind === 'cid' ? inline.get(source.id) : null;
     const url = source.kind === 'cid' ? (file && await previewUrl(file)) : source.url;
     if (disposed || !frame.isConnected) return;
     if (!url) return unavailable();
     if (source.kind === 'remote') image.loading = 'lazy';
     image.hidden = false;
     image.src = url;
    } catch { if (!disposed) unavailable(); }
   } });
   return frame;
  }

  function mount(body) {
   const items = deferred.filter(item => body.contains(item.frame));
   const local = new Map(items.filter(item => !item.remote).map(item => [item.frame, item]));
   if (local.size) {
    observer = new IntersectionObserver(entries => {
     for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      local.get(entry.target).start();
      local.delete(entry.target);
     }
    }, { root: $('.reader-pane'), rootMargin: '160px' });
    local.forEach(({ frame }) => observer.observe(frame));
   }
   const remote = items.filter(item => item.remote);
   if (!remote.length) return;
   const notice = text('div', '', 'mail-image-notice');
   const show = text('button', 'Show remote images');
   notice.append(show, text('span', 'Loading remote images can tell the sender you opened this email.'));
   show.onclick = () => {
    remote.forEach(item => item.start());
    notice.remove();
   };
   body.before(notice);
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

  return { renderImage, mount, previewFile, dispose() {
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
   media.mount(body);
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
    const item = text('div', '', 'file-entry');
    item.append(download);
    if (attachmentImageType(file)) {
     const open = text('button', 'Preview');
     open.setAttribute('aria-label', `Preview ${file.name}`);
     open.onclick = () => { if (active()) media.previewFile(file); };
     item.append(open);
    }
    files.append(item);
   }
   reader.append(files);
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
 const composer = richComposer($('#body'), $('#format-toolbar'), $('#link-panel'));
 const composerFields = () => ({
  from: $('#from').value,
  to: $('#to').value,
  subject: $('#subject').value,
  ...composer.fields()
 });
 async function compose(message = null) {
  if (!current || composing || sending || composeDialog.open) return;
  const account = current;
  composing = true;
  try {
   const values = account === 'domain' ? (await addresses()).map(item => item.address) : [account];
   if (current !== account) return;
   const from = $('#from');
   from.replaceChildren(...values.map(value => {
    const option = text('option', value);
    option.value = value;
    return option;
   }));
   if (account === 'domain' && message?.full?.recipients) {
    const match = message.full.recipients.find(recipient => values.includes(recipient));
    if (match) from.value = match;
   }
   const recipient = !message ? '' : account === 'domain' ? message.full.reply_to || message.from
    : header(message.full, 'Reply-To') || message.from;
   $('#to').value = recipient.match(/<([^>]+)>/)?.[1] || recipient;
   $('#subject').value = message ? (/^Re:/i.test(message.subject) ? message.subject : 'Re: ' + message.subject) : '';
   composer.reset();
   $('#compose-title').textContent = message ? 'Reply' : 'New message';
   $('#attachments').value = '';
   $('#compose-status').textContent = '';
   draft = { account, reply: message, id: crypto.randomUUID(), initial: JSON.stringify(composerFields()) };
   composeDialog.showModal();
   if (message) composer.focus();
   else $('#to').focus();
  } catch (error) { fail(error); }
  finally { composing = false; }
 }

 function closeDraft() {
  if (sending) return;
  const hasEdits = draft && (draft.initial !== JSON.stringify(composerFields()) || $('#attachments').files.length);
  if (hasEdits && !confirm('Discard this unsent message?')) return;
  composeDialog.close();
  draft = null;
 }
 $('#compose').onclick = () => compose();
 $('#mobile-compose').onclick = () => compose();
 $('#close-compose').onclick = closeDraft;
 composeDialog.addEventListener('cancel', event => { event.preventDefault(); closeDraft(); });

 $('#compose-form').onsubmit = async event => {
  event.preventDefault();
  if (!draft || sending || !composeDialog.open) return;

  const { account, reply, id } = draft;
  const message = { ...composerFields(), idempotencyKey: id };
  if (!message.text) {
   $('#compose-status').textContent = 'Write a message before sending.';
   composer.focus();
   return;
  }
  const selected = [...$('#attachments').files];
  const controls = [...composeDialog.querySelectorAll('button, input, select, textarea')].filter(control => !control.disabled);
  sending = true;
  $('#body').contentEditable = 'false';
  controls.forEach(control => { control.disabled = true; });
  $('#compose-status').textContent = 'Sending…';
  try {
   if (selected.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) throw Error('Attachments must total 10 MB or less.');
   const files = [];
   for (const file of selected) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    files.push({ name: file.name, type: file.type, content: btoa(binary) });
   }
   const data = { ...message, files };
   if (account === 'domain') await domain('send', data);
   else {
    const raw = mime({ ...data, replyId: reply ? header(reply.full, 'Message-ID') : null });
    await gmail('messages/send', {
     method: 'POST',
     body: JSON.stringify({ raw, ...(reply?.threadId ? { threadId: reply.threadId } : {}) })
    }, account);
   }
   composeDialog.close();
   draft = null;
   for (const [cacheId, entry] of lists) if (entry.key === account) lists.delete(cacheId);
   if (current === account && folder === 'SENT') await load(false, true);
   status(preview ? 'Sample message saved to Sent.' : 'Message sent.');
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
