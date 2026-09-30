/* A deliberately small, validated visual property vocabulary. No arbitrary CSS. */
(() => {
  const properties = {
    color: v => /^#[0-9a-f]{6}$/i.test(v),
    'background-color': v => /^#[0-9a-f]{6}$/i.test(v),
    'font-size': v => /^(?:[8-9]|[1-7]\d|80)px$/.test(v),
    'font-weight': v => /^(400|500|600|700|800)$/.test(v),
    'border-radius': v => /^(?:\d|[1-5]\d|60)px$/.test(v),
    padding: v => /^(?:\d|[1-5]\d|60)px$/.test(v),
    'text-align': v => /^(left|center|right)$/.test(v)
  };
  const validSelector = selector => typeof selector === 'string' && selector.length < 800 && /^(?:#[a-zA-Z][\w-]*|body)(?: > [a-z][a-z0-9]*:nth-of-type\([1-9]\d*\))*$/.test(selector);
  let design = {}, pending = false;
  const style = document.createElement('style'); style.id = 'site-design-overrides'; document.head.append(style);
  function apply(next) {
    design = next && typeof next === 'object' && !Array.isArray(next) ? next : {};
    const sheet = style.sheet; while (sheet.cssRules.length) sheet.deleteRule(0);
    for (const [selector, rule] of Object.entries(design.rules || {})) {
      if (!validSelector(selector) || !rule || typeof rule !== 'object') continue;
      const declarations = Object.entries(rule).filter(([key,value]) => properties[key]?.(String(value))).map(([key,value]) => `${key}:${value} !important`).join(';');
      if (declarations) sheet.insertRule(`${selector}{${declarations}}`,sheet.cssRules.length);
    }
    applyTexts();
  }
  function applyTexts() {
    for (const [selector,text] of Object.entries(design.texts || {})) {
      if (!validSelector(selector) || typeof text !== 'string' || text.length > 10000) continue;
      const element = document.querySelector(selector);
      if (element && !element.children.length && !element.matches('script,style,input,textarea') && element.textContent !== text) element.textContent = text;
    }
  }
  const observer = new MutationObserver(() => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; applyTexts(); }); } });
  observer.observe(document.body,{subtree:true,childList:true});
  window.siteDesign = {apply,validSelector,properties};
  fetchSiteContent('main-data.json').then(response => response.json()).then(data => apply(data.design)).catch(error => console.warn('Design unavailable',error.message));
})();
