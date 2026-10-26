import {resizeRect} from './resize-rect.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const HEADLINE_FRAME_DEFAULTS=Object.freeze({fit:'scale',box:null,basis:null,locked:false});

/** Store placement relative to the poster so saved projects survive a format
 * change. The frame is independent of animation phase and letter offsets. */
export function normalizeHeadlineFrame(value){
  const fit=value?.fit==='fill'?'fill':'scale',box=value?.box;
  const locked=typeof value?.locked==='boolean'?value.locked:Boolean(box&&fit==='scale');
  const basis=value?.basis&&['w','h'].every(key=>Number.isFinite(value.basis[key])&&value.basis[key]>0)?{w:clamp(value.basis.w,1,10000),h:clamp(value.basis.h,1,10000)}:null;
  if(!box||!['x','y','w','h'].every(key=>Number.isFinite(box[key])))return {fit,box:null,basis:null,locked};
  const w=clamp(box.w,.01,1),h=clamp(box.h,.01,1);
  return {fit,box:{x:clamp(box.x,0,1-w),y:clamp(box.y,0,1-h),w,h},basis,locked};
}
export function constrainHeadlineRect(rect,width,height){
  const w=clamp(rect.w,Math.min(32,width),width),h=clamp(rect.h,Math.min(32,height),height);
  return {x:clamp(rect.x,0,width-w),y:clamp(rect.y,0,height-h),w,h};
}
export function resolveHeadlineFrame(automatic,value,width,height){
  const settings=normalizeHeadlineFrame(value);
  if(!settings.box)return {...automatic};
  const b=settings.box,rect=constrainHeadlineRect({x:b.x*width,y:b.y*height,w:b.w*width,h:b.h*height},width,height);
  if(settings.fit==='scale'){
    // One transform carries both the artwork and its editing geometry.
    const factor=Math.min(rect.w/automatic.w,rect.h/automatic.h);
    rect.w=automatic.w*factor;rect.h=automatic.h*factor;
  }
  return rect;
}
export function headlineSettingsFromRect(rect,width,height,fit='scale',basis=null,locked=false){
  const box=constrainHeadlineRect(rect,width,height);
  return normalizeHeadlineFrame({fit,box:{x:box.x/width,y:box.y/height,w:box.w/width,h:box.h/height},basis,locked});
}

/** Corners always keep proportions; unlocked sides reshape independently. */
export function dragHeadlineRect(rect,start,point,handle,width,height,locked=false){
  if(!handle)return constrainHeadlineRect({...rect,x:rect.x+point.x-start.x,y:rect.y+point.y-start.y},width,height);
  const keep=typeof locked==='string'?locked==='scale':locked;
  return resizeRect(rect,start,point,{x:0,y:0,w:width,h:height},handle,{locked:keep,minW:Math.min(32,rect.w),minH:Math.min(32,rect.h),maxW:width,maxH:height});
}
export function headlineRectFromValue(rect,key,value,width,height,locked=false){
  if(key==='x'||key==='y')return constrainHeadlineRect({...rect,[key]:value},width,height);
  if(!(typeof locked==='string'?locked==='scale':locked))return constrainHeadlineRect({...rect,[key]:value},width,height);
  const factor=Math.max(Math.min(1,Math.max(32/rect.w,32/rect.h)),value/rect[key]);
  const size=Math.min(factor,(width-rect.x)/rect.w,(height-rect.y)/rect.h);
  return constrainHeadlineRect({...rect,w:rect.w*size,h:rect.h*size},width,height);
}
export function fitHeadlineRect(rect,action,width,height,margin,fit){
  if(action==='center')return {...rect,x:(width-rect.w)/2,y:(height-rect.h)/2};
  const available={w:width-2*margin,h:height-2*margin};
  let next={...rect};
  if(fit==='fill')next[action==='width'?'w':'h']=available[action==='width'?'w':'h'];
  else{
    const requested=action==='width'?available.w/rect.w:available.h/rect.h;
    const factor=Math.min(requested,available.w/rect.w,available.h/rect.h);
    next.w*=factor;next.h*=factor;
  }
  if(action==='width')next.x=margin;
  else next.y=margin;
  next.x=clamp(next.x,margin,Math.max(margin,width-margin-next.w));
  next.y=clamp(next.y,margin,Math.max(margin,height-margin-next.h));
  return constrainHeadlineRect(next,width,height);
}
export const transformHeadlineRect=(rect,m)=>({...rect,x:rect.x*m.sx+m.tx,y:rect.y*m.sy+m.ty,w:rect.w*m.sx,h:rect.h*m.sy});
export const inverseHeadlineRect=(rect,m)=>({...rect,x:(rect.x-m.tx)/m.sx,y:(rect.y-m.ty)/m.sy,w:rect.w/m.sx,h:rect.h/m.sy});
