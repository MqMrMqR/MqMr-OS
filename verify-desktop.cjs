const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = fs.readFileSync('script.js','utf8');
const fn = src.slice(src.indexOf('function getSnapZone('), src.indexOf('function getSnapPreviewRect('));
for (const [width,height] of [[1440,900],[1920,1080],[800,600]]) {
  const ctx = {window:{innerWidth:width,innerHeight:height},getDesktopRect:()=>({top:32})};
  vm.createContext(ctx); vm.runInContext(fn,ctx);
  assert.equal(ctx.getSnapZone(180,height-450,{left:0,right:400,bottom:height}), 'bottom-left');
  assert.equal(ctx.getSnapZone(width-180,height-450,{left:width-400,right:width,bottom:height}), 'bottom-right');
  for (const [x,y,want] of [[0,height*.85,'bottom-left'],[width,height*.85,'bottom-right'],[0,height*.5,'left'],[width,height*.5,'right'],[width/2,40,'maximize'],[width/2,height*.5,null],[10,height-10,'bottom-left'],[width-10,height-10,'bottom-right'],[10,40,'top-left'],[width-10,40,'top-right']]) assert.equal(ctx.getSnapZone(x,y),want,`${width}x${height} at ${x},${y}`);
}
console.log('36 snap boundary cases passed, including titlebar-offset drops');
