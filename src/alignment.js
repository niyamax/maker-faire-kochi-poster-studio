const anchors=rect=>({x:[rect.x,rect.x+rect.w/2,rect.x+rect.w],y:[rect.y,rect.y+rect.h/2,rect.y+rect.h]});
const inside=(r,w,h)=>r.x>=-.001&&r.y>=-.001&&r.x+r.w<=w+.001&&r.y+r.h<=h+.001;

/** Pure geometry: guide UI never enters the saved scene or exported artwork. */
export function snapFooterRect(rect,{width,height,margin,other=null,tolerance=8,corner=null,origin=rect,minScale=0,maxScale=Infinity,allowOverflow=false}={}){
  const sources=anchors(rect),targets={x:[],y:[]};
  for(const [axis,extent]of [['x',width],['y',height]]){
    targets[axis].push({value:margin,index:0,label:axis==='x'?'Left margin':'Top margin',full:true},
      {value:extent/2,index:1,label:'Poster centre',full:true},
      {value:extent-margin,index:2,label:axis==='x'?'Right margin':'Bottom margin',full:true});
    if(other?.w>0&&other.h>0)for(const [index,value]of anchors(other)[axis].entries())targets[axis].push({value,index,label:index===1?'Centres aligned':axis==='x'?(index===0?'Left edges':'Right edges'):(index===0?'Top edges':'Bottom edges'),full:false});
  }
  const match=(axis,index)=>targets[axis].filter(t=>t.index===index).map(t=>({...t,axis,index,delta:t.value-sources[axis][index]})).filter(t=>Math.abs(t.delta)<=tolerance).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
  let result={...rect},chosen=[];
  if(!corner){
    for(const axis of ['x','y']){
      const candidates=[0,1,2].flatMap(index=>match(axis,index)).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      const best=candidates.find(t=>allowOverflow||inside({...result,[axis]:result[axis]+t.delta},width,height));
      if(best){result[axis]+=best.delta;chosen.push(best);}
    }
  }else{
    const sx=corner.includes('w')?-1:1,sy=corner.includes('n')?-1:1;
    const fixed={x:origin.x+(sx<0?origin.w:0),y:origin.y+(sy<0?origin.h:0)};
    const candidates=[...match('x',sx<0?0:2),...match('y',sy<0?0:2)].sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
    for(const target of candidates){
      const factor=target.axis==='x'?Math.abs(target.value-fixed.x)/origin.w:Math.abs(target.value-fixed.y)/origin.h;
      const w=origin.w*factor,h=origin.h*factor,box={x:fixed.x+(sx<0?-w:0),y:fixed.y+(sy<0?-h:0),w,h};
      const correctSide=target.axis==='x'?(target.value-fixed.x)*sx>0:(target.value-fixed.y)*sy>0;
      if(correctSide&&factor>=minScale&&factor<=maxScale&&inside(box,width,height)){result=box;chosen=[target];break;}
    }
  }
  // Include coincident targets, e.g. a margin shared by both footer items.
  const finalAnchors=anchors(result);
  if(chosen.length)for(const axis of ['x','y'])for(const target of targets[axis]){
    if(corner&&target.index!==(axis==='x'?(corner.includes('w')?0:2):(corner.includes('n')?0:2)))continue;
    if(Math.abs(finalAnchors[axis][target.index]-target.value)<.001&&!chosen.some(t=>t.axis===axis&&t.value===target.value))chosen.push({...target,axis});
  }
  const guides=chosen.map(t=>{
    const start=t.full?margin:Math.min(t.axis==='x'?result.y:result.x,t.axis==='x'?other.y:other.x);
    const end=t.full?(t.axis==='x'?height:width)-margin:Math.max(t.axis==='x'?result.y+result.h:result.x+result.w,t.axis==='x'?other.y+other.h:other.x+other.w);
    return {axis:t.axis,value:t.value,start,end,label:t.label};
  });
  return {rect:result,guides};
}
