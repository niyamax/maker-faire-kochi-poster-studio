import {TREATMENTS,PALETTES,FORMATS,cleanHeadline,cleanDetail} from './scene.js';
import {treatmentSettings} from './treatment.js';
import {normalizeFooter} from './footer-layout.js';
import {LOOP_CURVE_IDS} from './loop-motion.js';
import {normalizeLetterOffsets} from './letter-drag.js';
import {normalizePosterImage} from './poster-image.js';
export const STUDIO_STORAGE_KEY='maker-poster-studio-v1';
export const STUDIO_DEFAULTS=Object.freeze({direction:'air',palette:'maker-red',format:'poster',phase:0,energy:1,loop:true,motionCurve:'smooth',customColors:null,snapping:true,media:null});
export const defaultStudioDrafts=()=>Object.fromEntries(TREATMENTS.map(d=>[d.id,{headline:d.headline,detail:d.detail,offsets:[],lettering:treatmentSettings(d.id),footer:normalizeFooter()}]));

/** Treatments share content, placement, font and layout. Keep their expressive
 * settings independent and copy data so history and older projects stay intact. */
export function switchStudioTreatment(state,drafts,direction){
  if(direction===state.direction||!TREATMENTS.some(d=>d.id===direction))return;
  const current=drafts[state.direction],target=drafts[direction];
  if(!current||!target)return;
  for(const key of ['headline','detail','footer','offsets'])target[key]=structuredClone(current[key]);
  target.lettering={...target.lettering,font:current.lettering.font,layout:current.lettering.layout};
  state.direction=direction;
}

export function normalizeStudioProject(input){
  if(!input||typeof input.state!=='object'||!input.state||typeof input.drafts!=='object'||!input.drafts)throw Error('This file does not contain a Poster Studio project.');
  if(input.kind&&input.kind!=='maker-faire-poster')throw Error('Choose a Maker Faire Poster Studio project.');
  if(input.kind&&input.version!==1)throw Error('This project version is not supported.');
  const source=input.state,state={...STUDIO_DEFAULTS},drafts=defaultStudioDrafts();
  state.media=normalizePosterImage(source.media);
  if(TREATMENTS.some(d=>d.id===source.direction))state.direction=source.direction;
  if(PALETTES.some(p=>p.id===source.palette))state.palette=source.palette;
  if(FORMATS[source.format])state.format=source.format;
  if(Number.isFinite(source.phase))state.phase=Math.max(0,Math.min(1,source.phase));
  if(Number.isFinite(source.energy))state.energy=Math.max(.35,Math.min(1.5,source.energy));
  if(LOOP_CURVE_IDS.includes(source.motionCurve))state.motionCurve=source.motionCurve;
  for(const key of ['loop','snapping'])if(typeof source[key]==='boolean'&&(key!=='loop'||source.motionCurve))state[key]=source[key];
  if(source.customColors&&['bg','fg','accent'].every(key=>/^#[0-9a-f]{6}$/i.test(source.customColors[key])))state.customColors=Object.fromEntries(['bg','fg','accent'].map(key=>[key,source.customColors[key]]));
  for(const d of TREATMENTS){
    const value=input.drafts[d.id];if(!value||typeof value!=='object')continue;
    drafts[d.id]={headline:cleanHeadline(typeof value.headline==='string'?value.headline:d.headline),detail:cleanDetail(typeof value.detail==='string'?value.detail:d.detail),offsets:normalizeLetterOffsets(value.offsets),lettering:treatmentSettings(d.id,value.lettering),footer:normalizeFooter(value.footer)};
  }
  return {kind:'maker-faire-poster',version:1,state,drafts};
}

export const studioProject=(state,drafts)=>normalizeStudioProject({kind:'maker-faire-poster',version:1,state,drafts});
