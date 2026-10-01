/* Device-local preferences and window focus. */
(() => {
  const backgrounds = {
    Original: '',
    Aurora: 'radial-gradient(ellipse at 20% 80%, #10b981 0, transparent 50%), radial-gradient(ellipse at 80% 20%, #6366f1 0, transparent 55%), #08152e',
    Dunes: 'radial-gradient(ellipse at 0 100%, #9a3412 0, transparent 65%), linear-gradient(145deg, #fef3c7, #fdba74 50%, #b45309)',
    Midnight: 'radial-gradient(ellipse at 70% 30%, #4338ca, transparent 55%), linear-gradient(120deg, #020617, #172554)',
    Rose: 'radial-gradient(ellipse at 20% 20%, #fce7f3, transparent 50%), linear-gradient(135deg, #fb7185, #7c3aed)',
    Ocean: 'radial-gradient(ellipse at 85% 15%, #67e8f9, transparent 55%), linear-gradient(145deg, #0f766e, #172554)'
  };
  let prefs = {};
  try { const saved = JSON.parse(localStorage.getItem('mqmr_appearance') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) prefs = saved; } catch {}
  if (!['ipad','mac','transparency'].includes(prefs.focus)) prefs.focus = 'ipad';
  prefs.theme = MqMrTheme.get();
  window.addEventListener('mqmr-theme-change',event => { prefs.theme=event.detail.preference; document.querySelector('#pref-theme').value=prefs.theme; });
  const windows = [...document.querySelectorAll('.window')];
  const visible = win => !win.classList.contains('hidden') && win.style.display !== 'none' && win.style.display !== '';
  const active = () => windows.find(win => visible(win) && win.classList.contains('active'));
  const dock = document.querySelector('.dock');
  document.querySelectorAll('.dock-item').forEach(item => {
    item.setAttribute('role','button'); item.tabIndex = 0;
    item.setAttribute('aria-label','Open ' + item.querySelector('.dock-label').textContent);
    item.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); } };
    item.addEventListener('click',() => fitWindowToDesktop(document.getElementById(item.dataset.window)));
  });
  let desktopSnapshot = null, desktopTransition = false, blockedClick = null;
  function focus(win) {
    if (!win || !visible(win)) return;
    windows.forEach(other => other.classList.toggle('active', other === win));
    win.style.zIndex = ++zIndexCounter; updateFocusedDockDot(win.id); sync();
  }
  window.focusDesktopWindow = focus;
  function sync() {
    // Return keyboard and content access to the next app after close/minimize.
    if (!active()) {
      const next = windows.filter(visible).sort((a,b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0];
      if (next) { next.classList.add('active'); updateFocusedDockDot(next.id); }
    }
    for (const win of windows) {
      const focused = visible(win) && win.classList.contains('active');
      const content = win.querySelector('.window-content'); if (content) content.inert = !focused;
      const shield = win.querySelector('.window-focus-shield'); if (shield) shield.hidden = focused || !visible(win);
      const indicator = win.querySelector('.window-focus-indicator');
      if (indicator) { indicator.setAttribute('aria-pressed', String(focused)); indicator.title = focused ? 'Focused app' : 'Focus this app'; }
    }
    const maximized = windows.some(win => visible(win) && win.classList.contains('maximized'));
    const mode = maximized && prefs.maxDock && prefs.maxDock !== 'inherit' ? prefs.maxDock : prefs.dock || 'visible';
    document.body.classList.toggle('dock-auto', mode === 'auto' || mode === 'hidden');
    document.body.classList.toggle('dock-reserved', mode === 'visible');
  }
  window.syncDesktopState = sync;
  for (const win of windows) {
    const shield = document.createElement('button'); shield.type = 'button'; shield.className = 'window-focus-shield'; shield.setAttribute('aria-label', 'Focus ' + win.querySelector('.window-title').textContent.trim());
    const indicator = document.createElement('button'); indicator.type = 'button'; indicator.className = 'window-focus-indicator'; indicator.setAttribute('aria-label', shield.getAttribute('aria-label'));
    indicator.innerHTML = '<span></span><span></span><span></span>';
    indicator.addEventListener('pointerdown', event => event.stopPropagation()); indicator.onclick = () => focus(win);
    win.querySelector('.window-titlebar').append(indicator); win.append(shield);
  }
  document.addEventListener('pointerdown', event => {
    const win = event.target.closest?.('.window');
    if (!win || !visible(win) || win.classList.contains('active') || event.target.closest('.window-titlebar')) return;
    event.preventDefault(); event.stopImmediatePropagation(); blockedClick = win; focus(win);
  }, true);
  document.addEventListener('click', event => {
    const win = event.target.closest?.('.window');
    if (blockedClick && win === blockedClick) { event.preventDefault(); event.stopImmediatePropagation(); blockedClick = null; return; }
    blockedClick = null;
    if (win && !win.classList.contains('active') && !event.target.closest('.window-titlebar')) { event.preventDefault(); event.stopImmediatePropagation(); focus(win); }
  }, true);
  document.addEventListener('pointerdown', event => { if (!event.target.closest?.('.window')) blockedClick = null; }, true);
  const observer = new MutationObserver(sync); windows.forEach(win => observer.observe(win, {attributes:true,attributeFilter:['class']}));
  window.toggleShowDesktop = () => {
    if (desktopTransition) return;
    if (desktopSnapshot && !windows.some(visible)) {
      const snapshot = desktopSnapshot; desktopSnapshot = null;
      snapshot.apps.forEach(win => { win.classList.remove('hidden'); win.style.display = 'flex'; }); focus(snapshot.focus || snapshot.apps.at(-1));
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) snapshot.apps.forEach(win => win.animate([
        {opacity:0,transform:'scale(0.1) translateY(120vh)'},
        {opacity:.8,transform:'scale(0.9) translateY(10px)'},
        {opacity:1,transform:'scale(1) translateY(0)'}
      ],{duration:280,easing:'cubic-bezier(.4,0,.2,1)'}));
    } else {
      desktopSnapshot = {apps:windows.filter(win => visible(win) && !win.classList.contains('closing') && !win.classList.contains('minimizing')),focus:active()};
      const snapshot = desktopSnapshot; desktopTransition = true;
      snapshot.apps.forEach(win => win.classList.add('minimizing','desktop-minimizing'));
      const finish = () => {
        snapshot.apps.forEach(win => {
          // A Dock/app click during the transition cancels hiding that app.
          if (win.classList.contains('desktop-minimizing')) win.classList.add('hidden');
          win.classList.remove('desktop-minimizing','minimizing');
        });
        desktopTransition = false; sync(); if (!active()) updateFocusedDockDot(null);
      };
      setTimeout(finish,matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
    }
    sync();
  };
  document.querySelectorAll('.menubar-left > .menubar-item').forEach(item => {
    item.setAttribute('role','button'); item.tabIndex = 0; item.setAttribute('aria-label','Show or restore desktop'); item.title = 'Show / restore desktop'; item.onclick = window.toggleShowDesktop;
    item.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleShowDesktop(); } };
  });
  document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); toggleShowDesktop(); } });
  // Measure its resting box, ignoring the auto-hide transform. No invisible
  // hit layer: windows and desktop icons beneath the Dock still receive clicks.
  let dockBounds;
  function measureDock() { const width = dock.offsetWidth, height = dock.offsetHeight, bottom = parseFloat(getComputedStyle(dock).bottom) || 0; dockBounds = {left:(innerWidth-width)/2,right:(innerWidth+width)/2,top:innerHeight-bottom-height,bottom:innerHeight-bottom}; }
  measureDock(); window.addEventListener('resize',measureDock); new ResizeObserver(measureDock).observe(dock);
  document.addEventListener('pointermove', event => {
    const inside = event.clientX >= dockBounds.left && event.clientX <= dockBounds.right && event.clientY >= dockBounds.top - 18 && event.clientY <= dockBounds.bottom;
    dock.classList.toggle('dock-revealed',inside || dock.contains(event.target));
  });
  document.addEventListener('pointerleave',() => dock.classList.remove('dock-revealed'));
  const wallpaper = document.querySelector('.wallpaper');
  const wallpaperTransition = document.createElement('div'); wallpaperTransition.className = 'wallpaper-transition'; wallpaperTransition.setAttribute('aria-hidden','true'); wallpaper.append(wallpaperTransition);
  const originalBackground = 'url(assets/mqmr-waves.webp) center/cover';
  let currentBackground, wallpaperAnimation;
  function apply() {
    const background = backgrounds[prefs.background] || originalBackground;
    if (background !== currentBackground) {
      wallpaperAnimation?.cancel();
      wallpaperTransition.style.background = currentBackground || background;
      wallpaper.style.background = background;
      wallpaperAnimation = currentBackground ? wallpaperTransition.animate([{opacity:1},{opacity:0}], {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450, easing:'ease-in-out',fill:'forwards'}) : null;
      if (!wallpaperAnimation) wallpaperTransition.style.opacity = '0';
      currentBackground = background;
    }
    document.body.dataset.focusStyle = prefs.focus;
    document.body.classList.toggle('solid-menubar', !!prefs.solid);
    document.querySelector('.menubar-icons').hidden = !!prefs.hideIcons; document.querySelector('#clock').hidden = !!prefs.hideClock;
    document.querySelector('.wallpaper-preview').style.background = backgrounds[prefs.background] || originalBackground;
    document.querySelectorAll('[data-wallpaper]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.wallpaper === (prefs.background || 'Original'))));
    for (const [id,on] of [['pref-solid',!!prefs.solid],['pref-icons',!prefs.hideIcons],['pref-clock',!prefs.hideClock]]) {
      const button = document.getElementById(id); button.classList.toggle('is-on',on); button.setAttribute('aria-pressed',String(on));
    }
    document.querySelector('#pref-focus').value = prefs.focus;
    document.querySelector('#pref-theme').value = MqMrTheme.get();
    document.querySelector('#focus-description').textContent = {ipad:'A three-dot indicator marks the active app. All windows stay opaque.',mac:'Only the active app shows its window controls. All windows stay opaque.',transparency:'Inactive floating windows dim. Tiled windows stay opaque.'}[prefs.focus];
    document.querySelector('#pref-dock').value = prefs.dock || 'visible'; document.querySelector('#pref-max-dock').value = prefs.maxDock || 'inherit';
    try { localStorage.setItem('mqmr_appearance',JSON.stringify(prefs)); } catch {} sync();
  }
  for (const [name,background] of Object.entries(backgrounds)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wallpaper-choice'; button.dataset.wallpaper = name;
    const swatch = document.createElement('span'); swatch.style.background = background || originalBackground;
    button.append(swatch,document.createTextNode(name)); button.onclick = () => { prefs.background = name; apply(); }; document.querySelector('#wallpaper-grid').append(button);
  }
  for (const [id,key,invert] of [['pref-solid','solid',false],['pref-icons','hideIcons',true],['pref-clock','hideClock',true]]) document.getElementById(id).onclick = event => { const on = event.currentTarget.getAttribute('aria-pressed') !== 'true'; prefs[key] = invert ? !on : on; apply(); };
  for (const [id,key] of [['pref-dock','dock'],['pref-max-dock','maxDock'],['pref-focus','focus']]) document.getElementById(id).onchange = event => { prefs[key] = event.target.value; apply(); };
  document.querySelector('#pref-theme').onchange = event => { MqMrTheme.set(event.target.value); apply(); };
  const windowAction = zone => { if (active()) snapWindow(active(),zone); };
  const menus = {
    File: [['About',() => openAppById('about-window')],['Projects',() => openAppById('projects-window')],['Contact',() => openAppById('contact-window')]],
    Edit: [['Settings',() => openAppById('settings-window')]],
    View: Object.keys(backgrounds).map(name => ['Background: ' + name,() => { prefs.background = name; apply(); }]),
    Go: [['Workspace',() => openAppById('workspace-window')],['Terminal',() => openAppById('terminal-window')]],
    Window: [['Maximize / restore',() => { if (active()) toggleWindowMaximize(active()); }],...['left','right','top-left','top-right','bottom-left','bottom-right'].map(zone => ['Tile ' + zone,() => windowAction(zone)])],
    Help: [['Settings & release notes',() => openAppById('settings-window')]]
  };
  const list = document.querySelector('.menu-list'); list.replaceChildren();
  for (const [name,actions] of Object.entries(menus)) {
    const details = document.createElement('details'); details.className = 'desktop-menu'; const summary = document.createElement('summary'); summary.textContent = name; const panel = document.createElement('div'); panel.className = 'desktop-menu-panel';
    for (const [label,action] of actions) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => { action(); sync(); details.open = false; summary.focus(); }; panel.append(button); }
    details.append(summary,panel); details.addEventListener('toggle',() => { if (details.open) list.querySelectorAll('details').forEach(other => { if (other !== details) other.open = false; }); }); list.append(details);
  }
  document.addEventListener('pointerdown',event => { if (!list.contains(event.target)) list.querySelectorAll('details').forEach(item => item.open = false); });
  document.addEventListener('keydown',event => { if (event.key === 'Escape') list.querySelectorAll('details[open]').forEach(item => { item.open = false; item.querySelector('summary').focus(); }); });
  let resizeTimer;
  window.addEventListener('resize',() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => {
    endDragForcefully();
    for (const win of windows) {
      if (win.classList.contains('snapped') && win.dataset.snapState) snapWindow(win,win.dataset.snapState);
      else if (!win.classList.contains('maximized')) {
        const rect = win.getBoundingClientRect(), desktop = getDesktopRect();
        win.style.left = Math.max(0,Math.min(rect.left,innerWidth - Math.min(rect.width,innerWidth))) + 'px';
        win.style.top = Math.max(0,Math.min(rect.top - desktop.top,innerHeight - desktop.top - Math.min(rect.height,innerHeight - desktop.top))) + 'px';
      }
    }
  },100); });
  apply();
})();
