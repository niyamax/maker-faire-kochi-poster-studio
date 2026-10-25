const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const SAMPLES=48;

/** A small, portable top contour keeps the response independent of browser
 * timing. Empty columns stay transparent instead of becoming an obstacle. */
export function silhouetteFromPixels(pixels,width,height){
  const top=[];
  for(let i=0;i<SAMPLES;i++){
    let first=height;
    for(let x=Math.floor(i*width/SAMPLES);x<Math.ceil((i+1)*width/SAMPLES);x++)for(let y=0;y<first;y++)if(pixels[(y*width+x)*4+3]>32){first=y;break;}
    top.push(first===height?null:first/height);
  }
  return {top};
}

export function normalizeSilhouette(value){
  if(!Array.isArray(value?.top)||value.top.length!==SAMPLES||value.top.some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1)))return null;
  return {top:[...value.top]};
}

function contourPressure(frame,silhouette,bounds){
  const source=silhouette?.top||Array(SAMPLES).fill(0),gap=Math.min(bounds.w,bounds.h)*.018;
  const raw=source.map(top=>top===null?0:Math.max(0,bounds.y+bounds.h+gap-frame.y-top*frame.h));
  // A narrow feather removes pixel-sized steps as the object crosses a letter.
  const weights=[1,4,6,4,1];
  const values=raw.map((_,i)=>weights.reduce((total,weight,k)=>total+(raw[i+k-2]||0)*weight,0)/16);
  return x=>{
    const u=(x-frame.x)/frame.w*SAMPLES-.5,index=Math.floor(u),t=smooth(u-index);
    const a=values[index]||0,b=values[index+1]||0;
    return a+(b-a)*t;
  };
}

/** Compress a continuous vertical field above the object. Squared distance
 * leaves the top of the title quiet and carries the pressure through the rows.
 * Saved offsets remain untouched; moving or removing the object is reversible. */
export function reactTypeToCutout(cells,frame,silhouette,bounds){
  const pressureAt=contourPressure(frame,silhouette,bounds),result=[];
  const rows=new Map();
  for(const cell of cells){if(!rows.has(cell.row))rows.set(cell.row,[]);rows.get(cell.row).push(cell);}
  for(const group of rows.values()){
    const warped=group.map(cell=>{
      const samples=Array.from({length:9},(_,i)=>pressureAt(cell.x+cell.w*i/8));
      const coverage=samples.reduce((total,value)=>total+smooth(value/(bounds.h*.04)),0)/samples.length;
      const peak=(samples.reduce((total,value)=>total+value**8,0)/samples.length)**(1/8)*1.1;
      const pressure=Math.min(bounds.h*.33,peak*smooth(coverage/.32));
      const warp=y=>y-pressure*clamp((y-bounds.y)/bounds.h,0,1)**2;
      const y=warp(cell.y),bottom=warp(cell.y+cell.h),h=Math.max(cell.h*.55,bottom-y);
      const depth=clamp((cell.y+cell.h*.5-bounds.y)/bounds.h,0,1);
      const strength=clamp(pressure/bounds.h/.33*(.25+.75*depth*depth),0,1);
      const away=Math.sign(cell.x+cell.w*.5-frame.x-frame.w*.5);
      return {...cell,y,h,response:{...cell.response,angle:(cell.response?.angle||0)+away*.018*strength},objectResponse:{strength,pressure,dy:y-cell.y,scaleY:h/cell.h}};
    });
    // Adjacent letters trade a little width as the compressed form expands.
    // Equal and opposite transfers preserve the row's span and reading order.
    {
      const widths=group.map(cell=>cell.w);
      for(let i=0;i<group.length-1;i++){
        const transfer=(warped[i].objectResponse.strength-warped[i+1].objectResponse.strength)*Math.min(group[i].w,group[i+1].w)*.075;
        widths[i]+=transfer;widths[i+1]-=transfer;
      }
      let x=group[0].x;
      for(let i=0;i<warped.length;i++){
        warped[i].x=x;warped[i].w=widths[i];
        x+=widths[i]+(i<group.length-1?group[i+1].x-group[i].x-group[i].w:0);
      }
    }
    result.push(...warped);
  }
  // Wide letters can span a stronger part of the contour than a narrow letter
  // above them. Carry that pressure upward so neighbouring rows keep a seam.
  const rowIds=[...rows.keys()].sort((a,b)=>b-a),gap=Math.min(Math.min(bounds.w,bounds.h)*.006,bounds.h/(rows.size*20));
  for(let r=1;r<rowIds.length;r++){
    const lower=result.filter(cell=>cell.row===rowIds[r-1]);
    for(const cell of result.filter(item=>item.row===rowIds[r])){
      const neighbours=lower.map(next=>({cell:next,weight:smooth(Math.max(0,Math.min(next.x+next.w,cell.x+cell.w)-Math.max(next.x,cell.x))/(Math.min(next.w,cell.w)*.25))})).filter(next=>next.weight>0&&(next.cell.objectResponse.strength>0||cell.objectResponse.strength>0));
      if(!neighbours.length)continue;
      const bottom=cell.y+cell.h,limit=Math.min(...neighbours.map(next=>bottom+(next.cell.y-gap-bottom)*next.weight));
      if(cell.y+cell.h>limit){
        const original=rows.get(cell.row).find(item=>item.index===cell.index),minimum=original.h*.55;
        cell.y=Math.max(bounds.y,Math.min(cell.y,limit-minimum));cell.h=Math.max(.1,limit-cell.y);
        cell.objectResponse.strength=Math.max(cell.objectResponse.strength,...neighbours.map(next=>next.cell.objectResponse.strength*.65*next.weight));
        cell.objectResponse.dy=cell.y-original.y;cell.objectResponse.scaleY=cell.h/original.h;
      }
    }
  }
  return result.sort((a,b)=>a.index-b.index);
}
