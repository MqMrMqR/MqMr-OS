/* Settings markup must exist before script.js initializes navigation. */
(() => {
  const appearance = document.querySelector('#settings-section-display');
  appearance.dataset.section = 'appearance'; appearance.id = 'settings-section-appearance';
  const label = appearance.querySelector('#settings-section-display-label');
  label.id = 'settings-section-appearance-label'; label.textContent = 'Appearance';
  const middle = document.querySelector('.settings-middle-section[data-section="display"]');
  middle.dataset.section = 'appearance';
  // Keep the existing Display icon and row layout.
  const displayLabel = middle.querySelector('#settings-menu-mode-label');
  displayLabel.id = 'settings-menu-display-label'; displayLabel.textContent = 'Display';
  for (const [id,name,path] of [
    ['wallpaper-page','Wallpaper','M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4'],
    ['focus-page','Window focus','M3 5h18v14H3z M3 9h18'],
    ['topbar-page','Menu bar','M3 5h18v14H3z M3 9h18 M6 7h1 M10 7h1'],
    ['dock-page','Desktop & Dock','M3 5h18v14H3z M7 16h10']
  ]) {
    const entry = document.createElement('button'); entry.type = 'button'; entry.className = 'mid-btn'; entry.dataset.page = id;
    entry.innerHTML = `<span class="mid-left"><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg></span><span>${name}</span></span><span class="mid-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>`;
    middle.append(entry);
  }
  const row = (title,description,control) => `<div class="setting-row setting-row-inline"><div class="setting-row-left"><span class="setting-title">${title}</span><p class="setting-description">${description}</p></div>${control}</div>`;
  const toggle = (id,label) => `<button type="button" class="switch-toggle" id="${id}" aria-label="${label}" aria-pressed="false"><span class="switch-thumb"></span></button>`;
  document.querySelector('.settings-main').insertAdjacentHTML('beforeend', `
    <section class="settings-page" id="wallpaper-page"><h1>Wallpaper</h1><p class="preference-intro">Choose a background for this desktop.</p><div class="wallpaper-preview" aria-hidden="true"></div><h2 class="preference-heading">Collections</h2><div id="wallpaper-grid" class="wallpaper-grid"></div></section>
    <section class="settings-page" id="focus-page"><h1>Window focus</h1>${row('Focus style','Choose how the active window is highlighted.','<select class="setting-select" id="pref-focus" aria-label="Focus style"><option value="ipad">iPadOS</option><option value="mac">macOS</option><option value="transparency">Transparency</option></select>')}<p class="preference-intro" id="focus-description"></p>${row('Interaction','Click an inactive app once to focus it, then use its content. Tiled windows stay opaque.','')}</section>
    <section class="settings-page" id="topbar-page"><h1>Menu bar</h1>${row('Solid menu bar','Use an opaque background.',toggle('pref-solid','Solid menu bar'))}${row('Show status icons','Display Wi-Fi and battery indicators.',toggle('pref-icons','Show status icons'))}${row('Show clock','Display the date and time.',toggle('pref-clock','Show clock'))}</section>
    <section class="settings-page" id="dock-page"><h1>Desktop & Dock</h1>${row('Dock by default','Choose when the Dock is visible.','<select class="setting-select" id="pref-dock" aria-label="Dock by default"><option value="visible">Always visible</option><option value="auto">Automatically hide</option></select>')}${row('When an app is maximized','Windows always fill the screen. The Dock appears over them.','<select class="setting-select" id="pref-max-dock" aria-label="Dock when maximized"><option value="inherit">Use default setting</option><option value="hidden">Hide Dock</option><option value="visible">Keep Dock visible</option></select>')}<p class="preference-intro">Move to the bottom edge or focus a Dock item with the keyboard to reveal a hidden Dock.</p>${row('Show Desktop','Hide apps and restore their positions. Click the Apple icon or MqMr’s OS, or press Win / ⌘ + D.','<button type="button" class="preference-action" id="show-desktop-setting">Show / restore</button>')}</section>`);
})();

