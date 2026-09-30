/* Visual edits are drafts. Database RLS remains the final authority for publishing. */
(() => {
  const $ = id => document.getElementById(id);
  const paths = [...$('document').options].map(option => option.value);
  const documents = new Map();
  let authorized = false, selection = null, busy = false, initializing = false;
  const history = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const dirtyPaths = () => [...documents].filter(([,row]) => JSON.stringify(row.draft) !== JSON.stringify(row.baseline)).map(([path]) => path);
  function status(text) { $('status').textContent = text; }
  function controls() { const dirty = dirtyPaths().length; $('save').disabled = busy || !authorized || !dirty; $('discard').disabled = busy || !dirty; $('undo').disabled = busy || !history.length; }
  function checkpoint() { history.push(Object.fromEntries([...documents].map(([path,row]) => [path,clone(row.draft)]))); if (history.length > 50) history.shift(); }
  function syncJSON() { const row = documents.get($('document').value); $('content').value = row ? JSON.stringify(row.draft,null,2) : ''; }
  function changed() { syncJSON(); controls(); status('Draft · ' + dirtyPaths().length + ' changed document(s). Publish when ready.'); }
  function design() { const main = documents.get('main-data.json').draft; if (!main.design || typeof main.design !== 'object' || Array.isArray(main.design)) main.design = {}; return main.design; }
  function applyDesign() { $('preview').contentWindow?.editorPreview?.applyDesign(design()); }
  function rgbToHex(value) { if (/^#[0-9a-f]{6}$/i.test(value)) return value; const rgb = value.match(/\d+/g); return rgb?.length >= 3 ? '#' + rgb.slice(0,3).map(number => Math.min(255,Number(number)).toString(16).padStart(2,'0')).join('') : '#ffffff'; }
  function select(info) {
    if (!authorized) return;
    selection = info; $('selection-empty').hidden = true; $('selection-panel').hidden = false;
    $('selected-tag').textContent = info.tag; $('selected-selector').textContent = info.selector;
    $('selected-text').value = info.text ?? ''; $('selected-text').disabled = info.text === null;
    $('text-source').textContent = info.binding ? 'Shared content · ' + info.binding.doc + ' / ' + info.binding.path.join('.') : info.text === null ? 'Select a text element to edit its words.' : 'Desktop text override · shared JSON remains available below.';
    const saved = documents.get('main-data.json').draft.design?.rules?.[info.selector] || {};
    for (const [id,prop] of [['style-color','color'],['style-background','background-color'],['style-size','font-size'],['style-weight','font-weight'],['style-align','text-align'],['style-radius','border-radius'],['style-padding','padding']]) {
      const input = $(id), value = saved[prop] || info.styles[prop];
      input.value = input.type === 'color' ? rgbToHex(value) : input.type === 'number' ? Math.round(parseFloat(value)) || 0 : value;
    }
  }
  window.MqMrEditor = {
    allowed:() => authorized,
    isSelecting:() => $('select-mode').checked,
    getContent(path) { return authorized && documents.has(path) ? clone(documents.get(path).draft) : null; },
    select
  };
  function reloadPreview() { selection = null; $('selection-panel').hidden = true; $('selection-empty').hidden = false; $('preview').src = 'index.html?editor=1&preview=' + Date.now(); }
  async function loadDocuments() {
    const {data,error} = await siteBackend.from('site_content').select('path,content,updated_at').in('path',paths);
    if (error) throw error;
    const loaded = new Map();
    for (const path of paths) {
      const row = data.find(item => item.path === path);
      const content = row ? row.content : await (await fetch(path)).json();
      loaded.set(path,{baseline:clone(content),draft:clone(content),revision:row?.updated_at || null});
    }
    documents.clear(); loaded.forEach((row,path) => documents.set(path,row)); history.length = 0; syncJSON(); reloadPreview(); controls();
  }
  async function refreshAdmin() {
    if (initializing) return; initializing = true;
    try {
      if (!window.siteBackend) throw new Error('Sign-in service unavailable. Check the connection and reload.');
      const {data,error} = await siteBackend.auth.getUser(); const user = error ? null : data.user;
      const allowed = user?.app_metadata?.role === 'admin';
      $('login').hidden = !!user; $('logout').hidden = !user;
      if (!allowed) { authorized = false; documents.clear(); history.length = 0; $('preview').removeAttribute('src'); $('editor').hidden = true; $('auth-gate').hidden = false; controls(); status(user ? 'This account has no administrator access.' : 'Sign in with the administrator account.'); return; }
      authorized = true;
      if (!documents.size) await loadDocuments();
      $('editor').hidden = false; $('auth-gate').hidden = true; controls(); status(dirtyPaths().length ? 'Your unpublished drafts are ready.' : 'Admin verified · select an element to edit.');
    } catch (error) { status(error.message); } finally { initializing = false; }
  }
  $('selected-text').oninput = event => {
    if (!authorized || !selection || selection.text === null) return;
    checkpoint(); const text = event.target.value;
    if (selection.binding) {
      const {doc,path} = selection.binding; let target = documents.get(doc).draft;
      for (const key of path.slice(0,-1)) target = target[key];
      target[path.at(-1)] = text;
    } else { const draftDesign = design(); draftDesign.texts ||= {}; draftDesign.texts[selection.selector] = text; }
    selection.text = text; $('preview').contentWindow.editorPreview?.updateText(text); changed();
  };
  for (const [id,prop] of [['style-color','color'],['style-background','background-color'],['style-size','font-size'],['style-weight','font-weight'],['style-align','text-align'],['style-radius','border-radius'],['style-padding','padding']]) $(id).onchange = event => {
    if (!authorized || !selection) return;
    const value = event.target.type === 'number' ? event.target.value + 'px' : event.target.value;
    if (!$('preview').contentWindow.siteDesign.properties[prop](value)) { status('Property is outside the supported range.'); return; }
    checkpoint(); const draftDesign = design(); draftDesign.rules ||= {}; draftDesign.rules[selection.selector] ||= {}; draftDesign.rules[selection.selector][prop] = value; applyDesign(); changed();
  };
  $('reset-style').onclick = () => {
    if (!selection) return; checkpoint(); const draftDesign = design(); delete draftDesign.rules?.[selection.selector]; delete draftDesign.texts?.[selection.selector]; reloadPreview(); changed();
  };
  $('undo').onclick = () => { const previous = history.pop(); if (!previous) return; for (const [path,draft] of Object.entries(previous)) documents.get(path).draft = draft; reloadPreview(); changed(); };
  $('discard').onclick = () => { if (!confirm('Discard all unpublished edits?')) return; documents.forEach(row => row.draft = clone(row.baseline)); history.length = 0; reloadPreview(); changed(); };
  $('preview-reload').onclick = reloadPreview;
  $('document').onchange = syncJSON;
  $('apply-json').onclick = () => {
    try {
      const next = JSON.parse($('content').value), row = documents.get($('document').value);
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Document must be a JSON object.');
      for (const [key,value] of Object.entries(row.baseline)) if (key !== 'design' && (!(key in next) || typeof next[key] !== typeof value || Array.isArray(next[key]) !== Array.isArray(value))) throw new Error('Keep the structure of ' + key);
      checkpoint(); row.draft = next; reloadPreview(); changed();
    } catch (error) { status('Draft not applied: ' + error.message); }
  };
  $('save').onclick = async () => {
    if (busy || !authorized) return; busy = true; controls();
    let published = 0;
    try {
      const {data,error} = await siteBackend.auth.getUser();
      if (error || data.user?.app_metadata?.role !== 'admin') throw new Error('Administrator session could not be verified.');
      for (const path of dirtyPaths()) {
        const row = documents.get(path), content = clone(row.draft);
        const payload = {path,content,updated_at:new Date().toISOString()};
        const query = row.revision ? siteBackend.from('site_content').update(payload).eq('path',path).eq('updated_at',row.revision) : siteBackend.from('site_content').insert(payload);
        const {data:result,error:saveError} = await query.select('updated_at').single();
        if (saveError) throw new Error(path + ': ' + saveError.message + '. Another session may have published edits; back up your drafts before reloading.');
        row.revision = result.updated_at; row.baseline = content; published++;
      }
      history.length = 0; status('Published ' + published + ' document(s). Visitors see changes when they reload.');
    } catch (error) { status('Published ' + published + ' document(s); remaining drafts kept. ' + error.message); }
    finally { busy = false; controls(); }
  };
  $('backup').onclick = () => {
    const payload = Object.fromEntries([...documents].map(([path,row]) => [path,row.draft]));
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'mqmr-os-content-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  $('login').onclick = async () => { try { await signInToSite(); } catch (error) { status(error.message); } };
  $('logout').onclick = async () => { if (dirtyPaths().length && !confirm('Sign out and discard unpublished edits?')) return; const {error} = await siteBackend.auth.signOut(); if (error) status(error.message); else refreshAdmin(); };
  $('retry').onclick = refreshAdmin;
  window.addEventListener('beforeunload',event => { if (dirtyPaths().length) { event.preventDefault(); event.returnValue = ''; } });
  if (window.siteBackend) siteBackend.auth.onAuthStateChange(() => setTimeout(refreshAdmin,0));
  refreshAdmin();
})();
