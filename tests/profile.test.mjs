import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, titleText } from '../profile-appearance.js';
import { presetPalette, presetTextKeys, themePresets } from '../profile-themes.js';

test('text-only themes change title, intro, and social names without restyling surrounding elements', () => {
  const before = normalizeAppearance({ colors: { 'page-background': '#123456', 'nav-surface': '#234567' }, social: { github: { icon: '#345678' } } });
  const paper = themePresets.find(theme => theme.name === 'Paper');
  const next = presetPalette(paper, before, 'text');
  assert.equal(next.colors['page-background'], '#123456');
  assert.equal(next.colors['nav-surface'], '#234567');
  assert.equal(next.colors['trail-primary'], before.colors['trail-primary']);
  assert.equal(next.social.github.icon, '#345678');
  assert.equal(next.social.github.accent, before.social.github.accent);
  assert.notEqual(next.colors['name-text'], before.colors['name-text']);
  assert.notEqual(next.colors['name-text'], paper.colors['name-text']);
  assert.notEqual(next.colors['intro-text'], before.colors['intro-text']);
  assert.notEqual(next.social.github.label, before.social.github.label);
});

test('presets provide distinct complete light and dark palettes', () => {
  assert.equal(themePresets.length, 28);
  assert.equal(themePresets.filter(theme => theme.harmony).length, 12);
  assert.equal(new Set(themePresets.map(theme => theme.colors.panel)).size, themePresets.length);
  for (const theme of themePresets) {
    const normalized = normalizeAppearance(theme);
    assert.deepEqual(normalized.colors, theme.colors);
    assert.deepEqual(normalized.social, theme.social);
  }
});

const rgb = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
const luminance = channels => channels
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const mix = (surface, accent, weight) => rgb(surface).map((value, index) =>
  value * (1 - weight) + rgb(accent)[index] * weight);

function assertContrast(theme, role, foreground, background, threshold = 4.5) {
  const fg = luminance(rgb(foreground));
  const bg = luminance(typeof background === 'string' ? rgb(background) : background);
  const ratio = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
  assert.ok(ratio >= threshold, `${theme} ${role}: ${ratio.toFixed(2)} below ${threshold}`);
}

test('researched palettes keep foregrounds readable on page, nav, and hover surfaces', () => {
  for (const { name, colors, social } of themePresets.filter(theme => theme.harmony)) {
    const { panel, 'nav-surface': nav } = colors;
    for (const key of presetTextKeys) assertContrast(name, key, colors[key], panel);
    assertContrast(name, 'Connect', colors['connect-text'], nav);
    assertContrast(name, 'Connect hover', colors['connect-hover'], mix(nav, colors['connect-hover'], .11));
    assertContrast(name, 'Wordmark hover', colors['wordmark-text'], mix(nav, colors['wordmark-text'], .12));
    assertContrast(name, 'Access', colors['access-text'], colors['access-fill']);
    assertContrast(name, 'Access hover', colors['access-text'], colors['access-hover']);
    assertContrast(name, 'Focus on page', colors['focus-color'], panel, 3);
    assertContrast(name, 'Focus on nav', colors['focus-color'], nav, 3);
    for (const [platform, roles] of Object.entries(social)) {
      const hover = mix(panel, roles.accent, .09);
      assertContrast(name, `${platform} handle`, roles.handle, panel);
      assertContrast(name, `${platform} label`, roles.label, panel);
      assertContrast(name, `${platform} label hover`, roles.label, hover);
      assertContrast(name, `${platform} icon hover`, roles.icon, hover, 3);
    }
  }
});

test('saved semicolon preference carries over to the configurable title ending', () => {
  const profile = { name: 'Ethan', handle: 'MqMr', appearance: normalizeAppearance(undefined, false) };
  assert.equal(titleText(profile), 'Ethan {MqMr}');
  profile.appearance = normalizeAppearance({ ending: { enabled: true, text: ' →', delay: 650 } }, false);
  assert.equal(titleText(profile), 'Ethan {MqMr} →');
  assert.equal(profile.appearance.ending.delay, 650);
});

test('the profile theme clamps spacing and delay, filters colors and keeps platform overrides separate', () => {
  const theme = normalizeAppearance({
    ending: { delay: -10 },
    wordSpacing: 200,
    handleGap: 28,
    colors: { 'name-text': '#AABBCC', 'alias-text': 'url(example.test)', bogus: '#abcdef' },
    social: { github: { icon: '#112233' }, discord: { accent: '#abcdef' } }
  });
  assert.equal(theme.ending.delay, 0);
  assert.equal(theme.wordSpacing, 45);
  assert.equal(theme.handleGap, 28);
  assert.equal(theme.colors['name-text'], '#aabbcc');
  assert.equal(theme.colors['alias-text'], normalizeAppearance().colors['alias-text']);
  assert.equal(Object.hasOwn(theme.colors, 'bogus'), false);
  assert.equal(theme.social.github.icon, '#112233');
  assert.equal(theme.social.discord.accent, '#abcdef');
  assert.notEqual(theme.social.discord.icon, theme.social.github.icon);
});
