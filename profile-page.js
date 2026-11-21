import { loadProfile } from './profile-content.js';

try {
  const profile = await loadProfile();
  document.querySelector('#profile-name').textContent = profile.name;
  document.querySelector('#profile-handle').textContent = profile.handle;
  document.querySelector('#profile-note').textContent = profile.note;
  const title = profile.name + ' {' + profile.handle + '}';
  document.title = title;
  document.querySelector('#name').style.setProperty('--characters', Math.min(48, Array.from(title).length));
  for (const [key, link] of Object.entries(profile.links)) {
    const anchor = document.querySelector('[data-profile="' + key + '"]');
    anchor.href = link.href;
    anchor.querySelector('strong').textContent = link.handle;
  }
} catch {
  // The static profile is usable during backend downtime.
}
