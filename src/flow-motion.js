// A reproducible shuffle lets every letter take one quick, medium and slow pulse
// per loop. A different letter leads each pulse and one pulse stretches vertically.
export const FLOW_CURVE='flow';
export const FLOW_SECONDS=12;

const tempos=[
  {attack:[.30,.39],release:[.55,.72]},
  {attack:[.42,.54],release:[.66,.84]},
  {attack:[.57,.72],release:[.82,1.03]},
];
const strengthFor=energy=>Math.max(0,Math.min(1.5,Number.isFinite(energy)?energy:1));
const wrap=phase=>Number.isFinite(phase)?((phase%1)+1)%1:0;
const ease=value=>value**3*(10-15*value+6*value**2);

let cachedText,cachedSchedule;
function scheduleFor(text,letterCount){
  if(text===cachedText&&cachedSchedule?.length===letterCount)return cachedSchedule;
  let seed=2811635;
  for(const char of text)seed=(Math.imul(seed,31)+char.codePointAt(0))>>>0;
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  const between=([min,max])=>min+(max-min)*random();
  const events=[];
  for(let round=0;round<tempos.length;round++){
    const order=Array.from({length:letterCount},(_,index)=>index);
    for(let index=order.length-1;index>0;index--){
      const other=Math.floor(random()*(index+1));
      [order[index],order[other]]=[order[other],order[index]];
    }
    if(order.length>1&&order[0]===events.at(-1)?.letter)[order[0],order[1]]=[order[1],order[0]];
    for(const letter of order){
      const tempo=tempos[(letter+round)%tempos.length];
      events.push({
        letter,vertical:(letter*2+round+1)%3===0,
        attack:between(tempo.attack),release:between(tempo.release),
        intensity:between([.72,1.08]),spacing:between([.32,.57]),
      });
    }
  }
  const duration=events.reduce((total,event)=>total+event.spacing,0);
  const schedule=Array.from({length:letterCount},()=>[]);
  let peak=.16;
  for(const event of events){
    schedule[event.letter].push({...event,peak});
    peak+=FLOW_SECONDS*event.spacing/duration;
  }
  cachedText=text;
  cachedSchedule=schedule;
  return schedule;
}

function pressures(events,time){
  let sideways=0,vertical=0;
  for(const event of events){
    const offset=((time-event.peak+FLOW_SECONDS*1.5)%FLOW_SECONDS)-FLOW_SECONDS*.5;
    if(offset< -event.attack||offset>event.release)continue;
    const progress=offset<0?1+offset/event.attack:1-offset/event.release;
    const pulse=event.intensity*ease(progress);
    sideways+=event.vertical?.82*pulse:pulse;
    if(event.vertical)vertical+=pulse;
  }
  return {sideways,vertical};
}

function stretchRow(row,schedule,time,energy){
  const cells=row.cells;
  const pushes=cells.map(cell=>pressures(schedule[cell.index],time));
  const demand=pushes.map(pulse=>.33*Math.tanh(pulse.sideways*energy));
  const widths=cells.map(cell=>cell.w);

  // The same amount leaves one letter as enters the other, keeping row ends fixed.
  for(let left=0;left<cells.length;left++){
    for(let right=left+1;right<=Math.min(left+2,cells.length-1);right++){
      const weight=right-left===1?.61:.15;
      const transfer=(demand[left]-demand[right])*Math.min(cells[left].w,cells[right].w)*weight;
      widths[left]+=transfer;
      widths[right]-=transfer;
    }
  }
  const gaps=cells.slice(1).map((next,index)=>{
    const previous=cells[index];
    const gap=next.x-previous.x-previous.w;
    const total=demand[index]+demand[index+1];
    const give=gap*.24*(-Math.expm1(-2*total));
    widths[index]+=give*demand[index]/(total||1);
    widths[index+1]+=give*demand[index+1]/(total||1);
    return gap-give;
  });

  let x=cells[0].x;
  return cells.map((cell,index)=>{
    // Leave room within the authored row so tall pulses never collide with
    // the next row or leave the headline frame, even with tight leading.
    const anchor=[.85,.35,.72,.18,.60][(index+row.index*2)%5];
    const reserve=cell.h*.115*Math.min(1,energy);
    const unused=reserve*Math.exp(-2.4*pushes[index].vertical*energy);
    const next={...cell,x,y:cell.y+unused*anchor,w:widths[index],h:cell.h-unused,flowBase:{w:cell.w,h:cell.h}};
    x+=next.w+(gaps[index]??0);
    return next;
  });
}

/** Animate the stable layout, preserving the base glyph geometry for rendering. */
export function applyFlowMotion(layout,text,phase,energy){
  const strength=strengthFor(energy);
  if(!strength||!layout.cells.length)return layout;
  const schedule=scheduleFor(text,layout.cells.length);
  const time=wrap(phase)*FLOW_SECONDS;
  const rows=layout.rows.map(row=>row.cells.length?{...row,cells:stretchRow(row,schedule,time,strength)}:row);
  const cells=rows.flatMap(row=>row.cells);
  return {...layout,rows,cells,unrefinedCells:cells};
}
