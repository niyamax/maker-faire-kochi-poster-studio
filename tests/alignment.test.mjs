import test from 'node:test';
import assert from 'node:assert/strict';
import {snapFooterRect} from '../src/alignment.js';
const board={width:1000,height:800,margin:60,tolerance:6};

test('footer movement snaps to poster margins and centres only within the magnetic distance',()=>{
  const margin=snapFooterRect({x:64,y:200,w:220,h:50},board);
  assert.equal(margin.rect.x,60);assert.equal(margin.rect.y,200);
  assert.ok(margin.guides.some(g=>g.label==='Left margin'&&g.value===60));
  const centre=snapFooterRect({x:388,y:250,w:220,h:50},board);
  assert.equal(centre.rect.x+centre.rect.w/2,500);
  const free=snapFooterRect({x:72,y:200,w:220,h:50},board);
  assert.deepEqual(free.rect,{x:72,y:200,w:220,h:50});assert.equal(free.guides.length,0);
});

test('text and logo can share a visible bottom edge without changing their size',()=>{
  const result=snapFooterRect({x:250,y:112,w:200,h:40},{...board,tolerance:4,other:{x:600,y:100,w:280,h:50}});
  assert.equal(result.rect.y+result.rect.h,150);assert.equal(result.rect.w,200);assert.equal(result.rect.h,40);
  assert.ok(result.guides.some(g=>g.label==='Bottom edges'&&g.start===250&&g.end===880));
});

test('resizing snaps the moving edge, preserving ratio and the opposite corner',()=>{
  const origin={x:100,y:100,w:200,h:50},rect={x:100,y:100,w:293,h:73.25};
  const result=snapFooterRect(rect,{width:460,height:400,margin:60,tolerance:8,origin,corner:'se',minScale:.4,maxScale:2.5});
  assert.equal(result.rect.x,100);assert.equal(result.rect.y,100);assert.equal(result.rect.x+result.rect.w,400);
  assert.equal(result.rect.w/result.rect.h,4);assert.ok(result.guides.some(g=>g.value===400));
  const limited=snapFooterRect(rect,{width:460,height:400,margin:60,tolerance:8,origin,corner:'se',minScale:.4,maxScale:1.4});
  assert.deepEqual(limited.rect,rect);
});

test('no snap can push a large item outside the board or fabricate a guide',()=>{
  const result=snapFooterRect({x:0,y:200,w:980,h:50},{...board,tolerance:70});
  assert.ok(result.rect.x>=0&&result.rect.x+result.rect.w<=1000);
  assert.ok(!result.guides.some(g=>g.axis==='x'&&g.value===60));
});
