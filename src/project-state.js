import {TREATMENTS,PALETTES,makerPaletteId} from './scene.js';
import {DEFAULT_LOGO_VARIANT,getLogoVariant} from './logo-library.js';
import {FLOW_CURVE} from './flow-motion.js';
import {CUTOUTS} from './paper-shapes.js';
import {createProjectStore} from './project-store.js';
import {MAKER_FOOTER_DEFAULTS} from './footer-layout.js';

export const {STUDIO_STORAGE_KEY,STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject,switchStudioTreatment}=createProjectStore({
  kind:'maker-faire-poster',
  title:'Maker Faire Poster Studio',
  storageKey:'maker-poster-studio-v1',
  footerDefaults:MAKER_FOOTER_DEFAULTS,
  defaults:Object.freeze({direction:'air',palette:'maker-red',format:'poster',phase:0,energy:1,loop:true,motionCurve:FLOW_CURVE,customColors:null,snapping:true,media:null,logoVariant:DEFAULT_LOGO_VARIANT}),
  normalizeEdition(state,source){
    state.palette=makerPaletteId(source.palette,state.palette);
    state.customColors=null;
    state.logoVariant=getLogoVariant(source.logoVariant).id;
    state.cutout=Object.hasOwn(CUTOUTS,source.cutout)?source.cutout:null;
    state.wrapMode=source.wrapMode==='letters'?'letters':'words';
  },
  treatments:TREATMENTS,
  palettes:PALETTES,
});
