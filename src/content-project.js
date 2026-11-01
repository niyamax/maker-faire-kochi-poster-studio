import {STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject} from './project-state.js';
import {normalizePosterImage} from './poster-image.js';
import {getLogoVariant} from './logo-library.js';

export const CONTENT_TYPES=Object.freeze([
  Object.freeze({id:'maker',label:'Maker Spotlight'}),
  Object.freeze({id:'workshop',label:'Workshop'}),
  Object.freeze({id:'poster',label:'Poster'}),
]);
export const CONTENT_FORMATS=Object.freeze({
  feed:Object.freeze({name:'Feed',w:1080,h:1350}),
  story:Object.freeze({name:'Story',w:1080,h:1920}),
});
export const CONTENT_PALETTE_IDS=Object.freeze(['maker-red','maker','maker-cyan']);
export const CONTENT_MAX_ASSETS=8;
export const CONTENT_MAX_PAGES=30;
const types=new Set(CONTENT_TYPES.map(type=>type.id)),roles=new Set(['cover','details','closing']);
const fields=Object.freeze({name:240,project:240,description:8000,handle:240,title:400,host:240,date:240,time:120,duration:120,location:500,url:2000});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
let sequence=0;
const freshId=()=>globalThis.crypto?.randomUUID?.()||`content-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const timestamp=()=>new Date().toISOString();
function text(value,fallback='',limit=8000,label='Text'){
  if(value===undefined)return fallback;
  if(typeof value!=='string')throw new Error(`${label} must be text.`);
  if(value.length>limit)throw new Error(`${label} is too long (maximum ${limit} characters).`);
  return value;
}
function identifier(value,label){
  const id=value===undefined?freshId():text(value,'',120,label);
  if(!id.trim())throw new Error(`${label} is missing.`);
  return id;
}
function list(value,fallback,limit,label){
  if(value===undefined)return fallback;
  if(!Array.isArray(value)||value.length>limit)throw new Error(`${label} must contain at most ${limit} entries.`);
  return value;
}
function unique(values,label){
  const seen=new Set();
  for(const value of values){if(seen.has(value.id))throw new Error(`${label} contains a duplicate ID.`);seen.add(value.id);}
}
function crop(value={}){
  if(!object(value))throw new Error('Image placement must be an object.');
  return Object.fromEntries([['zoom',1,1,4],['focusX',.5,0,1],['focusY',.5,0,1]].map(([key,fallback,min,max])=>{
    const n=value[key];
    if(n!==undefined&&!Number.isFinite(n))throw new Error('Image placement must use finite numbers.');
    return [key,n===undefined?fallback:Math.max(min,Math.min(max,n))];
  }));
}

export function normalizeContentEvent(value={}){
  if(!object(value))throw new Error('Event details must be an object.');
  return {
    name:text(value.name,'Maker Faire Kochi',240,'Event name'),
    dates:text(value.dates,'',240,'Event dates'),
    venue:text(value.venue,'',500,'Event venue'),
    url:text(value.url,'',2000,'Event link'),
  };
}

export function createContentPage(role='details'){
  if(!roles.has(role))throw new Error('Choose a cover, details or closing page.');
  return {id:freshId(),role,heading:'',body:'',assetId:null};
}
function defaultPages(type){return (type==='poster'?['cover']:['cover','details','closing']).map(createContentPage);}
function normalizeAsset(value){
  if(!object(value))throw new Error('This image is invalid.');
  const checked=normalizePosterImage({asset:value}).asset;
  return {...checked,id:identifier(value.id,'Image ID'),name:text(value.name,'Image',500,'Image name')};
}

export function normalizeContentItem(value){
  if(!object(value)||!types.has(value.type))throw new Error('Choose a Maker Spotlight, Workshop or Poster content item.');
  const content=value.content??{};
  if(!object(content))throw new Error('Content fields must be an object.');
  const partner=value.partner??{};
  if(!object(partner))throw new Error('Partner details must be an object.');
  const assets=list(value.assets,[],CONTENT_MAX_ASSETS,'Images').map(normalizeAsset);
  unique(assets,'Images');
  const pages=list(value.pages,defaultPages(value.type),CONTENT_MAX_PAGES,'Pages').map(page=>{
    if(!object(page)||!roles.has(page.role))throw new Error('Choose a cover, details or closing page.');
    const assetId=page.assetId==null?null:identifier(page.assetId,'Page image ID');
    if(assetId&&!assets.some(asset=>asset.id===assetId))throw new Error('A page refers to an image that is missing from this project.');
    return {id:identifier(page.id,'Page ID'),role:page.role,heading:text(page.heading,'',500,'Page heading'),body:text(page.body,'',8000,'Page text'),assetId};
  });
  if(!pages.length)throw new Error('Keep at least one page in this content item.');
  unique(pages,'Pages');
  const variants=value.variants??{};
  if(!object(variants))throw new Error('Output versions must be an object.');
  const result={
    id:identifier(value.id,'Content ID'),
    type:value.type,
    title:text(value.title,'',300,'Content name'),
    content:Object.fromEntries(Object.entries(fields).map(([key,limit])=>[key,text(content[key],'',limit,key==='description'?'Description':key)])),
    palette:CONTENT_PALETTE_IDS.includes(value.palette)?value.palette:'maker-red',
    logoVariant:getLogoVariant(value.logoVariant).id,
    logoColourMode:value.logoColourMode==='auto'?'auto':'manual',
    treatment:['air','flex','packed'].includes(value.treatment)?value.treatment:'air',
    assets,pages,
    partner:{name:text(partner.name,'',240,'Partner name'),asset:partner.asset==null?null:normalizeAsset(partner.asset)},
    variants:{feed:crop(variants.feed),story:crop(variants.story)},
    caption:text(value.caption,'',8000,'Caption'),
    altText:text(value.altText,'',8000,'Image description'),
  };
  if(value.type==='poster')result.legacyProject=value.legacyProject===undefined
    ?studioProject({...STUDIO_DEFAULTS},defaultStudioDrafts())
    :normalizeStudioProject(value.legacyProject);
  return result;
}

export function createContentItem(type='maker',event={}){
  if(!types.has(type))throw new Error('Choose a Maker Spotlight, Workshop or Poster content item.');
  normalizeContentEvent(event);
  return normalizeContentItem({type,pages:defaultPages(type),logoColourMode:type==='poster'?'manual':'auto'});
}
export function contentItemLabel(item){
  const title=typeof item?.title==='string'?item.title.trim():'';
  if(title)return title;
  const content=item?.content||{};
  if(item?.type==='maker')return content.name?.trim()||content.project?.trim()||'Untitled maker spotlight';
  if(item?.type==='workshop')return content.title?.trim()||'Untitled workshop';
  const project=item?.legacyProject;
  return project?.drafts?.[project?.state?.direction]?.headline?.split('\n').filter(Boolean).join(' ')||'Untitled poster';
}
export function duplicateContentItem(item){
  const copy=normalizeContentItem(structuredClone(item)),ids=new Map();
  copy.id=freshId();copy.title=`${contentItemLabel(item).slice(0,295)} copy`;
  for(const asset of copy.assets){const old=asset.id;asset.id=freshId();ids.set(old,asset.id);}
  for(const page of copy.pages){page.id=freshId();if(page.assetId)page.assetId=ids.get(page.assetId);}
  if(copy.partner.asset)copy.partner.asset.id=freshId();
  return copy;
}
function fromLegacy(input){
  const legacy=normalizeStudioProject(input),item=createContentItem('poster');
  item.legacyProject=legacy;
  item.palette=CONTENT_PALETTE_IDS.includes(legacy.state.palette)?legacy.state.palette:'maker-red';
  item.logoVariant=legacy.state.logoVariant;
  item.treatment=legacy.state.direction;
  return item;
}
export function createWorkspace({legacyPoster}={}){
  return {kind:'maker-faire-content-studio',version:2,event:normalizeContentEvent(),items:legacyPoster?[fromLegacy(legacyPoster)]:[],updatedAt:timestamp()};
}
export function normalizeWorkspace(input){
  if(!object(input))throw new Error('Choose a Content Studio project.');
  if(input.kind==='maker-faire-poster'||(!input.kind&&object(input.state)&&object(input.drafts)))return createWorkspace({legacyPoster:input});
  if(input.kind!=='maker-faire-content-studio')throw new Error('Choose a Content Studio or Poster Studio project.');
  if(input.version!==2)throw new Error('This Content Studio project version is not supported.');
  if(!Array.isArray(input.items))throw new Error('This Content Studio project must contain an items array.');
  const items=list(input.items,[],500,'Content library').map(normalizeContentItem);
  unique(items,'Content library');
  const updatedAt=text(input.updatedAt,timestamp(),100,'Project date');
  if(!Number.isFinite(Date.parse(updatedAt)))throw new Error('This project has an invalid saved date.');
  return {kind:'maker-faire-content-studio',version:2,event:normalizeContentEvent(input.event),items,updatedAt};
}

export function contentCaption(item,event={}){
  if(item?.caption?.trim())return item.caption;
  const details=normalizeContentEvent(event),c=item?.content||{};
  const lines=[];
  if(item?.type==='maker'){
    lines.push(c.name?`Meet ${c.name}${c.project?`, maker of ${c.project}`:''}.`:c.project||'Meet the makers.');
    if(c.description)lines.push(c.description);
    if(c.handle)lines.push(c.handle);
  }else if(item?.type==='workshop'){
    lines.push(c.title||'Make something together.');
    if(c.host)lines.push(`With ${c.host}`);
    if(c.description)lines.push(c.description);
    const when=[c.date||details.dates,c.time,c.duration].filter(Boolean).join(' · ');
    if(when)lines.push(when);
  }else if(item?.legacyProject){
    const draft=item.legacyProject.drafts[item.legacyProject.state.direction];
    lines.push(draft.headline,draft.detail);
  }
  lines.push(details.name);
  if(item?.type!=='workshop'&&(c.date||details.dates))lines.push(c.date||details.dates);
  if(c.location||details.venue)lines.push(c.location||details.venue);
  if(c.url||details.url)lines.push(c.url||details.url);
  return lines.filter(line=>typeof line==='string'&&line.trim()).join('\n\n');
}
