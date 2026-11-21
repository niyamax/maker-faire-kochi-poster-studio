import {COPY_FONT} from './data/copy-outlines.js';
import {HEADLINE_MAX_LENGTH} from './content-limits.js';
import {silhouetteFromPixels} from './cutout-response.js';

export const FORMATS={poster:{name:'Poster · 4:5',w:1080,h:1350},story:{name:'Story · 9:16',w:1080,h:1920},square:{name:'Square · 1:1',w:1080,h:1080},banner:{name:'Banner · 16:9',w:1920,h:1080},newsletter:{name:'Newsletter · 3:2',w:1536,h:1024}};
const n=v=>Number(v.toFixed(3));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function cleanHeadline(value){return String(value||'').toUpperCase().replace(/\r\n?/g,'\n').replace(/[^A-Z0-9 &!?\n.-]/g,'').slice(0,HEADLINE_MAX_LENGTH);}
export function cleanDetail(value){return [...String(value??'')].filter(char=>char==='\n'||COPY_FONT.glyphs[char]).join('').split('\n').slice(0,2).map(line=>line.slice(0,80)).join('\n').slice(0,160);}
export function addText(scene,text,x,y,size,color,maxWidth=Infinity,align='left'){
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
const imageCache=new Map(),canvasPaths=new Map();
function canvasPath(d){let geometry=canvasPaths.get(d);if(!geometry){geometry=new Path2D(d);if(canvasPaths.size>700)canvasPaths.clear();canvasPaths.set(d,geometry);}return geometry;}
const pendingImages=new Map(),alphaMasks=new Map(),silhouettes=new Map(),pinnedImages=new Set();
export async function loadPosterImage(src,alpha=false,pinned=false){
  if(pinned)pinnedImages.add(src);
  if(imageCache.has(src))return;
  if(pendingImages.has(src))return pendingImages.get(src);
  const promise=(async()=>{
    const image=new Image();image.src=src;await image.decode();imageCache.set(src,image);
    if(alpha){const mask=document.createElement('canvas');mask.width=64;mask.height=64;const context=mask.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,64,64);const pixels=context.getImageData(0,0,64,64).data;alphaMasks.set(src,pixels);silhouettes.set(src,silhouetteFromPixels(pixels,64,64));}
    while(imageCache.size>pinnedImages.size+9){
      const oldest=[...imageCache.keys()].find(key=>!pinnedImages.has(key));
      if(oldest===undefined)break;
      imageCache.delete(oldest);alphaMasks.delete(oldest);silhouettes.delete(oldest);
    }
  })();pendingImages.set(src,promise);
  try{await promise;}finally{pendingImages.delete(src);}
}
export async function prepareImageAsset(asset){
  if(!asset)return;
  await loadPosterImage(asset.src,asset.hasAlpha);
  if((!asset.silhouette||!asset.silhouette.bottom)&&silhouettes.has(asset.src))asset.silhouette=silhouettes.get(asset.src);
}
export const getImageSilhouette=src=>silhouettes.get(src);

export function hitPosterImage(scene,point,{includeTransparent=false}={}){
  const info=scene?.media;if(!info)return false;const r=info.frame;
  if(!includeTransparent&&(point.x<0||point.y<0||point.x>scene.width||point.y>scene.height))return false;
  if(point.x<r.x||point.x>r.x+r.w||point.y<r.y||point.y>r.y+r.h)return false;
  if(info.layout==='window'||includeTransparent)return true;
  const mask=alphaMasks.get(info.op.src);if(!mask)return true;
  const x=Math.min(63,Math.floor((point.x-r.x)/r.w*64)),y=Math.min(63,Math.floor((point.y-r.y)/r.h*64));
  return mask[(y*64+x)*4+3]>24;
}

let letterHitContext;
/** Pick the rendered ink, including outline knockouts and transformed glyphs.
 * A counter or a gap is empty frame area, rather than an invisible letter box.
 * This metadata never enters SVG output or changes any drawing operation. */
export function hitPosterLetter(scene,point,{tolerance=0}={}){
  if(!scene?.cells?.length)return null;
  const pad=tolerance+2,candidates=new Map(scene.cells.filter(c=>point.x>=c.x-pad&&point.x<=c.x+c.w+pad&&point.y>=c.y-pad&&point.y<=c.y+c.h+pad).map(c=>[c.index,c]));
  if(!candidates.size)return null;
  letterHitContext??=document.createElement('canvas').getContext('2d');
  const test=letterHitContext,ops=scene.ops.filter(op=>op.kind==='path'&&candidates.has(op.letterIndex)).reverse();
  test.setTransform(1,0,0,1,0,0);test.lineCap='round';test.lineJoin='round';
  const local=(p,m)=>{
    if(!m)return p;const [a,b,c,d,e,f]=m,det=a*d-b*c;
    return Math.abs(det)<1e-12?null:{x:(d*(p.x-e)-c*(p.y-f))/det,y:(a*(p.y-f)-b*(p.x-e))/det};
  };
  function at(p){
    for(const op of ops){
      if(op.opacity===0)continue;
      if(op.clip&&(p.x<op.clip.x||p.x>op.clip.x+op.clip.w||p.y<op.clip.y||p.y>op.clip.y+op.clip.h))continue;
      if(op.paperClip&&!test.isPointInPath(canvasPath(op.paperClip),p.x,p.y,'evenodd'))continue;
      if(op.pathClip){const q=local(p,op.pathClip.matrix);if(!q||!test.isPointInPath(canvasPath(op.pathClip.d),q.x,q.y))continue;}
      const q=local(p,op.matrix);if(!q)continue;
      const path=canvasPath(op.d),filled=op.fill!=='none'&&test.isPointInPath(path,q.x,q.y,op.rule||'nonzero');
      test.lineWidth=op.width||.0001;
      const stroked=op.stroke&&test.isPointInStroke(path,q.x,q.y);
      if(filled||stroked)return op.letterInk===false?null:candidates.get(op.letterIndex);
    }
    return null;
  }
  const direct=at(point);if(direct||tolerance<=0)return direct;
  for(const radius of [tolerance*.5,tolerance])for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,near=at({x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius});
    if(near)return near;
  }
  return null;
}
export function drawPosterScene(ctx,scene){
  ctx.save();ctx.fillStyle=scene.background;ctx.fillRect(0,0,scene.width,scene.height);
  for(const op of scene.ops){ctx.save();if(op.opacity!==undefined)ctx.globalAlpha*=op.opacity;
    if(op.clip){ctx.beginPath();ctx.rect(op.clip.x,op.clip.y,op.clip.w,op.clip.h);ctx.clip();}
    if(op.paperClip)ctx.clip(canvasPath(op.paperClip),'evenodd');
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
  let defs=scene.paperClip?`<clipPath id="paper"><path d="${scene.paperClip}" clip-rule="evenodd"/></clipPath>`:'',body='';scene.ops.forEach((op,index)=>{
    let markup='';if(op.kind==='path')markup=`<path d="${op.d}" fill="${op.fill}" fill-rule="${op.rule||'nonzero'}"${op.stroke?` stroke="${op.stroke}" stroke-width="${n(op.width)}" stroke-linecap="round" stroke-linejoin="round"`:''}${op.matrix?` transform="matrix(${op.matrix.map(n).join(' ')})"`:''}/>`;
    else if(op.kind==='rect')markup=`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.fill}"/>`;
    else if(op.kind==='image'){
      if(op.source){const c=op.source;markup=`<svg x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" viewBox="${n(c.x)} ${n(c.y)} ${n(c.w)} ${n(c.h)}" preserveAspectRatio="none" overflow="hidden"><image width="${op.naturalWidth}" height="${op.naturalHeight}" href="${escape(op.src)}"/></svg>`;}
      else markup=`<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" href="${escape(op.src)}"/>`;
    }
    if(op.clip){const c=op.clip;defs+=`<clipPath id="part-${index}"><rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}"/></clipPath>`;markup=`<g clip-path="url(#part-${index})">${markup}</g>`;}
    if(op.paperClip)markup=`<g clip-path="url(#paper)">${markup}</g>`;
    if(op.pathClip){const c=op.pathClip;defs+=`<clipPath id="ink-${index}"><path d="${c.d}" transform="matrix(${c.matrix.map(n).join(' ')})"/></clipPath>`;markup=`<g clip-path="url(#ink-${index})">${markup}</g>`;}
    body+=markup;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><title>${escape(scene.title || `${scene.direction} poster`)}</title><defs>${defs}<clipPath id="board"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs><rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/><g clip-path="url(#board)">${body}</g></svg>`;
}
