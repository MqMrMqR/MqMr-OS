const assert = require('node:assert/strict');
const {groupDelta,intersects,layout} = require('./desktop-geometry.js');
let cases = 0;
for (const [width,height] of [[1248,544],[768,424],[1888,904]]) {
  const points = Array.from({length:6},(_,i)=>layout(i,width,height));
  for (const [dx,dy] of [[-10000,-10000],[10000,10000],[-500,25],[25,150]]) {
    const delta = groupDelta(points,dx,dy,width,height,88,92);
    points.forEach(p => { assert(p.x+delta.dx>=0 && p.x+delta.dx+88<=width); assert(p.y+delta.dy>=0 && p.y+delta.dy+92<=height); cases++; });
    for (let i=1;i<points.length;i++) { assert.equal((points[i].x+delta.dx)-(points[0].x+delta.dx),points[i].x-points[0].x); assert.equal((points[i].y+delta.dy)-(points[0].y+delta.dy),points[i].y-points[0].y); }
  }
}
assert(intersects({x:10,y:10,width:100,height:100},{x:100,y:100,width:88,height:92}));
assert(!intersects({x:10,y:10,width:100,height:100},{x:200,y:200,width:88,height:92}));
console.log(`${cases} group-drag bounds cases passed; relative positions and selection intersections verified.`);

