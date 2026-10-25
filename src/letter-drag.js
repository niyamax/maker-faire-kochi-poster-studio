import {HEADLINE_MAX_LENGTH} from './content-limits.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
export function normalizeLetterOffsets(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>HEADLINE_MAX_LENGTH)throw Error('Invalid letter positions.');
  return value.map(entry=>{
    if(entry==null)return null;
    if(typeof entry!=='object'||['x','y','w','h'].some(key=>entry[key]!==undefined&&!Number.isFinite(entry[key])))throw Error('Invalid letter position.');
    return {x:clamp(finite(entry.x),-1,1),y:clamp(finite(entry.y),-1,1),w:clamp(finite(entry.w,1),.45,1.8),h:clamp(finite(entry.h,1),.45,1.8)};
  });
}
const edited=entry=>entry&&(Math.abs(entry.x||0)+Math.abs(entry.y||0)+Math.abs((entry.w??1)-1)+Math.abs((entry.h??1)-1)>1e-8);

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
    for(let i=0;i<moved.length;i++)for(let j=i+1;j<moved.length;j++){
      if(pinned[i]&&pinned[j])continue;
      const a=moved[i],b=moved[j],dx=(b.x+b.w/2)-(a.x+a.w/2),dy=(b.y+b.h/2)-(a.y+a.h/2);
      const ox=(a.w+b.w)/2+gap-Math.abs(dx),oy=(a.h+b.h)/2+gap-Math.abs(dy);
      if(ox<=0||oy<=0)continue;
      const shareA=pinned[i]?0:pinned[j]?1:.5,shareB=pinned[j]?0:pinned[i]?1:.5;
      if(ox<oy){const sign=Math.sign(dx)||Math.sign(originals[j].x-originals[i].x)||1;push(i,-sign*ox*shareA,0);push(j,sign*ox*shareB,0);}
      else{const sign=Math.sign(dy)||Math.sign(originals[j].y-originals[i].y)||1;push(i,0,-sign*oy*shareA);push(j,0,sign*oy*shareB);}
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
export function resizeLetterOffset(base,visible,start,point,bounds,handle){
  const dx=point.x-start.x,dy=point.y-start.y;
  let left=visible.x,right=visible.x+visible.w,top=visible.y,bottom=visible.y+visible.h;
  if(handle.includes('e'))right=clamp(right+dx,left+base.w*.45,Math.min(bounds.x+bounds.w,left+base.w*1.8));
  if(handle.includes('w'))left=clamp(left+dx,Math.max(bounds.x,right-base.w*1.8),right-base.w*.45);
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+base.h*.45,Math.min(bounds.y+bounds.h,top+base.h*1.8));
  if(handle.includes('n'))top=clamp(top+dy,Math.max(bounds.y,bottom-base.h*1.8),bottom-base.h*.45);
  return {x:(left-base.x)/bounds.w,y:(top-base.y)/bounds.h,w:(right-left)/base.w,h:(bottom-top)/base.h};
}

export function hitLetter(cells,point){
  return [...cells].reverse().find(c=>point.x>=c.x&&point.x<=c.x+c.w&&point.y>=c.y&&point.y<=c.y+c.h)||null;
}
