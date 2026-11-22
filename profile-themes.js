import { normalizeAppearance } from './profile-appearance.js';

// Outer, panel, nav, line, ink, muted, then five syntax accents.
const themes = [
  ['Midnight Code', '#101010 #141414 #1a1a1a #2c2b2e #f3f2f2 #a6a3aa #a5d6ff #7ee2c4 #e9d491 #c5a5f1 #ff9c95'],
  ['Indigo Dusk', '#101126 #171b32 #212643 #353b64 #e9ecff #a7afcc #a6b6ff #8ee6d0 #ffcf8b #c5a8ff #ff9fbc'],
  ['Glacier', '#10191f #16242e #1d303d #344d5c #eef8fc #adc0cd #a4ddff #8de4d9 #ffd89d #c6baff #ffa8b5'],
  ['Boreal Forest', '#0d1914 #13251d #1d3228 #354b41 #eff8ee #a9c2af #a0d7ff #9ce3a8 #f4d79a #dac1f8 #f8ac99'],
  ['Ember', '#1c1112 #27191a #332222 #543538 #fff0ea #d0aeaa #ffb995 #f4d383 #ffaeaa #e7b7ff #a4dfd1'],
  ['Soft Plum', '#1a1422 #241b30 #30233f #483559 #f9efff #c0adcb #e1bdff #a1dfd6 #f8d697 #f7aeda #b4cbff'],
  ['Deep Ocean', '#0b1719 #102428 #19363d #305056 #ebfbf9 #a5c5c5 #89dcee #9ae2ae #f5d395 #c0b8ff #ffa5a2'],
  ['Espresso', '#1b1511 #261e18 #35291f #534131 #fbede2 #cfb8a1 #ffca96 #b9d59b #ffdf9d #e0bdf5 #ffa6a0'],
  ['Graphite', '#111418 #191d23 #242a32 #3a424d #f3f5f8 #abb3bd #dde3eb #add7c9 #f2d59b #cdc0ee #e5afaf'],
  ['Ultraviolet', '#150d26 #20123a #2b1b4e #4a3670 #faefff #c2abd7 #b7bfff #91f0d4 #f8dd8f #e8aeff #ff9cbc'],
  ['Citrus Ink', '#131610 #1c2218 #283225 #3c4b33 #f4f5e8 #b6bda4 #d6ec91 #9ed9b9 #ffd685 #d0b9ee #f9ae93'],
  ['Desert Rose', '#211418 #2d1c23 #3d2731 #573945 #fff1f2 #caaeaf #ffc0cc #b1dbc5 #f5d1a3 #d2b4f3 #f9a88e'],
  ['Paper', '#ebe8df #faf8f0 #f0ede3 #d6d0c1 #27251e #605b4d #1b4f96 #17694d #77500e #6d489c #9b3b4a'],
  ['Lavender Mist', '#e8e3f3 #f7f3fe #eee8fb #d4c8e7 #30243c #655971 #484297 #166653 #795017 #773584 #9a3f63'],
  ['Porcelain Blue', '#e2ebf3 #f2f8fc #e8f1f8 #c8d7e4 #233349 #50657b #174f93 #166763 #775314 #5e4a99 #a03750'],
  ['Matcha Cream', '#e8ebdd #f6f8ef #ecf0e1 #cbd6bd #28352d #4d6151 #245d75 #2a653a #77511d #62528c #9a4350']
];

const base = normalizeAppearance();
export const themePresets = themes.map(([name, values], index) => {
  const [background, panel, nav, line, ink, muted, blue, mint, gold, violet, rose] = values.split(' ');
  const swatches = [panel, blue, mint, gold, violet];
  if (!index) return { name, colors: base.colors, social: base.social, swatches };
  const colors = {
    'page-background': background, panel, 'nav-surface': nav, 'frame-line': line, line,
    'name-text': blue, 'alias-text': mint, 'brace-text': gold, 'ending-text': violet, 'caret-color': gold,
    'intro-text': muted, 'comment-text': muted, 'wordmark-text': gold, 'connect-text': ink,
    'connect-hover': violet, 'access-text': panel, 'access-fill': ink, 'access-hover': blue,
    'focus-color': violet, 'social-title': gold, 'trail-primary': blue, 'trail-secondary': violet, 'trail-tertiary': gold
  };
  const accents = [blue, rose, gold, muted, violet];
  const social = Object.fromEntries(Object.keys(base.social).map((key, i) => [
    key, { handle: ink, label: accents[i], icon: accents[i], accent: accents[i] }
  ]));
  return { name, colors, social, swatches };
});
