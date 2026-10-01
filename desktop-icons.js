/* A bounded, device-local desktop: selection, multi-drag and keyboard access. */
(() => {
  const {clamp,groupDelta,intersects,layout} = DesktopGeometry;
  const surface = document.createElement('div'); surface.className = 'desktop-icons'; surface.setAttribute('role','listbox'); surface.setAttribute('aria-label','Desktop applications'); surface.setAttribute('aria-multiselectable','true'); surface.tabIndex = 0; document.querySelector('.desktop').append(surface);
  const marquee = document.createElement('div'); marquee.className = 'desktop-selection'; marquee.hidden = true; surface.append(marquee);
  const status = document.createElement('span'); status.className = 'desktop-status'; status.setAttribute('role','status'); surface.append(status);
  const iconWidth = 88, iconHeight = 92, selected = new Set(), icons = [], positions = new Map();
  let saved = {}, gesture = null, suppressClick = false, lastDrag = 0;
  try { const data = JSON.parse(localStorage.getItem('mqmr_desktop_icons') || '{}'); if (data.version === 1 && data.positions && typeof data.positions === 'object') saved = data.positions; } catch {}
  const bounds = () => surface.getBoundingClientRect();
  const choose = ids => {
    selected.clear(); ids.forEach(id => selected.add(id));
    icons.forEach(icon => icon.setAttribute('aria-selected',String(selected.has(icon.dataset.window))));
    status.textContent = selected.size ? `${selected.size} desktop ${selected.size === 1 ? 'item' : 'items'} selected` : '';
  };
  function paint() { icons.forEach(icon => { const p = positions.get(icon.dataset.window); icon.style.left = p.x+'px'; icon.style.top = p.y+'px'; }); }
  function save() {
    const box = bounds(), data = {};
    positions.forEach((p,id) => { data[id] = {x:p.x/Math.max(1,box.width-iconWidth),y:p.y/Math.max(1,box.height-iconHeight)}; });
    saved = data; try { localStorage.setItem('mqmr_desktop_icons',JSON.stringify({version:1,positions:data})); } catch {}
  }
  function restore() {
    const box = bounds(); icons.forEach((icon,index) => {
      const p = saved[icon.dataset.window];
      positions.set(icon.dataset.window,p && Number.isFinite(p.x) && Number.isFinite(p.y) ? {x:clamp(p.x,0,1)*Math.max(0,box.width-iconWidth),y:clamp(p.y,0,1)*Math.max(0,box.height-iconHeight)} : layout(index,box.width,box.height));
    }); paint();
  }
  document.querySelectorAll('.dock-item').forEach(item => {
    const icon = document.createElement('div'); icon.className = 'desktop-icon'; icon.dataset.window = item.dataset.window;
    icon.setAttribute('role','option'); icon.setAttribute('aria-selected','false'); icon.setAttribute('aria-label',item.querySelector('.dock-label').textContent); icon.tabIndex = icons.length ? -1 : 0;
    const symbol = document.createElement('span'); symbol.className = 'desktop-icon-symbol'; symbol.textContent = item.querySelector('span').textContent; symbol.style.background = getComputedStyle(item).backgroundImage;
    const label = document.createElement('span'); label.className = 'desktop-icon-label'; label.textContent = item.querySelector('.dock-label').textContent;
    icon.append(symbol,label); surface.append(icon); icons.push(icon);
    const open = () => { if (Date.now()-lastDrag<300) return; openAppById(icon.dataset.window); choose([]); };
    icon.addEventListener('dblclick',open);
    icon.addEventListener('keydown',event => {
      if (event.key === 'Enter') { event.preventDefault(); open(); }
      else if (event.key === ' ') { event.preventDefault(); const next = new Set(event.ctrlKey||event.metaKey ? selected : []); if (next.has(icon.dataset.window)) next.delete(icon.dataset.window); else next.add(icon.dataset.window); choose([...next]); }
      else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if (event.altKey) {
          if (!selected.has(icon.dataset.window)) choose([icon.dataset.window]);
          const ids = [...selected], points = ids.map(id=>positions.get(id)), box = bounds();
          const delta = groupDelta(points,event.key==='ArrowLeft'?-12:event.key==='ArrowRight'?12:0,event.key==='ArrowUp'?-12:event.key==='ArrowDown'?12:0,box.width,box.height,iconWidth,iconHeight);
          ids.forEach((id,index)=>positions.set(id,{x:points[index].x+delta.dx,y:points[index].y+delta.dy})); paint(); save();
        } else {
          const index = icons.indexOf(icon), next = icons[clamp(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1),0,icons.length-1)];
          icons.forEach(other => other.tabIndex = other===next?0:-1); next.focus(); if (!event.shiftKey) choose([next.dataset.window]); else choose([...selected,next.dataset.window]);
        }
      }
    });
  });
  restore();
  surface.addEventListener('pointerdown',event => {
    if (event.button !== 0 || gesture) return;
    event.preventDefault(); const icon = event.target.closest('.desktop-icon'), box = bounds();
    const start = {x:clamp(event.clientX-box.left,0,box.width),y:clamp(event.clientY-box.top,0,box.height)};
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    if (icon) {
      const id = icon.dataset.window, next = new Set(selected);
      if (additive) { if (next.has(id)) next.delete(id); else next.add(id); choose([...next]); }
      else if (!next.has(id)) choose([id]);
      icons.forEach(other=>other.tabIndex=other===icon?0:-1); icon.focus({preventScroll:true});
      gesture = {kind:'icons',pointer:event.pointerId,start,box,origin:new Map([...selected].map(key=>[key,{...positions.get(key)}])),moved:false,collapse:!additive?id:null};
    } else {
      const initial = additive ? [...selected] : []; choose(initial); surface.focus({preventScroll:true});
      gesture = {kind:'marquee',pointer:event.pointerId,start,box,initial,moved:false};
    }
    gesture.capture = icon || surface; gesture.capture.setPointerCapture(event.pointerId);
  });
  function move(event) {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const {start,box} = gesture, x=clamp(event.clientX-box.left,0,box.width), y=clamp(event.clientY-box.top,0,box.height);
    const dx=x-start.x, dy=y-start.y;
    if (!gesture.moved && Math.hypot(dx,dy)<4) return;
    gesture.moved = true;
    if (gesture.kind === 'icons') {
      const delta = groupDelta([...gesture.origin.values()],dx,dy,box.width,box.height,iconWidth,iconHeight);
      gesture.origin.forEach((p,id)=>positions.set(id,{x:p.x+delta.dx,y:p.y+delta.dy})); paint(); surface.classList.add('dragging-icons');
    } else {
      const rect = {x:Math.min(start.x,x),y:Math.min(start.y,y),width:Math.abs(dx),height:Math.abs(dy)};
      marquee.hidden = false; Object.assign(marquee.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
      choose([...new Set([...gesture.initial,...icons.filter(icon=>intersects(rect,{...positions.get(icon.dataset.window),width:iconWidth,height:iconHeight})).map(icon=>icon.dataset.window)])]);
    }
  }
  function finish(event,cancel=false) {
    if (!gesture || (event && event.pointerId!==gesture.pointer)) return;
    const current = gesture;
    if (!cancel && event) move(event);
    if (cancel) { if (current.origin) current.origin.forEach((p,id)=>positions.set(id,p)); else choose(current.initial); paint(); }
    else if (current.kind==='icons') { if (current.moved) save(); else if (current.collapse) choose([current.collapse]); }
    suppressClick = current.moved; if (current.moved) lastDrag = Date.now(); gesture = null; marquee.hidden = true; surface.classList.remove('dragging-icons');
    if (current.capture.hasPointerCapture(current.pointer)) current.capture.releasePointerCapture(current.pointer);
  }
  surface.addEventListener('pointermove',move); surface.addEventListener('pointerup',event=>finish(event)); surface.addEventListener('pointercancel',event=>finish(event,true)); surface.addEventListener('lostpointercapture',event=>finish(event,true));
  surface.addEventListener('click',event=>{ if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick=false; } });
  surface.addEventListener('dblclick',event=>{ if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick=false; } },true);
  surface.addEventListener('keydown',event=>{ if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='a') { event.preventDefault(); choose(icons.map(icon=>icon.dataset.window)); } if (event.key==='Escape') { finish(null,true); choose([]); } });
  document.addEventListener('pointerdown',event=>{ if (event.target.closest('.window,.dock,.menubar')) choose([]); },true);
  window.addEventListener('blur',()=>finish(null,true)); window.addEventListener('resize',()=>{ finish(null,true); restore(); });
})();

