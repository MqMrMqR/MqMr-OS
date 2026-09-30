/* Settings markup must exist before the navigation in script.js initializes. */
(() => {
  const sidebar = document.querySelector('#settings-section-privacy').parentElement;
  for (const [key, icon, label, pages] of [
    ['wallpaper','▧','Wallpaper',[['wallpaper-page','Wallpaper']]],
    ['appearance','◐','Appearance',[['focus-page','Window focus'],['topbar-page','Menu bar']]],
    ['dock','▤','Desktop & Dock',[['dock-page','Dock behavior']]]
  ]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'settings-btn'; button.dataset.section = key;
    const symbol = document.createElement('span'); symbol.className = 'icon'; symbol.textContent = icon; button.append(symbol,document.createTextNode(label)); sidebar.append(button);
    const middle = document.createElement('div'); middle.className = 'settings-middle-section'; middle.dataset.section = key;
    for (const [id,name] of pages) { const entry = document.createElement('button'); entry.type = 'button'; entry.className = 'mid-btn'; entry.dataset.page = id; entry.textContent = name; middle.append(entry); }
    document.querySelector('.settings-middle').append(middle);
  }
  document.querySelector('.settings-main').insertAdjacentHTML('beforeend', `
    <section class="settings-page" id="wallpaper-page"><h1>Wallpaper</h1><p class="preference-intro">Choose a background for this desktop. Your choice is saved on this device.</p><div class="wallpaper-preview" aria-hidden="true"></div><h2 class="preference-heading">Collections</h2><div id="wallpaper-grid" class="wallpaper-grid"></div></section>
    <section class="settings-page" id="focus-page"><h1>Window focus</h1><p class="preference-intro">Click an inactive app once to focus it, then interact. Tiled windows stay readable.</p><div class="focus-choices" id="focus-choices"></div><div class="preference-card"><strong>Keyboard access</strong><p>Focus the app using its title bar, focus indicator, or Dock icon to interact with its content.</p></div></section>
    <section class="settings-page" id="topbar-page"><h1>Menu bar</h1><div class="preference-card"><label class="preference-row">Solid menu bar<input type="checkbox" id="pref-solid"></label><label class="preference-row">Show status icons<input type="checkbox" id="pref-icons"></label><label class="preference-row">Show clock<input type="checkbox" id="pref-clock"></label></div></section>
    <section class="settings-page" id="dock-page"><h1>Desktop & Dock</h1><p class="preference-intro">Show Desktop keeps your apps open and restores their positions.</p><div class="preference-card"><label class="preference-row" for="pref-dock">Dock by default<select id="pref-dock"><option value="visible">Always visible</option><option value="auto">Automatically hide</option></select></label><label class="preference-row" for="pref-max-dock">When an app is maximized<select id="pref-max-dock"><option value="inherit">Use default Dock setting</option><option value="hidden">Hide Dock</option><option value="visible">Keep Dock visible</option></select></label><p>Move to the bottom edge or focus a Dock item with the keyboard to reveal a hidden Dock.</p></div><button type="button" class="preference-action" id="show-desktop-setting">Show / restore desktop</button><p class="preference-intro">Click the Apple icon or MqMr’s OS in the menu bar. Shortcut: Win / ⌘ + D.</p></section>`);
})();
