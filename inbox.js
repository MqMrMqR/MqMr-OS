/* Gmail tokens stay in memory and never pass through the site backend. */
(() => {
 const siteBackend=window.privateMailbox;
 const $=s=>document.querySelector(s), {header,resolveParts,mime,b64bytes}=MailCore;
 const mailbox = $('#mailbox');
 const preview = mailbox.dataset.preview === 'true';
 let previewOpened = false, lastMessageButton = null;
 const showList = () => { delete mailbox.dataset.reading; };
 const resetReader = () => {
  readerTicket++;
  showList();
  lastMessageButton = null;
  $('#reader').replaceChildren(text('p', 'Select a message to read it.', 'mail-empty'));
 };
 $('#back-to-list').onclick = () => { showList(); lastMessageButton?.focus(); };
 const folders={INBOX:'Inbox',ALL:'All Mail',STARRED:'Starred',SENT:'Sent',DRAFT:'Drafts',SPAM:'Junk',TRASH:'Trash'};
 const accounts = new Map();
 let current = null, folder = 'INBOX', view = null, readerTicket = 0;
 let draft = null, composing = false, sending = false;
 const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value||'';if(className)el.className=className;return el;};
 const status=value=>$('#mail-status').textContent=value;
 const fail=error=>status(error.message||'Mail could not load. Please try again.');
 function controls(){const connected=current&&accounts.has(current);$('#compose').disabled=!connected;$('#disconnect').disabled=!connected||current==='domain';$('#aliases').hidden=current!=='domain';}
 function renderAccounts(){const box=$('#accounts');box.replaceChildren();accounts.forEach((account,key)=>{const button=text('button',account.email,'account-button');button.setAttribute('aria-current',String(key===current));button.onclick=()=>selectAccount(key);box.append(button);});controls();}
 function renderFolders(){const box=$('#folders');box.replaceChildren();Object.entries(folders).forEach(([id,name])=>{if(current==='domain'&&['DRAFT','SPAM'].includes(id))return;const button=text('button',name);button.setAttribute('aria-current',String(folder===id));button.onclick=()=>{folder=id;showList();renderFolders();load();};box.append(button);});$('#mailbox-title').textContent=folders[folder];}
 function selectAccount(key){current=key;folder='INBOX';$('#search').value='';renderAccounts();renderFolders();load();}
 async function gmail(path,options={},key=current){const account=accounts.get(key);if(!account||Date.now()>=account.expires)throw Error('Mail access expired. Use Add Google account to reconnect.');const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,headers:{Authorization:'Bearer '+account.token,'Content-Type':'application/json',...options.headers}});if(response.status===401){account.expires=0;throw Error('Mail access expired. Reconnect this Google account.');}const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Google mail request failed.');return data;}
 async function domain(action,data={}){const result=await siteBackend.functions.invoke('mail-domain',{body:{action,...data}});if(result.error){let detail;try{detail=await result.error.context?.json();}catch{}throw Error(detail?.error||'Domain mail is unavailable. Please check its connection.');}if(result.data?.error)throw Error(result.data.error);return result.data;}
 $('#connect').onclick=async()=>{
  if(!InboxConfig.googleClientId){status('Google mail connection is being configured. Your site sign-in is unaffected.');return;}
  if(!window.google?.accounts?.oauth2){status('Google connection could not load. Check your connection and retry.');return;}
  google.accounts.oauth2.initTokenClient({client_id:InboxConfig.googleClientId,scope:'https://www.googleapis.com/auth/gmail.modify',include_granted_scopes:false,error_callback:()=>status('Google connection was closed. You can try again.'),callback:async result=>{
   if(result.error){status('Google mail permission was not granted.');return;}
   if(!google.accounts.oauth2.hasGrantedAllScopes(result,'https://www.googleapis.com/auth/gmail.modify')){status('Grant Gmail access to connect this account.');return;}
   try{const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+result.access_token}});const profile=await response.json();if(!response.ok)throw Error(profile.error?.message||'Google account could not connect.');accounts.set(profile.emailAddress,{email:profile.emailAddress,token:result.access_token,expires:Date.now()+Number(result.expires_in)*1000});selectAccount(profile.emailAddress);}catch(error){fail(error);}
  }}).requestAccessToken({prompt:'select_account'});
 };
 $('#disconnect').onclick = () => {
  if (!current || current === 'domain') return;
  accounts.delete(current);
  selectAccount('domain');
 };
 function summary(message,key){if(key==='domain')return message;return {id:message.id,threadId:message.threadId,from:header(message,'From'),to:header(message,'To'),subject:header(message,'Subject')||'(No subject)',snippet:message.snippet,date:Number(message.internalDate),unread:message.labelIds?.includes('UNREAD'),starred:message.labelIds?.includes('STARRED'),raw:message};}
 function renderRow(message){const button=text('button','',`message-row${message.unread?' unread':''}`);button.dataset.id=message.id;const top=text('div','','message-top');top.append(text('span',message.from,'message-sender'),text('span',new Date(message.date||message.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}),'message-date'));button.append(top,text('div',message.subject,'message-subject'),text('div',message.snippet,'message-snippet'));for (const label of [top.firstElementChild, ...button.children].filter(Boolean)) label.dir = 'auto';button.onclick=()=>read(message,button);$('#messages').append(button);}
 async function load(append = false) {
  if (!current || (append && (!view?.page || view.loading))) return;
  if (!append) {
   view = { key: current, folder, query: $('#search').value.trim(), page: null, loading: false };
   resetReader();
   $('#messages').replaceChildren();
  }

  const request = view;
  const { key, query, folder: targetFolder, page } = request;
  request.loading = true;
  $('#more').hidden = true;
  status('Loading mail…');
  try {
   let messages, next;
   if (key === 'domain') {
    const result = await domain('list', { folder: targetFolder, search: query, cursor: page });
    messages = result.messages;
    next = result.next;
   } else {
    const params = new URLSearchParams({ maxResults: '25' });
    if (targetFolder !== 'ALL') params.set('labelIds', targetFolder);
    if (targetFolder === 'SPAM' || targetFolder === 'TRASH') params.set('includeSpamTrash', 'true');
    if (query) params.set('q', query);
    if (page) params.set('pageToken', page);
    const result = await gmail('messages?' + params, {}, key);
    const ids = result.messages || [];
    next = result.nextPageToken;
    messages = [];
    for (let i = 0; i < ids.length && view === request; i += 5) {
     const batch = await Promise.all(ids.slice(i, i + 5).map(item =>
      gmail(`messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`, {}, key)));
     messages.push(...batch);
    }
   }
   if (view !== request) return;
   const rows = messages.map(message => summary(message, key));
   rows.forEach(renderRow);
   request.page = next;
   $('#mailbox-count').textContent = key === 'domain' ? (preview ? 'preview@example.test' : 'All addresses at @mqmr.bio') : key;
   status(rows.length ? '' : append ? 'No more messages.' : 'No messages in this mailbox.');
   if (preview && !previewOpened) {
    previewOpened = true;
    if (rows.length && matchMedia('(min-width: 761px)').matches) read(rows[0], $('#messages').firstElementChild);
   }
  } catch (error) {
   if (view === request) fail(error);
  } finally {
   request.loading = false;
   if (view === request) $('#more').hidden = !request.page;
  }
 }

 $('#refresh').onclick = () => load();
 $('#more').onclick = () => load(true);
 $('#search').onkeydown = event => { if (event.key === 'Enter') load(); };
 $('#search').onsearch = () => load();

 function plainText(content) {
  if (content.text || !content.html) return content.text;
  const template = document.createElement('template');
  template.innerHTML = content.html;
  template.content.querySelectorAll('script, style, title').forEach(node => node.remove());
  return template.content.textContent;
 }

 async function read(message, button) {
  const context = view;
  const { key, folder: targetFolder } = context;
  const ticket = ++readerTicket;
  const active = () => view === context && ticket === readerTicket;
  status('Opening message…');
  try {
   const full = key === 'domain'
    ? await domain('read', { id: message.id })
    : await gmail('messages/' + message.id + '?format=full', {}, key);
   if (!active()) return;
   const content = key === 'domain' ? { text: full.text_body, html: full.html_body, files: full.attachments || [] }
    : await resolveParts(full.payload, id => gmail(`messages/${message.id}/attachments/${encodeURIComponent(id)}`, {}, key));
   if (!active()) return;
   if (message.unread) {
    await modify(message.id, { unread: false }, key);
    message.unread = false;
    button.classList.remove('unread');
   }
   if (!active()) return;

   document.querySelectorAll('.message-row').forEach(row => row.classList.toggle('selected', row === button));
   lastMessageButton = button;
   mailbox.dataset.reading = 'true';
   const reader = $('#reader');
   const title = text('h2', message.subject, 'reader-subject');
   title.tabIndex = -1;
   title.dir = 'auto';
   reader.replaceChildren(title);
   if (matchMedia('(max-width: 760px)').matches) title.focus();
   reader.append(text('div', `From: ${message.from}
To: ${message.to}
${new Date(message.date || message.created_at).toLocaleString()}`, 'reader-meta'));

   const actions = text('div', '', 'reader-actions');
   const action = (label, run) => {
    const control = text('button', label);
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
    message.starred = starred;
    control.textContent = starred ? 'Unstar' : 'Star';
    if (active() && targetFolder === 'STARRED' && !starred) load();
   });
   action('Mark unread', async () => {
    await modify(message.id, { unread: true }, key);
    message.unread = true;
    button.classList.add('unread');
   });
   const changeAndRefresh = async change => {
    await modify(message.id, change, key);
    if (active()) load();
   };
   if (targetFolder === 'TRASH') action('Restore', () => changeAndRefresh({ trash: false }));
   else action('Move to Trash', () => changeAndRefresh({ trash: true }));
   if (targetFolder === 'INBOX') action('Archive', () => changeAndRefresh({ archive: true }));
   reader.append(actions);

   const body = text('pre', plainText(content) || '(No message body)', 'mail-text');
   body.dir = 'auto';
   reader.append(body);
   const files = text('div', '', 'file-list');
   for (const file of content.files) {
    const download = text('button', '↓ ' + file.name);
    download.onclick = async () => {
     download.disabled = true;
     try {
      const result = file.data ? { data: file.data }
       : key === 'domain' ? await domain('attachment', { id: message.id, attachment: file.id })
        : await gmail(`messages/${message.id}/attachments/${encodeURIComponent(file.id)}`, {}, key);
      const bytes = b64bytes(result.data);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
     } catch (error) { if (active()) fail(error); }
     finally { download.disabled = false; }
    };
    files.append(download);
   }
   reader.append(files);
   status('');
  } catch (error) { if (active()) fail(error); }
 }
 async function modify(id,change,key=current){if(key==='domain')return domain('modify',{id,...change});if('trash'in change)return gmail(`messages/${id}/${change.trash?'trash':'untrash'}`,{method:'POST'},key);const addLabelIds=[],removeLabelIds=[];if('starred'in change)(change.starred?addLabelIds:removeLabelIds).push('STARRED');if('unread'in change)(change.unread?addLabelIds:removeLabelIds).push('UNREAD');if(change.archive)removeLabelIds.push('INBOX');return gmail(`messages/${id}/modify`,{method:'POST',body:JSON.stringify({addLabelIds,removeLabelIds})},key);}
 async function addresses(){const result=await domain('addresses');return result.addresses;}
 const composeDialog = $('#compose-dialog');
 const composerFields = () => ({
  from: $('#from').value,
  to: $('#to').value,
  subject: $('#subject').value,
  text: $('#body').value
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
   $('#body').value = '';
   $('#attachments').value = '';
   $('#compose-status').textContent = '';
   draft = { account, reply: message, id: crypto.randomUUID(), initial: JSON.stringify(composerFields()) };
   composeDialog.showModal();
   $('#to').focus();
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
 $('#close-compose').onclick = closeDraft;
 composeDialog.addEventListener('cancel', event => { event.preventDefault(); closeDraft(); });

 $('#compose-form').onsubmit = async event => {
  event.preventDefault();
  if (!draft || sending || !composeDialog.open) return;

  const { account, reply, id } = draft;
  const message = { ...composerFields(), idempotencyKey: id };
  const selected = [...$('#attachments').files];
  const controls = [...composeDialog.querySelectorAll('button, input, select, textarea')].filter(control => !control.disabled);
  sending = true;
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
   status(preview ? 'Sample message saved to Sent.' : 'Message sent.');
  } catch (error) { $('#compose-status').textContent = error.message; }
  finally {
   sending = false;
   controls.forEach(control => { control.disabled = false; });
  }
 };
 async function listAliases(){const items=await addresses();$('#alias-list').replaceChildren(...items.map(a=>text('li',a.address)));}
 $('#aliases').onclick=async()=>{try{await listAliases();$('#alias-dialog').showModal();}catch(error){fail(error);}};$('#close-aliases').onclick=()=>$('#alias-dialog').close();$('#alias-form').onsubmit=async event=>{event.preventDefault();try{await domain('add-address',{name:$('#alias-name').value});await listAliases();$('#alias-name').value='';$('#alias-status').textContent='Address added.';}catch(error){$('#alias-status').textContent=error.message;}};
 if (preview) $('#disconnect').hidden = true;
 accounts.set('domain', { email: preview ? 'Sample mailbox' : 'All @mqmr.bio' });
 selectAccount('domain');
})();
