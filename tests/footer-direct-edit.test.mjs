import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFooter,placeFooterItem,dragFooterItem,footerSettingsFromRect,alignFooterRect} from '../src/footer-layout.js';
import {createPosterScene,posterSVG} from '../src/scene.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} ≠ ${expected}`);

test('grabbing a footer item follows the pointer, including after a previous offset hit the board edge',()=>{
  const base={rect:{x:700,y:650,w:240,h:40},anchor:{x:1,y:1}};
  const visible=placeFooterItem(base.rect,{size:130,x:100,y:100},1000,800,base.anchor);
  const settings=dragFooterItem(base,visible,1000,800,{x:5,y:9},{x:-75,y:-41});
  const moved=placeFooterItem(base.rect,settings,1000,800,base.anchor);
  near(moved.x,visible.x-80);near(moved.y,visible.y-50);near(moved.w,visible.w);near(moved.h,visible.h);
  const still=placeFooterItem(base.rect,dragFooterItem(base,visible,1000,800,{x:5,y:9},{x:5,y:9}),1000,800,base.anchor);
  near(still.x,visible.x);near(still.y,visible.y);
});

test('every resize corner keeps its opposite fixed and never distorts or leaves the board',()=>{
  const base={rect:{x:300,y:350,w:240,h:60},anchor:{x:0,y:1}},width=1000,height=800;
  for(const corner of ['nw','ne','se','sw'])for(const distance of [50,5000,-5000]){
    const sx=corner.includes('w')?-1:1,sy=corner.includes('n')?-1:1;
    const old=placeFooterItem(base.rect,{size:100,x:0,y:0},width,height,base.anchor);
    const settings=dragFooterItem(base,old,width,height,{x:0,y:0},{x:sx*distance,y:sy*distance},corner);
    const resized=placeFooterItem(base.rect,settings,width,height,base.anchor);
    near(resized.w/resized.h,4);
    near(resized.x+(sx<0?resized.w:0),old.x+(sx<0?old.w:0));
    near(resized.y+(sy<0?resized.h:0),old.y+(sy<0?old.h:0));
    assert.ok(resized.x>=0&&resized.y>=0&&resized.x+resized.w<=width+.001&&resized.y+resized.h<=height+.001);
    assert.ok(settings.size>=40&&settings.size<=250);
  }
});

test('canvas gestures produce saved footer settings and portable exports in every format',()=>{
  for(const format of ['banner','square','poster','story'])for(const part of ['text','logo']){
    const before=createPosterScene({format}),key=part==='text'?'details':'logo',old=before.regions[key];
    const footer=normalizeFooter();
    footer[part]=dragFooterItem(before.footerBases[part],old,before.width,before.height,{x:0,y:0},{x:-50,y:-80});
    const moved=createPosterScene({format,footer});
    footer[part]=dragFooterItem(moved.footerBases[part],moved.regions[key],before.width,before.height,{x:0,y:0},{x:45,y:18},'se');
    const edited=createPosterScene({format,footer});
    assert.deepEqual(edited.cells,before.cells);
    assert.notEqual(posterSVG(edited),posterSVG(before));
    assert.equal(posterSVG(edited),posterSVG(createPosterScene({format,footer:JSON.parse(JSON.stringify(footer))})));
    assert.ok(!posterSVG(edited).includes('#1769E0'),'selection UI is not part of the exported scene');
  }
});

test('poster alignment places text and logo ink at shared margins or centre without changing their size or other axis',()=>{
  const actions=['left','center','right','top','middle','bottom'];
  for(const format of ['banner','square','poster','story'])for(const part of ['text','logo'])for(const action of actions){
    const footer=normalizeFooter({text:{size:81.5,x:12,y:-14},logo:{size:163,x:-9,y:-17}});
    const before=createPosterScene({format,footer}),key=part==='text'?'details':'logo',otherKey=part==='text'?'logo':'details';
    const old=before.regions[key],settings={...footer[part]},axis=['left','center','right'].includes(action)?'x':'y',otherAxis=axis==='x'?'y':'x';
    const box=alignFooterRect(old,before.width,before.height,before.margin,action);
    footer[part][axis]=footerSettingsFromRect(before.footerBases[part],box,before.width,before.height)[axis];
    const after=createPosterScene({format,footer}),actual=after.regions[key];
    if(action==='left')near(actual.x,after.margin);
    if(action==='center')near(actual.x+actual.w/2,after.width/2);
    if(action==='right')near(actual.x+actual.w,after.width-after.margin);
    if(action==='top')near(actual.y,after.margin);
    if(action==='middle')near(actual.y+actual.h/2,after.height/2);
    if(action==='bottom')near(actual.y+actual.h,after.height-after.margin);
    near(actual.w,old.w);near(actual.h,old.h);near(actual[otherAxis],old[otherAxis]);
    assert.equal(footer[part].size,settings.size);assert.equal(footer[part][otherAxis],settings[otherAxis]);
    assert.deepEqual(after.regions[otherKey],before.regions[otherKey]);assert.deepEqual(after.cells,before.cells);
    const repeated=alignFooterRect(actual,after.width,after.height,after.margin,action);
    for(const key of ['x','y','w','h'])near(repeated[key],actual[key]);
    assert.equal(posterSVG(after),posterSVG(createPosterScene({format,footer:JSON.parse(JSON.stringify(footer))})));
  }
});

test('aligning canvas-clamped artwork retains its requested size and remains draggable without a jump',()=>{
  const format='story',footer=normalizeFooter({logo:{size:250,x:100,y:100}});
  const before=createPosterScene({format,footer}),old=before.regions.logo;
  near(old.w,before.width);
  assert.ok(old.w/before.footerBases.logo.rect.w*100<footer.logo.size,'the requested size exceeds the canvas fit');
  for(const action of ['left','center','right','top','middle','bottom']){
    const axis=['left','center','right'].includes(action)?'x':'y',otherAxis=axis==='x'?'y':'x';
    const aligned=normalizeFooter(footer),box=alignFooterRect(old,before.width,before.height,before.margin,action);
    aligned.logo[axis]=footerSettingsFromRect(before.footerBases.logo,box,before.width,before.height)[axis];
    const after=createPosterScene({format,footer:aligned}),actual=after.regions.logo;
    assert.equal(aligned.logo.size,250);assert.equal(aligned.logo[otherAxis],footer.logo[otherAxis]);
    near(actual.w,old.w);near(actual.h,old.h);near(actual[otherAxis],old[otherAxis]);
    assert.ok(actual.x>=0&&actual.y>=0&&actual.x+actual.w<=after.width+.001&&actual.y+actual.h<=after.height+.001);
    const grabbed=dragFooterItem(after.footerBases.logo,actual,after.width,after.height,{x:40,y:60},{x:40,y:60});
    const stationary=placeFooterItem(after.footerBases.logo.rect,grabbed,after.width,after.height,after.footerBases.logo.anchor);
    for(const key of ['x','y','w','h'])near(stationary[key],actual[key]);
    assert.equal(posterSVG(after),posterSVG(createPosterScene({format,footer:JSON.parse(JSON.stringify(aligned))})));
  }
});
