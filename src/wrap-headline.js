import {fontGlyphMetrics} from './font-library.js';

const cache=new Map();
const lineGap=.14;

function findLines(text,lanes,size,prefix,splitWords,fillLanes){
  const slots=lanes.flatMap((lane,index)=>Array.from({
    length:Math.floor((lane.h/size+lineGap)/(1+lineGap)),
  },()=>index)).slice(0,text.length);
  if(fillLanes&&new Set(slots).size!==lanes.length)return null;
  const nextLine=(start)=>{
    const newline=text.indexOf('\n',start);
    return newline<0?text.length:newline;
  };
  const memo=new Map();
  function fit(start,slot,laneUsed=false){
    if(start>=text.length)return !fillLanes||slots[slot-1]===lanes.length-1?[]:null;
    if(slot>=slots.length)return null;
    const key=(start*slots.length+slot)*2+Number(laneUsed);
    if(memo.has(key))return memo.get(key);
    const zone=slots[slot],capacity=lanes[zone].w/size,stop=nextLine(start);
    let result=null;
    let end=start+1;
    while(end<=stop&&prefix[end]-prefix[start]<=capacity)end++;
    for(end--;end>start;end--){
      if(end!==stop&&text[end]!==' '&&!splitWords)continue;
      const line=text.slice(start,end).trimEnd();
      if(!line.trim())continue;
      let next=end;
      if(end===stop)next++;
      while(text[next]===' ')next++;
      const rest=fit(next,slot+1,slots[slot+1]===zone);
      if(rest){result=[{line,zone},...rest];break;}
    }
    // All slots in a lane have the same width. If a word cannot start here,
    // jump straight to the next wider lane.
    if(!result&&(!fillLanes||laneUsed)){
      const next=slots.findIndex((lane,i)=>i>slot&&lane>zone);
      if(next>=0)result=fit(start,next);
    }
    memo.set(key,result);
    return result;
  }
  return fit(0,0);
}

// Balance a single word across bands by its glyph widths. This avoids
// leaving a lone final letter when earlier bands could give up some space.
function splitAcrossLanes(text,lanes,prefix){
  const minimum=text.length>=lanes.length*2?2:1;
  const totalWidth=lanes.reduce((sum,lane)=>sum+lane.w,0);
  const totalInk=prefix.at(-1);

  function distribute(minSize){
    const memo=new Map();
    function fit(start,zone){
      if(zone===lanes.length)return start===text.length?{size:Infinity,penalty:0,lines:[]}:null;
      const key=start*lanes.length+zone;
      if(memo.has(key))return memo.get(key);
      const lane=lanes[zone],last=text.length-minimum*(lanes.length-zone-1);
      if(lane.h<minSize)return null;
      let best=null;
      for(let end=start+minimum;end<=last;end++){
        const ink=prefix[end]-prefix[start],capacity=Math.min(lane.h,lane.w/ink);
        if(capacity<minSize)break;
        const rest=fit(end,zone+1);
        if(!rest)continue;
        const size=Math.min(capacity,rest.size);
        const penalty=rest.penalty+(ink/totalInk-lane.w/totalWidth)**2;
        const better=minSize?penalty<best?.penalty:size>best?.size;
        if(!best||better)best={size,penalty,lines:[{line:text.slice(start,end),zone},...rest.lines]};
      }
      memo.set(key,best);
      return best;
    }
    return fit(0,0);
  }

  const largest=distribute(0);
  return distribute(largest.size*.84)||largest;
}

export function wrapHeadline(raw,lanes,{font,contrast,layout,wrapMode}){
  const text=raw.split('\n').map(line=>line.trimEnd()).filter(line=>line.trim()).join('\n');
  if(!text)return [];
  const byLetter=wrapMode==='letters';
  const key=JSON.stringify([text,lanes,font,contrast,layout,wrapMode]);
  if(cache.has(key))return cache.get(key);
  const prefix=[0];
  for(const char of text){
    const metric=fontGlyphMetrics(font,char);
    prefix.push(prefix.at(-1)+(char===' '?.34:char==='\n'?0:(metric?.width??.7)+.06));
  }
  const maxHeight=Math.max(...lanes.map(lane=>lane.h));
  function largestFit(fillLanes){
    let min=.1,max=maxHeight,lines=[];
    for(let step=0;step<14;step++){
      const size=(min+max)/2;
      const wrapped=findLines(text,lanes,size,prefix,byLetter||size<maxHeight*.35,fillLanes);
      if(wrapped){min=size;lines=wrapped;}else max=size;
    }
    return {size:min,lines};
  }
  const natural=largestFit(false);
  const segments=byLetter?text.replace(/\s/g,'').length:text.split(/\s+/).filter(Boolean).length;
  const singleWord=byLetter&&!/\s/.test(text)&&text.length>=lanes.length;
  const acrossShape=singleWord?splitAcrossLanes(text,lanes,prefix):segments>=lanes.length?largestFit(true):null;
  const {size,lines:result}=acrossShape?.lines.length&&(byLetter||acrossShape.size>=natural.size*.77)?acrossShape:natural;

  const rows=[];
  for(const [zone,lane] of lanes.entries()){
    const lines=result.filter(line=>line.zone===zone);
    const blockHeight=size*(lines.length+(lines.length-1)*lineGap);
    for(const [index,{line}] of lines.entries()){
      const naturalWidth=[...line].reduce((total,char)=>total+(char===' '?.34:(fontGlyphMetrics(font,char)?.width??.7)+.06),0)*size;
      const width=Math.min(lane.w,naturalWidth*(1.04+contrast*.1));
      const align=layout==='centered'?.5:layout==='offset'&&rows.length%2?1:0;
      rows.push({
        line,zone,x:lane.x+(lane.w-width)*align,y:lane.y+(lane.h-blockHeight)*.5+index*size*(1+lineGap),w:width,h:size,
      });
    }
  }
  if(cache.size>=24)cache.delete(cache.keys().next().value);
  cache.set(key,rows);
  return rows;
}
