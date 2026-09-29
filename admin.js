const statusText = document.getElementById('status');
const editor = document.getElementById('editor');
const contentInput = document.getElementById('content');
const documentSelect = document.getElementById('document');
let revision = null;
let loadedPath = null;
let baseline = '';
async function loadDocument() {
  const path = documentSelect.value;
  document.getElementById('save').disabled = true;
  try {
    const { data, error } = await siteBackend.from('site_content').select('content,updated_at').eq('path', path).maybeSingle();
    if (error) throw error;
    const fallback = data ? null : await fetch(path);
    if (fallback && !fallback.ok) throw new Error('Bundled document could not be loaded.');
    contentInput.value = JSON.stringify(data ? data.content : await fallback.json(), null, 2);
    revision = data?.updated_at || null; loadedPath = path; baseline = contentInput.value;
    statusText.textContent = 'Loaded ' + path;
    document.getElementById('save').disabled = false;
  } catch (error) { statusText.textContent = error.message; }
}
async function refreshAdmin() {
  if (!window.siteBackend) { statusText.textContent = 'Sign-in service unavailable. Reload to retry.'; return; }
  const {data, error} = await siteBackend.auth.getUser();
  const user = error ? null : data.user;
  const allowed = user?.app_metadata?.role === 'admin';
  editor.hidden = !allowed;
  document.getElementById('login').hidden = !!user;
  document.getElementById('logout').hidden = !user;
  statusText.textContent = allowed ? 'Admin session verified.' : user ? 'This account has no administrator access.' : 'Sign in with the administrator account.';
  if (allowed && !loadedPath) await loadDocument();
  if (!allowed) { contentInput.value = ''; loadedPath = null; baseline = ''; }
}
document.getElementById('login').onclick = async () => { try { await signInToSite(); } catch (error) { statusText.textContent = error.message; } };
document.getElementById('logout').onclick = async () => { const {error} = await siteBackend.auth.signOut(); if (error) statusText.textContent = error.message; else refreshAdmin(); };
document.getElementById('load').onclick = () => { if (contentInput.value === baseline || confirm('Discard unsaved edits?')) loadDocument(); };
documentSelect.onchange = () => { if (contentInput.value === baseline || confirm('Discard unsaved edits?')) loadDocument(); else documentSelect.value = loadedPath; };
document.getElementById('save').onclick = async () => {
  const button = document.getElementById('save'); button.disabled = true;
  try {
    if (loadedPath !== documentSelect.value) throw new Error('Reload this document before publishing.');
    const content = JSON.parse(contentInput.value);
    if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('The document must be a JSON object.');
    const original = JSON.parse(baseline);
    for (const key of Object.keys(original)) if (!(key in content) || typeof content[key] !== typeof original[key] || Array.isArray(content[key]) !== Array.isArray(original[key])) throw new Error('Keep the structure of field: ' + key);
    const row = { path: loadedPath, content, updated_at: new Date().toISOString() };
    const query = revision ? siteBackend.from('site_content').update(row).eq('path', loadedPath).eq('updated_at', revision) : siteBackend.from('site_content').insert(row);
    const {data, error} = await query.select('updated_at').single();
    if (error) throw error;
    revision = data.updated_at; baseline = contentInput.value;
    statusText.textContent = 'Published successfully. Reload the desktop to see changes.';
  } catch (error) { statusText.textContent = 'Not published: ' + error.message + ' If another edit was published, back up your edits and reload.'; }
  finally { button.disabled = false; }
};
document.getElementById('backup').onclick = () => {
  const url = URL.createObjectURL(new Blob([contentInput.value], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = loadedPath.replaceAll('/', '-'); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener('beforeunload', event => { if (contentInput.value !== baseline) { event.preventDefault(); event.returnValue = ''; } });
if (window.siteBackend) siteBackend.auth.onAuthStateChange(() => setTimeout(refreshAdmin, 0));
refreshAdmin();
