import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, titleText } from '../profile-appearance.js';
import { presetPalette, themePresets } from '../profile-themes.js';

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
  assert.equal(themePresets.length, 16);
  assert.equal(new Set(themePresets.map(theme => theme.colors.panel)).size, 16);
  for (const theme of themePresets) {
    const normalized = normalizeAppearance(theme);
    assert.deepEqual(normalized.colors, theme.colors);
    assert.deepEqual(normalized.social, theme.social);
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
