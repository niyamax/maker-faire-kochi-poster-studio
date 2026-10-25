import {normalizeSilhouette} from './cutout-response.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(n,fallback,a,b)=>Number.isFinite(n)?clamp(n,a,b):fallback;
export const MAX_IMAGE_DATA_LENGTH=1_800_000;
export const IMAGE_DEFAULTS=Object.freeze({layout:'window',zoom:1,focusX:.5,focusY:.5,size:1,overlap:.22,position:1,freePlacement:true,boxes:{window:null,cutout:null},reaction:.65});

export function normalizePosterImage(value){
  if(!value)return null;
  const asset=value.asset;
  if(!asset||typeof asset.src!=='string'||asset.src.length>MAX_IMAGE_DATA_LENGTH||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.src))throw Error('Choose a PNG, JPG or WebP image.');
  if(!Number.isFinite(asset.width)||!Number.isFinite(asset.height)||asset.width<1||asset.height<1||asset.width>1600||asset.height>1600)throw Error('This project image has invalid dimensions.');
  return {
    asset:{src:asset.src,width:asset.width,height:asset.height,name:String(asset.name||'Poster image').replace(/[\x00-\x1f]/g,'').slice(0,80),hasAlpha:asset.hasAlpha===true,silhouette:normalizeSilhouette(asset.silhouette)},
    layout:value.layout==='cutout'?'cutout':'window',
    zoom:number(value.zoom,1,1,4),focusX:number(value.focusX,.5,0,1),focusY:number(value.focusY,.5,0,1),
    size:number(value.size,1,.1,4),overlap:number(value.overlap,.22,0,.3),position:number(value.position,1,0,1),
    freePlacement:value.freePlacement===true,boxes:{window:normalizeBox(value.boxes?.window),cutout:normalizeBox(value.boxes?.cutout)},reaction:number(value.reaction,.65,0,1),
  };
}

export function imageCoverCrop(asset,frame,media){
  const scale=Math.max(frame.w/asset.width,frame.h/asset.height)*media.zoom;
  const w=frame.w/scale,h=frame.h/scale;
  return {x:(asset.width-w)*media.focusX,y:(asset.height-h)*media.focusY,w,h};
}

function normalizeBox(box){
  if(!box||!['cx','cy','w','h'].every(key=>Number.isFinite(box[key])))return null;
  return {cx:clamp(box.cx,-1,2),cy:clamp(box.cy,-1,2),w:clamp(box.w,.0001,2),h:clamp(box.h,.0001,2)};
}

export function imageWithRect(media,rect,info){
  const x=clamp(rect.x,Math.min(30,rect.w)-rect.w,info.width-Math.min(30,rect.w)),y=clamp(rect.y,Math.min(30,rect.h)-rect.h,info.height-Math.min(30,rect.h));
  const box={cx:clamp((x+rect.w/2)/info.width,-1,2),cy:clamp((y+rect.h/2)/info.height,-1,2),w:clamp(rect.w/info.width,.0001,2),h:clamp(rect.h/info.height,.0001,2)};
  return {...media,freePlacement:true,size:rect.w/info.baseFrame.w,boxes:{...media.boxes,[media.layout]:box}};
}

/** Begin with a composed frame, then preserve direct image transforms
 * independently of typography, crop and footer placement. */
export function posterImageLayout(media,width,height,fullType,footer){
  if(!media)return null;
  const short=Math.min(width,height),margin=short*.065,gap=short*.025;
  const footerTop=Math.min(height*.79,...[footer.details,footer.logo].filter(r=>r.h>0&&r.y>height*.68).map(r=>r.y-gap));
  let typeRect,frame;
  if(media.layout==='window'){
    if(width/height>1.25){
      typeRect={...fullType,w:width*.52};
      frame={x:width*.62,y:fullType.y,w:width-margin-width*.62,h:Math.min(fullType.h,footerTop-fullType.y)};
    }else{
      typeRect={...fullType,h:height*.345};
      frame={x:margin,y:height*.435,w:width-2*margin,h:Math.min(height*.32,footerTop-height*.435)};
    }
    frame.h=Math.max(1,frame.h);
    return freeImageLayout(media,{typeRect,frame},width,height,margin,footerTop);
  }
  typeRect={...fullType,h:height*.53};
  const top=typeRect.y+typeRect.h+gap-typeRect.h*media.overlap;
  const maxW=width*.44*media.size,maxH=Math.max(1,Math.min(height*.29*media.size,footerTop-top));
  const scale=Math.min(maxW/media.asset.width,maxH/media.asset.height),w=media.asset.width*scale,h=media.asset.height*scale;
  frame={x:margin+(width-2*margin-w)*media.position,y:top,w,h};
  return freeImageLayout(media,{typeRect,frame},width,height,margin,footerTop);
}

function freeImageLayout(media,template,width,height,margin,footerTop){
  let baseFrame={...template.frame},frame={...baseFrame};
  if(media.layout==='window'&&media.freePlacement){baseFrame.h=height*(width/height>1.25?.705:.32);frame={...baseFrame};}
  if(media.layout==='cutout'){
    const scale=Math.min(width*.5/media.asset.width,height*.36/media.asset.height);
    const w=media.asset.width*scale,h=media.asset.height*scale;
    baseFrame={x:(width-w)/2,y:height*.60-h/2,w,h};
    if(media.freePlacement)frame={...baseFrame,w:w*media.size,h:h*media.size,x:width/2-w*media.size/2,y:baseFrame.y+h/2-h*media.size/2};
  }
  const box=media.boxes?.[media.layout];
  if(box){
    const w=box.w*width,h=media.layout==='cutout'?w*media.asset.height/media.asset.width:box.h*height;
    frame={x:box.cx*width-w/2,y:box.cy*height-h/2,w,h};
  }
  const op={kind:'image',src:media.asset.src,...frame};
  if(media.layout==='window')Object.assign(op,{source:imageCoverCrop(media.asset,frame,media),naturalWidth:media.asset.width,naturalHeight:media.asset.height});
  return {...template,frame,baseFrame,op};
}

export function dragPosterImage(media,info,start,point,{crop=false,handle=null}={}){
  const dx=point.x-start.x,dy=point.y-start.y;
  if(crop&&media.layout==='window'){
    const source=info.op.source,rangeX=media.asset.width-source.w,rangeY=media.asset.height-source.h;
    return {...media,focusX:rangeX>1e-8?clamp(media.focusX-dx*source.w/info.frame.w/rangeX,0,1):media.focusX,focusY:rangeY>1e-8?clamp(media.focusY-dy*source.h/info.frame.h/rangeY,0,1):media.focusY};
  }
  const old=info.frame;let frame={...old};
  if(handle){
    const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s');
    const corner=(west||east)&&(north||south);
    if(corner){
      const sx=west?-1:1,sy=north?-1:1,max=Math.min(info.width*2/old.w,info.height*2/old.h),min=Math.min(max,Math.max(30/old.w,30/old.h));
      const factor=clamp(1+(dx*sx*old.w+dy*sy*old.h)/(old.w*old.w+old.h*old.h),min,max);
      frame.w=old.w*factor;frame.h=old.h*factor;frame.x=west?old.x+old.w-frame.w:old.x;frame.y=north?old.y+old.h-frame.h:old.y;
    }else{
      if(west){frame.w=clamp(old.w-dx,30,info.width*2);frame.x=old.x+old.w-frame.w;}
      if(east)frame.w=clamp(old.w+dx,30,info.width*2);
      if(north){frame.h=clamp(old.h-dy,30,info.height*2);frame.y=old.y+old.h-frame.h;}
      if(south)frame.h=clamp(old.h+dy,30,info.height*2);
    }
  }else{
    frame.x=old.x+dx;frame.y=old.y+dy;
  }
  return imageWithRect(media,frame,info);
}

export function scalePosterImage(media,info,scale){
  const factor=clamp(scale,.1,4)/(info.frame.w/info.baseFrame.w),r=info.frame;
  const w=Math.min(info.width*2,info.height*2*r.w/r.h,r.w*factor),h=r.h*w/r.w;
  return imageWithRect(media,{x:r.x+r.w/2-w/2,y:r.y+r.h/2-h/2,w,h},info);
}

export function alignPosterImage(media,info,alignment){
  const r={...info.frame},margin=Math.min(info.width,info.height)*.065;
  if(alignment==='left')r.x=margin;if(alignment==='center')r.x=(info.width-r.w)/2;if(alignment==='right')r.x=info.width-margin-r.w;
  if(alignment==='top')r.y=margin;if(alignment==='middle')r.y=(info.height-r.h)/2;if(alignment==='bottom')r.y=info.height-margin-r.h;
  return imageWithRect(media,r,info);
}
