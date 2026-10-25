const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const FOOTER_LIMITS={size:{min:40,max:250,step:.1},x:{min:-100,max:100,step:.1},y:{min:-100,max:100,step:.1}};

export function normalizeFooter(value){
  const footer=Object.fromEntries(['text','logo'].map(part=>[part,Object.fromEntries(Object.entries(FOOTER_LIMITS).map(([key,limit])=>{
    const n=value?.[part]?.[key];
    return [key,Number.isFinite(n)?clamp(n,limit.min,limit.max):key==='size'?100:0];
  }))]));
  footer.text.align=['left','center','right'].includes(value?.text?.align)?value.text.align:'left';
  return footer;
}

/** Scale about the composed footer anchor, then apply relative board offsets.
 * Uniform scaling preserves logo proportions and the text's font geometry. */
export function placeFooterItem(rect,settings,width,height,anchor={x:0,y:1}){
  const scale=Math.min(settings.size/100,rect.w>0?width/rect.w:Infinity,rect.h>0?height/rect.h:Infinity);
  const w=rect.w*scale,h=rect.h*scale;
  const x=clamp(rect.x+rect.w*anchor.x-w*anchor.x+width*settings.x/100,0,width-w);
  const y=clamp(rect.y+rect.h*anchor.y-h*anchor.y+height*settings.y/100,0,height-h);
  return {x,y,w,h,scale,dx:x-rect.x*scale,dy:y-rect.y*scale};
}

export function footerSettingsFromRect(base,box,width,height){
  const rect=base.rect,anchor=base.anchor;
  return {
    size:clamp(box.w/rect.w*100,FOOTER_LIMITS.size.min,FOOTER_LIMITS.size.max),
    x:(box.x-rect.x-rect.w*anchor.x+box.w*anchor.x)/width*100,
    y:(box.y-rect.y-rect.h*anchor.y+box.h*anchor.y)/height*100,
  };
}

/** Align the visible artwork to the poster's shared margins or centre.
 * Keep its size and the other axis intact, including oversized artwork. */
export function alignFooterRect(rect,width,height,margin,alignment){
  const targets={left:['x',margin],center:['x',(width-rect.w)/2],right:['x',width-margin-rect.w],top:['y',margin],middle:['y',(height-rect.h)/2],bottom:['y',height-margin-rect.h]};
  const target=targets[alignment];
  if(!target)return {...rect};
  const [axis,value]=target,limit=axis==='x'?width-rect.w:height-rect.h;
  return {...rect,[axis]:clamp(value,0,Math.max(0,limit))};
}

/** Map a canvas gesture back into the same settings used by the sidebar.
 * Work from the visible box so grabbing an item already clamped at an edge
 * starts exactly where it is drawn. Resize keeps the opposite corner fixed. */
export function dragFooterItem(base,visible,width,height,start,point,corner=null){
  const rect=base.rect,anchor=base.anchor;
  if(!(rect.w>0&&rect.h>0&&visible.w>0&&visible.h>0))return {size:100,x:0,y:0};
  const dx=point.x-start.x,dy=point.y-start.y;
  let w=visible.w,h=visible.h,x=visible.x,y=visible.y;
  if(corner){
    const sx=corner.includes('w')?-1:1,sy=corner.includes('n')?-1:1;
    const fixed={x:visible.x+(sx<0?w:0),y:visible.y+(sy<0?h:0)};
    const actualSize=w/rect.w*100;
    const maxScale=Math.min(FOOTER_LIMITS.size.max/actualSize,(sx>0?width-fixed.x:fixed.x)/w,(sy>0?height-fixed.y:fixed.y)/h);
    const factor=clamp(1+(dx*sx*w+dy*sy*h)/(w*w+h*h),FOOTER_LIMITS.size.min/actualSize,maxScale);
    w*=factor;h*=factor;x=fixed.x+(sx<0?-w:0);y=fixed.y+(sy<0?-h:0);
  }else{
    x=clamp(x+dx,0,width-w);y=clamp(y+dy,0,height-h);
  }
  return footerSettingsFromRect(base,{x,y,w,h},width,height);
}
