/* Device-local appearance preferences and functional desktop menus. */
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
  try { prefs = JSON.parse(localStorage.getItem('mqmr_appearance') || '{}') || {}; } catch {}
  function apply() {
    document.querySelector('.wallpaper').style.background = backgrounds[prefs.background] || '';
    document.body.classList.toggle('solid-menubar', !!prefs.solid);
    document.querySelector('.menubar-icons').hidden = !!prefs.hideIcons;
    document.querySelector('#clock').hidden = !!prefs.hideClock;
    try { localStorage.setItem('mqmr_appearance', JSON.stringify(prefs)); } catch {}
  }
  const active = () => document.querySelector('.window.active');
  const windowAction = zone => { const win = active(); if (win) snapWindow(win, zone); };
  const menus = {
    File: [['About', () => openAppById('about-window')], ['Projects', () => openAppById('projects-window')], ['Contact', () => openAppById('contact-window')]],
    Edit: [['Settings', () => openAppById('settings-window')]],
    View: [...Object.keys(backgrounds).map(name => ['Background: ' + name, () => { prefs.background = name; apply(); }]), ['Toggle solid top bar', () => { prefs.solid = !prefs.solid; apply(); }], ['Toggle status icons', () => { prefs.hideIcons = !prefs.hideIcons; apply(); }], ['Toggle clock', () => { prefs.hideClock = !prefs.hideClock; apply(); }]],
    Go: [['Workspace', () => openAppById('workspace-window')], ['Terminal', () => openAppById('terminal-window')]],
    Window: [['Maximize / restore', () => { if (active()) toggleWindowMaximize(active()); }], ...['left','right','top-left','top-right','bottom-left','bottom-right'].map(zone => ['Tile ' + zone, () => windowAction(zone)])],
    Help: [['About this OS', () => openAppById('settings-window')]]
  };
  const list = document.querySelector('.menu-list');
  list.replaceChildren();
  for (const [name, actions] of Object.entries(menus)) {
    const details = document.createElement('details');
    details.className = 'desktop-menu';
    const summary = document.createElement('summary');
    summary.textContent = name;
    const panel = document.createElement('div');
    panel.className = 'desktop-menu-panel';
    for (const [label, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => { action(); details.open = false; summary.focus(); };
      panel.append(button);
    }
    details.append(summary, panel);
    details.addEventListener('toggle', () => {
      if (details.open) list.querySelectorAll('details').forEach(other => { if (other !== details) other.open = false; });
    });
    list.append(details);
  }
  document.addEventListener('pointerdown', event => {
    if (!list.contains(event.target)) list.querySelectorAll('details').forEach(item => item.open = false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') list.querySelectorAll('details[open]').forEach(item => { item.open = false; item.querySelector('summary').focus(); });
  });
  apply();
})();
