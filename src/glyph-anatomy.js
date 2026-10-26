/** Shape limits stay uniform within a glyph. Never pinch individual samples:
 * connected joins and the original stroke character must remain intact. */
export function easeInkLimit(value,limit){
  if(!Number.isFinite(limit))return value;
  if(limit<=0)return 0;
  const shoulder=limit*.12,start=limit-shoulder;
  return value<=start?value:limit-shoulder*Math.exp(-(value-start)/shoulder);
}
export const minimumInkGap=(width,height)=>Math.min(width,height)*.08;

export function openGlyphRadius(char,width,height,requested,character=0,outline=0){
  const gap=minimumInkGap(width,height),ink=2*(1+character*.31)+character*.30;
  let limit=Infinity;
  if(char==='G'){
    // Reserve a useful horizontal bar, its rounded end, bowl curvature and
    // the lower counter. Air's skeleton is inset by .83 radius at each edge.
    limit=Math.min((.88*width-gap-Math.min(width,height)*.02-outline)/(ink+1.66*.88),(.40*height-gap-outline)/(ink+1.66*.40));
  }else if(char==='E'||char==='F')limit=(.50*height-gap-outline)/(ink+1.66*.50);
  else if(char==='C')limit=(.68*height-gap-outline)/(ink+1.66*.68);
  else if(COUNTERS[char]){
    const [x,y]=COUNTERS[char];
    limit=Math.min((x*width-gap-outline)/(ink+1.66*x),(y*height-gap-outline)/(ink+1.66*y));
  }
  return easeInkLimit(requested,limit);
}

const COUNTERS={A:[1,.59],B:[.94,.47],D:[1,1],O:[1,1],Q:[1,.94],P:[1,.51],R:[1,.49],'0':[1,1],'6':[1,.55],'8':[.90,.47],'9':[1,.55]};
export function glyphStrokeWidth(char,width,height,requested){
  const gap=minimumInkGap(width,height),span=char==='G'?[.88,.40]:char==='E'||char==='F'?[Infinity,.50]:char==='C'?[Infinity,.68]:COUNTERS[char];
  let limit=Math.min(width,height)*.70;
  if(span)for(const [size,fraction]of [[width,span[0]],[height,span[1]]])if(Number.isFinite(fraction))limit=Math.min(limit,(fraction*size-gap)/(1+fraction));
  return easeInkLimit(requested,limit);
}

export function gCrossbarTip(preferred,bowl,ink,gap,smoothing){
  const needed=bowl+ink+gap;
  return (preferred+needed+Math.hypot(preferred-needed,smoothing))/2;
}
