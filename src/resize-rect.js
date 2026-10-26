const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Shared handle geometry for containers and letters. Corners keep the
 * current ratio; a locked side does too. Opposite edges remain anchored. */
export function resizeRect(rect,start,point,bounds,handle,{locked=false,minW=1,minH=1,maxW=bounds.w,maxH=bounds.h}={}){
  const dx=point.x-start.x,dy=point.y-start.y;
  if(!dx&&!dy)return {...rect};
  const horizontal=/[ew]/.test(handle),vertical=/[ns]/.test(handle),corner=horizontal&&vertical;
  const sx=handle.includes('w')?-1:1,sy=handle.includes('n')?-1:1;
  const fixed={x:horizontal?rect.x+(sx<0?rect.w:0):rect.x+rect.w/2,y:vertical?rect.y+(sy<0?rect.h:0):rect.y+rect.h/2};
  const availableW=horizontal?(sx>0?bounds.x+bounds.w-fixed.x:fixed.x-bounds.x):2*Math.min(fixed.x-bounds.x,bounds.x+bounds.w-fixed.x);
  const availableH=vertical?(sy>0?bounds.y+bounds.h-fixed.y:fixed.y-bounds.y):2*Math.min(fixed.y-bounds.y,bounds.y+bounds.h-fixed.y);
  let w=rect.w,h=rect.h;
  if(corner||locked){
    const wanted=corner?1+(dx*sx*w+dy*sy*h)/(w*w+h*h):horizontal?1+dx*sx/w:1+dy*sy/h;
    const upper=Math.max(.0001,Math.min(maxW/w,maxH/h,availableW/w,availableH/h));
    const lower=Math.min(upper,Math.max(minW/w,minH/h));
    const scale=clamp(wanted,lower,upper);w*=scale;h*=scale;
  }else{
    if(horizontal){const upper=Math.min(maxW,availableW);w=clamp(w+dx*sx,Math.min(minW,upper),upper);}
    if(vertical){const upper=Math.min(maxH,availableH);h=clamp(h+dy*sy,Math.min(minH,upper),upper);}
  }
  return {x:horizontal?fixed.x+(sx<0?-w:0):fixed.x-w/2,y:vertical?fixed.y+(sy<0?-h:0):fixed.y-h/2,w,h};
}
