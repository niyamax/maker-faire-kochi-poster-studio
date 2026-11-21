import {CUTOUTS,paperImageArea,paperSpanAt} from './paper-shapes.js';
import {composePaperScene} from './paper-scene.js';
import {LOGO_VARIANTS,getLogoVariant} from './logo-library.js';
import {layoutTreatment,appendTreatmentArtwork} from './treatment.js';
import {stableLetterPose} from './letter-pose.js';
import {animateLetterPose} from './letter-drag.js';
import {MAKER_FOOTER_DEFAULTS,normalizeFooter,placeFooterItem} from './footer-layout.js';
import {normalizePosterImage,posterImageLayout} from './poster-image.js';
import {reactTypeToCutout} from './cutout-response.js';
import {normalizeHeadlineFrame,resolveHeadlineFrame,transformHeadlineRect,inverseHeadlineRect} from './headline-frame.js';

import {FORMATS,addText,cleanHeadline,cleanDetail,getImageSilhouette,loadPosterImage,prepareImageAsset} from './scene-renderer.js';

export {FORMATS,cleanHeadline,cleanDetail,drawPosterScene,posterSVG,hitPosterImage,hitPosterLetter} from './scene-renderer.js';

export const PALETTES=Object.freeze([
  {id:'maker',name:'White paper',bg:'#FFFFFF',fg:'#ED1C24'},
  {id:'maker-red',name:'Red paper',bg:'#ED1C24',fg:'#FFFFFF'},
]);

export function makerPaletteId(id,fallback='maker'){
  if(id==='maker-cyan')return 'maker';
  if(id==='noise')return 'maker-red';
  return PALETTES.some(palette=>palette.id===id)?id:fallback;
}
export const TREATMENTS=Object.freeze([
  {id:'air',name:'Air',description:'Inflated letters that share space.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
  {id:'flex',name:'Flex',description:'Open strokes and elastic proportions.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
  {id:'packed',name:'Packed',description:'Dense, playful poster lettering.',headline:'MAKER FAIRE\nKOCHI',detail:'Build. Repair. Experiment.\nBring your curiosity.'},
]);

function placeMakerFooter(scene,text,colors,placement,{top,bottom,rowWidth,logoWidth,fontScale,frame,artwork}){
  const {width,height}=scene,short=Math.min(width,height);
  if(artwork.layout==='square')logoWidth=Math.min(logoWidth,short*.16);
  const logoRatio=artwork.height/artwork.width;
  const textScale=MAKER_FOOTER_DEFAULTS.text.size/100;
  const gap=short*.032;
  const availableWidth=frame?frame.right-frame.left:rowWidth;
  const copy=addText(scene,text,0,0,short*fontScale,colors.fg,(availableWidth-logoWidth-gap)/textScale,placement.text.align);
  const textWidth=copy.w*textScale;
  const textGap=textWidth>0?gap:0;
  const logoHeight=logoWidth*logoRatio;
  const rowHeight=Math.max(copy.h*textScale,logoHeight);
  const left=frame?.left??(width-textWidth-textGap-logoWidth)/2;
  const right=frame?.right??(left+textWidth+textGap+logoWidth);
  const middle=Math.min(top+rowHeight,bottom)-rowHeight/2;
  const textAnchor={x:frame?0:.5,y:.5};
  const logoAnchor={x:frame?1:.5,y:.5};
  const textRect={...copy,x:left+(textWidth-copy.w)*textAnchor.x,y:middle-copy.h/2};
  const logoRect={x:right-logoWidth,y:middle-logoHeight/2,w:logoWidth,h:logoHeight};
  scene.footerBases={text:{rect:textRect,anchor:textAnchor},logo:{rect:logoRect,anchor:logoAnchor}};
  const details=placeFooterItem(textRect,placement.text,width,height,textAnchor);
  const logo=placeFooterItem(logoRect,placement.logo,width,height,logoAnchor);
  for(const op of scene.ops){
    const m=op.matrix,s=details.scale;
    op.matrix=[m[0]*s,m[1]*s,m[2]*s,m[3]*s,(m[4]-copy.x)*s+details.x,(m[5]-copy.y)*s+details.y];
  }
  scene.regions.details=details;
  scene.regions.logo=logo;
  scene.ops.push({kind:'image',src:artwork.src,x:logo.x,y:logo.y,w:logo.w,h:logo.h});
}

export function createPosterScene({direction='air',palette='maker',format='poster',headline,detail,phase=0,energy=1,offsets=[],lettering={},footer={},headlineFrame={},motionCurve='smooth',media=null,cutout=null,wrapMode='words',logoVariant}={}){
  const artwork=getLogoVariant(logoVariant);
  const spec=TREATMENTS.find(d=>d.id===direction)||TREATMENTS[0],size=FORMATS[format]||FORMATS.poster;
  const colors=PALETTES.find(theme=>theme.id===makerPaletteId(palette));
  const {w:width,h:height}=size,short=Math.min(width,height),pad=short*.065;
  const scene={width,height,margin:pad,background:colors.bg,ops:[],title:`Maker Faire Kochi — ${spec.id} poster`,direction:spec.id,description:spec.description};
  const fullType={x:short*.035,y:height*.055,w:width-short*.07,h:height*.705};
  let lines=cleanHeadline(headline??spec.headline).split('\n').filter(line=>line.trim().length>0);if(!lines.length)lines=['MAKE'];

  const placement=normalizeFooter(footer,MAKER_FOOTER_DEFAULTS);
  const supportingText=cleanDetail(detail??spec.detail);
  scene.regions={type:fullType};
  if(Object.hasOwn(CUTOUTS,cutout)){
    const shape=CUTOUTS[cutout];
    scene.background=colors.fg;
    scene.title=`Maker Faire Kochi — ${shape.name} paper cutout`;
    const footerWidths={step:.50,ribbon:.40,split:.36};
    const footerBottoms={step:.917,window:.896,ribbon:.906,split:.902,gate:.906,ticket:.876,fold:.893,offset:.895,
      'wide-window':.874,'wide-fold':short/height>.8?.875:.865,'wide-offset':.887,'wide-gate':.876};
    const bottom=footerBottoms[cutout];
    const logoWidth=Math.min(shape.brand[2]*width,short*(cutout==='ribbon'?.17:.225));
    let frame;
    // Step's paper drops away below the left side of its window.
    if(shape.window&&cutout!=='step'){
      const opening=paperImageArea(shape);
      const paper=paperSpanAt(shape.outline,bottom);
      const textInset=short*.007;
      // Reserve more room for the bordered logo, including at bevels.
      const logoInset=Math.min(logoWidth,artwork.layout==='square'?short*.16:logoWidth)*artwork.height/artwork.width*.75;
      frame={
        left:Math.max(opening.x,paper.left)*width+textInset,
        right:Math.min(opening.x+opening.w,paper.right)*width-logoInset,
      };
    }
    placeMakerFooter(scene,supportingText,colors,placement,{
      top:shape.copy[1]*height,bottom:bottom*height,rowWidth:(footerWidths[cutout]??.74)*width,frame,
      logoWidth,fontScale:.019,artwork,
    });
    // The Step footer starts to the right of centre, so give its centred
    // footer a paper tab where it extends into the photo.
    if(cutout==='step')scene.ops.unshift({kind:'path',fill:colors.bg,d:
      `M${width*.21} ${height*.817}H${width*.79}V${height*.925}H${width*.255}L${width*.21} ${height*.898}Z`});
    return composePaperScene(scene,{
      cutout,text:lines.join('\n'),colors:{...colors,accent:colors.bg},media,wrapMode,direction:spec.id,
      phase,energy,lettering,headlineFrame,motionCurve,offsets,
    });
  }

  placeMakerFooter(scene,supportingText,colors,placement,{
    top:height-pad,bottom:height-pad,rowWidth:width-2*pad,
    logoWidth:Math.min((width-2*pad)*(width>=height?.33:.47),short*(width>=height?.40:.48)),
    fontScale:.026,artwork,
  });
  const footerOps=scene.ops;
  scene.ops=[];

  const image=normalizePosterImage(media),photo=posterImageLayout(image,width,height,fullType,scene.regions);
  const typeRect=photo&&image.layout==='cutout'?{...photo.typeRect,h:height*.62}:photo?.typeRect||fullType;
  const frameSettings=normalizeHeadlineFrame(headlineFrame);
  const sourceRect=frameSettings.fit==='scale'&&frameSettings.basis?{...typeRect,...frameSettings.basis}:typeRect;
  const frame=resolveHeadlineFrame(sourceRect,frameSettings,width,height);
  const fill=Boolean(frameSettings.box&&frameSettings.fit==='fill');
  const layoutRect=fill?{...typeRect,w:frame.w,h:frame.h}:sourceRect;
  const rx=layoutRect.w/typeRect.w,ry=layoutRect.h/typeRect.h;
  const editBounds={x:layoutRect.x+(fullType.x-typeRect.x)*rx,y:layoutRect.y+(fullType.y-typeRect.y)*ry,w:fullType.w*rx,h:fullType.h*ry};
  const transform={sx:frame.w/layoutRect.w,sy:frame.h/layoutRect.h};
  transform.tx=frame.x-layoutRect.x*transform.sx;transform.ty=frame.y-layoutRect.y*transform.sy;
  scene.headlinePlacement={rect:frame,automatic:typeRect,source:{w:layoutRect.w,h:layoutRect.h},fit:frameSettings.fit,custom:Boolean(frameSettings.box)};
  scene.regions.headline=frame;scene.regions.type=transformHeadlineRect(editBounds,transform);
  const words=lines.join('\n');
  // Resolve edits in local, phase-independent coordinates. Placement changes
  // apply one outer transform to artwork and hit boxes, without baking motion
  // into the saved layout or recalculating neighbour clearance on every move.
  const createLayout=(atPhase,rect)=>layoutTreatment(words,rect,spec.id,atPhase,energy,lettering,motionCurve);
  const letters=createLayout(phase,layoutRect);
  const poseKey=JSON.stringify([words,layoutRect,editBounds,spec.id,energy,lettering,motionCurve,offsets]);
  const pose=stableLetterPose(poseKey,()=>createLayout(0,layoutRect),()=>createLayout(0,editBounds),offsets,editBounds);
  scene.baseCells=pose.referenceCells.map(cell=>transformHeadlineRect(cell,transform));
  scene.editCells=pose.restCells.map(cell=>transformHeadlineRect(cell,transform));
  if(pose.hasEdits)letters.cells=animateLetterPose(pose.restCells,pose.referenceCells,letters.cells,editBounds);
  if(photo&&image.layout==='cutout'){
    scene.unreactedCells=letters.cells.map(cell=>transformHeadlineRect(cell,transform));
    letters.cells=reactTypeToCutout(letters.cells,inverseHeadlineRect(photo.frame,transform),image.asset.silhouette||getImageSilhouette(image.asset.src),layoutRect,image.reaction);
  }
  for(const row of letters.rows)row.cells=letters.cells.filter(cell=>cell.row===row.index);
  if(photo&&image.layout==='window')scene.ops.push(photo.op);
  const firstLetterOp=scene.ops.length;
  appendTreatmentArtwork(scene,letters,colors,editBounds);
  for(const op of scene.ops.slice(firstLetterOp)){
    const m=op.matrix||[1,0,0,1,0,0];
    op.matrix=[m[0]*transform.sx,m[1]*transform.sy,m[2]*transform.sx,m[3]*transform.sy,m[4]*transform.sx+transform.tx,m[5]*transform.sy+transform.ty];
  }
  if(photo&&image.layout==='cutout')scene.ops.push(photo.op);
  if(photo){
    scene.media={...photo,layout:image.layout,width,height};scene.regions.image=photo.frame;
  }
  scene.ops.push(...footerOps);scene.cells=letters.cells.map(cell=>transformHeadlineRect(cell,transform));return scene;
}

export async function preparePosterAssets(asset=null){
  await Promise.all([...LOGO_VARIANTS.map(variant=>loadPosterImage(variant.src,false,true)),prepareImageAsset(asset)]);
}
