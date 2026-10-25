import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject,switchStudioTreatment} from '../src/project-state.js';
import {createPosterScene,posterSVG} from '../src/scene.js';
import {retainCurrentOption,VISIBLE_FONT_IDS} from '../src/editor-config.js';
import {FONT_CATALOG} from '../src/font-library.js';

test('an existing studio project migrates without losing custom wording, type, palette or placement',()=>{
  const drafts=defaultStudioDrafts();drafts.air.headline='COMING SOON';drafts.air.lettering.font='anton';drafts.air.lettering.variation=.03;
  drafts.air.footer.logo={size:130,x:12,y:-5};drafts.air.offsets=[{x:.02,y:0,w:1.1,h:.95}];
  const old={state:{...STUDIO_DEFAULTS,format:'story',palette:'maker'},drafts};
  const project=normalizeStudioProject(old);
  assert.equal(project.drafts.air.headline,'COMING SOON');assert.equal(project.drafts.air.lettering.font,'anton');assert.equal(project.drafts.air.lettering.variation,.03);
  assert.deepEqual(project.drafts.air.footer.logo,drafts.air.footer.logo);assert.deepEqual(project.drafts.air.offsets,drafts.air.offsets);
  assert.equal(posterSVG(createPosterScene({...project.state,...project.drafts.air})),posterSVG(createPosterScene({...old.state,...drafts.air})));
});

test('saved project files restore all treatments and produce the same exported artwork',()=>{
  const drafts=defaultStudioDrafts();drafts.air.lettering.font='inter';drafts.air.lettering.strokeWidth=12;drafts.flex.detail='Make something.\nShare it with Kochi.';drafts.packed.lettering.font='dela';
  const state={...STUDIO_DEFAULTS,direction:'packed',phase:.36,motionCurve:'elastic',customColors:{bg:'#112233',fg:'#FFFFFF',accent:'#ED1C24'}};
  const saved=studioProject(state,drafts),opened=normalizeStudioProject(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(opened,saved);assert.equal(opened.drafts.air.lettering.font,'inter');assert.equal(opened.drafts.air.lettering.strokeWidth,12);assert.equal(opened.state.motionCurve,'elastic');
  assert.equal(posterSVG(createPosterScene({...opened.state,...opened.drafts.packed})),posterSVG(createPosterScene({...state,...drafts.packed})));
  const choices=retainCurrentOption(FONT_CATALOG,VISIBLE_FONT_IDS,opened.drafts.packed.lettering.font);
  assert.ok(choices.some(c=>c.id==='dela'),'the selected font remains available');
});

test('invalid project files fail before replacing the current design',()=>{
  assert.throws(()=>normalizeStudioProject({}),/project/);
  assert.throws(()=>normalizeStudioProject({kind:'other',state:{},drafts:{}}),/Choose/);
  assert.throws(()=>normalizeStudioProject({kind:'maker-faire-poster',version:2,state:{},drafts:{}}),/version/);
  const drafts=defaultStudioDrafts();drafts.air.offsets=[{x:Infinity}];
  assert.throws(()=>normalizeStudioProject({state:{},drafts}),/position/);
});

test('switching treatments changes lettering while preserving the current poster and footer geometry',()=>{
  for(const format of ['banner','square','poster','story']){
    const state={...STUDIO_DEFAULTS,format},drafts=defaultStudioDrafts();
    Object.assign(drafts.air,{headline:'COMING\nSOON',detail:'Make something.\nBring your curiosity.',footer:{text:{size:119,x:3,y:-8},logo:{size:81.5,x:-37.2,y:-4}},offsets:[{x:.01,y:.02,w:1.1,h:.9}]});
    Object.assign(drafts.air.lettering,{font:'geist',layout:'offset'});
    const original=structuredClone(drafts.air),before=createPosterScene({...state,...original});
    for(const direction of ['flex','packed','air']){
      const lettering=structuredClone(drafts[direction].lettering);
      switchStudioTreatment(state,drafts,direction);
      const current=drafts[direction],scene=createPosterScene({...state,...current});
      assert.equal(state.direction,direction);
      for(const key of ['headline','detail','footer','offsets'])assert.deepEqual(current[key],original[key]);
      assert.deepEqual(current.lettering,{...lettering,font:'geist',layout:'offset'});
      assert.deepEqual(scene.regions.details,before.regions.details);
      assert.deepEqual(scene.regions.logo,before.regions.logo);
      if(direction!=='air')assert.notEqual(posterSVG(scene),posterSVG(before));
    }
  }
});

test('edits in any treatment travel to the next, including after saving or opening a treatment URL',()=>{
  const state={...STUDIO_DEFAULTS},drafts=defaultStudioDrafts();
  drafts.air.headline='A NEW POSTER';drafts.air.detail='';
  Object.assign(drafts.air.lettering,{font:'geist',layout:'offset'});
  const undo=studioProject(state,drafts);
  switchStudioTreatment(state,drafts,'flex');
  drafts.flex.headline='UPDATED\nIN FLEX';drafts.flex.footer.logo.x=-23;
  Object.assign(drafts.flex.lettering,{font:'inter',layout:'centered'});
  assert.equal(drafts.air.headline,'A NEW POSTER');
  assert.equal(drafts.air.lettering.font,'geist');
  assert.equal(drafts.air.lettering.layout,'offset');
  assert.equal(undo.drafts.flex.headline,'MAKER FAIRE\nKOCHI');
  const opened=normalizeStudioProject(JSON.parse(JSON.stringify(studioProject(state,drafts))));
  switchStudioTreatment(opened.state,opened.drafts,'packed');
  assert.equal(opened.drafts.packed.headline,'UPDATED\nIN FLEX');
  assert.equal(opened.drafts.packed.detail,'');
  assert.equal(opened.drafts.packed.footer.logo.x,-23);
  assert.equal(opened.drafts.packed.lettering.font,'inter');
  assert.equal(opened.drafts.packed.lettering.layout,'centered');
  switchStudioTreatment(opened.state,opened.drafts,'air');
  assert.equal(opened.drafts.air.headline,'UPDATED\nIN FLEX');
  assert.equal(opened.drafts.air.footer.logo.x,-23);
  assert.equal(opened.drafts.air.lettering.font,'inter');
  assert.equal(opened.drafts.air.lettering.layout,'centered');
});
