import {connectedRowResponses} from './loop-motion.js';

/** Beam Sans is an exploratory constructed display alphabet. Each letter is a
 * graph of straight members. Outlines are regenerated at the requested size;
 * member thickness and the joint profile do not stretch with the letter. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f)=>Number.isFinite(Number(n))?Number(n):f;
const f=n=>String(Math.round(n*1000)/1000);
const polygon=points=>'M'+points.map(([x,y])=>`${f(x)} ${f(y)}`).join('L')+'Z';
const loop=(x0=0,y0=0,x1=1,y1=1,c=.18)=>[[x0+c*(x1-x0),y0],[x1-c*(x1-x0),y0],[x1,y0+c*(y1-y0)],[x1,y1-c*(y1-y0)],[x1-c*(x1-x0),y1],[x0+c*(x1-x0),y1],[x0,y1-c*(y1-y0)],[x0,y0+c*(y1-y0)],[x0+c*(x1-x0),y0]];
const C=[[1,.14],[.84,0],[.18,0],[0,.18],[0,.82],[.18,1],[.84,1],[1,.86]];
const S=[[1,.12],[.86,0],[.18,0],[0,.16],[0,.36],[.18,.5],[.82,.5],[1,.66],[1,.84],[.82,1],[.14,1],[0,.88]];
const BOWL=[[0,0],[.78,0],[1,.16],[1,.36],[.78,.52],[0,.52]];
const GLYPHS={
 A:[[[0,1],[.5,0],[1,1]],[[.21,.59],[.79,.59]]],
 B:[[[0,1],[0,0]],[[0,0],[.76,0],[1,.14],[1,.36],[.76,.49],[0,.49]],[[0,.49],[.8,.49],[1,.64],[1,.85],[.8,1],[0,1]]],
 C:[C],D:[[[0,1],[0,0],[.72,0],[1,.2],[1,.8],[.72,1],[0,1]]],
 E:[[[1,0],[0,0],[0,1],[1,1]],[[0,.49],[.79,.49]]],F:[[[0,1],[0,0],[1,0]],[[0,.49],[.79,.49]]],
 G:[C,[[1,.86],[1,.56],[.57,.56]]],H:[[[0,0],[0,1]],[[1,0],[1,1]],[[0,.5],[1,.5]]],
 I:[[[.5,0],[.5,1]]],J:[[[.24,0],[1,0],[1,.82],[.82,1],[.2,1],[0,.8]]],
 K:[[[0,0],[0,1]],[[1,0],[0,.54],[1,1]]],L:[[[0,0],[0,1],[1,1]]],
 M:[[[0,1],[0,0],[.5,.48],[1,0],[1,1]]],N:[[[0,1],[0,0],[1,1],[1,0]]],O:[loop()],
 P:[[[0,1],[0,0]],BOWL],Q:[loop(0,0,1,.94),[[.57,.65],[1,1]]],
 R:[[[0,1],[0,0]],BOWL,[[.48,.52],[1,1]]],S:[S],
 T:[[[0,0],[1,0]],[[.5,0],[.5,1]]],U:[[[0,0],[0,.82],[.18,1],[.82,1],[1,.82],[1,0]]],
 V:[[[0,0],[.5,1],[1,0]]],W:[[[0,0],[.22,1],[.5,.48],[.78,1],[1,0]]],
 X:[[[0,0],[1,1]],[[1,0],[0,1]]],Y:[[[0,0],[.5,.49],[1,0]],[[.5,.49],[.5,1]]],Z:[[[0,0],[1,0],[0,1],[1,1]]],
 '0':[loop(),[[.24,.82],[.76,.18]]],
 '1':[[[0,.2],[.46,0],[.46,1]],[[0,1],[1,1]]],
 '2':[[[0,.16],[.18,0],[.81,0],[1,.17],[1,.35],[0,1],[1,1]]],
 '3':[[[0,0],[.78,0],[1,.17],[1,.35],[.74,.5],[.24,.5]],[[.74,.5],[1,.66],[1,.84],[.79,1],[0,1]]],
 '4':[[[.74,0],[0,.65],[1,.65]],[[.74,0],[.74,1]]],
 '5':[[[1,0],[0,0],[0,.49],[.8,.49],[1,.66],[1,.84],[.82,1],[.12,1],[0,.88]]],
 '6':[loop(0,.46,1,1),[[0,.73],[0,.18],[.18,0],[.87,0]]],
 '7':[[[0,0],[1,0],[.22,1]]],
 '8':[loop(.04,0,.96,.5,.22),loop(0,.5,1,1,.22)],
 '9':[loop(0,0,1,.54),[[1,.28],[1,.82],[.82,1],[.12,1]]],
 '-':[[[0,.5],[1,.5]]],'+':[[[0,.5],[1,.5]],[[.5,.16],[.5,.84]]],
 '/':[[[0,1],[1,0]]],'.':[[[.5,.97],[.501,.97]]],',':[[[.66,.86],[.37,1]]],
 ':':[[[.5,.3],[.501,.3]],[[.5,.79],[.501,.79]]],
 '!':[[[.5,0],[.5,.66]],[[.5,.97],[.501,.97]]],
 '?':[[[0,.14],[.18,0],[.78,0],[1,.18],[1,.34],[.5,.61],[.5,.7]],[[.5,.97],[.501,.97]]],
 '&':[[[1,.39],[.19,1],[0,.8],[0,.64],[.75,.2],[.75,.07],[.61,0],[.28,0],[.12,.14],[.12,.3],[1,1]]],
 '(':[[[1,0],[.32,.17],[0,.4],[0,.6],[.32,.83],[1,1]]],
 ')':[[[0,0],[.68,.17],[1,.4],[1,.6],[.68,.83],[0,1]]],
 '#':[[[.32,0],[.18,1]],[[.82,0],[.68,1]],[[0,.34],[1,.34]],[[0,.68],[1,.68]]],
 "'":[[[.5,0],[.5,.2]]],
};
const RATIOS={M:1.05,W:1.12,I:.24,J:.64,L:.64,E:.7,F:.68,T:.78,'1':.5,'.':.22,',':.25,':':.24,'!':.25,'-':.56,'+':.64,'/':.53,'(': .33,')':.33,"'":.22};
export const BEAM_GLYPHS=Object.freeze(Object.keys(GLYPHS));
export const beamGlyphMetrics=char=>char===' '?.36:RATIOS[String(char).toUpperCase()]??.82;
export function cleanBeamText(value){return String(value??'').toUpperCase().replace(/\r\n?/g,'\n').split('\n').slice(0,4).map(line=>[...line].filter(c=>c===' '||GLYPHS[c]).slice(0,26).join('')).join('\n').slice(0,104);}

function members(points,thickness,chamfer){
 const r=thickness/2,paths=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<.00001)continue;
  const nx=-dy/length*r,ny=dx/length*r;
  paths.push(polygon([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]));
 }
 // Chamfered plates make a physical, shared joint at every beam intersection.
 const trim=r*(.08+.68*chamfer),s=r-trim;
 for(const [x,y]of points)paths.push(polygon([[x-s,y-r],[x+s,y-r],[x+r,y-s],[x+r,y+s],[x+s,y+r],[x-s,y+r],[x-r,y+s],[x-r,y-s]]));
 return paths;
}
function portOnSegments(segments,target){
 let best=null,score=Infinity;
 for(const [a,b]of segments){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?clamp(((target[0]-a[0])*dx+(target[1]-a[1])*dy)/len,0,1):0;
  const point=[a[0]+dx*t,a[1]+dy*t],distance=(point[0]-target[0])**2*4+(point[1]-target[1])**2;
  if(distance<score){score=distance;best=point;}
 }
 return best||target;
}
export function beamGlyphGeometry(character,width,height,{weight=.55,joint=.55}={}){
 const w=finite(width,0),h=finite(height,0),char=String(character??'').toUpperCase(),graph=GLYPHS[char];
 if(!(w>0&&h>0)||!graph)return{paths:[],nodes:[],segments:[],thickness:0,ports:null};
 const amount=clamp(finite(weight,.55),0,1),chamfer=clamp(finite(joint,.55),0,1);
 const narrowMember='I!.,:\''.includes(char);
 const thickness=Math.max(.001,Math.min(h*(.045+.115*amount),w*(narrowMember?.9:.23),h*.19));
 const inset=thickness/2+.002,cw=Math.max(.001,w-inset*2),ch=Math.max(.001,h-inset*2);
 const paths=[],nodes=[],segments=[];
 for(const stroke of graph){
  const points=stroke.map(([x,y])=>[inset+x*cw,inset+y*ch]);
  nodes.push(...points);for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);
  paths.push(...members(points,thickness,chamfer));
 }
 return{paths,nodes,segments,thickness,ports:{left:portOnSegments(segments,[inset,h*.5]),right:portOnSegments(segments,[w-inset,h*.5])}};
}

export const BEAM_PALETTES=Object.freeze({
 red:{name:'Maker red',background:'#ED1C24',ink:'#FFFFFF',accent:'#00AEEF'},
 white:{name:'Maker white',background:'#FFFFFF',ink:'#ED1C24',accent:'#00AEEF'},
 cyan:{name:'Maker cyan',background:'#00AEEF',ink:'#172C35',accent:'#FFFFFF'},
});
function responsiveWidths(base,hero,strain){
 if(base.length<2)return base;
 const result=[...base],near=base.map((width,index)=>({width,index,distance:Math.abs(index-hero)})).filter(n=>n.distance>0&&n.distance<=2);
 const capacity=near.reduce((sum,n)=>sum+n.width*.22,0),delta=clamp(base[hero]*strain,-base[hero]*.2,capacity);
 const total=near.reduce((sum,n)=>sum+n.width/n.distance,0);
 result[hero]+=delta;
 for(const n of near)result[n.index]-=delta*(n.width/n.distance)/total;
 return result;
}

export function createBeamScene({text='MAKER\nFAIRE\nKOCHI',weight=.55,width=.85,joint=.55,contrast=.4,phase=0,energy=1,connected=false,palette='red',hero=0}={}){
 const board={width:1080,height:1350},colours=BEAM_PALETTES[palette]||BEAM_PALETTES.red;
 const cleaned=cleanBeamText(text),lines=cleaned.split('\n').filter(line=>line.trim()).slice(0,4);
 const scene={...board,background:colours.background,ink:colours.ink,accent:colours.accent,cells:[],paths:[],connectors:[],text:cleaned};
 if(!lines.length)return scene;
 const margin=76,rowGap=35,totalH=board.height-margin*2,cap=(totalH-rowGap*(lines.length-1))/lines.length;
 const rowWidth=(board.width-margin*2)*(.62+.38*clamp(finite(width,.85),0,1));
 const amount=clamp(finite(contrast,.4),0,1),level=clamp(finite(energy,1),0,1.5),t=((finite(phase,0)%1)+1)%1;
 lines.forEach((line,row)=>{
  const chars=[...line],visible=chars.filter(c=>c!==' '),focus=clamp(Math.round(finite(hero,0)),0,Math.max(0,visible.length-1));
  const gap=Math.min(18,rowWidth/Math.max(12,visible.length*8));
  const metrics=chars.map(c=>beamGlyphMetrics(c));
  let vi=0;for(let i=0;i<chars.length;i++)if(chars[i]!==' '){if(vi===focus)metrics[i]*=1+amount*.72;vi++;}
  const usable=rowWidth-gap*Math.max(0,visible.length-1),metricTotal=metrics.reduce((a,b)=>a+b,0),unit=usable/metricTotal;
  const fullWidths=metrics.map(n=>n*unit),base=fullWidths.filter((_,i)=>chars[i]!==' ');
  const responses=connectedRowResponses(t,visible.map((char,col)=>({char,row,col})),focus,level,'smooth',.9);
  const widths=responsiveWidths(base,focus,responses[focus]?.width-1||0);
  const rowCells=[];let x=(board.width-rowWidth)/2,index=0;
  const y=margin+row*(cap+rowGap);
  for(let slot=0;slot<chars.length;slot++){
   const char=chars[slot];if(char===' '){x+=fullWidths[slot];continue;}
   const response=responses[index],h=cap*(1-7*(response.height-1)**2),cy=y+(cap-h)/2,w=widths[index];
   const geometry=beamGlyphGeometry(char,w,h,{weight,joint});
   const cell={char,row,col:index,index:scene.cells.length,x,y:cy,w,h,geometry,wordBreakBefore:slot>0&&chars[slot-1]===' '};
   scene.cells.push(cell);rowCells.push(cell);
   for(const d of geometry.paths)scene.paths.push({d,x,y:cy});
   x+=w+gap;index++;
  }
  if(connected)for(let i=1;i<rowCells.length;i++){
   const a=rowCells[i-1],b=rowCells[i];if(b.wordBreakBefore||!a.geometry.ports||!b.geometry.ports)continue;
   const p=a.geometry.ports.right.map((n,i)=>n+(i?a.y:a.x)),q=b.geometry.ports.left.map((n,i)=>n+(i?b.y:b.x));
   const middle=(a.x+a.w+b.x)/2,beam=Math.min(a.geometry.thickness,b.geometry.thickness)*.44;
   const paths=members([p,[middle,p[1]],[middle,q[1]],q],beam,clamp(finite(joint,.55),0,1));
   scene.connectors.push(...paths.map(d=>({d,x:0,y:0})));
  }
 });
 return scene;
}
export function drawBeamScene(context,scene,{guides=false}={}){
 context.save();context.fillStyle=scene.background;context.fillRect(0,0,scene.width,scene.height);
 if(guides){context.save();context.strokeStyle=scene.accent;context.globalAlpha=.4;context.lineWidth=1;for(const cell of scene.cells)context.strokeRect(cell.x,cell.y,cell.w,cell.h);context.restore();}
 context.fillStyle=scene.ink;
 for(const path of [...scene.connectors,...scene.paths]){context.save();context.translate(path.x,path.y);context.fill(new Path2D(path.d));context.restore();}
 context.restore();
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function beamSVG(scene){
 const paths=[...scene.connectors,...scene.paths].map(({d,x,y})=>`<path d="${d}"${x||y?` transform="translate(${f(x)} ${f(y)})"`:''}/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>Beam Sans — ${escape(scene.text.replace(/\n/g,' '))}</title><desc>Exploratory procedural straight-beam lettering with chamfered structural joints.</desc><rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/><g fill="${scene.ink}">${paths}</g></svg>`;
}
