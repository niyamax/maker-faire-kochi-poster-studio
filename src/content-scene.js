import {COPY_FONT} from './data/copy-outlines.js';
import {createPosterScene,preparePosterAssets,PALETTES} from './scene.js';
import {layoutTreatment,appendTreatmentArtwork,TREATMENT_PROFILES} from './treatment.js';
import {fontSupports,fontGlyphMetrics} from './font-library.js';
import {getLogoVariant} from './logo-library.js';
import {imageCoverCrop} from './poster-image.js';

const FORMATS={feed:{w:1080,h:1350},story:{w:1080,h:1920}};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const value=(input,fallback='')=>typeof input==='string'&&input.trim()?input:fallback;
const measure=(text,size)=>[...text].reduce((total,char)=>total+(COPY_FONT.glyphs[char]?.advance??COPY_FONT.em*.56)*size/COPY_FONT.em,0);

/** Wrap at words where possible and at grapheme-sized characters for long URLs.
 * Content is kept in the project; blocks report any text that cannot fit. */
function wrap(text,width,size){
  const lines=[];
  for(const paragraph of String(text).replace(/\r\n?/g,'\n').split('\n')){
    const words=paragraph.split(/\s+/).filter(Boolean);
    if(!words.length){lines.push('');continue;}
    let line='';
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(measure(candidate,size)<=width){line=candidate;continue;}
      if(line){lines.push(line);line='';}
      if(measure(word,size)<=width){line=word;continue;}
      for(const char of word){
        if(line&&measure(line+char,size)>width){lines.push(line);line='';}
        line+=char;
      }
    }
    if(line)lines.push(line);
  }
  return lines;
}

function addWarning(scene,message){if(!scene.warnings.includes(message))scene.warnings.push(message);}
function textBlock(scene,text,box,{size=32,minSize=size,color=scene.colors.ink,field='Text',lineHeight=1.28,align='left',maxLines=Infinity}={}){
  const original=String(text??'');
  const unsupported=[...new Set([...original].filter(char=>char!=='\n'&&char!=='\r'&&!COPY_FONT.glyphs[char]))];
  // A visible question mark marks unsupported characters in the preview. Export
  // checks hasUnsupportedText so it never silently publishes substituted text.
  const supported=[...original].map(char=>char==='\n'||char==='\r'||COPY_FONT.glyphs[char]?char:'?').join('');
  let fontSize=size,lines=wrap(supported,box.w,fontSize);
  const capacity=()=>Math.max(0,Math.min(maxLines,Math.floor((box.h+.001)/(fontSize*lineHeight))));
  while(fontSize>minSize&&lines.length>capacity()){
    fontSize=Math.max(minSize,fontSize-1);lines=wrap(supported,box.w,fontSize);
  }
  const overflow=lines.length>capacity(),visible=lines.slice(0,capacity());
  if(overflow){
    scene.hasOverflow=true;addWarning(scene,`${field} is longer than this page. Shorten it or add another details page.`);
  }
  if(overflow&&visible.length){
    let last=visible.at(-1);
    while(last&&measure(last+'...',fontSize)>box.w)last=last.slice(0,-1);
    visible[visible.length-1]=last+'...';
  }
  if(unsupported.length){
    scene.hasUnsupportedText=true;
    addWarning(scene,`${field} contains characters this template cannot render: ${unsupported.join(' ')}. Use supported Latin text before exporting.`);
  }
  const em=fontSize/COPY_FONT.em;
  for(const [index,line] of visible.entries()){
    const baseline=box.y+fontSize*.94+index*fontSize*lineHeight;
    let x=box.x+(align==='center'?(box.w-measure(line,fontSize))/2:align==='right'?box.w-measure(line,fontSize):0);
    for(const char of line){
      const glyph=COPY_FONT.glyphs[char]||COPY_FONT.glyphs['?'];
      if(glyph?.d)scene.ops.push({kind:'path',d:glyph.d,fill:color,matrix:[em,0,0,-em,x,baseline]});
      x+=(glyph?.advance??COPY_FONT.em*.3)*em;
    }
  }
  scene.textBlocks.push({field,text:original,lines:visible,bounds:{...box},fontSize,overflow,unsupportedCharacters:unsupported});
  return {height:visible.length*fontSize*lineHeight,lines:visible.length,fontSize,overflow};
}

function expressiveHeading(scene,text,box,{field='Heading',maxLines=4,lineLength=14}={}){
  const original=value(text,'MAKE SOMETHING'),upper=original.toUpperCase();
  const font=TREATMENT_PROFILES[scene.direction]?.font||'original';
  if([...upper].some(char=>char!=='\n'&&char!==' '&&!fontSupports(font,char))){
    return textBlock(scene,original,box,{size:88,minSize:48,color:scene.colors.fg,field,lineHeight:1.08,maxLines});
  }
  // Weighted line lengths give deliberate breaks without squeezing long names
  // into one nearly unreadable row of stretched cells.
  const lines=[];
  let line='';
  const nominal=lineLength,authoredBreaks=upper.includes('\n');
  for(const paragraph of upper.split(/\r?\n/)){
  if(authoredBreaks){if(paragraph.trim())lines.push(paragraph.trim());continue;}
  const words=paragraph.split(/\s+/).filter(Boolean);
  for(const word of words){
    if(line&&(line+' '+word).length>nominal){lines.push(line);line='';}
    if(word.length>nominal){
      if(line){lines.push(line);line='';}
      for(let start=0;start<word.length;start+=nominal)lines.push(word.slice(start,start+nominal));
    }else line=line?line+' '+word:word;
  }
  if(line)lines.push(line);line='';
  }
  if(lines.length>maxLines){
    // Ordinary outlined text handles unusually long titles more predictably.
    return textBlock(scene,original,box,{size:70,minSize:44,color:scene.colors.fg,field,lineHeight:1.08,maxLines});
  }
  const widest=Math.max(...lines.map(row=>[...row].reduce((sum,char)=>sum+(char===' '?.36:fontGlyphMetrics(font,char)?.width??.8),0)));
  if(widest&&box.w/widest<35){
    return textBlock(scene,original,box,{size:64,minSize:44,color:scene.colors.fg,field,lineHeight:1.08,maxLines});
  }
  const letters=layoutTreatment(lines.join('\n'),box,scene.direction,scene.phase,.7,{contrast:.34,variation:0},'smooth');
  appendTreatmentArtwork(scene,letters,scene.colors,box);
  scene.cells.push(...letters.cells);
  scene.textBlocks.push({field,text:original,lines,bounds:{...box},fontSize:box.h/lines.length,overflow:false,unsupportedCharacters:[]});
  return {height:box.h,lines:lines.length,fontSize:box.h/lines.length,overflow:false};
}

function addPhoto(scene,asset,box,crop){
  scene.regions.image={...box};
  if(asset){
    const settings={zoom:clamp(Number(crop?.zoom)||1,1,4),focusX:clamp(Number.isFinite(crop?.focusX)?crop.focusX:.5,0,1),focusY:clamp(Number.isFinite(crop?.focusY)?crop.focusY:.5,0,1)};
    scene.ops.push({kind:'image',src:asset.src,...box,source:imageCoverCrop(asset,box,settings),naturalWidth:asset.width,naturalHeight:asset.height,clip:{...box}});
    return;
  }

}

function footer(scene,event,pageIndex,pageCount,partner){
  const {margin:m,footerY:y,bodyBottom}=scene.layout;
  const logo=getLogoVariant(scene.logoVariant),square=logo.layout==='square';
  const w=square?72:260,h=w*logo.height/logo.width;
  const box={x:m,y:y+(72-h)/2,w,h};
  scene.ops.push({kind:'image',src:logo.src,...box});scene.regions.logo=box;
  const identityX=m+300,numberX=scene.width-m-78;
  if(partner){
    textBlock(scene,'IN PARTNERSHIP WITH',{x:identityX,y:y-2,w:numberX-identityX-24,h:24},{size:15,color:scene.colors.ink,field:'Partner label',maxLines:1});
    let nameX=identityX;
    if(partner.asset){
      const asset=partner.asset,frame={x:identityX,y:y+24,w:112,h:44};
      const scale=Math.min(frame.w/asset.width,frame.h/asset.height),width=asset.width*scale,height=asset.height*scale;
      scene.ops.push({kind:'image',src:asset.src,x:frame.x+(frame.w-width)/2,y:frame.y+(frame.h-height)/2,w:width,h:height});
      nameX=identityX+134;
    }
    if(value(partner.name))textBlock(scene,partner.name,{x:nameX,y:y+25,w:numberX-nameX-24,h:48},{size:21,minSize:18,color:scene.colors.ink,field:'Partner name',maxLines:2,lineHeight:1.2});
    scene.regions.partner={x:identityX,y:y-2,w:numberX-identityX-24,h:76};
  }else if(value(event?.name)&&event.name.toLowerCase().replace(/\s+/g,' ').trim()!=='maker faire kochi'){
    textBlock(scene,event.name,{x:identityX,y:y+20,w:numberX-identityX-30,h:52},{size:22,minSize:19,color:scene.colors.ink,field:'Event name',maxLines:2,lineHeight:1.18});
  }
  textBlock(scene,String(pageIndex+1).padStart(2,'0')+'/'+String(pageCount).padStart(2,'0'),{x:numberX,y:y+25,w:78,h:34},{size:20,color:scene.colors.ink,field:'Page number',align:'right'});
  scene.regions.footer={x:m,y,w:scene.width-2*m,h:bodyBottom-y};
}

function cover(scene,item,event,page,asset,crop){
  const c=item.content||{},l=scene.layout,m=l.margin,story=scene.format==='story',maker=item.type==='maker';
  const title=value(page.heading,maker?value(c.project,'Made to be shared'):value(c.title,'Come make something'));
  if(asset){
    const photo={x:250,y:story?650:430,w:scene.width-150,h:story?740:600};
    addPhoto(scene,asset,photo,crop);
    expressiveHeading(scene,title,{x:m,y:l.mainTop,w:scene.width-m*2,h:story?420:350},{field:maker?'Project name':'Workshop title',maxLines:4,lineLength:11});
    const railY=photo.y+200;
    const name=value(maker?c.name:c.host,maker?'Meet the maker':'Your host');
    const nameBlock=textBlock(scene,name,{x:m,y:railY,w:172,h:270},{size:50,minSize:38,color:scene.colors.ink,field:maker?'Maker name':'Workshop host',lineHeight:1.12,maxLines:6});
    textBlock(scene,value(maker?c.handle:c.duration),{x:m,y:railY+nameBlock.height+30,w:188,h:126},{size:23,minSize:19,color:scene.colors.ink,field:maker?'Social handle':'Workshop duration',lineHeight:1.2,maxLines:4});
    const captionY=photo.y+photo.h+30;
    const body=maker?value(page.body,value(c.description,'Ideas, experiments, and the people who make them happen.')):value(page.body,[value(c.date,event?.dates),value(c.time),value(c.location,event?.venue)].filter(Boolean).join(' / ')||'A hands-on invitation to make something.');
    textBlock(scene,body,{x:m,y:captionY,w:scene.width-m*2,h:Math.max(0,l.mainBottom-captionY)},{size:36,minSize:32,color:scene.colors.ink,field:maker?'Cover description':'Workshop date, time and location',lineHeight:1.2});
  }else{
    const headingH=story?880:620;
    expressiveHeading(scene,title,{x:m,y:l.mainTop,w:scene.width-m*2,h:headingH},{field:maker?'Project name':'Workshop title',maxLines:5});
    const nameY=l.mainTop+headingH+38;
    const name=textBlock(scene,value(maker?c.name:c.host,maker?'Meet the maker':'A hands-on workshop'),{x:m,y:nameY,w:scene.width-m*2,h:110},{size:48,minSize:40,color:scene.colors.ink,field:maker?'Maker name':'Workshop host',lineHeight:1.12,maxLines:2});
    const bodyY=nameY+name.height+30;
    const body=value(page.body,maker?value(c.description):[value(c.date,event?.dates),value(c.time),value(c.location,event?.venue)].filter(Boolean).join(' / '));
    textBlock(scene,body,{x:m,y:bodyY,w:scene.width-m*2,h:Math.max(0,l.mainBottom-bodyY)},{size:38,minSize:32,color:scene.colors.ink,field:maker?'Cover description':'Workshop date, time and location',lineHeight:1.24});
  }
}

function details(scene,item,event,page,asset,crop){
  const c=item.content||{},l=scene.layout,m=l.margin,story=scene.format==='story',maker=item.type==='maker';
  expressiveHeading(scene,value(page.heading,maker?'BEHIND\nTHE BUILD':'IN THE\nWORKSHOP'),{x:m,y:l.mainTop,w:scene.width-m*2,h:story?250:210},{field:'Details heading',maxLines:3,lineLength:14});
  const contentTop=story?520:360;
  if(asset)addPhoto(scene,asset,{x:0,y:contentTop,w:410,h:l.mainBottom-contentTop-12},crop);
  const x=asset?470:m,w=scene.width-x-m;
  let cursor=contentTop;
  const title=textBlock(scene,maker?value(c.project,'The project'):value(c.title,'The workshop'),{x,y:cursor,w,h:180},{size:46,minSize:36,color:scene.colors.ink,field:maker?'Project name':'Workshop title',lineHeight:1.12,maxLines:4});
  cursor+=title.height+24;
  const person=textBlock(scene,maker?value(c.name,'The maker'):value(c.host,'Your host'),{x,y:cursor,w,h:96},{size:34,minSize:30,color:scene.colors.ink,field:maker?'Maker name':'Workshop host',maxLines:2,lineHeight:1.2});
  cursor+=person.height+40;
  const factsH=maker?70:(story?290:238),factsY=l.mainBottom-factsH;
  const body=value(page.body,value(c.description,maker?'Every project starts with a question. Meet the maker, explore the process, and see what they built.':'Explore a new skill with a maker who loves sharing what they know.'));
  textBlock(scene,body,{x,y:cursor,w,h:Math.max(0,factsY-cursor-28)},{size:42,minSize:36,color:scene.colors.ink,field:'Details body',lineHeight:1.3});
  if(maker){
    textBlock(scene,value(c.handle),{x,y:factsY+12,w,h:58},{size:32,minSize:28,color:scene.colors.ink,field:'Social handle',maxLines:1,lineHeight:1.2});
  }else{
    const date=textBlock(scene,value(c.date,event?.dates)||'Date to be announced',{x,y:factsY,w,h:92},{size:38,minSize:32,color:scene.colors.ink,field:'Workshop date',maxLines:2,lineHeight:1.14});
    const timeY=factsY+date.height+14;
    const time=textBlock(scene,[value(c.time),value(c.duration)].filter(Boolean).join(' / '),{x,y:timeY,w,h:80},{size:34,minSize:29,color:scene.colors.ink,field:'Workshop time and duration',maxLines:2,lineHeight:1.16});
    const venueY=timeY+time.height+18;
    textBlock(scene,value(c.location,event?.venue)||'Location to be announced',{x,y:venueY,w,h:Math.max(0,l.mainBottom-venueY)},{size:34,minSize:28,color:scene.colors.ink,field:'Workshop location',maxLines:3,lineHeight:1.16});
  }
  scene.regions.details={x,y:contentTop,w,h:l.mainBottom-contentTop};
}

function closing(scene,item,event,page,asset,crop){
  const c=item.content||{},l=scene.layout,m=l.margin,story=scene.format==='story',maker=item.type==='maker',showPhoto=Boolean(asset&&page.assetId);
  expressiveHeading(scene,value(page.heading,maker?'COME\nEXPLORE':'COME\nMAKE'),{x:m,y:l.mainTop,w:scene.width-m*2,h:story?540:450},{field:'Closing heading',maxLines:3,lineLength:12});
  const intro=value(page.body,maker?`${value(c.name,'Meet the maker')} / ${value(c.project,'Explore their project')}`:`${value(c.title,'Join the workshop')} / ${value(c.host)}`);
  textBlock(scene,intro,{x:m,y:story?770:570,w:scene.width-m*2,h:story?170:126},{size:38,minSize:32,color:scene.colors.ink,field:'Closing introduction',lineHeight:1.18,maxLines:3});
  const dateText=(value(c.date,event?.dates)||'See you at Maker Faire').replace(/\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,'\n$1').toUpperCase();
  const practical=[dateText,...(!maker&&value(c.time)?[c.time]:[])].join('\n');
  textBlock(scene,practical,{x:m,y:story?1010:710,w:showPhoto?760:820,h:story?340:316},{size:story?120:112,minSize:78,color:scene.colors.fg,field:'Closing date and time',maxLines:4,lineHeight:1.04});
  if(showPhoto)addPhoto(scene,asset,{x:scene.width-250,y:story?1290:930,w:250,h:story?290:240},crop);
  const textWidth=scene.width-m*2-(showPhoto?285:0);
  const venue=maker?value(event?.venue):value(c.location,event?.venue);
  textBlock(scene,venue,{x:m,y:story?1380:1038,w:textWidth,h:story?126:94},{size:44,minSize:34,color:scene.colors.ink,field:'Closing location',maxLines:3,lineHeight:1.16});
  const url=value(c.url,event?.url)||value(c.handle);
  textBlock(scene,url||'More details from the festival team',{x:m,y:story?1518:1144,w:textWidth,h:story?72:58},{size:34,minSize:28,color:scene.colors.ink,field:'Booking link or handle',maxLines:2,lineHeight:1.18});
  scene.regions.details={x:m,y:l.mainTop,w:scene.width-m*2,h:l.mainBottom-l.mainTop};
}

/** One layout model feeds the editor, PNG, SVG and every animation frame. */
export function createContentScene(item,event={},options={}){
  const format=Object.hasOwn(FORMATS,options.format)?options.format:'feed';
  if(item?.type==='poster'){
    const project=item.legacyProject,state=project?.state||{},draft=project?.drafts?.[state.direction]||{};
    const scene=createPosterScene({...state,...draft,format:format==='story'?'story':'poster',phase:options.phase??state.phase??0});
    return {...scene,warnings:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false};
  }
  const {w:width,h:height}=FORMATS[format],margin=54,story=format==='story';
  const palette=PALETTES.find(p=>p.id===item?.palette&&['maker','maker-red','maker-cyan'].includes(p.id))||PALETTES.find(p=>p.id==='maker-red');
  // Dark type maintains readable contrast on the bright cyan field.
  const colors={...palette,fg:palette.id==='maker-cyan'?palette.ink:palette.fg};
  const pages=item?.pages?.length?item.pages:[{role:'cover'}];
  const pageIndex=clamp(Number.isInteger(options.pageIndex)?options.pageIndex:0,0,pages.length-1),page=pages[pageIndex];
  const direction=Object.hasOwn(TREATMENT_PROFILES,item?.treatment)?item.treatment:'air';
  const selectedLogo=getLogoVariant(item?.logoVariant),logoVariant=item?.logoColourMode==='auto'?`${selectedLogo.layout}-${palette.id==='maker-red'?'white':'black'}`:selectedLogo.id;
  const top=story?190:90,bodyBottom=height-(story?220:54),footerY=bodyBottom-78;
  const partner=item?.partner&&(value(item.partner.name)||item.partner.asset)?item.partner:null;
  const scene={width,height,margin,background:colors.bg,ops:[],cells:[],direction,description:`${item?.type==='workshop'?'Workshop':'Maker spotlight'} ${page.role||'cover'}`,colors,format,logoVariant,phase:Number.isFinite(options.phase)?options.phase:0,warnings:[],textBlocks:[],hasOverflow:false,hasUnsupportedText:false,regions:{},layout:{margin,mainTop:top,mainBottom:footerY-38,footerY,bodyBottom}};
  const assets=Array.isArray(item?.assets)?item.assets:[];
  const asset=assets.find(candidate=>candidate.id===page.assetId)||assets[0];
  const crop=item?.variants?.[format]||{};
  const render=page.role==='details'?details:page.role==='closing'?closing:cover;
  render(scene,item||{type:'maker'},event,page,asset,crop);
  footer(scene,event,pageIndex,pages.length,partner);
  return scene;
}

export async function prepareContentAssets(item){
  if(item?.type==='poster')return preparePosterAssets(item.legacyProject?.state?.media?.asset);
  const assets=Array.isArray(item?.assets)?item.assets:[];
  // Sequential loading preserves the renderer's predictable image-cache order.
  // The editor limits each item to eight photographs, matching that cache.
  await preparePosterAssets();
  for(const asset of assets)await preparePosterAssets(asset);
  if(item?.partner?.asset)await preparePosterAssets(item.partner.asset);
}
