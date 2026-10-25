import test from 'node:test';
import assert from 'node:assert/strict';
import {fontGlyphMetrics,fontOpticalProfile} from '../src/font-library.js';
import {opticalPairGap,shareHeroWidth,craftedLetterMatrix} from '../src/letter-craft.js';
import {connectedRowResponses,LOOP_CURVES} from '../src/loop-motion.js';
import {layoutTreatment} from '../src/treatment.js';
import {createPosterScene,posterSVG} from '../src/scene.js';
import {dragLetterOffset} from '../src/letter-drag.js';

const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const rect={x:40,y:50,w:1000,h:650};
const sum=values=>values.reduce((a,b)=>a+b,0);
const box=cell=>[cell.x,cell.y,cell.w,cell.h];

test('optical gaps respond to the chosen font’s outer ink instead of a uniform tracking value',()=>{
  const gap=(font,a,b)=>opticalPairGap(font,{char:a,w:100},{char:b,w:100},8);
  for(const font of ['geist','inter','bowlby','dela']){
    assert.ok(gap(font,'O','O')<gap(font,'H','H'));
    assert.ok(gap(font,'A','V')<gap(font,'H','H'));
    for(const char of 'MAKERFAIREKOCHI'){
      const profile=fontOpticalProfile(font,char);
      assert.equal(profile.left.length,17);
      assert.ok([...profile.left,...profile.right].every(n=>Number.isFinite(n)&&n>=0&&n<=1));
    }
  }
  assert.notEqual(gap('geist','A','V'),gap('bowlby','A','V'));
});

test('one letter leads each row, while supporting letters retain the selected font’s relative proportions',()=>{
  const layout=layoutTreatment('COMING\nSOON',rect,'air',0,1,{font:'bowlby',contrast:.8,variation:.8});
  for(const row of layout.rows){
    const heroes=row.cells.filter(c=>c.craft.hero);assert.equal(heroes.length,1);
    const supporting=row.cells.filter(c=>!c.craft.hero).map(c=>c.w/fontGlyphMetrics('bowlby',c.char).width);
    supporting.forEach(value=>near(value,supporting[0]));
    assert.ok(heroes[0].w/fontGlyphMetrics('bowlby',heroes[0].char).width>supporting[0]*1.5);
    near(row.cells[0].x,row.x);near(row.cells.at(-1).x+row.cells.at(-1).w,row.x+row.w);
  }
});

test('an expanding hero borrows from its nearest neighbours and preserves the row width',()=>{
  const widths=[70,80,90,140,85,75,65],hero=3;
  for(const strain of [-.4,-.2,.1,.3,.6]){
    const result=shareHeroWidth(widths,hero,strain);
    near(sum(result),sum(widths));near(result[0],widths[0]);near(result[6],widths[6]);
    result.forEach((width,index)=>assert.ok(width>=widths[index]*.76));
    if(strain>0){assert.ok(result[hero]>widths[hero]);assert.ok(result[2]<widths[2]&&result[4]<widths[4]);}
    if(strain<0){assert.ok(result[hero]<widths[hero]);assert.ok(result[2]>widths[2]&&result[4]>widths[4]);}
  }
});

test('connected motion and final cell geometry have matching seam velocities on every curve',()=>{
  const group=Array.from({length:7},(_,col)=>({row:0,col})),epsilon=1e-6;
  for(const {id} of LOOP_CURVES){
    assert.deepEqual(connectedRowResponses(0,group,3,1,id),connectedRowResponses(1,group,3,1,id));
    const at=phase=>layoutTreatment('MAKER\nFAIRE\nKOCHI',rect,'air',phase,1,{font:'inter'},id);
    const rest=at(0),before=at(1-epsilon),after=at(epsilon);
    for(let i=0;i<rest.cells.length;i++)box(rest.cells[i]).forEach((value,k)=>near((value-box(before.cells[i])[k])/epsilon,(box(after.cells[i])[k]-value)/epsilon,.015));
    assert.ok(Math.hypot(...rest.cells.flatMap((c,i)=>box(c).map((value,k)=>(box(after.cells[i])[k]-value)/epsilon)))>10,'the loop crosses its seam in motion');
  }
});

test('refinement stays inside each selected layout and letter rotations respect their allocated boxes',()=>{
  for(const direction of ['air','flex','packed'])for(const layout of ['stack','offset','centered'])for(const phase of [0,.17,.43,.76,1]){
    const result=layoutTreatment('MAKER\nFAIRE\nKOCHI',rect,direction,phase,1.5,{font:'bowlby',layout,contrast:1,variation:1});
    for(const cell of result.cells){
      assert.ok(cell.x>=rect.x&&cell.y>=rect.y&&cell.x+cell.w<=rect.x+rect.w+.001&&cell.y+cell.h<=rect.y+rect.h+.001);
      const [a,b,c,d,e,f]=craftedLetterMatrix(cell,result.profile);
      for(const [x,y] of [[0,0],[cell.w,0],[0,cell.h],[cell.w,cell.h]]){
        const tx=a*x+c*y+e,ty=b*x+d*y+f;
        assert.ok(tx>=cell.x-.001&&tx<=cell.x+cell.w+.001&&ty>=cell.y-.001&&ty<=cell.y+cell.h+.001);
      }
    }
  }
});

test('saved letter anchors and footer placement remain intact; grabbing a refined letter never jumps',()=>{
  for(const direction of ['air','flex','packed']){
    const settings={direction,format:'poster',phase:.811,headline:'COMING\nSOON',detail:'Build. Repair. Experiment.\nBring your curiosity.',lettering:{font:'bowlby',layout:'stack',variation:0,contrast:.44},footer:{text:{size:141,x:11,y:-6},logo:{size:81.5,x:-27,y:-3}}};
    const before=createPosterScene(settings),visible=before.cells[1],base=before.baseCells[1],bounds=before.regions.type;
    const offsets=[];offsets[1]=dragLetterOffset(base,visible,{x:0,y:0},{x:0,y:0},bounds);
    const grabbed=createPosterScene({...settings,offsets});box(grabbed.cells[1]).forEach((n,i)=>near(n,box(visible)[i]));
    const saved=[{x:.025,y:.015,w:1.03,h:.91}],moved=createPosterScene({...settings,offsets:saved}),original=before.baseCells[0];
    near(moved.cells[0].x,original.x+.025*bounds.w);near(moved.cells[0].y,original.y+.015*bounds.h);
    near(moved.cells[0].w,original.w*1.03);near(moved.cells[0].h,original.h*.91);
    assert.deepEqual(moved.regions,before.regions);
    assert.equal(posterSVG(moved),posterSVG(createPosterScene(JSON.parse(JSON.stringify({...settings,offsets:saved})))));
  }
});
