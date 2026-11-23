import { loadProfileRecord, platforms, profileChangeKey } from './profile-content.js?v=quick';
import { applyAppearance, normalizeAppearance, renderTitle, titleText } from './profile-appearance.js';
import { cursorTrail } from './cursor-trail.js';

const site = document.querySelector('.profile-home');
const title = document.querySelector('#name');
const setTrail = cursorTrail(site, document.querySelector('#cursor-trail'));
let rendered;
let revision;
let request = 0;
const list = document.querySelector('.profile-list');
const originalPhotos = Object.fromEntries([...list.querySelectorAll('[data-profile]')]
  .map(anchor => [anchor.dataset.profile, anchor.querySelector('.profile-photo').getAttribute('src')]));

function showTitle(profile) {
  const text = titleText(profile);
  const { ending: { delay } } = profile.appearance;
  if (rendered?.text === text && rendered.delay === delay) return;
  renderTitle(title, profile, true);
  document.title = text;
  rendered = { text, delay };
}

const fallback = setTimeout(() => {
  const appearance = normalizeAppearance();
  setTrail(appearance);
  showTitle({ name: 'Ethan', handle: 'MqMr', appearance });
}, 390);

async function refreshProfile() {
  const ticket = ++request;
  try {
    const record = await loadProfileRecord();
    if (ticket !== request || revision === record.revision) return;
    const { profile } = record;
    clearTimeout(fallback);
    applyAppearance(document.body, profile.appearance);
    document.querySelector('meta[name="theme-color"]').content = profile.appearance.colors['page-background'];
    setTrail(profile.appearance);
    showTitle(profile);
    document.querySelector('#profile-note').textContent = profile.note;
    profile.order.forEach((key, index) => {
      const link = profile.links[key];
      const anchor = list.querySelector('[data-profile="' + key + '"]');
      anchor.href = link.href;
      const handle = anchor.querySelector('strong');
      handle.textContent = link.handle;
      handle.hidden = link.handle.toLowerCase() === platforms[key].label.toLowerCase();
      anchor.querySelector('.profile-photo').src = link.photo || originalPhotos[key];
      const row = anchor.parentElement;
      row.hidden = link.hidden;
      if (list.children[index] !== row) list.insertBefore(row, list.children[index]);
    });
    document.querySelector('.profiles').hidden = profile.order.every(key => profile.links[key].hidden);
    revision = record.revision;
  } catch {
    // The existing profile remains visible during backend downtime.
  }
}

window.addEventListener('storage', event => { if (event.key === profileChangeKey) refreshProfile(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProfile(); });
window.addEventListener('pageshow', event => { if (event.persisted) refreshProfile(); });
refreshProfile();
