import {COPY_FONT} from './data/copy-outlines.js';
import {createPosterScene,preparePosterAssets,PALETTES} from './scene.js';
import {DISPLAY_FONT} from './data/display-outlines.js';
import {getLogoVariant} from './logo-library.js';
import {imageCoverCrop} from './poster-image.js';

const FORMATS={feed:{w:1080,h:1350},story:{w:1080,h:1920}};
const MARGIN=64;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const value=(input,fallback='')=>typeof input==='string'&&input.trim()?input.trim():fallback;
const copyWidth=(text,size,tracking=0)=>[...text].reduce((sum,char,index)=>sum+(COPY_FONT.glyphs[char]?.advance??0)*size/COPY_FONT.em+(index?tracking:0),0);
const displayAdvance=(char,size)=>(DISPLAY_FONT.glyphs[char]?.advance||0)*size/DISPLAY_FONT.capHeight;
const displayWidth=(text,size)=>[...text].reduce((sum,char)=>sum+displayAdvance(char,size),0);

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
function drawHeadline(scene,text,box,{size=128,leading=size*1.06,maxLines=3,sizes,field='Headline',color=scene.displayInk}={}){
  text=value(text);if(!text)return {drawn:false};
  const upper=text.toUpperCase();
  if([...upper].some(char=>char!=='\n'&&char!=='\r'&&!DISPLAY_FONT.glyphs[char])){
    omit(scene,field,text,'The original wording is retained in the caption and project.');record(scene,field,text,[],box,size,true);return {drawn:false};
  }
  // Three authored optical sizes, always with the font's original geometry.
  // Primary titles are never cut midway through their name.
  const candidates=[...new Set(sizes||[size,Math.min(size,112),Math.min(size,104)])];
  let lines=null,cap=size,lineStep=leading;
  for(const candidate of candidates){
    const trial=wrap(upper,box.w,candidate,displayWidth),step=leading*candidate/size;
    if(trial&&trial.length<=maxLines&&trial.length*step<=box.h){lines=trial;cap=candidate;lineStep=step;break;}
  }
  if(!lines){omit(scene,field,text,'The full wording is retained in the caption; a shorter page headline can be supplied.');record(scene,field,text,[],box,size,true);return {drawn:false};}
  const scale=cap/DISPLAY_FONT.capHeight;
  for(const [row,line]of lines.entries()){
    let x=box.x;
    for(const char of line){
      const glyph=DISPLAY_FONT.glyphs[char];
      if(glyph?.d)scene.ops.push({kind:'path',d:glyph.d,fill:color,matrix:[scale,0,0,-scale,x,box.y+cap+row*lineStep]});
      x+=displayAdvance(char,cap);
    }
  }
  record(scene,field,text,lines,box,cap);
  return {drawn:true,height:lines.length*lineStep};
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
function photo(scene,asset,box,crop){
  if(!asset)return;
  scene.regions.image={...box};
  if(asset.hasAlpha){
    const scale=Math.min(box.w/asset.width,box.h/asset.height)*(crop?.zoom||1);
    const breathing=1+(1-Math.cos((scene.phase||0)*Math.PI*2))*.004;
    const w=asset.width*scale*breathing,h=asset.height*scale*breathing;
    const x=box.x+(box.w-w)*(crop?.focusX??.5),y=box.y+(box.h-h)*(crop?.focusY??.5);
    scene.ops.push({kind:'image',src:asset.src,x,y,w,h,clip:{...box}});
  }else{
    const placement={zoom:clamp(Number(crop?.zoom)||1,1,4),focusX:clamp(Number(crop?.focusX)??.5,0,1),focusY:clamp(Number(crop?.focusY)??.5,0,1)};
    placement.zoom+=(1-Math.cos((scene.phase||0)*Math.PI*2))*.004;
    placement.focusX=Number.isFinite(placement.focusX)?placement.focusX:.5;
    placement.focusY=Number.isFinite(placement.focusY)?placement.focusY:.5;
    scene.ops.push({kind:'image',src:asset.src,...box,source:imageCoverCrop(asset,box,placement),naturalWidth:asset.width,naturalHeight:asset.height,clip:{...box}});
  }
}
function identity(scene,item,event,index,count){
  const y=scene.format==='story'?176:56,logo=getLogoVariant(scene.logoVariant);
  const square=logo.layout==='square',w=square?76:250,h=w*logo.height/logo.width;
  const box={x:MARGIN,y:y+(76-h)/2,w,h};
  scene.ops.push({kind:'image',src:logo.src,...box});scene.regions.logo=box;
  const label=item.type==='workshop'?'HANDS-ON WORKSHOP':'MAKER SPOTLIGHT';
  drawCopy(scene,label,{x:490,y:y+5,w:526,h:32},{size:23,leading:32,field:'Series label',align:'right',tracking:.6});
  drawCopy(scene,`${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`,{x:850,y:y+40,w:166,h:28},{size:20,leading:28,field:'Page number',align:'right'});
}
function shortLink(scene,raw,box){
  raw=value(raw);if(!raw)return;
  let display=raw.replace(/^https?:\/\//i,'').replace(/\/$/,'');
  if(copyWidth(display,26)>box.w){
    try{display=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).host;}catch{}
    if(display!==raw)omit(scene,'Full booking or project link',raw,'The complete link is included in the caption.');
  }
  drawCopy(scene,display,box,{size:26,leading:34,field:'Project link'});
}
function signature(scene,item,event){
  const y=scene.format==='story'?1660:1256,c=item.content||{},partner=item.partner;
  const hasPartner=Boolean(partner?.asset||value(partner?.name));
  shortLink(scene,value(c.url,event.url)||c.handle,{x:MARGIN,y,w:hasPartner?480:952,h:40});
  if(!hasPartner)return;
  const x=650,w=366;
  if(partner.asset){
    const asset=partner.asset,s=Math.min(152/asset.width,42/asset.height);
    scene.ops.push({kind:'image',src:asset.src,x:1016-asset.width*s,y:y+(42-asset.height*s)/2,w:asset.width*s,h:asset.height*s});
    drawCopy(scene,value(partner.name),{x,y:y+4,w:190,h:36},{size:22,leading:30,field:'Partner name',align:'right'});
  }else drawCopy(scene,partner.name,{x,y:y+4,w,h:36},{size:24,leading:32,field:'Partner name',align:'right'});
}
function contentTitle(item){return value(item.type==='maker'?item.content?.project:item.content?.title);}
function person(item){return value(item.type==='maker'?item.content?.name:item.content?.host);}
function eventFacts(item,event){const c=item.content||{};return {date:value(c.date,event.dates),time:value(c.time),venue:value(c.location,event.venue)};}

function cover(scene,item,event,page,asset,crop){
  const story=scene.format==='story',c=item.content||{},facts=eventFacts(item,event);
  const title=value(page.heading,contentTitle(item));
  const titleBox=asset?{x:64,y:story?312:160,w:952,h:story?408:340}:{x:64,y:story?376:224,w:952,h:story?960:720};
  const titleStyle=asset?{size:120,leading:128,maxLines:3}:{size:story?192:176,leading:story?204:188,sizes:story?[192,176,160]:[176,160,144],maxLines:4};
  const heading=drawHeadline(scene,title,titleBox,{...titleStyle,field:'Project or workshop title'});
  const personIsHeadline=!heading.drawn&&drawHeadline(scene,person(item),titleBox,{...titleStyle,field:'Maker or host name'}).drawn;
  if(asset){
    photo(scene,asset,{x:64,y:story?752:520,w:952,h:story?704:520},crop);
    if(!personIsHeadline)drawCopy(scene,person(item),{x:64,y:story?1496:1080,w:952,h:64},{size:46,leading:58,field:item.type==='maker'?'Maker name':'Workshop host'});
  }else{
    // An equally deliberate type-only master; no invented illustrations.
    if(!personIsHeadline)drawCopy(scene,person(item),{x:64,y:story?1472:1008,w:952,h:120},{size:54,leading:66,maxLines:1,field:item.type==='maker'?'Maker name':'Workshop host'});
  }
  if(item.type==='workshop'){
    drawCopy(scene,[facts.date,facts.time].filter(Boolean).join(' / '),{x:64,y:story?1564:1150,w:952,h:48},{size:34,leading:44,field:'Workshop date and time'});
    if(!story)drawCopy(scene,facts.venue,{x:64,y:1198,w:952,h:44},{size:30,leading:40,field:'Workshop venue'});
    else omit(scene,'Workshop venue',facts.venue,'The venue is on the invitation page and in the caption.');
  }
  omit(scene,'Cover story',value(page.body,c.description),'The cover prioritises the title, image and maker. The story is in the caption.');
  if(item.type==='maker')omit(scene,'Social handle',c.handle,'The handle is included with the sharing caption.');
}
function details(scene,item,event,page,asset,crop){
  const story=scene.format==='story',c=item.content||{},facts=eventFacts(item,event);
  drawHeadline(scene,value(page.heading,item.type==='maker'?'BEHIND THE BUILD':'IN THE WORKSHOP'),{x:64,y:story?312:160,w:952,h:220},{size:104,leading:112,maxLines:2,field:'Details headline'});
  const top=story?640:430,height=story?840:650;
  if(asset)photo(scene,asset,{x:64,y:top,w:480,h:height},crop);
  const x=asset?592:64,w=asset?424:800;
  const name=drawCopy(scene,person(item),{x,y:top,w,h:116},{size:38,leading:49,maxLines:2,field:item.type==='maker'?'Maker name':'Workshop host'});
  const start=top+(name.drawn?name.height+34:0);
  drawStory(scene,value(page.body,c.description),{x,y:start,w,h:height-(start-top)},{size:36,leading:49,field:'Project or workshop story',maxLines:story?12:10});
  if(item.type==='workshop'){
    const y=story?1534:1140;
    drawCopy(scene,[facts.date,facts.time].filter(Boolean).join(' / '),{x:64,y,w:952,h:48},{size:32,leading:42,field:'Workshop date and time'});
    drawCopy(scene,facts.venue,{x:64,y:y+50,w:952,h:44},{size:30,leading:40,field:'Workshop venue'});
    omit(scene,'Workshop duration',c.duration,'The complete session information is included in the caption.');
  }else{
    drawCopy(scene,contentTitle(item),{x:64,y:story?1540:1144,w:952,h:64},{size:34,leading:44,field:'Project name'});
  }
}
function closing(scene,item,event,page,asset,crop){
  const story=scene.format==='story',facts=eventFacts(item,event),c=item.content||{};
  const title=value(page.heading,item.type==='maker'?'MEET THE MAKER':'JOIN THE WORKSHOP');
  drawHeadline(scene,title,{x:64,y:story?340:192,w:952,h:270},{size:120,leading:132,maxLines:2,field:'Invitation headline'});
  drawCopy(scene,[contentTitle(item),person(item)].filter(Boolean).join(' / '),{x:64,y:story?670:490,w:952,h:108},{size:36,leading:46,maxLines:2,field:'Project and host context'});
  const y=story?942:672,hasDate=Boolean(facts.date),date=hasDate?facts.date:contentTitle(item);
  const pieces=date.match(/^(?:(\w+day)\s+)?(\d{1,2}(?:\s*[–—-]\s*\d{1,2})?)\s+([a-z]+(?:\s+\d{4})?)$/i);
  if(pieces){
    if(pieces[1])drawCopy(scene,pieces[1].toUpperCase(),{x:64,y,w:952,h:40},{size:28,leading:38,field:'Day of week'});
    drawHeadline(scene,pieces[2].replace(/\s/g,''),{x:64,y:y+(pieces[1]?48:0),w:952,h:176},{size:168,leading:176,maxLines:1,field:'Festival date'});
    drawCopy(scene,pieces[3].toUpperCase(),{x:64,y:y+(pieces[1]?240:192),w:952,h:80},{size:58,leading:74,field:'Festival month'});
  }else{
    drawCopy(scene,date,{x:64,y,w:952,h:280},{size:80,leading:92,maxLines:3,field:hasDate?'Festival date':'Project name'});
  }
  const bottom=story?1370:1030;
  drawCopy(scene,[item.type==='workshop'?facts.time:'',facts.venue].filter(Boolean).join(' / '),{x:64,y:bottom,w:952,h:story?150:120},{size:38,leading:50,maxLines:2,field:'Time and venue'});
  omit(scene,'Closing supporting text',value(page.body,c.description),'The invitation retains only its essential information. Supporting text is in the caption.');

}

/** Master compositions retain their proportions. Copy is selected for the
 * design; source content stays intact in the project and sharing pack. */
export function createContentScene(item,event={},options={}){
  const format=Object.hasOwn(FORMATS,options.format)?options.format:'feed';
  if(item?.type==='poster'){
    const p=item.legacyProject,state=p?.state||{},draft=p?.drafts?.[state.direction]||{};
    return {...createPosterScene({...state,...draft,format:format==='story'?'story':'poster',phase:options.phase??state.phase??0}),warnings:[],omittedContent:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false};
  }
  const original=PALETTES.find(p=>p.id===item?.palette&&['maker','maker-red','maker-cyan'].includes(p.id))||PALETTES.find(p=>p.id==='maker-red');
  const colors={...original,fg:original.id==='maker-cyan'?original.ink:original.fg};
  const displayInk=colors.fg,readingInk=original.id==='maker'?'#172C35':displayInk;
  const pages=item?.pages?.length?item.pages:[{role:'cover'}],index=clamp(Number.isInteger(options.pageIndex)?options.pageIndex:0,0,pages.length-1),page=pages[index];
  const selected=getLogoVariant(item?.logoVariant),logoVariant=item?.logoColourMode==='auto'?`${selected.layout}-${original.id==='maker-red'?'white':'black'}`:selected.id;
  const size=FORMATS[format];
  const scene={phase:Number.isFinite(options.phase)?options.phase:0,width:size.w,height:size.h,margin:MARGIN,background:colors.bg,ops:[],cells:[],direction:item?.treatment||'air',description:`${item?.type==='workshop'?'Workshop':'Maker spotlight'} ${page.role}`,colors,displayInk,readingInk,format,logoVariant,warnings:[],omittedContent:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false,regions:{}};
  const assets=item?.assets||[],asset=assets.find(image=>image.id===page.assetId)||assets[0];
  identity(scene,item||{},event,index,pages.length);
  (page.role==='details'?details:page.role==='closing'?closing:cover)(scene,item||{type:'maker'},event,page,asset,item?.variants?.[format]);
  signature(scene,item||{},event);
  return scene;
}
export async function prepareContentAssets(item){
  if(item?.type==='poster')return preparePosterAssets(item.legacyProject?.state?.media?.asset);
  await preparePosterAssets();
  for(const asset of item?.assets||[])await preparePosterAssets(asset);
  if(item?.partner?.asset)await preparePosterAssets(item.partner.asset);
}
