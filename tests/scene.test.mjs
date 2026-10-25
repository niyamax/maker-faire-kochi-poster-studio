import test from 'node:test';
import assert from 'node:assert/strict';
import {createPosterScene,posterSVG,cleanHeadline,cleanDetail,TREATMENTS,PALETTES,FORMATS} from '../src/scene.js';
import {LOGO_DATA} from '../src/data/logo.js';
import {dragLetterOffset} from '../src/letter-drag.js';
import {treatmentSettings} from '../src/treatment.js';
import {FONT_IDS} from '../src/font-library.js';
import {normalizeFooter} from '../src/footer-layout.js';
import {LOOP_CURVES} from '../src/loop-motion.js';

test('line artwork has a dedicated portable stroke width independent of inflation',()=>{
  for(const direction of ['air','flex','packed']){
    const narrow=createPosterScene({direction,lettering:{render:'line',strokeWidth:2}}),wide=createPosterScene({direction,lettering:{render:'line',strokeWidth:12}});
    assert.deepEqual(narrow.cells,wide.cells);
    assert.notEqual(posterSVG(narrow),posterSVG(wide));
    assert.ok(wide.ops.filter(op=>op.stroke).every(op=>op.width===12||op.width===24));
  }
});

test('every selectable loop curve exports a closed seam without a quiet ending',()=>{
  for(const {id}of LOOP_CURVES)for(const direction of ['air','flex','packed']){
    const create=phase=>createPosterScene({direction,phase,motionCurve:id});
    assert.equal(posterSVG(create(0)),posterSVG(create(1)));
    assert.notEqual(posterSVG(create(.98)),posterSVG(create(.99)));
    assert.notEqual(posterSVG(create(.99)),posterSVG(create(0)));
  }
});

test('footer controls resize and move copy and logo independently without changing the lettering',()=>{
  const baseline=createPosterScene({format:'banner'});
  const footer=normalizeFooter({text:{size:150,x:8,y:-10},logo:{size:125,x:-5,y:-15}});
  const changed=createPosterScene({format:'banner',footer});
  assert.deepEqual(changed.cells,baseline.cells);
  assert.ok(Math.abs(changed.regions.details.w/baseline.regions.details.w-1.5)<1e-9);
  assert.ok(Math.abs(changed.regions.logo.w/baseline.regions.logo.w-1.25)<1e-9);
  assert.ok(changed.regions.details.x>baseline.regions.details.x&&changed.regions.details.y<baseline.regions.details.y);
  assert.ok(changed.regions.logo.x<baseline.regions.logo.x&&changed.regions.logo.y<baseline.regions.logo.y);
  assert.equal(changed.ops.at(-1).src,LOGO_DATA);
  assert.equal(posterSVG(changed),posterSVG(createPosterScene({format:'banner',footer:JSON.parse(JSON.stringify(footer))})));
  assert.notEqual(posterSVG(changed),posterSVG(baseline));
  assert.equal(posterSVG(createPosterScene({format:'banner',footer:normalizeFooter()})),posterSVG(baseline));
});

test('footer extremes stay on every artboard and preserve the supplied logo proportions',()=>{
  for(const format of Object.keys(FORMATS))for(const sign of [-1,1])for(const detail of ['', 'Build. Repair. Experiment.\nBring your curiosity.', 'Long supporting copy '.repeat(6)]){
    const scene=createPosterScene({format,detail,footer:{text:{size:250,x:sign*100,y:sign*100},logo:{size:250,x:sign*100,y:sign*100}}});
    for(const rect of [scene.regions.details,scene.regions.logo])assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=scene.width+.001&&rect.y+rect.h<=scene.height+.001);
    assert.ok(Math.abs(scene.regions.logo.w/scene.regions.logo.h-3871/646)<1e-9);
    assert.ok(!/NaN|Infinity|undefined/.test(posterSVG(scene)));
  }
  assert.deepEqual(normalizeFooter({text:{size:NaN,x:'20',y:Infinity}}),normalizeFooter());
});

test('lettering controls change the rendered scene and retain their settings through serialization',()=>{
  for(const direction of ['air','flex','packed']){
    const base=treatmentSettings(direction),rest=posterSVG(createPosterScene({direction,lettering:base}));
    for(const change of [{font:base.font==='original'?'bowlby':'original'},{contrast:.1},{pressure:.1},{variation:.1},{layout:'centered'},{style:base.style==='jostle'?'original':'jostle'},{render:base.render==='solid'?'line':'solid'}]){
      const settings=treatmentSettings(direction,{...base,...change});
      const svg=posterSVG(createPosterScene({direction,lettering:settings}));
      assert.notEqual(svg,rest,`${direction} ${Object.keys(change)[0]} affects the actual artwork`);
      assert.equal(svg,posterSVG(createPosterScene({direction,lettering:treatmentSettings(direction,JSON.parse(JSON.stringify(settings)))})));
    }
  }
  assert.equal(treatmentSettings('air',{font:'missing',contrast:-50,variation:100,pressure:NaN}).font,'original');
  assert.equal(treatmentSettings('air',{contrast:-50}).contrast,0);
  assert.equal(treatmentSettings('air',{variation:100}).variation,1);
});

test('all selectable fonts and treatments retain finite export geometry with maximum character',()=>{
  for(const font of FONT_IDS)for(const direction of ['air','flex','packed']){
    const scene=createPosterScene({direction,lettering:{font,variation:1,pressure:1,contrast:1},phase:.42,format:'story'});
    assert.ok(scene.cells.length===15);
    assert.ok(!/NaN|Infinity|undefined/.test(posterSVG(scene)));
  }

});

test('saved drag poses move the chosen letter and survive deterministic SVG export',()=>{
  for(const direction of ['air','flex','packed']){
    const baseline=createPosterScene({direction,format:'banner'}),base=baseline.cells[1],bounds=baseline.regions.type;
    const offsets=[];offsets[base.index]=dragLetterOffset(base,base,{x:0,y:0},{x:bounds.w*.035,y:bounds.h*.025},bounds);
    const changed=createPosterScene({direction,format:'banner',offsets});
    assert.notDeepEqual(changed.cells[1],base);
    assert.notEqual(posterSVG(changed),posterSVG(baseline));
    assert.equal(posterSVG(changed),posterSVG(createPosterScene({direction,format:'banner',offsets:JSON.parse(JSON.stringify(offsets))})));
    assert.deepEqual(changed.regions,baseline.regions,'dragging stays inside the type area without moving footer content');
    for(const c of changed.cells)assert.ok(c.x>=bounds.x-.001&&c.y>=bounds.y-.001&&c.x+c.w<=bounds.x+bounds.w+.001&&c.y+c.h<=bounds.y+bounds.h+.001);
    assert.equal(posterSVG(createPosterScene({direction,format:'banner',offsets:[]})),posterSVG(baseline));
  }
});

test('all treatments use finite portable geometry in every colour family and artboard format',()=>{
  for(const direction of TREATMENTS)for(const palette of PALETTES)for(const format of Object.keys(FORMATS))for(const phase of [0,.2,.5,.8,1]){
    const scene=createPosterScene({direction:direction.id,palette:palette.id,format,phase});
    assert.ok(scene.cells.length>0);
    for(const c of scene.cells)assert.ok([c.x,c.y,c.w,c.h,c.focus].every(Number.isFinite)&&c.w>0&&c.h>0);
    for(const op of scene.ops){
      if(op.matrix)assert.ok(op.matrix.every(Number.isFinite));
      if(op.d)assert.ok(!/NaN|Infinity|undefined/.test(op.d));
      if(op.clip)assert.ok(Object.values(op.clip).every(Number.isFinite)&&op.clip.w>0&&op.clip.h>0);
    }
    const logos=scene.ops.filter(op=>op.kind==='image');assert.equal(logos.length,1);assert.equal(logos[0].src,LOGO_DATA);
    assert.ok(Math.abs(logos[0].w/logos[0].h-3871/646)<1e-9,'the supplied logo is never stretched or recoloured');
    const a=scene.regions.details,b=scene.regions.logo;
    assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'details and logo have separate space even in square and wide formats');
  }
});

test('SVG exports keep vector copy and embed the original logo',()=>{
  for(const direction of TREATMENTS){
    const svg=posterSVG(createPosterScene({direction:direction.id,phase:.4}));
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('href="data:image/png;base64,'));
    assert.ok(!svg.includes('<text'),'supporting copy is portable outlined type');
    assert.ok(!/NaN|undefined|Infinity/.test(svg));
  }
});

test('editable copy and the motion phrase retain safe readable limits',()=>{
  assert.equal(cleanHeadline('a'.repeat(150)).length,120);
  assert.equal(cleanHeadline('<script>'), 'SCRIPT');
  assert.equal(cleanDetail('One\nTwo\nThree'),'One\nTwo');
  assert.ok(cleanDetail('A'.repeat(200)).length<=80);
  assert.ok(createPosterScene({headline:'   \n '}).cells.length>0);
});
