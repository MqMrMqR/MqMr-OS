import { loadProfile, platforms } from './profile-content.js?v=appearance';
import { applyAppearance, normalizeAppearance, renderTitle, titleText } from './profile-appearance.js';
import { cursorTrail } from './cursor-trail.js';

const site = document.querySelector('.profile-home');
const title = document.querySelector('#name');
const setTrail = cursorTrail(site, document.querySelector('#cursor-trail'));
let rendered;

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

try {
  const profile = await loadProfile();
  clearTimeout(fallback);
  applyAppearance(document.body, profile.appearance);
  document.querySelector('meta[name="theme-color"]').content = profile.appearance.colors['page-background'];
  setTrail(profile.appearance);
  showTitle(profile);
  document.querySelector('#profile-note').textContent = profile.note;
  const list = document.querySelector('.profile-list');
  for (const key of profile.order) {
    const link = profile.links[key];
    const anchor = document.querySelector('[data-profile="' + key + '"]');
    anchor.href = link.href;
    const handle = anchor.querySelector('strong');
    handle.textContent = link.handle;
    handle.hidden = link.handle.toLowerCase() === platforms[key].label.toLowerCase();
    if (link.photo) anchor.querySelector('.profile-photo').src = link.photo;
    anchor.parentElement.hidden = link.hidden;
    list.append(anchor.parentElement);
  }
  document.querySelector('.profiles').hidden = profile.order.every(key => profile.links[key].hidden);
} catch {
  // The static profile is usable during backend downtime.
}
