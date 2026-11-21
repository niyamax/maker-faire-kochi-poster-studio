import {TREATMENTS,PALETTES,makerPaletteId} from './scene.js';
import {CUTOUTS} from './paper-shapes.js';
import {createProjectStore} from './project-store.js';
import {MAKER_FOOTER_DEFAULTS} from './footer-layout.js';

export const {STUDIO_STORAGE_KEY,STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject,switchStudioTreatment}=createProjectStore({
  kind:'maker-faire-poster',
  title:'Maker Faire Poster Studio',
  storageKey:'maker-poster-studio-v1',
  footerDefaults:MAKER_FOOTER_DEFAULTS,
  defaults:Object.freeze({direction:'air',palette:'maker-red',format:'poster',phase:0,energy:1,loop:true,motionCurve:'smooth',customColors:null,snapping:true,media:null}),
  normalizeEdition(state,source){
    state.palette=makerPaletteId(source.palette,state.palette);
    state.customColors=null;
    state.cutout=Object.hasOwn(CUTOUTS,source.cutout)?source.cutout:null;
    state.wrapMode=source.wrapMode==='letters'?'letters':'words';
  },
  treatments:TREATMENTS,
  palettes:PALETTES,
});
