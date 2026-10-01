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
  // Place icons in distinct grid cells, preserving the closest available spot.
  const alignGrid = (points,width,height,iconWidth=88,iconHeight=92) => {
    const maxX=Math.max(0,width-iconWidth), maxY=Math.max(0,height-iconHeight), cells=[];
    for(let y=0;y<=maxY;y+=100) for(let x=maxX;x>=0;x-=100) cells.push({x,y});
    const result=[];
    points.forEach(p=>{
      if(!cells.length) { result.push({x:clamp(p.x,0,maxX),y:clamp(p.y,0,maxY)}); return; }
      let best=0;
      for(let i=1;i<cells.length;i++) if((cells[i].x-p.x)**2+(cells[i].y-p.y)**2 < (cells[best].x-p.x)**2+(cells[best].y-p.y)**2) best=i;
      result.push(cells.splice(best,1)[0]);
    }); return result;
  };
  const geometry = {clamp,groupDelta,intersects,layout,alignGrid};
  if (typeof module !== 'undefined') module.exports = geometry; else window.DesktopGeometry = geometry;
})();
