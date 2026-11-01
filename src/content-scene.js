import {COPY_FONT} from './data/copy-outlines.js';
import {createPosterScene,preparePosterAssets,PALETTES} from './scene.js';
import {layoutTreatment,appendTreatmentArtwork} from './treatment.js';
import {reactTypeToCutout} from './cutout-response.js';
import {getLogoVariant} from './logo-library.js';
import {imageCoverCrop} from './poster-image.js';

const FORMATS={feed:{w:1080,h:1350},story:{w:1080,h:1920}};
const MARGIN=64;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const value=(input,fallback='')=>typeof input==='string'&&input.trim()?input.trim():fallback;
const copyWidth=(text,size,tracking=0)=>[...text].reduce((sum,char,index)=>sum+(COPY_FONT.glyphs[char]?.advance??0)*size/COPY_FONT.em+(index?tracking:0),0);

function omit(scene,field,text,reason='Kept in the caption to preserve the composition.'){
  if(!value(text))return;
  if(!scene.omittedContent.some(entry=>entry.field===field&&entry.text===text))scene.omittedContent.push({field,text,reason});
}
function record(scene,field,text,lines,box,size,omitted=false){
  scene.textBlocks.push({field,text,lines,bounds:{...box},fontSize:size,overflow:false,omitted,unsupportedCharacters:[]});
}
function supportedCopy(text){return [...text].every(char=>char==='\n'||char==='\r'||Boolean(COPY_FONT.glyphs[char]));}
function wrap(text,width,size,measure=copyWidth){
  const lines=[];
  for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
    const words=paragraph.trim().split(/\s+/).filter(Boolean);let line='';
    for(const word of words){
      if(measure(word,size)>width)return null;
      const next=line?`${line} ${word}`:word;
      if(line&&measure(next,size)>width){lines.push(line);line=word;}else line=next;
    }
    if(line)lines.push(line);
  }
  return lines;
}
function drawCopy(scene,text,box,{size=36,leading=48,color=scene.readingInk,field='Supporting text',maxLines=1,tracking=0,align='left'}={}){
  text=value(text);if(!text)return {height:0,drawn:false};
  const measure=(line,s)=>copyWidth(line,s,tracking),lines=supportedCopy(text)?wrap(text,box.w,size,measure):null;
  const capacity=Math.min(maxLines,Math.floor(box.h/leading));
  if(!lines||lines.length>capacity){omit(scene,field,text);record(scene,field,text,[],box,size,true);return {height:0,drawn:false};}
  const scale=size/COPY_FONT.em;
  for(const [row,line]of lines.entries()){
    let x=box.x+(align==='right'?box.w-measure(line,size):0);
    const baseline=box.y+size*.94+row*leading;
    for(const char of line){
      const glyph=COPY_FONT.glyphs[char];
      if(glyph?.d)scene.ops.push({kind:'path',d:glyph.d,fill:color,matrix:[scale,0,0,-scale,x,baseline]});
      x+=(glyph?.advance||0)*scale+tracking;
    }
  }
  record(scene,field,text,lines,box,size);
  return {height:lines.length*leading,drawn:true};
}
function drawStory(scene,text,box,{size=36,leading=49,field='Project story',maxLines=10}={}){
  text=value(text);if(!text)return;
  const lines=supportedCopy(text)?wrap(text,box.w,size):null;
  const capacity=Math.min(maxLines,Math.floor(box.h/leading));
  if(lines&&lines.length<=capacity)return drawCopy(scene,text,box,{size,leading,field,maxLines:capacity});
  // Retain complete sentences only. Never cut off a sentence or add an ellipsis.
  const sentences=text.match(/[^.!?]+(?:[.!?]+(?:[\u201d\u2019"']|\s|$)|$)/g)||[text];
  let excerpt='';
  for(const part of sentences){
    const next=value(`${excerpt} ${part}`),candidate=supportedCopy(next)?wrap(next,box.w,size):null;
    if(!candidate||candidate.length>capacity)break;
    excerpt=next;
  }
  omit(scene,field,text,'The complete story is retained in the caption.');
  if(excerpt)drawCopy(scene,excerpt,box,{size,leading,field,maxLines:capacity});
  else record(scene,field,text,[],box,size,true);
}
// Callouts use the same constructed lettering, optical spacing and motion as
// the hero poster editor. Official titles and facts keep their own reading area.
function calloutLines(text){
  const upper=value(text).toUpperCase().replace(/[–—]/g,'-');
  if(!upper||/[^A-Z0-9 &!?\n\r.\-]/.test(upper))return null;
  const lines=upper.includes('\n')?upper.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean):wrap(upper,14,1,(line)=>line.length);
  if(!lines||lines.length>4||lines.some(line=>line.replace(/ /g,'').length>18))return null;
  return lines;
}
function chooseCallout(scene,item,page){
  const fallback=page.role==='details'?'HOW IT\nWORKS':page.role==='closing'?'COME\nMAKE':'MAKE\nSOMETHING';
  const candidates=[value(page.heading),page.role==='cover'?value(item.content?.callout):'',page.role==='cover'?contentTitle(item):'',fallback].filter(Boolean);
  for(const text of candidates){
    const lines=calloutLines(text);
    if(lines){scene.callout=lines.join('\n');return lines;}
    omit(scene,'Poster callout',text,'The full wording is retained in the caption. Use a short callout and authored line breaks.');
  }
  return ['MAKE'];
}
function expressive(scene,lines,box,{field='Poster callout',object=null}={}){
  if(!lines.length)return;
  const letters=layoutTreatment(lines.join('\n'),box,scene.direction,scene.phase,.78,{variation:.64});
  if(object){
    letters.cells=reactTypeToCutout(letters.cells,object.frame,object.asset.silhouette,box,.72);
    for(const row of letters.rows)row.cells=letters.cells.filter(cell=>cell.row===row.index);
  }
  appendTreatmentArtwork(scene,letters,{...scene.colors,fg:scene.displayInk},box);
  scene.cells.push(...letters.cells);
  scene.regions.type=scene.regions.type||{...box};
  record(scene,field,lines.join('\n'),lines,box,box.h/lines.length);
}
function composition(page,asset){
  if(page.composition==='type'||!asset)return 'type';
  if(page.composition==='window')return 'window';
  if(page.composition==='cutout')return asset.hasAlpha?'cutout':'window';
  if(page.role==='closing')return 'type';
  return asset.hasAlpha?'cutout':'window';
}
function photo(scene,asset,box,crop){
  scene.regions.image={...box};
  const placement={zoom:clamp(crop?.zoom??1,1,4),focusX:clamp(crop?.focusX??.5,0,1),focusY:clamp(crop?.focusY??.5,0,1)};
  if(asset.hasAlpha){
    const scale=Math.min(box.w/asset.width,box.h/asset.height)*placement.zoom;
    const w=asset.width*scale,h=asset.height*scale;
    scene.ops.push({kind:'image',src:asset.src,x:box.x+(box.w-w)*placement.focusX,y:box.y+(box.h-h)*placement.focusY,w,h,clip:{...box}});
  }else scene.ops.push({kind:'image',src:asset.src,...box,source:imageCoverCrop(asset,box,placement),naturalWidth:asset.width,naturalHeight:asset.height,clip:{...box}});
}
function objectFrame(asset,box,crop){
  // Zoom enlarges the cut-out; focus moves it through a bounded, protected area.
  const base=Math.min(box.w/asset.width,box.h/asset.height);
  const scale=Math.min(base*(crop?.zoom??1),496/asset.width,(box.h+100)/asset.height);
  const w=asset.width*scale,h=asset.height*scale;
  const x=clamp(box.x+(box.w-w)*(crop?.focusX??.5),520,1016-w);
  const y=clamp(box.y+(box.h-h)*(crop?.focusY??.5),box.y-100,box.y+box.h-h);
  return {x,y,w,h};
}
function drawObject(scene,asset,frame){
  scene.ops.push({kind:'image',src:asset.src,...frame});
  scene.regions.image={...frame};
}
function shortLink(scene,raw,box){
  raw=value(raw);if(!raw)return;
  let display=raw.replace(/^https?:\/\//i,'').replace(/\/$/,'');
  if(copyWidth(display,25)>box.w){
    try{display=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).host;}catch{}
    if(display!==raw)omit(scene,'Full booking or project link',raw,'The complete link is included in the caption.');
  }
  drawCopy(scene,display,box,{size:25,leading:34,field:'Project link',align:'right'});
}
function signature(scene,item,event){
  const story=scene.format==='story',y=story?1660:1250,logo=getLogoVariant(scene.logoVariant);
  const partner=item.partner,hasPartner=Boolean(partner?.asset||value(partner?.name));
  const w=logo.layout==='square'?78:hasPartner?280:310,h=w*logo.height/logo.width;
  const box={x:MARGIN,y:y+24-h/2,w,h};
  scene.ops.push({kind:'image',src:logo.src,...box});scene.regions.logo=box;
  shortLink(scene,value(item.content?.url,event.url)||item.content?.handle,{x:hasPartner?720:580,y:y+5,w:hasPartner?296:436,h:38});
  if(!hasPartner)return;
  const asset=partner?.asset;
  if(asset){
    const scale=Math.min(180/asset.width,30/asset.height),width=asset.width*scale;
    scene.ops.push({kind:'image',src:asset.src,x:420+(240-width)/2,y:y-4,w:width,h:asset.height*scale});
    drawCopy(scene,value(partner.name),{x:420,y:y+30,w:240,h:28},{size:20,leading:26,field:'Partner name'});
  }else drawCopy(scene,partner.name,{x:420,y:y+2,w:240,h:60},{size:23,leading:28,maxLines:2,field:'Partner name'});
}
function contentTitle(item){return value(item.type==='maker'?item.content?.project:item.content?.title);}
function person(item){return value(item.type==='maker'?item.content?.name:item.content?.host);}
function eventFacts(item,event){const c=item.content||{};return {date:value(c.date,event.dates),time:value(c.time),venue:value(c.location,event.venue)};}
function context(scene,item,{y,width=952,x=64,compact=false}={}){
  const name=person(item),title=contentTitle(item),nameSize=compact?34:38;
  const named=drawCopy(scene,name,{x,y,w:width,h:compact?88:50},{size:nameSize,leading:44,maxLines:compact?2:1,field:item.type==='maker'?'Maker name':'Workshop host'});
  const top=y+(named.drawn?named.height+10:0);
  drawCopy(scene,title,{x,y:top,w:width,h:compact?72:76},{size:28,leading:36,maxLines:2,field:'Full project or workshop title'});
}
function facts(scene,item,event,y,{size=28,width=952}={}){
  const info=eventFacts(item,event);
  drawCopy(scene,[info.date,info.time].filter(Boolean).join(' / '),{x:64,y,w:width,h:40},{size,leading:38,field:'Event date and time'});
  drawCopy(scene,info.venue,{x:64,y:y+42,w:width,h:40},{size,leading:38,field:'Event venue'});
}
function windowCover(scene,item,event,page,asset,crop,lines){
  const story=scene.format==='story';
  // The image belongs inside the typographic field: the last row completes the
  // callout beneath it, rather than reducing the lettering to a small masthead.
  const split=lines.length>1,top=split?lines.slice(0,-1):lines;
  expressive(scene,top,{x:34,y:story?176:32,w:1012,h:split?(story?440:306):(story?600:470)});
  photo(scene,asset,{x:64,y:split?(story?636:354):(story?800:510),w:952,h:split?(story?570:414):(story?620:454)},crop);
  if(split)expressive(scene,lines.slice(-1),{x:34,y:story?1224:788,w:1012,h:story?204:190});
  context(scene,item,{y:story?1460:1008});
  facts(scene,item,event,story?1560:1144,{size:27});
}
function cutoutCover(scene,item,event,page,asset,crop,lines){
  const story=scene.format==='story';
  const frame=objectFrame(asset,{x:520,y:story?1000:600,w:496,h:story?550:490},crop);
  expressive(scene,lines,{x:34,y:story?176:44,w:1012,h:story?1190:920},{object:{asset,frame}});
  drawObject(scene,asset,frame);
  context(scene,item,{x:64,y:story?1398:1000,width:440,compact:true});
  facts(scene,item,event,story?1558:1152,{size:26});
}
function typeCover(scene,item,event,page,lines){
  const story=scene.format==='story';
  expressive(scene,lines,{x:34,y:story?176:44,w:1012,h:story?1190:920});
  context(scene,item,{y:story?1410:1008});
  facts(scene,item,event,story?1560:1144,{size:27});
}
function cover(scene,item,event,page,asset,crop,mode){
  const lines=chooseCallout(scene,item,page);
  if(mode==='window')windowCover(scene,item,event,page,asset,crop,lines);
  else if(mode==='cutout')cutoutCover(scene,item,event,page,asset,crop,lines);
  else typeCover(scene,item,event,page,lines);
  omit(scene,'Cover story',value(page.body,item.content?.description),'The cover keeps its callout, image and essential facts. The full story is in the caption.');
  if(item.content?.handle)omit(scene,'Social handle',item.content.handle);
}
function details(scene,item,event,page,asset,crop,mode){
  const story=scene.format==='story',lines=chooseCallout(scene,item,page);
  const typeBox={x:34,y:story?176:40,w:1012,h:story?470:350};
  expressive(scene,lines,typeBox);
  const top=story?700:436,height=story?690:528,hasImage=mode!=='type';
  if(hasImage)photo(scene,asset,{x:64,y:top,w:500,h:height},crop);
  const x=hasImage?612:64,w=hasImage?404:860;
  const named=drawCopy(scene,person(item),{x,y:top,w,h:100},{size:34,leading:44,maxLines:2,field:item.type==='maker'?'Maker name':'Workshop host'});
  const start=top+(named.drawn?named.height+26:0);
  drawStory(scene,value(page.body,item.content?.description),{x,y:start,w,h:height-(start-top)},{size:hasImage?34:40,leading:hasImage?46:54,field:'Project or workshop story',maxLines:hasImage?10:8});
  drawCopy(scene,contentTitle(item),{x:64,y:story?1436:1004,w:952,h:90},{size:32,leading:42,maxLines:2,field:'Full project or workshop title'});
  facts(scene,item,event,story?1558:1144,{size:27});
  if(item.content?.duration)omit(scene,'Workshop duration',item.content.duration);
}
function closing(scene,item,event,page,asset,crop,mode){
  if(mode!=='type')return cover(scene,item,event,page,asset,crop,mode);
  const story=scene.format==='story',lines=chooseCallout(scene,item,page),info=eventFacts(item,event);
  expressive(scene,lines,{x:34,y:story?176:44,w:1012,h:story?780:620});
  context(scene,item,{y:story?1016:730});
  const date=info.date,pieces=date.match(/^(?:(\w+day)\s+)?(\d{1,2}(?:\s*[–—-]\s*\d{1,2})?)\s+([a-z]+(?:\s+\d{4})?)$/i);
  const dateY=story?1234:888;
  if(pieces){
    const numerals=pieces[2].replace(/\s/g,'').replace(/[–—]/g,'-');
    const dateWidth=Math.min(pieces[1]?650:952,Math.max(320,numerals.length*140));
    expressive(scene,[numerals],{x:34,y:dateY,w:dateWidth,h:story?220:190},{field:'Festival date'});
    if(pieces[1])drawCopy(scene,pieces[1].toUpperCase(),{x:718,y:dateY+70,w:298,h:76},{size:30,leading:40,maxLines:2,field:'Day of week'});
    drawCopy(scene,pieces[3].toUpperCase(),{x:64,y:dateY+(story?236:208),w:952,h:52},{size:36,leading:48,field:'Festival month'});
  }else drawCopy(scene,date,{x:64,y:dateY,w:952,h:160},{size:48,leading:60,maxLines:2,field:'Festival date'});
  drawCopy(scene,[info.time,info.venue].filter(Boolean).join(' / '),{x:64,y:story?1556:1164,w:952,h:76},{size:30,leading:38,maxLines:2,field:'Time and venue'});
  omit(scene,'Closing supporting text',value(page.body,item.content?.description),'Supporting text is retained in the caption.');
}

/** Content masters adapt the original hero lettering and image response.
 * The same composed scene powers preview, still artwork and moving exports. */
export function createContentScene(item,event={},options={}){
  const format=Object.hasOwn(FORMATS,options.format)?options.format:'feed';
  if(item?.type==='poster'){
    const p=item.legacyProject,state=p?.state||{},draft=p?.drafts?.[state.direction]||{};
    return {...createPosterScene({...state,...draft,format:format==='story'?'story':'poster',phase:options.phase??state.phase??0}),warnings:[],omittedContent:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false};
  }
  const original=PALETTES.find(p=>p.id===item?.palette&&['maker','maker-red','maker-cyan'].includes(p.id))||PALETTES.find(p=>p.id==='maker-red');
  const colors={...original,fg:original.id==='maker-cyan'?original.ink:original.fg};
  const pages=item?.pages?.length?item.pages:[{role:'cover'}],index=clamp(Number.isInteger(options.pageIndex)?options.pageIndex:0,0,pages.length-1),page=pages[index];
  const selected=getLogoVariant(item?.logoVariant),logoVariant=item?.logoColourMode==='auto'?`${selected.layout}-${original.id==='maker-red'?'white':'black'}`:selected.id;
  const size=FORMATS[format];
  const scene={phase:Number.isFinite(options.phase)?options.phase:0,width:size.w,height:size.h,margin:MARGIN,background:colors.bg,ops:[],cells:[],direction:item?.treatment||'air',description:`${item?.type==='workshop'?'Workshop':'Maker spotlight'} ${page.role}`,colors,displayInk:colors.fg,readingInk:original.id==='maker'?'#172C35':colors.fg,format,logoVariant,warnings:[],omittedContent:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false,regions:{},callout:''};
  const assets=item?.assets||[],asset=assets.find(image=>image.id===page.assetId)||assets[0],mode=composition(page,asset);
  scene.composition=mode;
  (page.role==='details'?details:page.role==='closing'?closing:cover)(scene,item||{type:'maker'},event,page,asset,item?.variants?.[format],mode);
  signature(scene,item||{},event);
  return scene;
}
export async function prepareContentAssets(item){
  if(item?.type==='poster')return preparePosterAssets(item.legacyProject?.state?.media?.asset);
  await preparePosterAssets();
  for(const asset of item?.assets||[])await preparePosterAssets(asset);
  if(item?.partner?.asset)await preparePosterAssets(item.partner.asset);
}
