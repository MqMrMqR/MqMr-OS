export const colorGroups = {
  'Title and intro': {
    'name-text': ['Name', '#a5d6ff'],
    'alias-text': ['Handle', '#7ee2c4'],
    'brace-text': ['Braces', '#e9d491'],
    'ending-text': ['Title ending', '#c5a5f1'],
    'caret-color': ['Typing caret', '#e9d491'],
    'intro-text': ['Intro', '#a6a3aa'],
    'comment-text': ['Comment marker', '#8fa0b5']
  },
  'Page and navigation': {
    'page-background': ['Outer background', '#101010'],
    'panel': ['Page surface', '#141414'],
    'frame-line': ['Page and navigation borders', '#28282a'],
    'line': ['Social dividers', '#2c2b2e'],
    'nav-surface': ['Navigation background', '#1a1a1a'],
    'wordmark-text': ['MqR wordmark', '#e9d491'],
    'connect-text': ['Connect text', '#d5d3da'],
    'connect-hover': ['Connect hover text', '#c5a5f1'],
    'access-text': ['Access text', '#171618'],
    'access-fill': ['Access background', '#f6f5f6'],
    'access-hover': ['Access hover background', '#eee3fa'],
    'focus-color': ['Keyboard focus', '#c5a5f1'],
    'social-title': ['Social heading', '#e9d491']
  },
  'Cursor trail': {
    'trail-primary': ['Main strand', '#8bd8ff'],
    'trail-secondary': ['Second strand', '#ba9af4'],
    'trail-tertiary': ['Third strand', '#edcc80']
  }
};

export const platformColors = {
  github: '#a5d6ff',
  instagram: '#eea3c8',
  youtube: '#ff9c95',
  x: '#cbd2dd',
  discord: '#b6a8ff'
};

export const socialColorLabels = { handle: 'Account name', label: 'Platform name', icon: 'Logo', accent: 'Hover highlight' };
const palette = Object.fromEntries(Object.values(colorGroups).flatMap(group =>
  Object.entries(group).map(([key, [, color]]) => [key, color])
));
const defaultSocial = Object.fromEntries(Object.entries(platformColors).map(([key, accent]) =>
  [key, { handle: '#f3f2f2', label: accent, icon: accent, accent }]
));

export const appearanceLimits = {
  endingLength: 12,
  endingDelay: { min: 0, max: 2000, step: 50 },
  wordSpacing: { min: 0, max: 45, step: 1 },
  handleGap: { min: 0, max: 120, step: 1 }
};

function bounded(value, limits, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

function colors(values, fallback) {
  return Object.fromEntries(Object.entries(fallback).map(([key, value]) => {
    const input = values?.[key];
    return [key, typeof input === 'string' && /^#[a-f0-9]{6}$/i.test(input) ? input.toLowerCase() : value];
  }));
}

export function normalizeAppearance(value, legacySemicolon) {
  const text = typeof value?.ending?.text === 'string'
    ? value.ending.text.replace(/[\r\n\t]/g, ' ').slice(0, appearanceLimits.endingLength) : ';';
  return {
    ending: {
      enabled: typeof value?.ending?.enabled === 'boolean' ? value.ending.enabled : legacySemicolon !== false,
      text,
      delay: bounded(value?.ending?.delay, appearanceLimits.endingDelay, 500)
    },
    wordSpacing: bounded(value?.wordSpacing, appearanceLimits.wordSpacing, 0),
    handleGap: bounded(value?.handleGap, appearanceLimits.handleGap, 60),
    trail: value?.trail !== false,
    colors: colors(value?.colors, palette),
    social: Object.fromEntries(Object.entries(defaultSocial).map(([key, fallback]) =>
      [key, colors(value?.social?.[key], fallback)]
    ))
  };
}

export function applyAppearance(element, appearance) {
  element.style.setProperty('--word-space', appearance.wordSpacing / 100 + 'em');
  element.style.setProperty('--handle-gap', appearance.handleGap / 100 + 'em');
  for (const [key, value] of Object.entries(appearance.colors)) element.style.setProperty('--' + key, value);
  for (const row of element.querySelectorAll('[data-profile]')) {
    for (const [key, value] of Object.entries(appearance.social[row.dataset.profile])) {
      row.style.setProperty('--social-' + key, value);
    }
  }
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = value => segmenter ? [...segmenter.segment(value)].map(item => item.segment) : Array.from(value);
const titleTimers = new WeakMap();

export function titleText({ name, handle, appearance: { ending } }) {
  return name + ' {' + handle + '}' + (ending.enabled ? ending.text : '');
}

export function renderTitle(element, profile, animate) {
  const { name, handle, appearance: { ending } } = profile;
  clearTimeout(titleTimers.get(element));
  titleTimers.delete(element);
  const parts = document.createElement('span');
  parts.className = 'title-parts';
  const text = titleText(profile);
  parts.setAttribute('aria-hidden', 'true');
  element.setAttribute('aria-label', text);

  const timeline = [];
  const interval = Math.min(85, 1250 / Math.max(1, graphemes(name + '{' + handle + '}').length));
  let time = 100;
  function add(parent, value, className) {
    const segment = document.createElement('span');
    segment.className = className;
    for (const char of graphemes(value)) {
      if (/^\s+$/u.test(char)) {
        segment.append(char);
        continue;
      }
      const node = document.createElement('span');
      node.className = 'title-character';
      node.textContent = char;
      segment.append(node);
      timeline.push({ node, time });
      time += interval;
    }
    parent.append(segment);
  }
  add(parts, name, 'name-text');
  const gap = document.createElement('span');
  gap.className = 'title-gap';
  gap.textContent = ' ';
  parts.append(gap);
  const alias = document.createElement('span');
  alias.className = 'name-alias';
  add(alias, '{', 'name-brace');
  add(alias, handle, 'name-handle');
  add(alias, '}', 'name-brace');
  if (ending.enabled && ending.text.trim()) {
    time += ending.delay - interval;
    add(alias, ending.text, 'name-ending');
  }
  parts.append(alias);
  const typing = animate && matchMedia('(prefers-reduced-motion: no-preference)').matches;
  if (typing) timeline.forEach(({ node }) => node.classList.add('title-pending'));
  element.replaceChildren(parts);
  if (!typing) return;

  const started = performance.now();
  let next = 0;
  let active;
  function reveal() {
    const elapsed = performance.now() - started;
    while (next < timeline.length && timeline[next].time <= elapsed) {
      active?.classList.remove('title-active');
      active = timeline[next++].node;
      active.classList.replace('title-pending', 'title-active');
    }
    if (next < timeline.length) {
      titleTimers.set(element, setTimeout(reveal, Math.ceil(timeline[next].time - elapsed)));
    } else {
      titleTimers.set(element, setTimeout(() => {
        active.classList.remove('title-active');
        titleTimers.delete(element);
      }, 260));
    }
  }
  titleTimers.set(element, setTimeout(reveal, timeline[0].time));
}
