import { loadProfile } from './profile-content.js';

const site = document.querySelector('.site');
const followPointer = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let frame = null;
let position;
site.addEventListener('pointermove', event => {
  if (!followPointer.matches || event.pointerType !== 'mouse') return;
  position = { x: event.clientX, y: event.clientY };
  if (frame !== null) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    const bounds = site.getBoundingClientRect();
    site.style.setProperty('--glow-x', (position.x - bounds.left) + 'px');
    site.style.setProperty('--glow-y', (position.y - bounds.top) + 'px');
    site.dataset.glow = 'true';
  });
});
function clearGlow() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  delete site.dataset.glow;
}
site.addEventListener('pointerleave', clearGlow);
followPointer.addEventListener('change', clearGlow);

try {
  const profile = await loadProfile();
  document.querySelector('#profile-name').textContent = profile.name;
  document.querySelector('#profile-handle').textContent = profile.handle;
  document.querySelector('#profile-note').textContent = profile.note;
  document.querySelector('#profile-semicolon').hidden = !profile.showSemicolon;
  const title = profile.name + ' {' + profile.handle + '}' + (profile.showSemicolon ? ';' : '');
  document.title = title;
  document.querySelector('#name').style.setProperty('--characters', Math.min(48, Array.from(title).length));
  const list = document.querySelector('.profile-list');
  for (const key of profile.order) {
    const link = profile.links[key];
    const anchor = document.querySelector('[data-profile="' + key + '"]');
    anchor.href = link.href;
    anchor.querySelector('strong').textContent = link.handle;
    if (link.photo) anchor.querySelector('img').src = link.photo;
    anchor.parentElement.hidden = link.hidden;
    list.append(anchor.parentElement);
  }
  document.querySelector('.profiles').hidden = profile.order.every(key => profile.links[key].hidden);
} catch {
  // The static profile is usable during backend downtime.
}
