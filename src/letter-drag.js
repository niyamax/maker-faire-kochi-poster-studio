import {HEADLINE_MAX_LENGTH} from './content-limits.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
export function normalizeLetterOffsets(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>HEADLINE_MAX_LENGTH)throw Error('Invalid letter positions.');
  return value.map(entry=>{
    if(entry==null)return null;
    if(typeof entry!=='object'||['x','y','w','h'].some(key=>entry[key]!==undefined&&!Number.isFinite(entry[key])))throw Error('Invalid letter position.');
    const stable=entry.basis==='rest';
    return {x:clamp(finite(entry.x),-1,1),y:clamp(finite(entry.y),-1,1),w:clamp(finite(entry.w,1),stable?.05:.45,stable?8:1.8),h:clamp(finite(entry.h,1),stable?.05:.45,stable?8:1.8),...(stable?{basis:'rest'}:{})};
  });
}
const edited=entry=>entry&&(Math.abs(entry.x||0)+Math.abs(entry.y||0)+Math.abs((entry.w??1)-1)+Math.abs((entry.h??1)-1)>1e-8);
export const hasLetterEdits=offsets=>Boolean(offsets?.some(edited));

/** Apply the continuous motion field to an already resolved editing pose.
 * Collision decisions are made at rest, never against a moving set of boxes.
 * Using centre deltas keeps relocated letters close to their edited position.
 */
export function animateLetterPose(restCells,referenceCells,animatedCells,bounds){
  const reference=new Map(referenceCells.map(c=>[c.index,c])),animated=new Map(animatedCells.map(c=>[c.index,c]));
  return restCells.map(rest=>{
    const neutral=reference.get(rest.index),current=animated.get(rest.index);if(!neutral||!current)return {...rest};
    const sx=current.w/Math.max(.0001,neutral.w),sy=current.h/Math.max(.0001,neutral.h);
    const dx=current.x+current.w/2-neutral.x-neutral.w/2,dy=current.y+current.h/2-neutral.y-neutral.h/2;
    const w=Math.min(bounds.w,Math.max(.1,rest.w*sx)),h=Math.min(bounds.h,Math.max(.1,rest.h*sy));
    return {...rest,x:clamp(rest.x+(rest.w-w)/2+dx,bounds.x,bounds.x+bounds.w-w),y:clamp(rest.y+(rest.h-h)/2+dy,bounds.y,bounds.y+bounds.h-h),w,h,response:current.response,craft:current.craft};
  });
}

/** A grabbed letter follows its saved offset. Nearby unedited rectangles yield
 * and compress inside the type area. No clock or browser state enters export. */
export function displaceLetters(cells,offsets,bounds){
  if(!offsets?.some(edited))return cells;
  const gap=Math.min(bounds.w,bounds.h)*.004;
  const originals=cells.map(c=>({...c}));
  const moved=cells.map(c=>{
    const edit=offsets[c.index];
    const w=Math.min(bounds.w,c.w*(edited(edit)?edit.w??1:1)),h=Math.min(bounds.h,c.h*(edited(edit)?edit.h??1:1));
    return {...c,w,h,x:clamp(c.x+(edited(edit)?edit.x||0:0)*bounds.w,bounds.x,bounds.x+bounds.w-w),y:clamp(c.y+(edited(edit)?edit.y||0:0)*bounds.h,bounds.y,bounds.y+bounds.h-h)};
  });
  const pinned=moved.map(c=>edited(offsets[c.index]));
  // Keep each pair's ordering and response axis tied to the authored rows.
  // Switching axes or push direction from a moving overlap caused jumps.
  const pairs=[];
  for(let i=0;i<originals.length;i++)for(let j=i+1;j<originals.length;j++){
    const a=originals[i],b=originals[j],axis=a.row===b.row?'x':'y',size=axis==='x'?'w':'h';
    const delta=b[axis]+b[size]/2-a[axis]-a[size]/2,sign=Math.sign(delta)||Math.sign(b.index-a.index)||1;
    const authoredGap=Math.max(0,Math.abs(delta)-(a[size]+b[size])/2);
    pairs.push({i,j,axis,sign,gap:Math.min(gap,authoredGap)});
  }
  function push(i,dx,dy){
    if(pinned[i])return;
    const c=moved[i],base=originals[i],wantedX=c.x+dx,wantedY=c.y+dy;
    c.x=clamp(wantedX,bounds.x,bounds.x+bounds.w-c.w);c.y=clamp(wantedY,bounds.y,bounds.y+bounds.h-c.h);
    const blockedX=Math.abs(c.x-wantedX),blockedY=Math.abs(c.y-wantedY);
    if(blockedX>.01){const old=c.w;c.w=Math.max(base.w*.58,c.w-blockedX*.65);if(dx<0)c.x+=old-c.w;}
    if(blockedY>.01){const old=c.h;c.h=Math.max(base.h*.65,c.h-blockedY*.65);if(dy<0)c.y+=old-c.h;}
    c.x=clamp(c.x,bounds.x,bounds.x+bounds.w-c.w);c.y=clamp(c.y,bounds.y,bounds.y+bounds.h-c.h);
  }
  for(let pass=0;pass<18;pass++){
    if(pass<12)for(let i=0;i<moved.length;i++)if(!pinned[i]){moved[i].x+=(originals[i].x-moved[i].x)*.025;moved[i].y+=(originals[i].y-moved[i].y)*.025;}
    for(const {i,j,axis,sign,gap:pairGap}of pairs){
      if(pinned[i]&&pinned[j])continue;
      const a=moved[i],b=moved[j],dx=(b.x+b.w/2)-(a.x+a.w/2),dy=(b.y+b.h/2)-(a.y+a.h/2);
      const cross=axis==='x'?(a.h+b.h)/2-Math.abs(dy):(a.w+b.w)/2-Math.abs(dx);
      const contact=clamp(cross/Math.max(.001,Math.min(axis==='x'?a.h:a.w,axis==='x'?b.h:b.w)*.15),0,1);
      const blend=contact*contact*(3-2*contact);
      const overlap=axis==='x'?(a.w+b.w)/2+pairGap-dx*sign:(a.h+b.h)/2+pairGap-dy*sign;
      const pressure=Math.max(0,overlap)*blend;if(pressure<=0)continue;
      const shareA=pinned[i]?0:pinned[j]?1:.5,shareB=pinned[j]?0:pinned[i]?1:.5;
      if(axis==='x'){push(i,-sign*pressure*shareA,0);push(j,sign*pressure*shareB,0);}
      else{push(i,0,-sign*pressure*shareA);push(j,0,sign*pressure*shareB);}
    }
  }
  return moved;
}

export function dragLetterOffset(base,visible,start,point,bounds,action='move'){
  const dx=point.x-start.x,dy=point.y-start.y;
  if(action==='reshape')return {
    x:(visible.x-base.x)/bounds.w,y:(visible.y-base.y)/bounds.h,
    w:clamp(visible.w/base.w*Math.exp(dx/Math.max(40,visible.w)*.9),.45,1.8),
    h:clamp(visible.h/base.h*Math.exp(dy/Math.max(40,visible.h)*.9),.45,1.8),
  };
  return {x:clamp((visible.x+dx-base.x)/bounds.w,-1,1),y:clamp((visible.y+dy-base.y)/bounds.h,-1,1),w:visible.w/base.w,h:visible.h/base.h};
}

/** Edge/corner handles reshape the grabbed letter without switching tools.
 * The opposite edges stay fixed while the neighbouring letters yield. */
export function resizeLetterOffset(base,visible,start,point,bounds,handle,{min=.45,max=1.8}={}){
  const dx=point.x-start.x,dy=point.y-start.y;
  let left=visible.x,right=visible.x+visible.w,top=visible.y,bottom=visible.y+visible.h;
  if(handle.includes('e'))right=clamp(right+dx,left+base.w*min,Math.min(bounds.x+bounds.w,left+base.w*max));
  if(handle.includes('w'))left=clamp(left+dx,Math.max(bounds.x,right-base.w*max),right-base.w*min);
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+base.h*min,Math.min(bounds.y+bounds.h,top+base.h*max));
  if(handle.includes('n'))top=clamp(top+dy,Math.max(bounds.y,bottom-base.h*max),bottom-base.h*min);
  return {x:(left-base.x)/bounds.w,y:(top-base.y)/bounds.h,w:(right-left)/base.w,h:(bottom-top)/base.h};
}

/** Invert the current motion and image response before saving an edit.
 * A zero-distance grab reproduces the exact rest pose instead of baking the
 * currently animated scale/translation into the next animation cycle.
 */
export function letterOffsetFromDisplay(base,rest,visible,start,point,bounds,handle=null,unreacted=visible){
  const sx=unreacted.w/Math.max(.0001,rest.w),sy=unreacted.h/Math.max(.0001,rest.h);
  const dx=unreacted.x+unreacted.w/2-rest.x-rest.w/2,dy=unreacted.y+unreacted.h/2-rest.y-rest.h/2;
  const imageX=visible.w/Math.max(.0001,unreacted.w),imageY=visible.h/Math.max(.0001,unreacted.h);
  const toMotion=rect=>({x:rect.x+rect.w/2+dx-rect.w*sx/2,y:rect.y+rect.h/2+dy-rect.h*sy/2,w:rect.w*sx,h:rect.h*sy});
  const motionBase=toMotion(base),displayBase={x:visible.x+(motionBase.x-unreacted.x)*imageX,y:visible.y+(motionBase.y-unreacted.y)*imageY,w:motionBase.w*imageX,h:motionBase.h*imageY};
  const limits={min:Math.min(.45,rest.w/base.w,rest.h/base.h),max:Math.max(1.8,rest.w/base.w,rest.h/base.h)};
  const edit=handle?resizeLetterOffset(displayBase,visible,start,point,bounds,handle,limits):dragLetterOffset(displayBase,visible,start,point,bounds,'move');
  const w=Math.min(bounds.w,displayBase.w*edit.w),h=Math.min(bounds.h,displayBase.h*edit.h);
  const x=clamp(displayBase.x+edit.x*bounds.w,bounds.x,bounds.x+bounds.w-w),y=clamp(displayBase.y+edit.y*bounds.h,bounds.y,bounds.y+bounds.h-h);
  const motionW=w/imageX,motionH=h/imageY,motionX=unreacted.x+(x-visible.x)/imageX,motionY=unreacted.y+(y-visible.y)/imageY;
  const restW=motionW/sx,restH=motionH/sy,restX=motionX+motionW/2-dx-restW/2,restY=motionY+motionH/2-dy-restH/2;
  return {x:clamp((restX-base.x)/bounds.w,-1,1),y:clamp((restY-base.y)/bounds.h,-1,1),w:restW/base.w,h:restH/base.h,basis:'rest'};
}

export function hitLetter(cells,point){
  return [...cells].reverse().find(c=>point.x>=c.x&&point.x<=c.x+c.w&&point.y>=c.y&&point.y<=c.y+c.h)||null;
}
