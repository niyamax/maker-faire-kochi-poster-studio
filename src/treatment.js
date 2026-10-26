import {layoutComposition,LAYOUT_IDS} from './composition.js';
import {glyphPath,glyphMetrics} from './flex-glyphs.js';
import {airGlyphPaths} from './air-glyphs.js';
import {fontGlyphGeometry,fontGlyphMetrics,FONT_IDS} from './font-library.js';
import {heroForRow,styleCell,paintLayers,STYLE_IDS} from './style-system.js';
import {continuousCompositionFrame,continuousLetterResponse} from './loop-motion.js';
import {craftTreatmentLayout,craftedLetterMatrix} from './letter-craft.js';
import {glyphStrokeWidth,easeInkLimit} from './glyph-anatomy.js';

export const TREATMENT_PROFILES=Object.freeze({
  air:{mode:'air',font:'original',style:'jostle',render:'solid',contrast:.62,spread:.035,pressure:.84,variation:0},
  flex:{mode:'flex',font:'original',style:'original',render:'line',contrast:.70,spread:.32,pressure:.24,variation:0},
  packed:{mode:'air',font:'bowlby',style:'jostle',render:'solid',contrast:.46,spread:.46,pressure:.84,variation:0},
});
export function treatmentSettings(id,values={}){
  const base=TREATMENT_PROFILES[id]||TREATMENT_PROFILES.air;
  const profile={...base,layout:'stack',strokeWidth:3};
  for(const [key,allowed]of [['font',FONT_IDS],['style',STYLE_IDS],['layout',LAYOUT_IDS],['render',['line','solid']]])if(allowed.includes(values?.[key]))profile[key]=values[key];
  for(const key of ['contrast','pressure','variation'])if(Number.isFinite(values?.[key]))profile[key]=Math.max(0,Math.min(1,values[key]));
  if(Number.isFinite(values?.strokeWidth))profile.strokeWidth=Math.max(.5,Math.min(32,values.strokeWidth));
  if(id==='packed')profile.spread=profile.contrast;
  return profile;
}
export function layoutTreatment(words,rect,id,phase=0,energy=1,settings={},curve='smooth'){
  const profile=treatmentSettings(id,settings);
  const rhythm=[[1.55,.62,.86,.52,1.26],[.68,1.60,.62,1.34,.8],[.88,1.46,.66,1.14,.8]];
  const coefficient=id==='packed'?.32:profile.mode==='flex'?.92:.35;
  const rowCount=Math.max(32,String(words).split('\n').length),colCount=Math.max(32,...String(words).split('\n').map(line=>line.length));
  const weights=Array.from({length:rowCount},(_,row)=>Array.from({length:colCount},(_,col)=>1+(rhythm[row%3][col%5]-1)*profile.contrast*coefficient));
  const metrics=char=>profile.font==='original'?glyphMetrics(char):fontGlyphMetrics(profile.font,char)?.width;
  const options={width:rect.w,height:rect.h,mode:profile.mode,layout:profile.layout,spread:profile.spread,pressure:profile.pressure,variation:profile.variation,weights,metrics};
  const neutral=layoutComposition(words,options);
  if(profile.style!=='original')for(const row of neutral.rows){const hero=row.cells.find(c=>c.index===heroForRow(neutral.cells,row.index));if(hero){weights[row.index][hero.col]*=profile.style==='jostle'?1.28:1.38;for(const c of row.cells.filter(c=>Math.abs(c.col-hero.col)===1))weights[row.index][c.col]*=profile.style==='jostle'?.83:.88;}}
  for(const c of neutral.cells)weights[c.row][c.col]*=continuousLetterResponse(phase,c,energy,curve).width;
  const motion=continuousCompositionFrame(phase,energy,curve);
  const result=layoutComposition(words,{...options,spread:options.spread+motion.spreadOffset,pressure:options.pressure+motion.pressureOffset,rowWeights:motion.rowBias});
  for(const cell of result.cells){cell.x+=rect.x;cell.y+=rect.y;cell.focus=0;cell.response=continuousLetterResponse(phase,cell,energy,curve);}
  for(const row of result.rows){row.x+=rect.x;row.y+=rect.y;}
  return {...craftTreatmentLayout(result,profile,phase,energy,curve),unrefinedCells:result.cells,profile,motion,pressure:options.pressure+motion.pressureOffset};
}
function contain(cell,matrix,rect){
  const points=[[0,0],[cell.w,0],[cell.w,cell.h],[0,cell.h]].map(([x,y])=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]);
  const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
  const scale=Math.min(1,rect.w/(right-left||1),rect.h/(bottom-top||1));
  const cx=(left+right)/2,cy=(top+bottom)/2,l=cx+(left-cx)*scale,r=cx+(right-cx)*scale,t=cy+(top-cy)*scale,b=cy+(bottom-cy)*scale;
  const dx=l<rect.x?rect.x-l:r>rect.x+rect.w?rect.x+rect.w-r:0,dy=t<rect.y?rect.y-t:b>rect.y+rect.h?rect.y+rect.h-b:0;
  return [matrix[0]*scale,matrix[1]*scale,matrix[2]*scale,matrix[3]*scale,cx+(matrix[4]-cx)*scale+dx,cy+(matrix[5]-cy)*scale+dy];
}
export function appendTreatmentArtwork(scene,letters,colors,rect){
  const p=letters.profile;
  for(const cell of letters.cells){
    const info=styleCell(cell,{style:p.style,cells:letters.cells,focus:letters.motion.focus,gesture:letters.motion.gesture,width:scene.width,height:scene.height});
    info.matrix=cell.craft?craftedLetterMatrix(cell,p):contain(cell,info.matrix,rect);
    const short=Math.min(cell.w,cell.h);
    const airOutline=p.mode==='air'&&p.render==='line'?easeInkLimit(p.strokeWidth*2,short*.20):0;
    const inset=airOutline/2,w=Math.max(.001,cell.w-inset*2),h=Math.max(.001,cell.h-inset*2);
    let geometry;
    if(p.font!=='original')geometry=fontGlyphGeometry(p.font,cell.char,w,h,{mode:p.mode,pressure:letters.pressure,character:p.variation*(cell.craft&&!cell.craft.hero?.55:1)});
    if(!geometry&&p.mode==='air')geometry={paths:airGlyphPaths(cell.char,w,h,{pressure:letters.pressure,character:p.variation,phase:(cell.index*.173)%1,outlineWidth:airOutline}),weight:4.4};
    else if(!geometry){const weight=glyphStrokeWidth(cell.char,w,h,p.render==='line'?p.strokeWidth:1.6+letters.pressure**2*22),radius=Math.min(letters.height/Math.max(1,letters.rows.length)*.4,h*.55)*(.75+p.variation*.5);geometry={paths:[glyphPath(cell.char,w,h,{weight,inkWeight:weight,roundness:.98,radius})],weight,strokeOnly:true};}
    if(p.render==='line'&&!geometry.strokeOnly)geometry.weight=p.mode==='air'?airOutline:Math.min(short*.7,p.strokeWidth);
    if(inset){const m=info.matrix;info.matrix=[m[0],m[1],m[2],m[3],m[4]+(m[0]+m[2])*inset,m[5]+(m[1]+m[3])*inset];}
    for(const layer of paintLayers(p.mode,p.render,info,{fg:colors.fg,bg:colors.bg,weight:geometry.weight,scale:1}))for(const d of geometry.paths){
      scene.ops.push({kind:'path',d,fill:geometry.strokeOnly?'none':layer.fill,matrix:info.matrix,...(layer.stroke!=='none'?{stroke:layer.stroke,width:layer.width}:{})});
    }
  }
}
