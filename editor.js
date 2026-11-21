import { isLocalPreview } from './preview-mode.js';
import { isOwner, verifiedOwnerClient } from './mail-access.js';
import { loadProfile, platforms, saveProfile } from './profile-content.js';

const $ = selector => document.querySelector(selector);
const form = $('#profile-editor');
const status = $('#editor-status');
const lock = $('#lock-editor');
const focusDestination = () => location.replace('index.html?connect=1');
let editClient;

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

    const profile = await loadProfile();
    $('#edit-name').value = profile.name;
    $('#edit-handle').value = profile.handle;
    $('#edit-note').value = profile.note;
    for (const [key, platform] of Object.entries(platforms)) {
      const pair = document.createElement('div');
      pair.className = 'editor-pair';
      pair.append(input(platform.label + ' handle', profile.links[key].handle, key + '-handle'),
        input(platform.label + ' URL', profile.links[key].href, key + '-url', 'url'));
      $('#edit-links').append(pair);
    }

    form.hidden = false;
    lock.hidden = false;
    status.textContent = isLocalPreview ? 'Edits are saved on this device.' : 'Changes appear on the public profile.';
  } catch (error) {
    status.textContent = error.message;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#save-profile');
  button.disabled = true;
  try {
    const links = Object.fromEntries(Object.keys(platforms).map(key => [
      key, { handle: $('#' + key + '-handle').value, href: $('#' + key + '-url').value }
    ]));
    await saveProfile({
      name: $('#edit-name').value,
      handle: $('#edit-handle').value,
      note: $('#edit-note').value,
      links
    }, editClient);
    status.textContent = isLocalPreview ? 'Profile saved on this device.' : 'Profile published.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

lock.addEventListener('click', async () => {
  if (isLocalPreview) sessionStorage.removeItem('mqmr-editor-preview');
  else {
    const { error } = await editClient.auth.signOut({ scope: 'local' });
    if (error) { status.textContent = 'Could not lock the editor. Try again.'; return; }
  }
  form.hidden = true;
  location.replace('index.html');
});

window.addEventListener('pagehide', () => { form.hidden = true; });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
init();
