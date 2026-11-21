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

export async function loadProfile() {
  if (isLocalPreview) {
    const saved = localStorage.getItem(storageKey);
    return saved ? validateProfile(JSON.parse(saved)) : validateProfile(defaults);
  }
  const response = await fetch(url + '/rest/v1/profile_homepage?select=payload&singleton=eq.true', {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(2500)
  });
  if (!response.ok) throw new Error('The profile settings could not be loaded.');
  const [record] = await response.json();
  return validateProfile(record?.payload || defaults);
}

export async function saveProfile(data, client) {
  const profile = validateProfile(data);
  if (isLocalPreview) {
    localStorage.setItem(storageKey, JSON.stringify(profile));
    return;
  }
  const { error } = await client.from('profile_homepage').upsert({ singleton: true, payload: profile });
  if (error) throw new Error('Could not publish. Recheck your session and try again.');
}
