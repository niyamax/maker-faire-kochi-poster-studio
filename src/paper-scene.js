import {addText,getImageSilhouette} from './scene-renderer.js';
import {placeFooterItem} from './footer-layout.js';
import {normalizeHeadlineFrame,resolveHeadlineFrame} from './headline-frame.js';
import {imageCoverCrop,normalizePosterImage,posterImageLayout} from './poster-image.js';
import {layoutTreatment,appendTreatmentArtwork,treatmentSettings} from './treatment.js';
import {animateLetterPose} from './letter-drag.js';
import {stableLetterPose} from './letter-pose.js';
import {reactTypeToCutout} from './cutout-response.js';
import {CUTOUTS,cutoutId,paperLanes,paperPath,paperImageArea} from './paper-shapes.js';
import {wrapHeadline} from './wrap-headline.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const union=lanes=>{
  const x=Math.min(...lanes.map(lane=>lane.x)),y=Math.min(...lanes.map(lane=>lane.y));
  return {x,y,w:Math.max(...lanes.map(lane=>lane.x+lane.w))-x,h:Math.max(...lanes.map(lane=>lane.y+lane.h))-y};
};

export function placePaperCopy(scene,text,shape,ink,footer){
  const {width,height}=scene,short=Math.min(width,height);
  const [x,y,w]=shape.copy;
  const rect=addText(scene,text,x*width,y*height,short*.019,ink,w*width,footer.text.align);
  const anchor={x:0,y:0};
  scene.footerBases.text={rect,anchor};
  const placed=placeFooterItem(rect,footer.text,width,height,anchor);
  for(const op of scene.ops){
    const m=op.matrix;
    op.matrix=[m[0]*placed.scale,m[1]*placed.scale,m[2]*placed.scale,m[3]*placed.scale,m[4]*placed.scale+placed.dx,m[5]*placed.scale+placed.dy];
  }
  scene.regions.details=placed;
}

function backdrop(image,width,height){
  const baseFrame={x:0,y:0,w:width,h:height},box=image.boxes.window;
  const frame=box?{x:(box.cx-box.w/2)*width,y:(box.cy-box.h/2)*height,w:box.w*width,h:box.h*height}:baseFrame;
  const {asset}=image;
  const op={kind:'image',src:asset.src,...frame,source:imageCoverCrop(asset,frame,image),naturalWidth:asset.width,naturalHeight:asset.height};
  return {frame,baseFrame,op,layout:'window',width,height,backdrop:true};
}

function placeRows(rows,lanes,automatic,frame,custom){
  if(!custom)return rows;
  const sx=frame.w/automatic.w,sy=frame.h/automatic.h;
  return lanes.flatMap((lane,zone)=>{
    const group=rows.filter(row=>row.zone===zone);
    if(!group.length)return [];
    const y=group[0].y;
    const last=group.at(-1);
    const naturalHeight=last.y+last.h-y;
    const scale=Math.min(sy,lane.h/naturalHeight);
    const top=clamp(frame.y+(y-automatic.y)*sy,lane.y,lane.y+lane.h-naturalHeight*scale);
    return group.map(row=>{
      const w=Math.min(lane.w,row.w*sx);
      return {...row,w,h:row.h*scale,
        x:clamp(frame.x+(row.x-automatic.x)*sx,lane.x,lane.x+lane.w-w),
        y:top+(row.y-y)*scale,
      };
    });
  });
}

function makeLayout(rows,direction,phase,energy,profile,curve){
  const layouts=rows.map(row=>layoutTreatment(row.line,row,direction,phase,energy,profile,curve,{rowOffset:row.index}));
  let offset=0;
  const allRows=layouts.flatMap((layout,index)=>layout.rows.map(row=>{
    const cells=row.cells.map(cell=>({...cell,index:offset++,row:index}));
    return {...row,index,cells};
  }));
  const first=layouts[0];
  return {...first,rows:allRows,cells:allRows.flatMap(row=>row.cells)};
}


export function composePaperScene(scene,{cutout,text,colors,media,wrapMode,direction,phase,energy,lettering,headlineFrame,motionCurve,offsets}){
  const {width,height}=scene;
  const shapeId=cutoutId(cutout),shape=CUTOUTS[shapeId];
  const clip=paperPath(shapeId,width,height);
  scene.paperClip=clip;
  const footerOps=scene.ops;
  scene.ops=[];

  const image=normalizePosterImage(media);
  if(image){
    const typeRect={x:0,y:0,w:width,h:height*.7};
    let info=image.layout==='window'?backdrop(image,width,height):posterImageLayout(image,width,height,typeRect,scene.regions);
    if(image.layout==='cutout'&&!image.boxes.cutout){
      const area=paperImageArea(shape);
      const scale=Math.min(area.w*width*.88/image.asset.width,area.h*height*.92/image.asset.height);
      const w=image.asset.width*scale,h=image.asset.height*scale;
      const frame={x:(area.x+area.w/2)*width-w/2,y:(area.y+area.h/2)*height-h/2,w,h};
      info={...info,baseFrame:frame,frame,op:{...info.op,...frame}};
    }
    scene.media={...info,layout:image.layout,width,height};
    scene.regions.image=info.frame;
    if(info.backdrop)scene.ops.push(info.op);
  }
  scene.ops.push({kind:'path',d:clip,fill:colors.accent,rule:'evenodd'});

  const lanes=paperLanes(shapeId,width,height),automatic=union(lanes);
  const frameSettings=normalizeHeadlineFrame(headlineFrame);
  const frame=resolveHeadlineFrame(automatic,frameSettings,width,height);
  scene.regions.headline=frame;
  scene.regions.type={x:0,y:0,w:width,h:height};
  scene.headlinePlacement={rect:frame,automatic,source:{w:automatic.w,h:automatic.h},fit:frameSettings.fit,custom:Boolean(frameSettings.box)};
  const profile=treatmentSettings(direction,lettering);
  const wrapped=wrapHeadline(text,lanes,{...profile,wrapMode});
  const rows=placeRows(wrapped,lanes,automatic,frame,frameSettings.box).map((row,index)=>({...row,index}));
  const layout=atPhase=>makeLayout(rows,direction,atPhase,energy,profile,motionCurve);
  const letters=layout(phase);
  const key=JSON.stringify(['paper',rows,direction,energy,profile,motionCurve,offsets,width,height]);
  const pose=stableLetterPose(key,()=>layout(0),()=>layout(0),offsets,scene.regions.type);
  scene.baseCells=pose.referenceCells;
  scene.editCells=pose.restCells;
  if(pose.hasEdits)letters.cells=animateLetterPose(pose.restCells,pose.referenceCells,letters.cells,scene.regions.type);
  if(scene.media?.layout==='cutout'){
    scene.unreactedCells=letters.cells;
    letters.cells=reactTypeToCutout(letters.cells,scene.media.frame,image.asset.silhouette||getImageSilhouette(image.asset.src),automatic,image.reaction);
  }
  const start=scene.ops.length;
  if(letters.cells.length)appendTreatmentArtwork(scene,letters,{...colors,bg:colors.accent},scene.regions.type);
  for(let i=start;i<scene.ops.length;i++)scene.ops[i].paperClip=clip;
  scene.cells=letters.cells;
  if(scene.media?.layout==='cutout')scene.ops.push(scene.media.op);
  scene.ops.push(...footerOps);
  return scene;
}
