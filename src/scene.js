import {COPY_FONT} from './data/copy-outlines.js';
import {LOGO_DATA} from './data/logo.js';
import {layoutTreatment,appendTreatmentArtwork} from './treatment.js';
import {displaceLetters} from './letter-drag.js';
import {normalizeFooter,placeFooterItem} from './footer-layout.js';

export const PALETTES=Object.freeze([
  {id:'maker',name:'Maker Faire',bg:'#FFFFFF',fg:'#ED1C24',accent:'#00AEEF',ink:'#172C35'},
  {id:'maker-red',name:'Maker / Red field',bg:'#ED1C24',fg:'#FFFFFF',accent:'#00AEEF',ink:'#FFFFFF'},
  {id:'maker-cyan',name:'Maker / Cyan field',bg:'#00AEEF',fg:'#FFFFFF',accent:'#ED1C24',ink:'#172C35'},
  {id:'noise',name:'Make Some Noise',bg:'#FFE86C',fg:'#2B19D9',accent:'#2B19D9',ink:'#2B19D9'},
]);
export const TREATMENTS=Object.freeze([
  {id:'air',name:'Air',description:'Inflated letters that share space.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
  {id:'flex',name:'Flex',description:'Open strokes and elastic proportions.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
  {id:'packed',name:'Packed',description:'Dense, playful poster lettering.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
]);
export const FORMATS={poster:{name:'Poster · 4:5',w:1080,h:1350},story:{name:'Story · 9:16',w:1080,h:1920},square:{name:'Square · 1:1',w:1080,h:1080},banner:{name:'Banner · 16:9',w:1920,h:1080}};
const n=v=>Number(v.toFixed(3));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function cleanHeadline(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9 &!?\n.-]/g,'').split('\n').slice(0,4).map(row=>row.slice(0,14)).join('\n').slice(0,52);}
export function cleanDetail(value){return [...String(value??'')].filter(char=>char==='\n'||COPY_FONT.glyphs[char]).join('').split('\n').slice(0,2).map(line=>line.slice(0,80)).join('\n').slice(0,160);}
function addText(scene,text,x,y,size,color,maxWidth=Infinity){
  const advance=char=>(COPY_FONT.glyphs[char]?.advance||COPY_FONT.em*.3)*size/COPY_FONT.em;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [row,line] of String(text).split('\n').entries()){
    const lineWidth=[...line].reduce((total,char)=>total+advance(char),0),scale=Math.min(1,maxWidth/Math.max(1,lineWidth));
    const unit=size/COPY_FONT.em*scale,baseline=y+row*size*1.35+size*.82;
    let pen=x;for(const char of line){const glyph=COPY_FONT.glyphs[char];if(glyph?.d){scene.ops.push({kind:'path',d:glyph.d,fill:color,matrix:[unit,0,0,-unit,pen,baseline]});if(glyph.bounds){left=Math.min(left,pen+glyph.bounds[0]*unit);right=Math.max(right,pen+glyph.bounds[2]*unit);top=Math.min(top,baseline-glyph.bounds[3]*unit);bottom=Math.max(bottom,baseline-glyph.bounds[1]*unit);}}pen+=advance(char)*scale;}
  }
  return Number.isFinite(top)?{x:left,y:top,w:right-left,h:bottom-top}:{x,y,w:0,h:0};
}
export function createPosterScene({direction='air',palette='maker',format='poster',headline,detail,phase=0,energy=1,customColors=null,offsets=[],lettering={},footer={},motionCurve='smooth'}={}){
  const spec=TREATMENTS.find(d=>d.id===direction)||TREATMENTS[0],size=FORMATS[format]||FORMATS.poster;
  const original=PALETTES.find(p=>p.id===palette)||PALETTES[0];
  const colors={...original,...customColors};if(customColors?.fg)colors.ink=customColors.fg;const {w:width,h:height}=size,short=Math.min(width,height);
  const scene={width,height,margin:short*.065,background:colors.bg,ops:[],direction:spec.id,description:spec.description};
  const pad=short*.065,frameW=width-pad*2;
  let lines=cleanHeadline(headline??spec.headline).split('\n').map(line=>line.trim()).filter(Boolean);if(!lines.length)lines=['MAKE'];
  if(width<height)lines=lines.flatMap(line=>line.split(/ +/));
  const typeRect={x:short*.035,y:height*.055,w:width-short*.07,h:height*.705};
  const letters=layoutTreatment(lines.join('\n'),typeRect,spec.id,phase,energy,lettering,motionCurve);
  scene.baseCells=(letters.unrefinedCells||letters.cells).map(cell=>({...cell}));
  // Existing offsets refer to the original layout anchor. Preserve that exact
  // anchor for edited letters; new drags are measured
  // against the same base, including when they start on a refined letter.
  const placed=letters.cells.map(cell=>{
    const edit=offsets[cell.index];
    const pinned=edit&&(Math.abs(edit.x||0)+Math.abs(edit.y||0)+Math.abs((edit.w??1)-1)+Math.abs((edit.h??1)-1)>1e-8);
    return pinned&&letters.unrefinedCells?{...scene.baseCells[cell.index],response:cell.response,craft:cell.craft}:cell;
  });
  letters.cells=displaceLetters(placed,offsets,typeRect);
  for(const row of letters.rows)row.cells=letters.cells.filter(cell=>cell.row===row.index||cell.row===letters.rows.indexOf(row));
  appendTreatmentArtwork(scene,letters,colors,typeRect);

  const bodySize=short*.026,sideBySide=width>=height;
  const detailW=frameW*(sideBySide?.52:.75);
  const logoW=sideBySide?Math.min(frameW*.33,short*.40):Math.min(frameW*.47,short*.48),logoH=logoW*646/3871;
  const baseLogo={x:sideBySide?width-pad-logoW:pad,y:height-pad-logoH,w:logoW,h:logoH};
  const copyStart=scene.ops.length;
  const copy=addText(scene,cleanDetail(detail??spec.detail),pad,0,bodySize,colors.ink,detailW);
  // Align visible ink, including descenders, to the logo's bottom edge.
  const textY=sideBySide?baseLogo.y+baseLogo.h-copy.y-copy.h:height*.805;
  const placement=normalizeFooter(footer);
  scene.footerBases={text:{rect:{...copy,y:copy.y+textY},anchor:{x:0,y:sideBySide?1:0}},logo:{rect:baseLogo,anchor:{x:sideBySide?1:0,y:1}}};
  const placedCopy=placeFooterItem(scene.footerBases.text.rect,placement.text,width,height,scene.footerBases.text.anchor);
  for(let i=copyStart;i<scene.ops.length;i++){
    const m=scene.ops[i].matrix;m[5]+=textY;
    scene.ops[i].matrix=[m[0]*placedCopy.scale,m[1]*placedCopy.scale,m[2]*placedCopy.scale,m[3]*placedCopy.scale,m[4]*placedCopy.scale+placedCopy.dx,m[5]*placedCopy.scale+placedCopy.dy];
  }
  const positionedLogo=placeFooterItem(baseLogo,placement.logo,width,height,scene.footerBases.logo.anchor);
  const logo={x:positionedLogo.x,y:positionedLogo.y,w:positionedLogo.w,h:positionedLogo.h};
  scene.ops.push({kind:'image',src:LOGO_DATA,...logo});
  scene.regions={type:typeRect,details:{x:placedCopy.x,y:placedCopy.y,w:placedCopy.w,h:placedCopy.h},logo};
  scene.cells=letters.cells;return scene;
}

const imageCache=new Map(),canvasPaths=new Map();
function canvasPath(d){let geometry=canvasPaths.get(d);if(!geometry){geometry=new Path2D(d);if(canvasPaths.size>700)canvasPaths.clear();canvasPaths.set(d,geometry);}return geometry;}
export async function preparePosterAssets(){
  if(imageCache.has(LOGO_DATA))return;
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=LOGO_DATA;});imageCache.set(LOGO_DATA,image);
}
export function drawPosterScene(ctx,scene){
  ctx.save();ctx.fillStyle=scene.background;ctx.fillRect(0,0,scene.width,scene.height);
  for(const op of scene.ops){ctx.save();if(op.opacity!==undefined)ctx.globalAlpha*=op.opacity;
    if(op.clip){ctx.beginPath();ctx.rect(op.clip.x,op.clip.y,op.clip.w,op.clip.h);ctx.clip();}
    if(op.pathClip){const [a,b,c,d,e,f]=op.pathClip.matrix,det=a*d-b*c;ctx.transform(a,b,c,d,e,f);ctx.clip(canvasPath(op.pathClip.d));ctx.transform(d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det);}
    if(op.matrix)ctx.transform(...op.matrix);
    if(op.kind==='path'){
      if(op.fill!=='none'){ctx.fillStyle=op.fill;ctx.fill(canvasPath(op.d),op.rule||'nonzero');}
      if(op.stroke){ctx.strokeStyle=op.stroke;ctx.lineWidth=op.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(canvasPath(op.d));}
    }else if(op.kind==='rect'){ctx.fillStyle=op.fill;ctx.fillRect(op.x,op.y,op.w,op.h);}
    else if(op.kind==='image'){const image=imageCache.get(op.src);if(image)ctx.drawImage(image,op.x,op.y,op.w,op.h);}
    ctx.restore();
  }ctx.restore();
}
export function posterSVG(scene){
  let defs='',body='';scene.ops.forEach((op,index)=>{
    let markup='';if(op.kind==='path')markup=`<path d="${op.d}" fill="${op.fill}" fill-rule="${op.rule||'nonzero'}"${op.stroke?` stroke="${op.stroke}" stroke-width="${n(op.width)}" stroke-linecap="round" stroke-linejoin="round"`:''}${op.matrix?` transform="matrix(${op.matrix.map(n).join(' ')})"`:''}/>`;
    else if(op.kind==='rect')markup=`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.fill}"/>`;
    else if(op.kind==='image')markup=`<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" href="${escape(op.src)}"/>`;
    if(op.clip){const c=op.clip;defs+=`<clipPath id="part-${index}"><rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}"/></clipPath>`;markup=`<g clip-path="url(#part-${index})">${markup}</g>`;}
    if(op.pathClip){const c=op.pathClip;defs+=`<clipPath id="ink-${index}"><path d="${c.d}" transform="matrix(${c.matrix.map(n).join(' ')})"/></clipPath>`;markup=`<g clip-path="url(#ink-${index})">${markup}</g>`;}
    body+=markup;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>Maker Faire Kochi — ${escape(scene.direction)} poster</title><defs>${defs}<clipPath id="board"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs><rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/><g clip-path="url(#board)">${body}</g></svg>`;
}
