import { isLocalPreview } from './preview-mode.js';
import { isOwner, lockOwner, verifiedOwnerClient } from './mail-access.js?v=quick';
import { loadProfileRecord, platforms, profileChangeKey, saveProfile } from './profile-content.js?v=themes';
import { manageDevices } from './device-client.js?v=quick';
import { appearanceLimits, applyAppearance, colorGroups, normalizeAppearance, renderTitle, socialColorLabels } from './profile-appearance.js';
import { cursorTrail } from './cursor-trail.js';
import { presetPalette, presetTextKeys, themePresets } from './profile-themes.js?v=quick';

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
const themePreview = $('#theme-preview');
const previewTrail = cursorTrail(themePreview, $('#preview-trail'));
const sliders = {
  endingDelay: { input: $('#edit-ending-delay'), output: $('#ending-delay-value'), format: value => value + ' ms' },
  wordSpacing: { input: $('#edit-word-spacing'), output: $('#word-spacing-value'), format: value => (value / 100).toFixed(2) + ' em' },
  handleGap: { input: $('#edit-handle-gap'), output: $('#handle-gap-value'), format: value => (value / 100).toFixed(2) + ' em' }
};

$('#edit-ending').maxLength = appearanceLimits.endingLength;
for (const [key, { input: slider }] of Object.entries(sliders)) Object.assign(slider, appearanceLimits[key]);

function colorChoice(label, key, value) {
  const wrapper = document.createElement('label');
  wrapper.className = 'color-choice';
  const control = document.createElement('input');
  control.type = 'color';
  control.setAttribute('aria-label', label + ' color');
  control.name = 'color-' + key;
  control.value = value;
  const hex = document.createElement('span');
  hex.className = 'color-value';
  hex.setAttribute('aria-hidden', 'true');
  hex.textContent = value;
  wrapper.append(label, hex, control);
  return wrapper;
}

function colorSection(title, parent, accordion) {
  const details = document.createElement('details');
  details.name = accordion;
  const summary = document.createElement('summary');
  summary.textContent = title;
  const content = document.createElement('div');
  details.append(summary, content);
  parent.append(details);
  return content;
}

const colorControls = $('#color-groups');
const themeDefaults = normalizeAppearance();
const paletteKey = ({ colors, social }, mode) => mode === 'text'
  ? JSON.stringify([presetTextKeys.map(key => colors[key]), Object.values(social).map(item => [item.handle, item.label])])
  : JSON.stringify([colors, social]);
const scope = $('#preset-scope');
let presetContext;
const presetButtons = themePresets.map(preset => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-preset';
  const swatches = document.createElement('span');
  swatches.className = 'theme-swatches';
  swatches.setAttribute('aria-hidden', 'true');
  for (const color of preset.swatches) {
    const chip = document.createElement('i');
    chip.style.backgroundColor = color;
    swatches.append(chip);
  }
  button.append(swatches, preset.name);
  button.onclick = () => {
    colorValues(presetPalette(preset, appearanceInputs(), scope.value));
    updatePreview();
    setDirty(true);
    status.textContent = preset.name + ' selected. Save profile to publish.';
  };
  $('#theme-presets').append(button);
  return { button, preset };
});
for (const [title, values] of Object.entries(colorGroups)) {
  const panel = colorSection(title, colorControls, 'page-colors');
  for (const [key, [label, color]] of Object.entries(values)) panel.append(colorChoice(label, key, color));
}
const socialColors = colorSection('Platform colors', colorControls, 'page-colors');
for (const [key, platform] of Object.entries(platforms)) {
  const panel = colorSection(platform.label, socialColors, 'platform-colors');
  for (const [field, label] of Object.entries(socialColorLabels)) {
    panel.append(colorChoice(platform.label + ' ' + label.toLowerCase(), key + '-' + field, themeDefaults.social[key][field]));
  }
}

function colorValues(appearance) {
  const controls = form.elements;
  for (const [key, value] of Object.entries(appearance.colors)) controls.namedItem('color-' + key).value = value;
  for (const [key, swatches] of Object.entries(appearance.social)) {
    for (const [field, value] of Object.entries(swatches)) controls.namedItem('color-' + key + '-' + field).value = value;
  }
}

function appearanceInputs() {
  const values = {};
  for (const color of colorControls.querySelectorAll('input[type="color"]')) values[color.name.slice(6)] = color.value;
  return normalizeAppearance({
    ending: { enabled: $('#edit-ending-enabled').checked, text: $('#edit-ending').value, delay: sliders.endingDelay.input.valueAsNumber },
    wordSpacing: sliders.wordSpacing.input.valueAsNumber,
    handleGap: sliders.handleGap.input.valueAsNumber,
    trail: $('#edit-trail').checked,
    colors: values,
    social: Object.fromEntries(Object.keys(platforms).map(key => [key, Object.fromEntries(
      Object.keys(socialColorLabels).map(field => [field, values[key + '-' + field]])
    )]))
  });
}

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
      const profileRequest = loadProfileRecord().catch(error => ({ error }));
      editClient = await verifiedOwnerClient();
      if (!editClient) return focusDestination();
      editClient.auth.onAuthStateChange((_event, session) => {
        if (!isOwner(session?.user, session?.access_token, true)) {
          editClient = null;
          form.hidden = true;
          focusDestination();
        }
      });
      const record = await profileRequest;
      if (!editClient) return;
      if (record.error) throw record.error;
      showEditor(record);
      manageDevices(editClient);
      return;
    }

    await loadEditor();
  } catch (error) {
    status.textContent = error.message;
    reload.hidden = false;
  }
}

async function loadEditor() {
  showEditor(await loadProfileRecord());
}

function showEditor(record) {
    const profile = record.profile;
    revision = record.revision;
    $('#edit-name').value = profile.name;
    $('#edit-handle').value = profile.handle;
    $('#edit-note').value = profile.note;
  const { appearance } = profile;
  $('#edit-ending-enabled').checked = appearance.ending.enabled;
  $('#edit-ending').value = appearance.ending.text;
  $('#edit-trail').checked = appearance.trail;
  sliders.endingDelay.input.value = appearance.ending.delay;
  sliders.wordSpacing.input.value = appearance.wordSpacing;
  sliders.handleGap.input.value = appearance.handleGap;
  colorValues(appearance);
    $('#edit-links').replaceChildren();
    for (const key of profile.order) $('#edit-links').append(accountRow(key, profile.links[key]));
    refreshMoveControls();
    form.hidden = false;
  updatePreview();
    lock.hidden = false;
    reload.hidden = true;
    setDirty(false);
    status.textContent = isLocalPreview ? 'Edits are saved on this device.' : 'Changes appear on the public profile.';
}

function updatePreview(animate = false) {
  const appearance = appearanceInputs();
  updatePresetSelection(appearance);
  renderTitle($('#edit-title-preview'), {
    name: $('#edit-name').value, handle: $('#edit-handle').value, appearance
  }, animate);
  $('#preview-note').textContent = $('#edit-note').value;
  for (const { input: slider, output, format } of Object.values(sliders)) {
    output.value = format(slider.valueAsNumber);
    slider.setAttribute('aria-valuetext', output.value);
  }
  for (const color of colorControls.querySelectorAll('input[type="color"]')) {
    color.previousElementSibling.textContent = color.value;
  }
  const rows = [...$('#edit-links').children].filter(row => $('#' + row.dataset.account + '-hidden').checked);
  $('#preview-social').hidden = !rows.length;
  $('#preview-accounts').replaceChildren(...rows.map(row => {
    const key = row.dataset.account;
    const item = document.createElement('li');
    const preview = document.createElement('div');
    preview.className = 'profile';
    preview.dataset.profile = key;
    const photo = row.querySelector('img').cloneNode();
    photo.className = 'profile-photo';
    const line = document.createElement('span');
    const handle = document.createElement('strong');
    const label = document.createElement('small');
    const icon = document.createElement('i');
    handle.textContent = $('#' + key + '-handle').value;
    handle.hidden = handle.textContent.toLowerCase() === platforms[key].label.toLowerCase();
    icon.className = 'platform-logo logo-' + key;
    icon.setAttribute('aria-hidden', 'true');
    label.append(icon, platforms[key].label);
    line.append(handle, label);
    preview.append(photo, line);
    item.append(preview);
    return item;
  }));
  applyAppearance(themePreview, appearance);
  previewTrail(appearance);
}

function updatePresetSelection(appearance) {
  const mode = scope.value;
  const context = mode === 'text' ? mode + appearance.colors.panel : mode;
  if (presetContext !== context) {
    for (const item of presetButtons) {
      item.key = paletteKey(normalizeAppearance(presetPalette(item.preset, appearance, mode)), mode);
    }
    presetContext = context;
  }
  const key = paletteKey(appearance, mode);
  for (const { button, key: presetKey } of presetButtons) button.setAttribute('aria-pressed', String(presetKey === key));
}

scope.addEventListener('change', () => updatePresetSelection(appearanceInputs()));

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
    updatePreview();
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
    updatePreview();
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
    updatePreview();
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
        updatePreview();
        status.textContent = 'Unsaved changes.';
      } finally { bitmap.close(); }
    } catch (error) { status.textContent = error.message; }
    finally { photoReads--; file.value = ''; file.disabled = reset.disabled = false; setDirty(true); }
  });
  row.append(heading, pair, visibility, fileLabel, reset);
  return row;
}

form.addEventListener('input', event => {
  if (event.target === scope) return;
  updatePreview();
  setDirty(true);
  if (!saving) status.textContent = 'Unsaved changes.';
});

$('#replay-title').onclick = () => updatePreview(true);
$('#reset-colors').onclick = () => {
  colorValues(themeDefaults);
  updatePreview();
  setDirty(true);
  status.textContent = 'Unsaved changes.';
};

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
  const controls = [...form.querySelectorAll('input,textarea,select,button')].filter(control => !control.disabled);
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
      appearance: appearanceInputs(),
      order: rows.map(row => row.dataset.account),
      links
    }, editClient, revision);
    setDirty(false);
    reload.hidden = true;
    status.textContent = isLocalPreview ? 'Profile saved on this device.' : 'Profile published.';
    try { localStorage.setItem(profileChangeKey, crypto.randomUUID()); } catch {}
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
