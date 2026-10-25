import test from 'node:test';
import assert from 'node:assert/strict';
import {displaceLetters,dragLetterOffset,resizeLetterOffset,normalizeLetterOffsets,hitLetter} from '../src/letter-drag.js';
const bounds={x:0,y:0,w:500,h:400};
const cells=[{index:0,char:'A',row:0,col:0,x:20,y:20,w:100,h:120},{index:1,char:'B',row:0,col:1,x:130,y:20,w:100,h:120},{index:2,char:'C',row:0,col:2,x:240,y:20,w:100,h:120},{index:3,char:'D',row:1,col:0,x:20,y:190,w:100,h:120}];

test('a moved letter follows the grab point while adjacent letters yield',()=>{
  const offset=dragLetterOffset(cells[0],cells[0],{x:50,y:70},{x:130,y:70},bounds);
  const result=displaceLetters(cells,[offset],bounds);
  assert.equal(result[0].x,100);assert.equal(result[0].y,20);
  assert.equal(result[0].w,100);assert.equal(result[0].h,120,'Move does not quietly resize the held letter');
  assert.ok(result[1].x>cells[1].x+20,'the neighbouring letter visibly moves');
  assert.deepEqual(result[3],cells[3],'an untouched row stays still');
  assert.ok(result[1].x>=result[0].x+result[0].w-1,'the immediate neighbour clears the held letter');
});

test('dragging beyond the artboard clamps the held letter and keeps every letter inside',()=>{
  const offsets=[{x:1,y:1,w:1.3,h:1.2}];
  const result=displaceLetters(cells,offsets,bounds);
  assert.equal(result[0].x+result[0].w,500);assert.equal(result[0].y+result[0].h,400);
  for(const c of result){assert.ok([c.x,c.y,c.w,c.h].every(Number.isFinite));assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=500.001&&c.y+c.h<=400.001);}
});

test('reshaping changes dimensions explicitly, and saved offsets reproduce the same arrangement',()=>{
  const offset=dragLetterOffset(cells[1],cells[1],{x:170,y:60},{x:205,y:84},bounds,'reshape');
  assert.ok(offset.w>1&&offset.h>1);assert.equal(offset.x,0);assert.equal(offset.y,0);
  const offsets=[null,offset],first=displaceLetters(cells,offsets,bounds);
  assert.deepEqual(displaceLetters(cells,JSON.parse(JSON.stringify(offsets)),bounds),first);
  assert.equal(first[1].x,cells[1].x);
});

test('reset returns the exact authored arrangement and a previously yielded letter can be grabbed without a jump',()=>{
  assert.strictEqual(displaceLetters(cells,[],bounds),cells);
  const first=displaceLetters(cells,[{x:.16,y:0,w:1,h:1}],bounds),visible=first[1];
  const offset=dragLetterOffset(cells[1],visible,{x:200,y:80},{x:200,y:80},bounds);
  const next=displaceLetters(cells,[{x:.16,y:0,w:1,h:1},offset],bounds);
  assert.ok(Math.abs(next[1].x-visible.x)<.001&&Math.abs(next[1].w-visible.w)<.001);
});

test('positions validate before loading and hit testing chooses the topmost visible cell',()=>{
  assert.throws(()=>normalizeLetterOffsets([{x:NaN}]));assert.throws(()=>normalizeLetterOffsets(Array(121).fill(null)));
  assert.deepEqual(normalizeLetterOffsets([{x:4,y:-3,w:20,h:.01}]),[{x:1,y:-1,w:1.8,h:.45}]);
  assert.equal(hitLetter([{...cells[0]}, {...cells[1],x:20}],{x:40,y:40}).index,1);
  assert.equal(hitLetter(cells,{x:490,y:390}),null);
});

test('letter edge and corner handles track the pointer while the opposite edges stay fixed',()=>{
  const cell=cells[1],right=cell.x+cell.w,bottom=cell.y+cell.h;
  const west=resizeLetterOffset(cell,cell,{x:0,y:0},{x:30,y:60},bounds,'w');
  const reshaped=displaceLetters(cells,[null,west],bounds)[1];
  assert.equal(reshaped.x,160);assert.equal(reshaped.x+reshaped.w,right);assert.equal(reshaped.h,cell.h);
  const corner=resizeLetterOffset(cell,cell,{x:0,y:0},{x:-20,y:-20},bounds,'nw');
  const expanded=displaceLetters(cells,[null,corner],bounds)[1];
  assert.equal(expanded.x,110);assert.equal(expanded.y,0);assert.equal(expanded.x+expanded.w,right);assert.equal(expanded.y+expanded.h,bottom);
});
