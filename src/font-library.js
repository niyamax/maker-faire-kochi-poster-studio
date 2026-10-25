/**
 * Display faces chosen for broad shoulders, compressed rhythm, warm serifs,
 * and swollen poster lettering. All outlines and licenses are bundled locally.
 *
 * Geometry is independent of CSS/font loading and is shared by Canvas, still
 * SVG, and animated SVG. One compound path retains the source font's counters
 * under the default nonzero fill rule. Fixed point counts permit interpolation.
 */
import {FONT_OUTLINES} from './data/font-outlines.js';
import {glyphMetrics,supportedGlyphs} from './flex-glyphs.js';

export const FONT_CATALOG = Object.freeze([
  {id:'original',name:'Studio Sans',description:'The elastic studio alphabet.',preview:'Elastic / original',family:null,source:null},
  {id:'dela',name:'Dela Gothic One',description:'Wide shoulders. Heavy, graphic forms.',preview:'Wide / graphic',family:'Dela Gothic One',file:'assets/fonts/DelaGothicOne-Regular.ttf',source:'https://github.com/google/fonts/tree/main/ofl/delagothicone'},
  {id:'anton',name:'Anton',description:'Tall, compressed poster lettering.',preview:'Tall / condensed',family:'Anton',file:'assets/fonts/Anton-Regular.ttf',source:'https://github.com/google/fonts/tree/main/ofl/anton'},
  {id:'bricolage',name:'Bricolage Extra Bold',description:'Warm grotesque with a little eccentricity.',preview:'Warm / eccentric',family:'Bricolage Grotesque',file:'assets/fonts/BricolageGrotesque-variable.ttf',axes:{wght:800,opsz:96,wdth:100},source:'https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque'},
  {id:'bowlby',name:'Bowlby One',description:'Bulging, irregular display forms.',preview:'Bulging / playful',family:'Bowlby One',file:'assets/fonts/BowlbyOne-Regular.ttf',source:'https://github.com/google/fonts/tree/main/ofl/bowlbyone'},
  {id:'geist',name:'Geist',description:'Heavy, precise grotesque with open counters.',preview:'Black / geometric',family:'Geist',file:'assets/fonts/Geist-variable.woff2',axes:{wght:900},source:'https://github.com/vercel/geist-font'},
  {id:'inter',name:'Inter',description:'Black display grotesque with clear, open forms.',preview:'Black / display',family:'Inter',file:'assets/fonts/Inter.ttf',axes:{wght:900,opsz:32},source:'https://github.com/rsms/inter'},
].map(font=>Object.freeze(font)));
export const FONT_IDS = Object.freeze(FONT_CATALOG.map(font=>font.id));
export const FONT_SHAPING_NOTE = 'Latin display glyphs. The studio uses uppercase; Malayalam and connected-script shaping are not included.';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback)=>Number.isFinite(Number(n))?Number(n):fallback;
const fmt=n=>String(Math.round(n*1000)/1000);
const glyph=(id,char)=>FONT_OUTLINES[id]?.[String(char??'')];
const cornerCache=new WeakMap();
function smoothFontContour(points,source){
  // Classification comes from the undeformed source, so animation topology is
  // fixed. Keep designed corners (M, K, serifs), smooth the sampled curve runs.
  let corners=cornerCache.get(source);
  if(!corners){corners=source.map(([x,y],i)=>{
    const a=source[(i+source.length-1)%source.length],b=source[(i+1)%source.length];
    const ax=x-a[0],ay=y-a[1],bx=b[0]-x,by=b[1]-y;
    const lengths=Math.hypot(ax,ay)*Math.hypot(bx,by);
    return lengths>1e-12&&(ax*bx+ay*by)/lengths<.82;
  });cornerCache.set(source,corners);}
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const start=midpoint(points.at(-1),points[0]);
  let d=`M${fmt(start.x)} ${fmt(start.y)}`;
  for(let i=0;i<points.length;i++){
    const p=points[i],end=midpoint(p,points[(i+1)%points.length]);
    d+=corners[i]?`L${fmt(p.x)} ${fmt(p.y)}L${fmt(end.x)} ${fmt(end.y)}`:`Q${fmt(p.x)} ${fmt(p.y)} ${fmt(end.x)} ${fmt(end.y)}`;
  }
  return d+'Z';
}

export const getFont=id=>FONT_CATALOG.find(font=>font.id===id)||FONT_CATALOG[0];
export const fontSupports=(id,char)=>id==='original'?supportedGlyphs.includes(String(char??'').toUpperCase()):Boolean(glyph(id,char));
export const fontSupportedGlyphs=id=>id==='original'?supportedGlyphs:Object.keys(FONT_OUTLINES[id]||{});

/** Width/advance relative to cap height, suitable for layout score weighting. */
export function fontGlyphMetrics(id,char){
  if(id==='original')return{width:glyphMetrics(char),advance:glyphMetrics(char),hasCounter:false};
  const g=glyph(id,char);
  return g?{width:g.ratio,advance:g.advance,hasCounter:Boolean(g.hasCounter)}:null;
}

const opticalCache=new Map();
/** Outer ink edges at shared scanlines, independent of the font's sidebearings.
 * Counters do not affect the outer envelope. Cached once per glyph. */
export function fontOpticalProfile(id,char){
  const key=`${id}:${char}`;
  if(opticalCache.has(key))return opticalCache.get(key);
  const source=glyph(id,char),left=[],right=[];
  for(let i=0;i<17;i++){
    const y=.06+i*.88/16,intersections=[];
    for(const contour of source?.contours||[])for(let j=0;j<contour.length;j++){
      const a=contour[j],b=contour[(j+1)%contour.length];
      if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))intersections.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    if(intersections.length){left.push(Math.max(0,Math.min(...intersections)));right.push(Math.max(0,1-Math.max(...intersections)));}
    else{
      // The procedural alphabets have no source contour table. Use their
      // recognisable edge construction rather than a fabricated font metric.
      const round=.5-Math.sqrt(Math.max(0,.25-(y-.5)**2));
      left.push('COGQSUO0689'.includes(char)?round:'AVWY'.includes(char)?.38*(char==='A'?1-y:y):0);
      right.push('DCOGQSUO0689'.includes(char)?round:'AVWY'.includes(char)?.38*(char==='A'?1-y:y):0);
    }
  }
  const result={left,right};opticalCache.set(key,result);return result;
}

/**
 * Return null for Studio Sans or unsupported glyphs, letting the app use its
 * authored Flex/Air construction. Real fonts produce closed M/L/Q/Z outlines.
 *
 * The font's anatomy is stretched into its shared layout cell. Pressure offsets
 * the outline towards the empty side of each contour (shrinking counters),
 * while character gently bows stems. The cell remains the outer constraint.
 * This is an intentional display deformation, rather than a font weight axis.
 */
export function fontGlyphGeometry(id,char,width,height,{mode='air',pressure=.7,character=.7}={}){
  if(id==='original')return null;
  const g=glyph(id,char);
  if(!g)return null;
  const w=finite(width,0),h=finite(height,0);
  if(w<=0||h<=0||!g.contours.length)return{paths:[],weight:0,fillRule:'nonzero'};
  const p=clamp(finite(pressure,.7),0,1),c=clamp(finite(character,.7),0,1),short=Math.min(w,h);
  const weight=short*(mode==='air'?.011:.008+.012*p);
  const inset=Math.min(short*.04,Math.max(short*.005,weight*.55));
  const cw=Math.max(.01,w-2*inset),ch=Math.max(.01,h-2*inset);
  const amount=short*(.001+.013*p)*(mode==='air'?1:.38);
  const bow=c*(mode==='air'?.014:.006)*( .35+p*.65);
  const phase=(String(char).charCodeAt(0)%7)*.49;
  const paths=[];
  for(const contour of g.contours){
    // A fixed, monotone warp keeps both the outline and counters coherent.
    const points=contour.map(([u,v])=>({
      x:inset+cw*(u+bow*Math.sin(Math.PI*u)*Math.sin(Math.PI*2*v+phase)),
      y:inset+ch*(v+bow*.55*Math.sin(Math.PI*v)*Math.sin(Math.PI*2*u+phase)),
    }));
    const xs=points.map(q=>q.x),ys=points.map(q=>q.y);
    const contourMin=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
    // Thin counters retain at least 86% of their smaller aperture dimension.
    const offset=Math.min(amount,contourMin*.07);
    const displaced=points.map((q,i)=>{
      const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
      const ax=q.x-prev.x,ay=q.y-prev.y,bx=next.x-q.x,by=next.y-q.y;
      const al=Math.hypot(ax,ay)||1,bl=Math.hypot(bx,by)||1;
      const nx=ay/al+by/bl,ny=-ax/al-bx/bl,nl=Math.hypot(nx,ny)||1;
      return{x:clamp(q.x+nx/nl*offset,inset,w-inset),y:clamp(q.y+ny/nl*offset,inset,h-inset)};
    });
    paths.push(smoothFontContour(displaced,contour));
  }
  return{paths:[paths.join('')],weight,fillRule:'nonzero'};
}
