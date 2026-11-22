import { isLocalPreview } from './preview-mode.js';
import { url, publishableKey } from './mail-access.js';

const storageKey = 'mqr-profile-preview';
export const platforms = {
  github: { label: 'GitHub', hostnames: ['github.com', 'www.github.com'] },
  instagram: { label: 'Instagram', hostnames: ['instagram.com', 'www.instagram.com'] },
  youtube: { label: 'YouTube', hostnames: ['youtube.com', 'www.youtube.com'] },
  x: { label: 'X', hostnames: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'] },
  discord: { label: 'Discord', hostnames: ['discord.com', 'www.discord.com'] }
};

const defaults = {
  name: 'Ethan',
  handle: 'MqMr',
  note: 'Around the internet.',
  links: {
    github: { handle: '@MqMrMqR', href: 'https://github.com/MqMrMqR' },
    instagram: { handle: '@_.wp1', href: 'https://www.instagram.com/_.wp1/' },
    youtube: { handle: '@MqMr', href: 'https://www.youtube.com/@MqMr' },
    x: { handle: '@mqmrmqr', href: 'https://x.com/mqmrmqr' },
    discord: { handle: 'Discord', href: 'https://discord.com/users/1367578118830817420' }
  }
};

function field(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(label + ' must have between 1 and ' + maxLength + ' characters.');
  }
  return value.trim();
}

export function validateProfile(data) {
  const profile = {
    name: field(data?.name, 'Name', 32),
    handle: field(data?.handle, 'Display handle', 24),
    note: field(data?.note, 'Intro', 150),
    links: {}
  };
  for (const [key, platform] of Object.entries(platforms)) {
    const link = data.links?.[key];
    let address;
    try { address = new URL(field(link?.href, platform.label + ' URL', 400)); } catch {}
    if (!address || address.protocol !== 'https:' || address.username || address.password
        || !platform.hostnames.includes(address.hostname)) {
      throw new Error('Enter a valid https URL for ' + platform.label + '.');
    }
    profile.links[key] = {
      handle: field(link.handle, platform.label + ' handle', 48),
      href: address.href
    };
  }
  return profile;
}

function readLocalProfile() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return { profile: validateProfile(defaults), revision: null };
  const record = JSON.parse(saved);
  return { profile: validateProfile(record.profile || record), revision: record.revision || 1 };
}

export async function loadProfileRecord() {
  if (isLocalPreview) return readLocalProfile();
  const response = await fetch(url + '/rest/v1/profile_homepage?select=payload,revision&singleton=eq.true', {
    headers: { apikey: publishableKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(5500)
  });
  if (!response.ok) throw new Error('The profile settings could not be loaded.');
  const [record] = await response.json();
  return { profile: validateProfile(record?.payload || defaults), revision: record?.revision ?? null };
}

export async function loadProfile() {
  return (await loadProfileRecord()).profile;
}

export async function saveProfile(data, client, revision) {
  const profile = validateProfile(data);
  const conflict = () => new Error('The profile changed in another tab. Your edits are still here. Review the latest version before saving again.');
  if (isLocalPreview) {
    if (readLocalProfile().revision !== revision) throw conflict();
    const next = (revision || 0) + 1;
    localStorage.setItem(storageKey, JSON.stringify({ profile, revision: next }));
    return next;
  }
  const table = client.from('profile_homepage');
  const request = revision === null
    ? table.insert({ singleton: true, payload: profile })
    : table.update({ payload: profile }).eq('singleton', true).eq('revision', revision);
  const { data: saved, error } = await request.select('revision').maybeSingle();
  if (error?.code === '23505' || (!error && !saved)) throw conflict();
  if (error) throw new Error('Could not publish. Recheck your session and try again.');
  return saved.revision;
}
