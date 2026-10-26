import {fontGlyphMetrics,fontOpticalProfile} from './font-library.js';
import {heroForRow} from './style-system.js';
import {connectedRowResponses} from './loop-motion.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const sum=values=>values.reduce((a,b)=>a+b,0);
const MATERIALS={original:[1.35,1,1],bowlby:[1.25,.9,.75],bricolage:[1,.85,.7],dela:[.85,.8,.6],anton:[.85,.75,.5],geist:[.7,.72,.45],inter:[.65,.68,.4]};

/** Perceptual gap: diagonal openings can tuck in, round edges come closer,
 * and two straight stems keep breathing space. Bounds include a safety floor. */
export function opticalPairGap(font,left,right,nominal){
  const a=fontOpticalProfile(font,left.char),b=fontOpticalProfile(font,right.char);
  const clearance=a.right.map((value,i)=>value*left.w+b.left[i]*right.w);
  const mean=sum(clearance)/clearance.length,min=Math.min(...clearance);
  const correction=Math.min(nominal*.9,mean*.22);
  return Math.max(nominal*.45-min*.18,nominal-correction);
}

/** The hero borrows actual width from its two nearest neighbours on each
 * side. Total row width is conserved; no global zoom or long-range shuffle. */
export function shareHeroWidth(widths,hero,strain){
  if(widths.length<2||!strain)return [...widths];
  const result=[...widths],neighbours=widths.map((width,index)=>({index,width,distance:Math.abs(index-hero)})).filter(n=>n.distance>0&&n.distance<=2);
  const capacity=sum(neighbours.map(n=>n.width*.23));
  const delta=clamp(widths[hero]*strain,-widths[hero]*.24,capacity);
  const weights=neighbours.map(n=>n.width/(n.distance*n.distance));
  let remaining=delta,active=neighbours.map((_,i)=>i);
  for(let pass=0;pass<3&&active.length&&Math.abs(remaining)>1e-9;pass++){
    const total=sum(active.map(i=>weights[i])),next=[];let paid=0;
    for(const i of active){
      const n=neighbours[i],wanted=remaining*weights[i]/total;
      const available=result[n.index]-widths[n.index]*.77;
      const transfer=wanted>0?Math.min(wanted,available):wanted;
      result[n.index]-=transfer;paid+=transfer;
      if(wanted<=available+1e-9)next.push(i);
    }
    remaining-=paid;active=next;
  }
  result[hero]+=delta-remaining;
  return result;
}

function spaceSlots(text,count){
  const slots=Array(count+1).fill(0);let before=0;
  for(const char of text){if(char===' ')slots[before]++;else before++;}
  return slots;
}

/** Refine inside the selected row arrangement. The caller retains original
 * base cells for saved drags, so a manually placed letter never changes anchor. */
export function craftTreatmentLayout(layout,profile,phase,energy,curve){
  const [exaggeration,motion,tilt]=MATERIALS[profile.font]||MATERIALS.original;
  const cells=[],rows=[];
  for(const row of layout.rows){
    const group=row.cells;if(!group.length){rows.push({...row,cells:[]});continue;}
    const hero=Math.max(0,group.findIndex(c=>c.index===heroForRow(group,row.index)));
    const scores=group.map((cell,index)=>{
      const metric=fontGlyphMetrics(profile.font,cell.char)?.width||1;
      const emphasis=index===hero&&group.length>1?1+profile.contrast*exaggeration:1;
      return metric*emphasis;
    });
    const spaces=spaceSlots(row.text,group.length),spaceCount=sum(spaces);
    const spaceWeight=(fontGlyphMetrics(profile.font,' ')?.advance||.36)*(profile.mode==='air'?.7:1.2);
    const nominal=Math.min(row.h*.032,Math.min(layout.width,layout.height)*(profile.mode==='flex'?.009:.007));
    let widths=scores.map(value=>row.w*value/sum(scores)),gaps=[],leading=0;
    for(let pass=0;pass<2;pass++){
      gaps=group.slice(0,-1).map((cell,index)=>spaces[index+1]?nominal:opticalPairGap(profile.font,{...cell,w:widths[index]},{...group[index+1],w:widths[index+1]},nominal));
      // Keep long headlines readable even on unusually small artboards.
      const scale=Math.min(1,row.w*.16/(sum(gaps)||1));gaps=gaps.map(gap=>gap*scale);
      const advance=(row.w-sum(gaps))/(sum(scores)+spaceCount*spaceWeight);
      widths=scores.map(value=>advance*value);
      leading=spaces[0]*spaceWeight*advance;
      gaps=gaps.map((gap,index)=>gap+spaces[index+1]*spaceWeight*advance);
    }
    const responses=connectedRowResponses(phase,group,hero,energy,curve,motion);
    widths=shareHeroWidth(widths,hero,responses[hero].width-1);
    const refined=[];let x=row.x+leading;
    for(let index=0;index<group.length;index++){
      const original=group[index],response=responses[index],isHero=index===hero;
      // Squash has a smooth maximum at the resting pose. Clipping a sinusoid
      // at the row edge would introduce a visible velocity kink at the seam.
      const h=row.h*(1-12*(response.height-1)**2),y=row.y+(row.h-h)*.5;
      const cell={...original,x,y,w:widths[index],h,response,craft:{hero:isHero,tilt,emphasis:isHero?1:.35}};
      refined.push(cell);cells.push(cell);x+=cell.w+(gaps[index]||0);
    }
    rows.push({...row,cells:refined});
  }
  return {...layout,cells,rows};
}

/** Rotation stays inside its own letter box, protecting the tuned gaps. */
export function craftedLetterMatrix(cell,profile){
  const direction=(cell.row%2?-1:1),accent=cell.craft.hero?1:.22;
  const resting=profile.style==='jostle'?direction*accent*(.035+profile.variation*.025)*cell.craft.tilt:0;
  const angle=resting+(cell.response?.angle||0),c=Math.cos(angle),s=Math.sin(angle);
  const rotatedW=Math.abs(c)*cell.w+Math.abs(s)*cell.h,rotatedH=Math.abs(s)*cell.w+Math.abs(c)*cell.h;
  const scale=Math.min(1,cell.w/rotatedW,cell.h/rotatedH);
  return [c*scale,s*scale,-s*scale,c*scale,cell.x+cell.w/2-scale*(c*cell.w/2-s*cell.h/2),cell.y+cell.h/2-scale*(s*cell.w/2+c*cell.h/2)];
}
