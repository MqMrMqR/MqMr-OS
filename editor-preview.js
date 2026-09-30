/* Only the authenticated, same-origin admin preview installs the inspector. */
(() => {
  if (window.parent === window || !new URLSearchParams(location.search).has('editor')) return;
  let host;
  try { host = parent.MqMrEditor; if (!host?.allowed()) return; } catch { return; }
  let selected = null;
  function selectorFor(element) {
    if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) return '#' + element.id;
    if (element === document.body) return 'body';
    const chain = []; let current = element;
    while (current && current !== document.body) {
      if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) { chain.unshift('#' + current.id); return chain.join(' > '); }
      const siblings = [...current.parentElement.children].filter(item => item.tagName === current.tagName);
      chain.unshift(current.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')'); current = current.parentElement;
    }
    return ['body',...chain].join(' > ');
  }
  function leaves(value,path = []) {
    if (typeof value === 'string') return [{path,value}];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key,item]) => key === 'design' ? [] : leaves(item,[...path,key]));
  }
  function bindingFor(element) {
    if (element.children.length || element.matches('input,textarea')) return null;
    const text = element.textContent.trim(), win = element.closest('.window');
    const docs = win ? { 'about-window':'Apps/AboutMe.json','projects-window':'Apps/Projects.json','workspace-window':'Apps/Workspace.json','contact-window':'Apps/Contact.json','settings-window':'Apps/Settings.json','terminal-window':'Apps/Terminal.json' } : {};
    for (const doc of [docs[win?.id],'main-data.json'].filter(Boolean)) {
      const candidates = [];
      for (const leaf of leaves(host.getContent(doc))) if (leaf.value.trim() === text && text) candidates.push({doc,path:leaf.path});
      if (candidates.length === 1) return candidates[0];
    }
    return null;
  }
  function select(element) {
    if (!element || element.matches('body,html,script,style') || element.closest('.window-controls,.window-focus-indicator')) return;
    selected?.classList.remove('editor-selected'); selected = element; selected.classList.add('editor-selected');
    const computed = getComputedStyle(element);
    host.select({selector:selectorFor(element),tag:element.tagName.toLowerCase(),text:element.children.length ? null : element.textContent,binding:bindingFor(element),styles:Object.fromEntries(Object.keys(siteDesign.properties).map(key => [key,computed.getPropertyValue(key)]))});
  }
  document.addEventListener('click',event => {
    if (!host.allowed() || !host.isSelecting()) return;
    if (event.target.closest('.dock,.menu-list,.settings-btn,.mid-btn,.window-controls,.window-focus-indicator,.menubar-left > .menubar-item')) return;
    event.preventDefault(); event.stopImmediatePropagation(); select(event.target.closest('.window-focus-shield') ? event.target.closest('.window') : event.target);
  },true);
  const css = document.createElement('style'); css.textContent = '.editor-selected{outline:2px solid #3478f6 !important;outline-offset:-2px}.editor-mode .window-content{cursor:crosshair}'; document.head.append(css); document.body.classList.add('editor-mode');
  window.editorPreview = {
    updateText(text) { if (selected && !selected.children.length) selected.textContent = text; },
    applyDesign(design) { siteDesign.apply(design); },
    clear() { selected?.classList.remove('editor-selected'); selected = null; },
    selectBySelector(selector) { if (siteDesign.validSelector(selector)) select(document.querySelector(selector)); }
  };
})();
