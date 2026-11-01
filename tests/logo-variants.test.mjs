import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGO_VARIANTS,DEFAULT_LOGO_VARIANT,getLogoVariant} from '../src/logo-library.js';
import {createPosterScene,posterSVG,FORMATS} from '../src/scene.js';
import {STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject,switchStudioTreatment} from '../src/project-state.js';
import {normalizeFooter,alignFooterRect,footerSettingsFromRect} from '../src/footer-layout.js';
import {VISIBLE_PALETTE_IDS,retainCurrentOption} from '../src/editor-config.js';
import {PALETTES} from '../src/scene.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} ≠ ${expected}`);

test('all logo variants render at native proportions with separate footer space in every format',()=>{
  assert.equal(LOGO_VARIANTS.length,9);
  for(const variant of LOGO_VARIANTS)for(const format of Object.keys(FORMATS)){
    const scene=createPosterScene({logoVariant:variant.id,format}),logo=scene.regions.logo,copy=scene.regions.details;
    near(logo.w/logo.h,variant.width/variant.height);
    assert.equal(scene.ops.at(-1).src,variant.src);
    assert.ok(logo.x+logo.w<=copy.x||copy.x+copy.w<=logo.x||logo.y+logo.h<=copy.y||copy.y+copy.h<=logo.y);
    assert.ok(logo.y>=scene.regions.type.y+scene.regions.type.h,'the default logo stays below the lettering');
    assert.ok(posterSVG(scene).includes(variant.src));
    const baseline=createPosterScene({format});
    assert.deepEqual(scene.cells,baseline.cells,'logo choices do not change the lettering');
    for(const sign of [-1,1]){
      const footer=normalizeFooter({logo:{size:250,x:sign*100,y:sign*100}});
      const extreme=createPosterScene({logoVariant:variant.id,format,footer}),box=extreme.regions.logo;
      near(box.w/box.h,variant.width/variant.height);
      assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=extreme.width+.001&&box.y+box.h<=extreme.height+.001);
      const aligned=alignFooterRect(box,extreme.width,extreme.height,extreme.margin,'center');
      footer.logo.x=footerSettingsFromRect(extreme.footerBases.logo,aligned,extreme.width,extreme.height).x;
      const changed=createPosterScene({logoVariant:variant.id,format,footer});
      near(changed.regions.logo.x+changed.regions.logo.w/2,changed.width/2);
    }
  }
});

test('logo selection round trips through projects and treatment switches; old and invalid choices use the original',()=>{
  const drafts=defaultStudioDrafts();
  for(const variant of LOGO_VARIANTS){
    const state={...STUDIO_DEFAULTS,logoVariant:variant.id};
    const opened=normalizeStudioProject(JSON.parse(JSON.stringify(studioProject(state,drafts))));
    assert.equal(opened.state.logoVariant,variant.id);
    const before=posterSVG(createPosterScene({...state,...drafts.air}));
    assert.equal(posterSVG(createPosterScene({...opened.state,...opened.drafts.air})),before);
    switchStudioTreatment(opened.state,opened.drafts,'flex');
    assert.equal(opened.state.logoVariant,variant.id);
    assert.equal(createPosterScene({...opened.state,...opened.drafts.flex}).ops.at(-1).src,variant.src);
  }
  for(const logoVariant of [undefined,null,'unknown','__proto__']){
    const opened=normalizeStudioProject({state:{logoVariant},drafts});
    assert.equal(opened.state.logoVariant,DEFAULT_LOGO_VARIANT);
  }
});

test('palette choices stay within Maker Faire while existing saved palettes remain available',()=>{
  assert.deepEqual(VISIBLE_PALETTE_IDS,['maker-red','maker','maker-cyan']);
  const old=normalizeStudioProject({state:{palette:'noise'},drafts:defaultStudioDrafts()});
  assert.equal(old.state.palette,'noise');
  assert.ok(retainCurrentOption(PALETTES,VISIBLE_PALETTE_IDS,old.state.palette).some(p=>p.id==='noise'));
});
