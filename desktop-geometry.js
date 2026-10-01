/* Shared, deterministic desktop geometry. */
(() => {
  const clamp = (value,min,max) => Math.max(min,Math.min(value,Math.max(min,max)));
  const groupDelta = (positions,dx,dy,width,height,iconWidth,iconHeight) => {
    if (!positions.length) return {dx:0,dy:0};
    const minX = Math.min(...positions.map(p=>p.x)), maxX = Math.max(...positions.map(p=>p.x+iconWidth));
    const minY = Math.min(...positions.map(p=>p.y)), maxY = Math.max(...positions.map(p=>p.y+iconHeight));
    return {dx:clamp(dx,-minX,width-maxX),dy:clamp(dy,-minY,height-maxY)};
  };
  const intersects = (a,b) => a.x <= b.x+b.width && a.x+a.width >= b.x && a.y <= b.y+b.height && a.y+a.height >= b.y;
  const layout = (index,width,height,iconWidth=88,iconHeight=92) => {
    const rows = Math.max(1,Math.floor(height/(iconHeight+8))), column = Math.floor(index/rows), row = index%rows;
    return {x:clamp(width-iconWidth-column*(iconWidth+12),0,width-iconWidth),y:clamp(row*(iconHeight+8),0,height-iconHeight)};
  };
  const geometry = {clamp,groupDelta,intersects,layout};
  if (typeof module !== 'undefined') module.exports = geometry; else window.DesktopGeometry = geometry;
})();

