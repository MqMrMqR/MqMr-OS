import { isLocalPreview } from './preview-mode.js';
import { isOwner, verifiedOwnerClient } from './mail-access.js';
import { loadProfileRecord, platforms, saveProfile } from './profile-content.js';

const $ = selector => document.querySelector(selector);
const form = $('#profile-editor');
const status = $('#editor-status');
const lock = $('#lock-editor');
const reload = $('#reload-profile');
const focusDestination = () => location.replace('index.html?connect=1');
let editClient;
let revision = null, dirty = false, saving = false;

function setDirty(value) {
  dirty = value;
  $('#save-profile').disabled = saving || !dirty;
}

function input(label, value, id, type = 'text') {
  const wrapper = document.createElement('label');
  const control = document.createElement('input');
  control.id = id;
  control.type = type;
  control.maxLength = type === 'url' ? 400 : 48;
  control.value = value;
  control.required = true;
  wrapper.append(label, control);
  return wrapper;
}

async function init() {
  if (window.self !== window.top) {
    status.textContent = 'Open the editor directly to sign in.';
    return;
  }
  try {
    if (isLocalPreview) {
      if (sessionStorage.getItem('mqmr-editor-preview') !== '1') return focusDestination();
    } else {
      editClient = await verifiedOwnerClient();
      if (!editClient) return focusDestination();
      editClient.auth.onAuthStateChange((_event, session) => {
        if (!isOwner(session?.user, session?.access_token, true)) {
          form.hidden = true;
          focusDestination();
        }
      });
    }

    await loadEditor();
  } catch (error) {
    status.textContent = error.message;
    reload.hidden = false;
  }
}

async function loadEditor() {
    const record = await loadProfileRecord();
    const profile = record.profile;
    revision = record.revision;
    $('#edit-name').value = profile.name;
    $('#edit-handle').value = profile.handle;
    $('#edit-note').value = profile.note;
    $('#edit-links').replaceChildren();
    for (const [key, platform] of Object.entries(platforms)) {
      const pair = document.createElement('div');
      pair.className = 'editor-pair';
      pair.append(input(platform.label + ' handle', profile.links[key].handle, key + '-handle'),
        input(platform.label + ' URL', profile.links[key].href, key + '-url', 'url'));
      $('#edit-links').append(pair);
    }

    form.hidden = false;
    lock.hidden = false;
    reload.hidden = true;
    setDirty(false);
    status.textContent = isLocalPreview ? 'Edits are saved on this device.' : 'Changes appear on the public profile.';
}

form.addEventListener('input', () => {
  setDirty(true);
  if (!saving) status.textContent = 'Unsaved changes.';
});

reload.addEventListener('click', async () => {
  if (saving || (dirty && !confirm('Replace your unsaved edits with the latest published profile?'))) return;
  reload.disabled = true;
  try {
    if (isLocalPreview || editClient) await loadEditor();
    else await init();
  } catch (error) { status.textContent = error.message; }
  finally { reload.disabled = false; }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || !dirty) return;
  saving = true;
  setDirty(true);
  const controls = [...form.querySelectorAll('input,textarea')];
  controls.forEach(control => { control.disabled = true; });
  try {
    const links = Object.fromEntries(Object.keys(platforms).map(key => [
      key, { handle: $('#' + key + '-handle').value, href: $('#' + key + '-url').value }
    ]));
    revision = await saveProfile({
      name: $('#edit-name').value,
      handle: $('#edit-handle').value,
      note: $('#edit-note').value,
      links
    }, editClient, revision);
    setDirty(false);
    reload.hidden = true;
    status.textContent = isLocalPreview ? 'Profile saved on this device.' : 'Profile published.';
  } catch (error) {
    status.textContent = error.message;
    reload.hidden = false;
  } finally {
    saving = false;
    setDirty(dirty);
    controls.forEach(control => { control.disabled = false; });
  }
});

lock.addEventListener('click', async () => {
  if (saving || (dirty && !confirm('Lock the editor and discard the unsaved changes?'))) return;
  if (isLocalPreview) sessionStorage.removeItem('mqmr-editor-preview');
  else {
    const { error } = await editClient.auth.signOut({ scope: 'local' });
    if (error) { status.textContent = 'Could not lock the editor. Try again.'; return; }
  }
  form.hidden = true;
  setDirty(false);
  location.replace('index.html');
});

window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = true; } });
window.addEventListener('pagehide', () => { form.hidden = true; });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
init();
