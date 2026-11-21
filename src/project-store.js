import {FORMATS,cleanHeadline,cleanDetail} from './scene-renderer.js';
import {treatmentSettings} from './treatment.js';
import {normalizeFooter} from './footer-layout.js';
import {LOOP_CURVE_IDS} from './loop-motion.js';
import {normalizeLetterOffsets} from './letter-drag.js';
import {normalizePosterImage} from './poster-image.js';
import {normalizeHeadlineFrame} from './headline-frame.js';
export function createProjectStore({kind,title,storageKey,defaults,treatments,palettes,footerDefaults,letteringDefaults=treatmentSettings,normalizeEdition=()=>{}}){
  const defaultDrafts=()=>Object.fromEntries(treatments.map(d=>[d.id,{headline:d.headline,detail:d.detail,offsets:[],headlineFrame:normalizeHeadlineFrame(),lettering:letteringDefaults(d.id),footer:normalizeFooter(undefined,footerDefaults)}]));

  /** Treatments share content, placement, font and layout. Keep their expressive
   * settings independent and copy data so history and older projects stay intact. */
  function switchStudioTreatment(state,drafts,direction){
    if(direction===state.direction||!treatments.some(d=>d.id===direction))return;
    const current=drafts[state.direction],target=drafts[direction];
    if(!current||!target)return;
    for(const key of ['headline','detail','footer','offsets','headlineFrame'])target[key]=structuredClone(current[key]);
    target.lettering={...target.lettering,font:current.lettering.font,layout:current.lettering.layout};
    state.direction=direction;
  }

  function normalizeStudioProject(input){
    if(!input||typeof input.state!=='object'||!input.state||typeof input.drafts!=='object'||!input.drafts)throw Error('This file does not contain a Poster Studio project.');
    if(input.kind&&input.kind!==kind)throw Error(`Choose a ${title} project.`);
    if(input.kind&&input.version!==1)throw Error('This project version is not supported.');
    const source=input.state,state={...defaults},drafts=defaultDrafts();
    state.media=normalizePosterImage(source.media);
    if(treatments.some(d=>d.id===source.direction))state.direction=source.direction;
    if(palettes.some(p=>p.id===source.palette))state.palette=source.palette;
    if(Object.hasOwn(FORMATS,source.format))state.format=source.format;
    if(Number.isFinite(source.phase))state.phase=Math.max(0,Math.min(1,source.phase));
    if(Number.isFinite(source.energy))state.energy=Math.max(.35,Math.min(1.5,source.energy));
    if(LOOP_CURVE_IDS.includes(source.motionCurve))state.motionCurve=source.motionCurve;
    for(const key of ['loop','snapping'])if(typeof source[key]==='boolean'&&(key!=='loop'||source.motionCurve))state[key]=source[key];
    if(source.customColors&&['bg','fg','accent'].every(key=>/^#[0-9a-f]{6}$/i.test(source.customColors[key])))state.customColors=Object.fromEntries(['bg','fg','accent'].map(key=>[key,source.customColors[key]]));
    normalizeEdition(state,source);
    for(const d of treatments){
      const value=input.drafts[d.id];if(!value||typeof value!=='object')continue;
      drafts[d.id]={headline:cleanHeadline(typeof value.headline==='string'?value.headline:d.headline),detail:cleanDetail(typeof value.detail==='string'?value.detail:d.detail),offsets:normalizeLetterOffsets(value.offsets),headlineFrame:normalizeHeadlineFrame(value.headlineFrame),lettering:treatmentSettings(d.id,value.lettering??letteringDefaults(d.id)),footer:normalizeFooter(value.footer,footerDefaults)};
    }
    return {kind,version:1,state,drafts};
  }

  const studioProject=(state,drafts)=>normalizeStudioProject({kind,version:1,state,drafts});
  return {STUDIO_STORAGE_KEY:storageKey,STUDIO_DEFAULTS:defaults,defaultStudioDrafts:defaultDrafts,normalizeStudioProject,studioProject,switchStudioTreatment};
}
