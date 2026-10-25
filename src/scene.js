import {COPY_FONT} from './data/copy-outlines.js';
import {LOGO_DATA} from './data/logo.js';
import {layoutTreatment,appendTreatmentArtwork} from './treatment.js';
import {displaceLetters} from './letter-drag.js';
import {normalizeFooter,placeFooterItem} from './footer-layout.js';
import {HEADLINE_MAX_LENGTH} from './content-limits.js';
import {normalizePosterImage,posterImageLayout} from './poster-image.js';
import {reactTypeToCutout,silhouetteFromPixels} from './cutout-response.js';

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
export function cleanHeadline(value){return String(value||'').toUpperCase().replace(/\r\n?/g,'\n').replace(/[^A-Z0-9 &!?\n.-]/g,'').slice(0,HEADLINE_MAX_LENGTH);}
export function cleanDetail(value){return [...String(value??'')].filter(char=>char==='\n'||COPY_FONT.glyphs[char]).join('').split('\n').slice(0,2).map(line=>line.slice(0,80)).join('\n').slice(0,160);}
function addText(scene,text,x,y,size,color,maxWidth=Infinity,align='left'){
  const advance=char=>(COPY_FONT.glyphs[char]?.advance||COPY_FONT.em*.3)*size/COPY_FONT.em;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;const rows=[];
  for(const [row,line] of String(text).split('\n').entries()){
    const lineWidth=[...line].reduce((total,char)=>total+advance(char),0),scale=Math.min(1,maxWidth/Math.max(1,lineWidth));
    const unit=size/COPY_FONT.em*scale,baseline=y+row*size*1.35+size*.82;
    const start=scene.ops.length;let rowLeft=Infinity,rowRight=-Infinity,pen=x;
    for(const char of line){
      const glyph=COPY_FONT.glyphs[char];
      if(glyph?.d){
        scene.ops.push({kind:'path',d:glyph.d,fill:color,matrix:[unit,0,0,-unit,pen,baseline]});
        if(glyph.bounds){
          rowLeft=Math.min(rowLeft,pen+glyph.bounds[0]*unit);rowRight=Math.max(rowRight,pen+glyph.bounds[2]*unit);
          left=Math.min(left,rowLeft);right=Math.max(right,rowRight);top=Math.min(top,baseline-glyph.bounds[3]*unit);bottom=Math.max(bottom,baseline-glyph.bounds[1]*unit);
        }
      }
      pen+=advance(char)*scale;
    }
    rows.push({start,end:scene.ops.length,left:rowLeft,right:rowRight});
  }
  // Align the lines inside the existing text frame, keeping its size and
  // position stable for direct editing, snapping and every export format.
  if(align!=='left'&&Number.isFinite(left))for(const row of rows)if(Number.isFinite(row.left)){
    const dx=left+(right-left-row.right+row.left)*(align==='right'?1:.5)-row.left;
    for(let i=row.start;i<row.end;i++)scene.ops[i].matrix[4]+=dx;
  }
  return Number.isFinite(top)?{x:left,y:top,w:right-left,h:bottom-top}:{x,y,w:0,h:0};
}
export function createPosterScene({direction='air',palette='maker',format='poster',headline,detail,phase=0,energy=1,customColors=null,offsets=[],lettering={},footer={},motionCurve='smooth',media=null}={}){
  const spec=TREATMENTS.find(d=>d.id===direction)||TREATMENTS[0],size=FORMATS[format]||FORMATS.poster;
  const original=PALETTES.find(p=>p.id===palette)||PALETTES[0];
  const colors={...original,...customColors};if(customColors?.fg)colors.ink=customColors.fg;
  const {w:width,h:height}=size,short=Math.min(width,height),pad=short*.065,frameW=width-pad*2;
  const scene={width,height,margin:pad,background:colors.bg,ops:[],direction:spec.id,description:spec.description};
  const fullType={x:short*.035,y:height*.055,w:width-short*.07,h:height*.705};
  let lines=cleanHeadline(headline??spec.headline).split('\n').map(line=>line.trim()).filter(Boolean);if(!lines.length)lines=['MAKE'];
  if(width<height)lines=lines.flatMap(line=>line.split(/ +/));

  // Footer placement remains independent of the image layout.
  const bodySize=short*.026,sideBySide=width>=height,detailW=frameW*(sideBySide?.52:.75);
  const logoW=sideBySide?Math.min(frameW*.33,short*.40):Math.min(frameW*.47,short*.48),logoH=logoW*646/3871;
  const baseLogo={x:sideBySide?width-pad-logoW:pad,y:height-pad-logoH,w:logoW,h:logoH};
  const placement=normalizeFooter(footer),copy=addText(scene,cleanDetail(detail??spec.detail),pad,0,bodySize,colors.ink,detailW,placement.text.align);
  const textY=sideBySide?baseLogo.y+baseLogo.h-copy.y-copy.h:height*.805;
  scene.footerBases={text:{rect:{...copy,y:copy.y+textY},anchor:{x:0,y:sideBySide?1:0}},logo:{rect:baseLogo,anchor:{x:sideBySide?1:0,y:1}}};
  const placedCopy=placeFooterItem(scene.footerBases.text.rect,placement.text,width,height,scene.footerBases.text.anchor);
  for(const op of scene.ops){
    const m=op.matrix;m[5]+=textY;
    op.matrix=[m[0]*placedCopy.scale,m[1]*placedCopy.scale,m[2]*placedCopy.scale,m[3]*placedCopy.scale,m[4]*placedCopy.scale+placedCopy.dx,m[5]*placedCopy.scale+placedCopy.dy];
  }
  const positionedLogo=placeFooterItem(baseLogo,placement.logo,width,height,scene.footerBases.logo.anchor);
  const logo={x:positionedLogo.x,y:positionedLogo.y,w:positionedLogo.w,h:positionedLogo.h};
  scene.ops.push({kind:'image',src:LOGO_DATA,...logo});
  const footerOps=scene.ops;scene.ops=[];
  scene.regions={type:fullType,details:{x:placedCopy.x,y:placedCopy.y,w:placedCopy.w,h:placedCopy.h},logo};

  const image=normalizePosterImage(media),photo=posterImageLayout(image,width,height,fullType,scene.regions);
  const typeRect=photo&&image.layout==='cutout'?{...photo.typeRect,h:height*.62}:photo?.typeRect||fullType;
  const letters=layoutTreatment(lines.join('\n'),typeRect,spec.id,phase,energy,lettering,motionCurve);
  const anchors=photo?layoutTreatment(lines.join('\n'),fullType,spec.id,phase,energy,lettering,motionCurve):letters;
  scene.baseCells=(anchors.unrefinedCells||anchors.cells).map(cell=>({...cell}));
  const placed=letters.cells.map(cell=>{
    const edit=offsets[cell.index],pinned=edit&&(Math.abs(edit.x||0)+Math.abs(edit.y||0)+Math.abs((edit.w??1)-1)+Math.abs((edit.h??1)-1)>1e-8);
    return pinned?{...scene.baseCells[cell.index],response:cell.response,craft:cell.craft}:cell;
  });
  letters.cells=displaceLetters(placed,offsets,fullType);
  if(photo&&image.layout==='cutout'){
    scene.unreactedCells=letters.cells.map(cell=>({...cell}));
    letters.cells=reactTypeToCutout(letters.cells,photo.frame,image.asset.silhouette||silhouettes.get(image.asset.src),typeRect);
  }
  for(const row of letters.rows)row.cells=letters.cells.filter(cell=>cell.row===row.index);
  if(photo&&image.layout==='window')scene.ops.push(photo.op);
  appendTreatmentArtwork(scene,letters,colors,fullType);
  if(photo&&image.layout==='cutout')scene.ops.push(photo.op);
  if(photo){
    scene.media={...photo,layout:image.layout,width,height};scene.regions.image=photo.frame;
    const r=scene.regions.details,f=photo.frame;
    if(r.w>0&&r.x<f.x+f.w&&r.x+r.w>f.x&&r.y<f.y+f.h&&r.y+r.h>f.y)scene.ops.push({kind:'rect',x:r.x-8,y:r.y-6,w:r.w+16,h:r.h+12,fill:colors.bg});
  }
  scene.ops.push(...footerOps);scene.cells=letters.cells;return scene;
}

const imageCache=new Map(),canvasPaths=new Map();
function canvasPath(d){let geometry=canvasPaths.get(d);if(!geometry){geometry=new Path2D(d);if(canvasPaths.size>700)canvasPaths.clear();canvasPaths.set(d,geometry);}return geometry;}
const pendingImages=new Map(),alphaMasks=new Map(),silhouettes=new Map();
async function loadPosterImage(src,alpha=false){
  if(imageCache.has(src))return;
  if(pendingImages.has(src))return pendingImages.get(src);
  const promise=(async()=>{
    const image=new Image();image.src=src;await image.decode();imageCache.set(src,image);
    if(alpha){const mask=document.createElement('canvas');mask.width=64;mask.height=64;const context=mask.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,64,64);const pixels=context.getImageData(0,0,64,64).data;alphaMasks.set(src,pixels);silhouettes.set(src,silhouetteFromPixels(pixels,64,64));}
    while(imageCache.size>8){const oldest=[...imageCache.keys()].find(key=>key!==LOGO_DATA);imageCache.delete(oldest);alphaMasks.delete(oldest);silhouettes.delete(oldest);}
  })();pendingImages.set(src,promise);
  try{await promise;}finally{pendingImages.delete(src);}
}
export async function preparePosterAssets(asset=null){
  await Promise.all([loadPosterImage(LOGO_DATA),...(asset?[loadPosterImage(asset.src,asset.hasAlpha)]:[])]);
  if(asset&&!asset.silhouette&&silhouettes.has(asset.src))asset.silhouette=silhouettes.get(asset.src);
}
export function hitPosterImage(scene,point){
  const info=scene?.media;if(!info)return false;const r=info.frame;
  if(point.x<r.x||point.x>r.x+r.w||point.y<r.y||point.y>r.y+r.h)return false;
  if(info.layout==='window')return true;
  const mask=alphaMasks.get(info.op.src);if(!mask)return true;
  const x=Math.min(63,Math.floor((point.x-r.x)/r.w*64)),y=Math.min(63,Math.floor((point.y-r.y)/r.h*64));
  return mask[(y*64+x)*4+3]>24;
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
    else if(op.kind==='image'){const image=imageCache.get(op.src);if(image){if(op.source){const c=op.source;ctx.drawImage(image,c.x,c.y,c.w,c.h,op.x,op.y,op.w,op.h);}else ctx.drawImage(image,op.x,op.y,op.w,op.h);}}
    ctx.restore();
  }ctx.restore();
}
export function posterSVG(scene){
  let defs='',body='';scene.ops.forEach((op,index)=>{
    let markup='';if(op.kind==='path')markup=`<path d="${op.d}" fill="${op.fill}" fill-rule="${op.rule||'nonzero'}"${op.stroke?` stroke="${op.stroke}" stroke-width="${n(op.width)}" stroke-linecap="round" stroke-linejoin="round"`:''}${op.matrix?` transform="matrix(${op.matrix.map(n).join(' ')})"`:''}/>`;
    else if(op.kind==='rect')markup=`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.fill}"/>`;
    else if(op.kind==='image'){
      if(op.source){const c=op.source;markup=`<svg x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" viewBox="${n(c.x)} ${n(c.y)} ${n(c.w)} ${n(c.h)}" preserveAspectRatio="none" overflow="hidden"><image width="${op.naturalWidth}" height="${op.naturalHeight}" href="${escape(op.src)}"/></svg>`;}
      else markup=`<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" href="${escape(op.src)}"/>`;
    }
    if(op.clip){const c=op.clip;defs+=`<clipPath id="part-${index}"><rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}"/></clipPath>`;markup=`<g clip-path="url(#part-${index})">${markup}</g>`;}
    if(op.pathClip){const c=op.pathClip;defs+=`<clipPath id="ink-${index}"><path d="${c.d}" transform="matrix(${c.matrix.map(n).join(' ')})"/></clipPath>`;markup=`<g clip-path="url(#ink-${index})">${markup}</g>`;}
    body+=markup;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>Maker Faire Kochi — ${escape(scene.direction)} poster</title><defs>${defs}<clipPath id="board"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs><rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/><g clip-path="url(#board)">${body}</g></svg>`;
}
