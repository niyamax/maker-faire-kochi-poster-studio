const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(n,fallback,a,b)=>Number.isFinite(n)?clamp(n,a,b):fallback;
export const MAX_IMAGE_DATA_LENGTH=1_800_000;
export const IMAGE_DEFAULTS=Object.freeze({layout:'window',zoom:1,focusX:.5,focusY:.5,size:1,overlap:.22,position:1});

export function normalizePosterImage(value){
  if(!value)return null;
  const asset=value.asset;
  if(!asset||typeof asset.src!=='string'||asset.src.length>MAX_IMAGE_DATA_LENGTH||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.src))throw Error('Choose a PNG, JPG or WebP image.');
  if(!Number.isFinite(asset.width)||!Number.isFinite(asset.height)||asset.width<1||asset.height<1||asset.width>1600||asset.height>1600)throw Error('This project image has invalid dimensions.');
  return {
    asset:{src:asset.src,width:asset.width,height:asset.height,name:String(asset.name||'Poster image').replace(/[\x00-\x1f]/g,'').slice(0,80),hasAlpha:asset.hasAlpha===true},
    layout:value.layout==='cutout'?'cutout':'window',
    zoom:number(value.zoom,1,1,2),focusX:number(value.focusX,.5,0,1),focusY:number(value.focusY,.5,0,1),
    size:number(value.size,1,.6,1.4),overlap:number(value.overlap,.22,0,.3),position:number(value.position,1,0,1),
  };
}

export function imageCoverCrop(asset,frame,media){
  const scale=Math.max(frame.w/asset.width,frame.h/asset.height)*media.zoom;
  const w=frame.w/scale,h=frame.h/scale;
  return {x:(asset.width-w)*media.focusX,y:(asset.height-h)*media.focusY,w,h};
}

/** Fixed frames follow the poster margins. Typography reserves room without
 * changing the saved font, arrangement, offsets or footer settings. */
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
    return {typeRect,frame,op:{kind:'image',src:media.asset.src,...frame,source:imageCoverCrop(media.asset,frame,media),naturalWidth:media.asset.width,naturalHeight:media.asset.height}};
  }
  typeRect={...fullType,h:height*.53};
  const top=typeRect.y+typeRect.h+gap-typeRect.h*media.overlap;
  const maxW=width*.44*media.size,maxH=Math.max(1,Math.min(height*.29*media.size,footerTop-top));
  const scale=Math.min(maxW/media.asset.width,maxH/media.asset.height),w=media.asset.width*scale,h=media.asset.height*scale;
  frame={x:margin+(width-2*margin-w)*media.position,y:top,w,h};
  return {typeRect,frame,op:{kind:'image',src:media.asset.src,...frame}};
}

export function dragPosterImage(media,info,start,point){
  const dx=point.x-start.x,dy=point.y-start.y;
  if(media.layout==='window'){
    const crop=info.op.source,rangeX=media.asset.width-crop.w,rangeY=media.asset.height-crop.h;
    return {...media,focusX:rangeX>1e-8?clamp(media.focusX-dx*crop.w/info.frame.w/rangeX,0,1):media.focusX,focusY:rangeY>1e-8?clamp(media.focusY-dy*crop.h/info.frame.h/rangeY,0,1):media.focusY};
  }
  const short=Math.min(info.width,info.height),available=info.width-2*short*.065-info.frame.w;
  return {...media,position:available>0?clamp(media.position+dx/available,0,1):media.position,overlap:clamp(media.overlap-dy/info.typeRect.h,0,.3)};
}
