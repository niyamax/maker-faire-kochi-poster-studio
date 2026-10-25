import test from 'node:test';
import assert from 'node:assert/strict';
import {FONT_CATALOG,FONT_IDS,fontGlyphGeometry,fontGlyphMetrics,fontSupports,fontSupportedGlyphs} from '../src/font-library.js';

const topology=geometry=>geometry.paths.map(d=>d.match(/[MLCQZ]/g).join(''));
const contours=d=>d.split('M').slice(1).map(part=>[...part.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(match=>[Number(match[1]),Number(match[2])]));
function winding(d,x,y){
  let value=0;
  for(const points of contours(d))for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const cross=(b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]);
    if(a[1]<=y&&b[1]>y&&cross>0)value++;
    if(a[1]>y&&b[1]<=y&&cross<0)value--;
  }
  return value;
}

test('the curated catalog exposes real anatomy and cap-height layout metrics',()=>{
  assert.equal(FONT_CATALOG.length,7);
  assert.equal(fontGlyphGeometry('original','A',100,100),null);
  assert.equal(fontGlyphGeometry('absent','A',100,100),null);
  const paths=FONT_IDS.filter(id=>id!=='original').map(id=>{
    assert.ok(fontSupports(id,'M'));
    assert.ok(fontGlyphMetrics(id,'M').width>fontGlyphMetrics(id,'I').width);
    assert.ok(fontGlyphMetrics(id,'O').hasCounter);
    return fontGlyphGeometry(id,'M',200,250).paths[0];
  });
  assert.equal(new Set(paths).size,6,'each choice changes the actual letter construction');
  assert.ok(fontGlyphMetrics('anton','M').width<fontGlyphMetrics('dela','M').width,'Anton is naturally condensed relative to Dela');
});

test('Geist and Inter are native heavy poster alphabets with full uppercase and number coverage',()=>{
  for(const id of ['geist','inter']){
    const font=FONT_CATALOG.find(item=>item.id===id);
    assert.equal(font.name,id==='geist'?'Geist':'Inter');
    assert.equal(font.axes.wght,900);
    if(id==='inter')assert.equal(font.axes.opsz,32);
    for(const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'){
      assert.ok(fontSupports(id,char),`${id} includes ${char}`);
      const geometry=fontGlyphGeometry(id,char,200,300,{pressure:.84,character:.82});
      assert.ok(geometry.paths.length>0&&geometry.paths.every(path=>path.startsWith('M')&&path.endsWith('Z')),`${id} ${char} is actual outlined artwork`);
    }
  }
});

test('every supported font glyph keeps bounded geometry and stable animation topology',()=>{
  for(const id of FONT_IDS.filter(id=>id!=='original'))for(const char of fontSupportedGlyphs(id)){
    const baseline=fontGlyphGeometry(id,char,180,250,{pressure:0,character:0});
    for(const [w,h,p] of [[180,250,1],[30,600,.5],[600,30,1]]){
      const geometry=fontGlyphGeometry(id,char,w,h,{pressure:p,character:1});
      assert.deepEqual(topology(geometry),topology(baseline),`${id} ${char} retains commands at ${w}×${h}`);
      for(const d of geometry.paths){
        assert.ok(!/NaN|Infinity/.test(d));
        assert.ok(d.endsWith('Z'));
        for(const points of contours(d))for(const [x,y] of points){
          assert.ok(x>=0&&x<=w&&y>=0&&y<=h,`${id} ${char} coordinate within cell`);
        }
      }
    }
  }
});

test('source counters stay open with default nonzero fill at maximum pressure',()=>{
  for(const id of FONT_IDS.filter(id=>id!=='original'))for(const [w,h] of [[160,220],[45,600],[600,45]]){
    const d=fontGlyphGeometry(id,'O',w,h,{pressure:1,character:1}).paths[0];
    assert.equal(winding(d,w/2,h/2),0,`${id} has an open O counter`);
    const area=points=>Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0));
    const outer=contours(d).sort((a,b)=>area(b)-area(a))[0];
    const ringPoint=outer[Math.floor(outer.length/4)];
    const nearInside=[ringPoint[0]*.96+w*.02,ringPoint[1]*.96+h*.02];
    assert.notEqual(winding(d,...nearInside),0,`${id} keeps a filled O ring`);
  }
});

test('font bowls use smooth curves while intentional angular letter corners survive',()=>{
  for(const id of ['dela','anton','bricolage','bowlby','geist','inter']){
    const bowl=fontGlyphGeometry(id,'O',320,440,{pressure:1,character:1}).paths[0];
    const corner=fontGlyphGeometry(id,'M',320,440,{pressure:1,character:1}).paths[0];
    assert.ok(bowl.includes('Q'),`${id} curves are no longer exported as faceted line segments`);
    assert.ok(corner.includes('L'),`${id} keeps its designed corners`);
  }
});

test('pressure changes source-font silhouettes while invalid sizes return empty geometry',()=>{
  for(const id of FONT_IDS.filter(id=>id!=='original')){
    assert.notDeepEqual(fontGlyphGeometry(id,'R',150,220,{pressure:0}),fontGlyphGeometry(id,'R',150,220,{pressure:1}));
    assert.deepEqual(fontGlyphGeometry(id,'A',-1,100).paths,[]);
    assert.deepEqual(fontGlyphGeometry(id,'A',NaN,100).paths,[]);
    assert.deepEqual(fontGlyphGeometry(id,' ',100,100).paths,[]);
  }
});
