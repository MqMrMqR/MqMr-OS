import { isLocalPreview } from './preview-mode.js';
import { isOwner, lockOwner, verifiedOwnerClient } from './mail-access.js';
import { loadProfileRecord, platforms, saveProfile } from './profile-content.js';
import { manageDevices } from './device-client.js';

const $ = selector => document.querySelector(selector);
const form = $('#profile-editor');
const status = $('#editor-status');
const lock = $('#lock-editor');
const reload = $('#reload-profile');
const focusDestination = () => location.replace('index.html?connect=1');
let editClient;
let revision = null, dirty = false, saving = false;
const existingPhotos = { x: 'x', github: 'mqmr', instagram: 'instagram', youtube: 'youtube', discord: 'youtube' };
let dragged = null, photoReads = 0;

function setDirty(value) {
  dirty = value;
  $('#save-profile').disabled = saving || !dirty || photoReads > 0;
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
    if (!isLocalPreview) manageDevices(editClient);
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
    $('#edit-semicolon').checked = profile.showSemicolon;
    $('#edit-links').replaceChildren();
    for (const key of profile.order) $('#edit-links').append(accountRow(key, profile.links[key]));
    refreshMoveControls();
    updateTitlePreview();

    form.hidden = false;
    lock.hidden = false;
    reload.hidden = true;
    setDirty(false);
    status.textContent = isLocalPreview ? 'Edits are saved on this device.' : 'Changes appear on the public profile.';
}

function updateTitlePreview() {
  $('#edit-title-preview').textContent = $('#edit-name').value + ' {' + $('#edit-handle').value + '}' +
    ($('#edit-semicolon').checked ? ';' : '');
}

function refreshMoveControls() {
  const rows = [...$('#edit-links').children];
  rows.forEach((row, index) => {
    row.querySelector('[data-move="up"]').disabled = index === 0;
    row.querySelector('[data-move="down"]').disabled = index === rows.length - 1;
  });
}

function accountRow(key, link) {
  const platform = platforms[key].label;
  const row = document.createElement('section');
  row.className = 'editor-account';
  row.dataset.account = key;
  row.dataset.photo = link.photo;

  const heading = document.createElement('div');
  heading.className = 'account-heading';
  const image = document.createElement('img');
  const defaultPhoto = 'profiles/' + existingPhotos[key] + '.webp';
  image.src = link.photo || defaultPhoto;
  image.alt = '';
  const name = document.createElement('strong');
  name.textContent = platform;
  const button = (label, text, action) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = text;
    control.setAttribute('aria-label', label);
    control.onclick = action;
    return control;
  };
  const move = direction => {
    const neighbor = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
    if (!neighbor) return;
    if (direction === 'up') neighbor.before(row);
    else neighbor.after(row);
    refreshMoveControls();
    (row.querySelector('[data-move="' + direction + '"]:enabled') || name).focus();
    setDirty(true);
  };
  name.tabIndex = -1;
  const up = button('Move ' + platform + ' up', '↑', () => move('up'));
  const down = button('Move ' + platform + ' down', '↓', () => move('down'));
  up.dataset.move = 'up';
  down.dataset.move = 'down';
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.draggable = true;
  handle.textContent = '⋮⋮';
  handle.setAttribute('aria-hidden', 'true');
  handle.addEventListener('dragstart', event => {
    if (saving) { event.preventDefault(); return; }
    dragged = row;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  });
  handle.addEventListener('dragend', () => { dragged = null; });
  row.addEventListener('dragover', event => { if (dragged && dragged !== row) event.preventDefault(); });
  row.addEventListener('drop', event => {
    if (saving || !dragged || dragged === row) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) row.before(dragged);
    else row.after(dragged);
    refreshMoveControls();
    dragged = null;
    setDirty(true);
  });
  heading.append(handle, image, name, up, down);

  const pair = document.createElement('div');
  pair.className = 'editor-pair';
  pair.append(input(platform + ' handle', link.handle, key + '-handle'),
    input(platform + ' URL', link.href, key + '-url', 'url'));

  const visibility = document.createElement('label');
  visibility.className = 'check-row';
  const hidden = document.createElement('input');
  hidden.type = 'checkbox';
  hidden.id = key + '-hidden';
  hidden.setAttribute('aria-label', 'Show ' + platform + ' on public profile');
  hidden.checked = !link.hidden;
  visibility.append(hidden, ' Show on public profile');

  const fileLabel = document.createElement('label');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp';
  fileLabel.append('Change ' + platform + ' photo', file);
  const reset = button('Restore original ' + platform + ' photo', 'Restore original', () => {
    row.dataset.photo = '';
    image.src = defaultPhoto;
    setDirty(true);
  });
  file.addEventListener('change', async () => {
    const selection = file.files[0];
    if (!selection) return;
    photoReads++;
    setDirty(true);
    file.disabled = reset.disabled = true;
    try {
      if (selection.size > 5_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(selection.type)) {
        throw new Error('Choose a PNG, JPEG or WebP image under 5 MB.');
      }
      const bitmap = await createImageBitmap(selection);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        const edge = Math.min(bitmap.width, bitmap.height);
        canvas.getContext('2d').drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2,
          edge, edge, 0, 0, 160, 160);
        const photo = canvas.toDataURL('image/webp', .72);
        if (!photo.startsWith('data:image/webp;') || photo.length > 24000) throw new Error('This photo is too large. Choose a simpler image.');
        row.dataset.photo = photo;
        image.src = photo;
        status.textContent = 'Unsaved changes.';
      } finally { bitmap.close(); }
    } catch (error) { status.textContent = error.message; }
    finally { photoReads--; file.value = ''; file.disabled = reset.disabled = false; setDirty(true); }
  });
  row.append(heading, pair, visibility, fileLabel, reset);
  return row;
}

form.addEventListener('input', () => {
  updateTitlePreview();
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
  if (saving || !dirty || photoReads) return;
  saving = true;
  setDirty(true);
  const controls = [...form.querySelectorAll('input,textarea,button')].filter(control => !control.disabled);
  controls.forEach(control => { control.disabled = true; });
  try {
    const rows = [...$('#edit-links').children];
    const links = Object.fromEntries(rows.map(row => {
      const key = row.dataset.account;
      return [key, { handle: $('#' + key + '-handle').value, href: $('#' + key + '-url').value,
        hidden: !$('#' + key + '-hidden').checked, photo: row.dataset.photo }];
    }));
    revision = await saveProfile({
      name: $('#edit-name').value,
      handle: $('#edit-handle').value,
      note: $('#edit-note').value,
      showSemicolon: $('#edit-semicolon').checked,
      order: rows.map(row => row.dataset.account),
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
    controls.forEach(control => { control.disabled = false; });
    setDirty(dirty);
    refreshMoveControls();
  }
});

lock.addEventListener('click', async () => {
  if (saving || (dirty && !confirm('Lock the editor and discard the unsaved changes?'))) return;
  if (isLocalPreview) sessionStorage.removeItem('mqmr-editor-preview');
  else {
    try { await lockOwner(editClient); }
    catch { status.textContent = 'Could not lock the editor. Try again.'; return; }
  }
  form.hidden = true;
  setDirty(false);
  location.replace('index.html');
});

window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = true; } });
window.addEventListener('pagehide', () => { form.hidden = true; });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
init();
