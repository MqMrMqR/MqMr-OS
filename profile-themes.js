import { colorGroups, normalizeAppearance } from './profile-appearance.js';

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

// Designed in OKLCH, then saved as displayable sRGB values for the existing color controls.
const colorStudies = [
  ["Abyssal Ink", "#030f17 #051b27 #0a2a3b #19394c #e6f3fb #95bbcc #88daff #59d9e8 #a7d0f4 #89c3ff #51c1e0", "Analogous"],
  ["Ultramarine & Ochre", "#090f1e #101937 #1a274e #2e3c65 #eef3ff #a5b5d1 #b1c9ff #facc62 #ddb558 #90b1ff #f7dda4", "Complementary"],
  ["Copper & Patina", "#081012 #0c1f23 #102e35 #23434b #ebf6f9 #a0b9c1 #ffb9a8 #62d9f3 #fb967f #9fddec #ffd7ce", "Complementary"],
  ["Mulberry Nocturne", "#160a12 #281322 #3c1c33 #502c45 #faeff8 #c7acc2 #ffa9d8 #deadf4 #eac5eb #f689bb #ffcbda", "Analogous"],
  ["Green Phosphor", "#050d06 #091b0a #102811 #1f3d21 #def9de #91bf91 #63f570 #79d87e #adf6af #64c76a #93d995", "Monochromatic"],
  ["Prism After Dark", "#090e19 #101a2b #19263e #293a5a #eef4fe #a7b3cb #acc6ff #81e886 #ffa7a0 #adecae #ff9088", "Triadic"],
  ["Blue Hour Paper", "#d1e9f7 #f3faff #ddeffb #b8d2e4 #0b2332 #345668 #004e84 #005e75 #2c5f83 #164085 #115b7a", "Analogous"],
  ["Sumi & Persimmon", "#f4e3ca #fff7ec #f7e9d6 #d9c8af #132231 #5e4e3b #084b7c #774800 #814f00 #244e75 #764700", "Complementary"],
  ["Celadon Print", "#d3eee0 #edfdf5 #ddf3e9 #b4d8c6 #062318 #3a5649 #00593f #8d303a #704484 #5e346c #80303c", "Split-complementary"],
  ["Garnet Paper", "#f5e0df #fff7f6 #fce8e7 #e6c5c3 #381414 #6a4947 #8b1c26 #8f3a3b #803c3b #7a1c22 #8a393a", "Monochromatic"],
  ["Signal Cream", "#f2e5cd #fff9ec #faeed6 #d9caaf #122130 #425264 #004c86 #93133c #46641e #004a83 #8f2741", "Triadic"],
  ["Lilac & Brass", "#eae2f6 #fbf8ff #f0e9f9 #d3c8e4 #261b33 #584b6a #5b3489 #1e6130 #695605 #533177 #206535", "Split-complementary"],
];

const base = normalizeAppearance();
export const themePresets = [...colorStudies, ...themes].map(([name, values, harmony]) => {
  const [background, panel, nav, line, ink, muted, nameAccent, handleAccent, braceAccent, endingAccent, extraAccent] = values.split(' ');
  const swatches = [panel, nameAccent, handleAccent, braceAccent, endingAccent];
  if (name === 'Midnight Code') return { name, colors: base.colors, social: base.social, swatches };
  const colors = {
    'page-background': background, panel, 'nav-surface': nav, 'frame-line': line, line,
    'name-text': nameAccent, 'alias-text': handleAccent, 'brace-text': braceAccent, 'ending-text': endingAccent, 'caret-color': braceAccent,
    'intro-text': muted, 'comment-text': muted, 'wordmark-text': braceAccent, 'connect-text': ink,
    'connect-hover': endingAccent, 'access-text': panel, 'access-fill': ink, 'access-hover': nameAccent,
    'focus-color': endingAccent, 'social-title': braceAccent, 'trail-primary': nameAccent, 'trail-secondary': endingAccent, 'trail-tertiary': braceAccent
  };
  const accents = [nameAccent, extraAccent, braceAccent, muted, endingAccent];
  const social = Object.fromEntries(Object.keys(base.social).map((key, i) => [
    key, { handle: ink, label: accents[i], icon: accents[i], accent: accents[i] }
  ]));
  return { name, harmony, colors, social, swatches };
});

export const presetTextKeys = [...Object.keys(colorGroups['Title and intro']), 'social-title'];
const rgb = value => value.slice(1).match(/.{2}/g).map(channel => Number.parseInt(channel, 16));
const brightness = channels => channels.reduce((total, channel, index) => {
  const srgb = channel / 255;
  const linear = srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
  return total + linear * [.2126, .7152, .0722][index];
}, 0);

function readable(color, surface) {
  const original = rgb(color);
  const level = brightness(rgb(surface));
  const contrast = tone => (Math.max(tone, level) + .05) / (Math.min(tone, level) + .05);
  if (contrast(brightness(original)) >= 4.5) return color;
  const target = contrast(1) > contrast(0) ? 255 : 0;
  for (let weight = .1; weight < 1; weight += .1) {
    const adjusted = original.map(channel => Math.round(channel + (target - channel) * weight));
    if (contrast(brightness(adjusted)) >= 4.5) {
      return '#' + adjusted.map(channel => channel.toString(16).padStart(2, '0')).join('');
    }
  }
  return target === 255 ? '#ffffff' : '#000000';
}

export function presetPalette(preset, current, scope) {
  if (scope !== 'text') return { colors: preset.colors, social: preset.social };
  const backdrop = current.colors.panel;
  const colors = { ...current.colors };
  for (const key of presetTextKeys) colors[key] = readable(preset.colors[key], backdrop);
  const social = Object.fromEntries(Object.entries(current.social).map(([key, value]) => [
    key, { ...value, handle: readable(preset.social[key].handle, backdrop), label: readable(preset.social[key].label, backdrop) }
  ]));
  return { colors, social };
}
