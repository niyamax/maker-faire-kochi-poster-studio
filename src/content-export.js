import {createContentScene,prepareContentAssets} from './content-scene.js';
import {createWorkspace,normalizeWorkspace,contentItemLabel,contentCaption,CONTENT_FORMATS} from './content-project.js';
import {drawPosterScene,posterSVG} from './scene.js';
import {exportVideo} from './video-export.js';

const encoder=new TextEncoder();
const MAX_ZIP_SIZE=0xffffffff;
const crcTable=Uint32Array.from({length:256},(_,index)=>{
  let value=index;
  for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
const crc32=bytes=>{
  let value=0xffffffff;
  for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);
  return (value^0xffffffff)>>>0;
};
const abortError=()=>new DOMException('Content export cancelled.','AbortError');
const checkAbort=signal=>{if(signal?.aborted)throw abortError();};
const cleanSlug=(value,fallback='content')=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,76).replace(/-+$/,'')||fallback;

function outputOptions({format='feed',pageIndex=0,...rest}={}){
  if(!Object.hasOwn(CONTENT_FORMATS,format))throw new RangeError('Choose a feed or Story output.');
  if(!Number.isInteger(pageIndex)||pageIndex<0)throw new RangeError('Choose a valid content page.');
  return {...rest,format,pageIndex};
}
function snapshotContent(item,event){
  const workspace=normalizeWorkspace({...createWorkspace(),event,items:[item]});
  if(workspace.items.length!==1)throw new Error('Choose a content item to export.');
  return {workspace,item:workspace.items[0],event:workspace.event};
}
function pageCount(item){return Math.max(1,item.pages?.length||0);}
function omittedContent(scene){
  return Array.isArray(scene.omittedContent)?scene.omittedContent.filter(entry=>entry&&typeof entry.field==='string'&&typeof entry.text==='string'):[];
}
function isOmittedBlock(block,omissions){
  return block.omitted===true||omissions.some(entry=>entry.field===block.field&&(typeof block.text!=='string'||entry.text===block.text));
}
function checkedScene(item,event,options){
  if(options.pageIndex>=pageCount(item))throw new RangeError('This content page no longer exists.');
  const scene=createContentScene(item,event,options),expected=CONTENT_FORMATS[options.format];
  if(scene.width!==expected.w||scene.height!==expected.h)throw new Error('This output has invalid dimensions.');
  const omissions=omittedContent(scene),blocks=scene.textBlocks||[];
  const overflowing=blocks.filter(block=>block.overflow),unsupported=blocks.filter(block=>block.unsupportedCharacters?.length);
  // A composed layout may deliberately leave secondary copy off the artwork.
  // Only unresolved rendering failures block an export; omissions are retained
  // in the source project and carried into the pack's supporting text.
  if(overflowing.some(block=>!isOmittedBlock(block,omissions))||(scene.hasOverflow&&!overflowing.length))throw new Error('Some text cannot be laid out correctly on this page. Edit the highlighted text before exporting.');
  if(unsupported.some(block=>!isOmittedBlock(block,omissions))||(scene.hasUnsupportedText&&!unsupported.length))throw new Error('Some characters cannot be rendered by the current fonts. Edit the highlighted text before exporting.');
  if(!Array.isArray(scene.ops)||!scene.ops.length)throw new Error('This content page has no artwork to export.');
  return scene;
}

export function contentFilename(item,options={}){
  const {format,pageIndex,extension='png'}=outputOptions(options);
  if(!/^[a-z0-9]{1,10}$/i.test(extension))throw new RangeError('Choose a valid export file type.');
  const stem=`maker-faire-${cleanSlug(contentItemLabel(item),item?.type||'content')}`;
  const ext=extension.toLowerCase();
  if(ext==='zip')return `${stem}-social-pack.zip`;
  if(ext==='json')return `${stem}-project.json`;
  return `${stem}-${format}-${String(pageIndex+1).padStart(2,'0')}.${ext}`;
}

async function scenePNG(scene){
  if(typeof document==='undefined')throw new Error('PNG export needs a browser drawing surface.');
  const canvas=document.createElement('canvas');canvas.width=scene.width;canvas.height=scene.height;
  try{
    const context=canvas.getContext('2d',{alpha:false,colorSpace:'srgb'});
    if(!context)throw new Error('A drawing surface could not be created.');
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    drawPosterScene(context,scene);
    const blob=await new Promise((resolve,reject)=>{
      try{canvas.toBlob(result=>result?.size?resolve(result):reject(new Error('The PNG could not be created. Try exporting SVG.')),'image/png');}
      catch(error){reject(error);}
    });
    return blob;
  }finally{canvas.width=canvas.height=1;}
}

export async function contentPNG(item,event,options={}){
  const output=outputOptions(options),snapshot=snapshotContent(item,event);
  checkAbort(output.signal);
  await prepareContentAssets(snapshot.item);checkAbort(output.signal);
  const scene=checkedScene(snapshot.item,snapshot.event,output);
  return scenePNG(scene);
}

export function contentSVG(item,event,options={}){
  const output=outputOptions(options),snapshot=snapshotContent(item,event);
  return posterSVG(checkedScene(snapshot.item,snapshot.event,output));
}

async function entryBytes(data){
  if(typeof data==='string')return encoder.encode(data);
  if(data instanceof Uint8Array)return data;
  if(data instanceof ArrayBuffer)return new Uint8Array(data);
  if(ArrayBuffer.isView(data))return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  if(data instanceof Blob)return new Uint8Array(await data.arrayBuffer());
  throw new TypeError('ZIP entries must contain text, bytes or a Blob.');
}

/** Store-only ZIP. Standard headers and CRC32 keep image files usable without
 * adding a compression dependency; PNG and WebP are already compressed. */
export async function zipEntries(entries){
  if(!Array.isArray(entries)||!entries.length||entries.length>65535)throw new RangeError('Choose between 1 and 65535 files for the ZIP.');
  const local=[],central=[],names=new Set();let offset=0,centralSize=0;
  for(const entry of entries){
    const name=String(entry?.name||'');
    if(!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(part=>part==='..'||part==='.'||part===''))throw new Error('ZIP filenames must be safe relative paths.');
    if(names.has(name))throw new Error('ZIP filenames must be unique.');
    names.add(name);
    const nameBytes=encoder.encode(name),bytes=await entryBytes(entry.data);
    if(nameBytes.length>65535||bytes.length>MAX_ZIP_SIZE)throw new RangeError('This file is too large for a ZIP export.');
    const crc=crc32(bytes),header=new Uint8Array(30),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);
    view.setUint16(8,0,true);view.setUint16(10,0,true);view.setUint16(12,33,true);
    view.setUint32(14,crc,true);view.setUint32(18,bytes.length,true);view.setUint32(22,bytes.length,true);view.setUint16(26,nameBytes.length,true);
    local.push(header,nameBytes,bytes);
    const record=new Uint8Array(46),directory=new DataView(record.buffer);
    directory.setUint32(0,0x02014b50,true);directory.setUint16(4,20,true);directory.setUint16(6,20,true);directory.setUint16(8,0x800,true);
    directory.setUint16(10,0,true);directory.setUint16(12,0,true);directory.setUint16(14,33,true);
    directory.setUint32(16,crc,true);directory.setUint32(20,bytes.length,true);directory.setUint32(24,bytes.length,true);directory.setUint16(28,nameBytes.length,true);directory.setUint32(42,offset,true);
    central.push(record,nameBytes);centralSize+=46+nameBytes.length;offset+=30+nameBytes.length+bytes.length;
    if(offset+centralSize+22>MAX_ZIP_SIZE)throw new RangeError('This content pack is too large for a ZIP export.');
  }
  const end=new Uint8Array(22),view=new DataView(end.buffer);
  view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);
  view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}

function withOmittedText(copy,omissions){
  let result=String(copy||'').trim();
  const included=new Set();
  for(const entry of omissions){
    const text=entry.text.trim();
    if(!text||included.has(text)||result.includes(text))continue;
    included.add(text);result+=(result?'\n\n':'')+text;
  }
  return result;
}
function altTextForPage(item,event,page,omissions=[],callout=''){
  if(item.altText?.trim())return withOmittedText(item.altText,omissions);
  const c=item.content||{},heading=page?.heading||c.project||c.title||c.name||contentItemLabel(item);
  const details=page?.body||c.description;
  const facts=item.type==='workshop'?[c.host,c.date||event.dates,c.time,c.duration,c.location||event.venue,c.url||event.url]:[c.name,c.handle,c.date||event.dates,c.location||event.venue,c.url||event.url];
  const hero=typeof callout==='string'?callout.trim():'';
  const description=[...new Set([event.name,hero,heading,details,...facts].filter(Boolean))].join('. ');
  return withOmittedText(description,omissions);
}

export async function contentPack(item,event,{onProgress=()=>{},signal}={}){
  const snapshot=snapshotContent(item,event);item=snapshot.item;event=snapshot.event;
  const count=pageCount(item),outputs=[];
  checkAbort(signal);
  onProgress(0,{stage:'preparing',totalPages:Object.keys(CONTENT_FORMATS).length*count});
  await prepareContentAssets(item);checkAbort(signal);
  // Validate the entire pack before the first expensive raster operation.
  for(const format of Object.keys(CONTENT_FORMATS))for(let pageIndex=0;pageIndex<count;pageIndex++){
    const options={format,pageIndex,phase:0};
    outputs.push({options,scene:checkedScene(item,event,options)});
  }
  const entries=[],files=[],alternativeText=[];
  for(const [index,{options,scene}] of outputs.entries()){
    checkAbort(signal);
    const filename=`${options.format}/${contentFilename(item,options)}`,data=await scenePNG(scene);
    checkAbort(signal);
    entries.push({name:filename,data});
    const page=item.pages?.[options.pageIndex];
    const omissions=omittedContent(scene);
    files.push({filename,format:options.format,pageIndex:options.pageIndex,page:options.pageIndex+1,role:page?.role||'cover',width:scene.width,height:scene.height,warnings:scene.warnings||[],omittedContent:omissions});
    alternativeText.push(`${filename}\n${altTextForPage(item,event,page,omissions,scene.callout)}`);
    onProgress((index+1)/(outputs.length+1),{stage:'rendering',...options,totalPages:outputs.length});
  }
  const manifest={kind:'maker-faire-content-pack',version:1,exportedAt:new Date().toISOString(),itemId:item.id,type:item.type,title:contentItemLabel(item),event,files};
  entries.push(
    {name:'project.json',data:JSON.stringify(snapshot.workspace,null,2)+'\n'},
    {name:'caption.txt',data:withOmittedText(item.caption?.trim()||contentCaption(item,event),outputs.flatMap(({scene})=>omittedContent(scene)))+'\n'},
    {name:'alt-text.txt',data:alternativeText.join('\n\n')+'\n'},
    {name:'manifest.json',data:JSON.stringify(manifest,null,2)+'\n'},
  );
  onProgress(outputs.length/(outputs.length+1),{stage:'packaging',totalPages:outputs.length});
  const blob=await zipEntries(entries);checkAbort(signal);
  onProgress(1,{stage:'complete',totalPages:outputs.length});return blob;
}

export async function contentVideo(item,event,options={}){
  const output=outputOptions(options),snapshot=snapshotContent(item,event);
  checkAbort(output.signal);
  await prepareContentAssets(snapshot.item);checkAbort(output.signal);
  const first=checkedScene(snapshot.item,snapshot.event,{...output,phase:0});
  return exportVideo({
    width:first.width,height:first.height,duration:output.duration??8,fps:output.fps??30,renderScale:1,maxSide:1920,
    signal:output.signal,onProgress:output.onProgress,onSetup:output.onSetup,
    renderFrame:(context,phase)=>drawPosterScene(context,createContentScene(snapshot.item,snapshot.event,{...output,phase})),
  });
}

export function downloadContent(blob,filename){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('There is no exported file to download.');
  if(typeof document==='undefined')throw new Error('Downloads need a browser.');
  const anchor=document.createElement('a'),url=URL.createObjectURL(blob);
  anchor.href=url;anchor.download=String(filename||'maker-faire-content').replace(/[\x00-\x1f/\\]/g,'-');anchor.style.display='none';
  document.body.append(anchor);
  try{anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  catch(error){URL.revokeObjectURL(url);throw error;}
  finally{anchor.remove();}
}
