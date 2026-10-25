import './styles/studio.css';
import {HEADLINE_MAX_LENGTH} from './content-limits.js';
import {mountImageEditor} from './image-editor.js';
import {dragPosterImage,imageWithRect,scalePosterImage} from './poster-image.js';
import {normalizeLetterOffsets,dragLetterOffset,resizeLetterOffset,hitLetter} from './letter-drag.js';
import {FONT_CATALOG} from './font-library.js';
import {LAYOUT_PRESETS} from './composition.js';
import {treatmentSettings} from './treatment.js';
import {normalizeFooter,FOOTER_LIMITS,dragFooterItem,placeFooterItem,footerSettingsFromRect,alignFooterRect} from './footer-layout.js';
import {snapFooterRect} from './alignment.js';
import {LOOP_CURVES} from './loop-motion.js';
import {getVideoExportSupport,exportVideo} from './video-export.js';
import {mountEditorShell} from './editor-shell.js';
import {VISIBLE_DIRECTION_IDS,VISIBLE_FONT_IDS,VISIBLE_LAYOUT_IDS,VISIBLE_STYLE_IDS,VISIBLE_PALETTE_IDS,EDITOR_PRESETS,EDITOR_PALETTE_LABELS,retainCurrentOption} from './editor-config.js';
import {STUDIO_STORAGE_KEY,STUDIO_DEFAULTS,defaultStudioDrafts,normalizeStudioProject,studioProject,switchStudioTreatment} from './project-state.js';
import {TREATMENTS,PALETTES,FORMATS,cleanHeadline,cleanDetail,createPosterScene,preparePosterAssets,drawPosterScene,posterSVG,hitPosterImage} from './scene.js';

const $=selector=>document.querySelector(selector),canvas=$('#artwork'),ctx=canvas.getContext('2d');
$('#headline').maxLength=HEADLINE_MAX_LENGTH;
const params=new URLSearchParams(location.search);
const state={...STUDIO_DEFAULTS};
if(VISIBLE_DIRECTION_IDS.includes(params.get('direction')))state.direction=params.get('direction');
const drafts=defaultStudioDrafts();
let playing=false,dirty=true,last=0,view={scale:1,x:0,y:0,w:1,h:1},selected=null,selectedFooter=null,activeLayer='letters',hovered=null,hoveredFooter=null,drag=null,lastScene=null,ready=false,noticeTimer,snapGuides=[],guideUntil=0,editorShell=null,imageEditor=null,undoStack=[],redoStack=[],saveError=false,videoController=null,videoResult=null;
const chosen=()=>TREATMENTS.find(d=>d.id===state.direction);
const palette=()=>({...PALETTES.find(p=>p.id===state.palette),...state.customColors});
function announce(message){$('#status').textContent=message;$('#status').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#status').classList.remove('visible'),3200);}
function saveState(){
  try{localStorage.setItem(STUDIO_STORAGE_KEY,JSON.stringify(studioProject(state,drafts)));saveError=false;editorShell?.setSaveStatus('saved');}
  catch{editorShell?.setSaveStatus('error','Save failed');if(!saveError)announce('Device storage is full. Save a project file to keep your work.');saveError=true;}
}
try{
  const saved=localStorage.getItem(STUDIO_STORAGE_KEY);
  if(saved){const project=normalizeStudioProject(JSON.parse(saved));Object.assign(state,project.state);Object.assign(drafts,project.drafts);if(VISIBLE_DIRECTION_IDS.includes(params.get('direction')))switchStudioTreatment(state,drafts,params.get('direction'));}
}catch{}

for(const preset of EDITOR_PRESETS){const b=document.createElement('button');b.className='treatment-option';b.dataset.direction=preset.id;b.title=preset.description;b.setAttribute('aria-pressed',String(preset.id===state.direction));b.textContent=preset.label;b.addEventListener('click',()=>selectDirection(preset.id));$('.directions').append(b);}
for(const [id,f]of Object.entries(FORMATS))$('#format').add(new Option(f.name,id));
for(const curve of LOOP_CURVES)$('#motion-curve').add(new Option(curve.label,curve.id));
function syncCuratedChoices(){
  const current=drafts[state.direction].lettering;
  const populate=(id,catalog,ids,value,labels={})=>{const element=$('#'+id);element.replaceChildren(...retainCurrentOption(catalog,ids,value).map(item=>new Option(labels[item.id]||item.name||item.label,item.id)));};
  populate('type-font',FONT_CATALOG,VISIBLE_FONT_IDS,current.font);
  populate('type-layout',LAYOUT_PRESETS,VISIBLE_LAYOUT_IDS,current.layout);
  populate('type-style',[{id:'original',name:'Original'},{id:'jostle',name:'Jostle'}],VISIBLE_STYLE_IDS,current.style);
  populate('palette',PALETTES,VISIBLE_PALETTE_IDS,state.palette,EDITOR_PALETTE_LABELS);
}
function selectDirection(id){if(id===state.direction)return;imageEditor?.setCropping(false);rememberPose();switchStudioTreatment(state,drafts,id);snapGuides=[];activeLayer='letters';state.phase=0;playing=false;selected=hovered=null;selectedFooter=hoveredFooter=null;drag=null;canvas.classList.remove('dragging','resizing');sync();dirty=true;saveState();window.history.replaceState(null,'',`${location.pathname}?direction=${id}`);}
function sync(){
  if(state.media&&!state.media.freePlacement&&!state.media.boxes?.[state.media.layout]){const info=makeScene().media;state.media=imageWithRect(state.media,info.frame,info);}
  const d=chosen();for(const b of document.querySelectorAll('button[data-direction]'))b.setAttribute('aria-pressed',String(b.dataset.direction===d.id));
  syncCuratedChoices();$('#headline').value=drafts[d.id].headline;$('#detail').value=drafts[d.id].detail;$('#format').value=state.format;$('#palette').value=state.palette;$('#motion-curve').value=state.motionCurve;$('#energy').value=state.energy*100;$('#energy-value').value=Math.round(state.energy*100);$('#snapping').checked=state.snapping;
  imageEditor?.sync();syncHeadlineCount();syncColors();syncTransport();syncLetteringControls();syncFooterControls();syncPoseControls();dirty=true;
}
function syncHeadlineCount(){$('#headline-count').textContent=`${$('#headline').value.length} / ${HEADLINE_MAX_LENGTH}`;}
function syncLetteringControls(){
  const settings=drafts[state.direction].lettering;
  for(const key of ['font','style','render','layout'])$('#type-'+key).value=settings[key];
  for(const key of ['contrast','variation']){const value=Math.round(settings[key]*100);$('#type-'+key).value=value;$('#'+key+'-value').value=value;}
  const line=settings.render==='line',control=$('#type-pressure');control.min=line?.5:0;control.max=line?32:100;control.step=line?.5:1;control.value=line?settings.strokeWidth:settings.pressure*100;
  $('#pressure-value').value=line?`${settings.strokeWidth} px`:Math.round(settings.pressure*100);$('#type-pressure-label').textContent=line||settings.mode==='flex'?'Stroke':'Inflation';
}
function editLettering(key,value){
  playing=false;syncTransport();
  const settings={...drafts[state.direction].lettering,[key]:value};
  drafts[state.direction].lettering=treatmentSettings(state.direction,settings);
  syncLetteringControls();dirty=true;saveState();
}
for(const key of ['font','style','render','layout'])$('#type-'+key).addEventListener('change',event=>{editLettering(key,event.target.value);});
for(const key of ['contrast','pressure','variation']){
  $('#type-'+key).addEventListener('input',event=>{const stroke=key==='pressure'&&drafts[state.direction].lettering.render==='line';editLettering(stroke?'strokeWidth':key,Number(event.target.value)/(stroke?1:100));});
}
$('#reset-type').addEventListener('click',()=>{rememberPose();drafts[state.direction].lettering=treatmentSettings(state.direction);playing=false;syncTransport();syncLetteringControls();dirty=true;saveState();});
const footerAlignments=[
  {id:'left',label:'Left',axis:'x',icon:'M3 2v14M6 5h8v3H6zM6 11h5v3H6z'},
  {id:'center',label:'Centre',axis:'x',icon:'M9 2v2M9 9v1M9 15v1M3 5h12v3H3zM5 11h8v3H5z'},
  {id:'right',label:'Right',axis:'x',icon:'M15 2v14M4 5h8v3H4zM7 11h5v3H7z'},
  {id:'top',label:'Top',axis:'y',icon:'M2 3h14M5 6h3v8H5zM11 6h3v5h-3z'},
  {id:'middle',label:'Middle',axis:'y',icon:'M2 9h2M9 9h1M15 9h1M5 3h3v12H5zM11 5h3v8h-3z'},
  {id:'bottom',label:'Bottom',axis:'y',icon:'M2 15h14M5 4h3v8H5zM11 7h3v5h-3z'},
];
for(const part of ['text','logo']){
  const label=part==='text'?'Supporting text':'Logo',fields=document.querySelector(`[data-footer-part="${part}"] .footer-fields`);
  for(const [key,title]of [['size','Size']]){
    const limits=FOOTER_LIMITS[key],id=`footer-${part}-${key}`,row=document.createElement('div');row.className='footer-range';
    row.innerHTML=`<label for="${id}">${title}</label><span><input type="number" id="${id}-number" min="${limits.min}" max="${limits.max}" step="${limits.step}" aria-label="${label} ${title.toLowerCase()} percent">%</span><input type="range" id="${id}" min="${limits.min}" max="${limits.max}" step="${limits.step}" aria-label="${label} ${title.toLowerCase()}">`;
    fields.append(row);
    for(const suffix of ['','-number']){
      const input=$('#'+id+suffix);let recorded=false;
      input.addEventListener('focus',()=>recorded=false);input.addEventListener('pointerdown',()=>recorded=false);
      input.addEventListener('input',()=>{
        if(input.value===''||!Number.isFinite(input.valueAsNumber))return;
        const footer=drafts[state.direction].footer;
        if(!recorded){rememberPose();recorded=true;}
        footer[part][key]=Math.max(limits.min,Math.min(limits.max,input.valueAsNumber));
        syncFooterControls(input);syncPoseControls();dirty=true;saveState();
      });
      input.addEventListener('change',()=>{recorded=false;syncFooterControls();});
      input.addEventListener('blur',()=>syncFooterControls());
    }
  }
  if(part==='text'){
    const textAlignment=document.createElement('div');textAlignment.className='text-alignment';
    textAlignment.innerHTML='<span class="field-label">Text alignment</span><div class="alignment-buttons" role="group" aria-label="Supporting text line alignment"></div>';
    for(const [id,label,icon]of [
      ['left','Left','M3 4h12M3 8h8M3 12h12M3 16h8'],
      ['center','Centre','M3 4h12M5 8h8M3 12h12M5 16h8'],
      ['right','Right','M3 4h12M7 8h8M3 12h12M7 16h8'],
    ]){
      const button=document.createElement('button');button.type='button';button.dataset.textAlign=id;
      button.setAttribute('aria-label',`Align text lines ${label.toLowerCase()}`);button.setAttribute('aria-pressed','false');
      button.innerHTML=`<svg viewBox="0 0 18 20" aria-hidden="true"><path d="${icon}"/></svg><span>${label}</span>`;
      button.addEventListener('click',()=>{
        const text=drafts[state.direction].footer.text;if(text.align===id)return;
        rememberPose();text.align=id;selectFooter('text',false);syncFooterControls();dirty=true;saveState();
      });
      textAlignment.querySelector('.alignment-buttons').append(button);
    }
    fields.append(textAlignment);
  }
  const alignment=document.createElement('div');alignment.className='footer-alignment';
  alignment.innerHTML='<span class="field-label">Align to poster</span>';
  for(const axis of ['x','y']){
    const group=document.createElement('div');group.className='alignment-buttons';group.setAttribute('role','group');group.setAttribute('aria-label',`${label} ${axis==='x'?'horizontal':'vertical'} alignment`);
    for(const option of footerAlignments.filter(option=>option.axis===axis)){
      const button=document.createElement('button');button.type='button';button.dataset.footerAlign=option.id;button.dataset.footerTarget=part;
      button.setAttribute('aria-label',`Align ${label.toLowerCase()} ${option.label.toLowerCase()}`);button.setAttribute('aria-pressed','false');
      button.title=['center','middle'].includes(option.id)?`Align to poster ${option.label.toLowerCase()}`:`Align to poster ${option.label.toLowerCase()} margin`;
      button.innerHTML=`<svg viewBox="0 0 18 18" aria-hidden="true"><path d="${option.icon}"/></svg><span>${option.label}</span>`;
      button.addEventListener('click',()=>alignFooter(part,option));group.append(button);
    }
    alignment.append(group);
  }
  fields.append(alignment);
}
function syncFooterControls(active=null){
  const footer=drafts[state.direction].footer;
  for(const part of ['text','logo'])for(const key of ['size'])for(const suffix of ['','-number']){
    const input=$(`#footer-${part}-${key}${suffix}`);if(input!==active)input.value=Math.round(footer[part][key]*10)/10;
  }
  for(const button of document.querySelectorAll('[data-text-align]'))button.setAttribute('aria-pressed',String(button.dataset.textAlign===(footer.text.align||'left')));
}
function syncFooterAlignment(scene){
  for(const button of document.querySelectorAll('[data-footer-align]')){
    const rect=scene.regions[button.dataset.footerTarget==='text'?'details':'logo'],valid=rect?.w>0&&rect.h>0;
    button.disabled=!valid;
    const target=valid&&alignFooterRect(rect,scene.width,scene.height,scene.margin,button.dataset.footerAlign);
    button.setAttribute('aria-pressed',String(valid&&Math.abs(target.x-rect.x)<.05&&Math.abs(target.y-rect.y)<.05));
  }
}
function alignFooter(part,option){
  const scene=makeScene(),rect=scene.regions[part==='text'?'details':'logo'];
  if(!(rect?.w>0&&rect.h>0))return;
  const box=alignFooterRect(rect,scene.width,scene.height,scene.margin,option.id);
  if(Math.abs(box[option.axis]-rect[option.axis])>.001){
    rememberPose();
    const aligned=footerSettingsFromRect(scene.footerBases[part],box,scene.width,scene.height);
    drafts[state.direction].footer[part][option.axis]=aligned[option.axis];
    saveState();
  }
  selectFooter(part,false);
  const offset=['center','middle'].includes(option.id)?.5:['right','bottom'].includes(option.id)?1:0;
  snapGuides=[{axis:option.axis,value:box[option.axis]+(option.axis==='x'?box.w:box.h)*offset,start:0,end:option.axis==='x'?scene.height:scene.width}];
  guideUntil=performance.now()+900;dirty=true;
}
function resetFooter(part){
  rememberPose();const defaults=normalizeFooter();
  if(part)drafts[state.direction].footer[part]=defaults[part];else drafts[state.direction].footer=defaults;
  syncFooterControls();syncPoseControls();dirty=true;saveState();
}
$('#align-footer').addEventListener('click',()=>{rememberPose();for(const part of ['text','logo']){drafts[state.direction].footer[part].x=0;drafts[state.direction].footer[part].y=0;}syncFooterControls();syncPoseControls();dirty=true;saveState();});
for(const button of document.querySelectorAll('[data-reset-footer]'))button.addEventListener('click',()=>resetFooter(button.dataset.resetFooter));
function syncColors(){const p=palette();$('#palette-swatches').replaceChildren();for(const [key,title]of [['bg','Field'],['fg','Type'],['accent','Accent']]){const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=p[key];swatch.title=`${title} ${p[key]}`;$('#palette-swatches').append(swatch);$('#custom-'+key).value=p[key];}}
function syncTransport(){$('#timeline').value=Math.round(state.phase*1000);$('#time').textContent=(state.phase*8).toFixed(1)+' / 8s';$('#play').setAttribute('aria-label',playing?'Pause motion':'Play motion');$('#play-symbol').textContent=playing?'Ⅱ':'▶';$('#loop').checked=state.loop;}
function fit(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);view.w=r.width;view.h=r.height;view.dpr=dpr;dirty=true;}
function makeScene(override={}){return createPosterScene({...state,...drafts[state.direction],pointer:null,...override});}
function footerRect(part){return lastScene?.regions[part==='text'?'details':'logo'];}
function footerHandles(rect){const pad=4/view.scale;return [
  {corner:'nw',x:rect.x-pad,y:rect.y-pad},{corner:'ne',x:rect.x+rect.w+pad,y:rect.y-pad},
  {corner:'se',x:rect.x+rect.w+pad,y:rect.y+rect.h+pad},{corner:'sw',x:rect.x-pad,y:rect.y+rect.h+pad},
];}
function imageHandles(){
  if(!lastScene?.media||imageEditor?.isCropping())return [];
  const rect=lastScene.media.frame,handles=footerHandles(rect).map(h=>({...h,handle:h.corner}));
  if(state.media.layout==='window'){
    const pad=4/view.scale;
    if(rect.w*view.scale>45)handles.push({handle:'n',x:rect.x+rect.w/2,y:rect.y-pad},{handle:'s',x:rect.x+rect.w/2,y:rect.y+rect.h+pad});
    if(rect.h*view.scale>45)handles.push({handle:'w',x:rect.x-pad,y:rect.y+rect.h/2},{handle:'e',x:rect.x+rect.w+pad,y:rect.y+rect.h/2});
  }
  return handles;
}
function imageHandleHit(point,pointerType='mouse'){
  if(activeLayer!=='image')return null;
  const radius=(pointerType==='touch'?15:9)/view.scale;
  return imageHandles().filter(h=>Math.hypot(point.x-h.x,point.y-h.y)<radius).sort((a,b)=>Math.hypot(point.x-a.x,point.y-a.y)-Math.hypot(point.x-b.x,point.y-b.y))[0]||null;
}
function letterHandles(cell){
  const pad=4/view.scale,left=cell.x-pad,right=cell.x+cell.w+pad,top=cell.y-pad,bottom=cell.y+cell.h+pad;
  const handles=[{handle:'nw',x:left,y:top},{handle:'ne',x:right,y:top},{handle:'se',x:right,y:bottom},{handle:'sw',x:left,y:bottom}];
  if(cell.w*view.scale>30)handles.push({handle:'n',x:(left+right)/2,y:top},{handle:'s',x:(left+right)/2,y:bottom});
  if(cell.h*view.scale>30)handles.push({handle:'w',x:left,y:(top+bottom)/2},{handle:'e',x:right,y:(top+bottom)/2});
  return handles;
}
function letterHandleHit(p,pointerType='mouse'){
  if(selectedFooter||!lastScene)return null;
  const radius=(pointerType==='touch'?14:8)/view.scale;
  for(const index of new Set([selected,hovered])){
    const cell=lastScene.cells.find(c=>c.index===index);if(!cell)continue;
    const h=letterHandles(cell).filter(h=>Math.hypot(p.x-h.x,p.y-h.y)<=radius).sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];
    if(h)return {cell,handle:h.handle};
  }
  return null;
}
function drawLetterSelection(cell,active){
  if(!cell)return;const pad=4/view.scale,size=6/view.scale;ctx.save();ctx.strokeStyle=active?'#1769E0':'#1769E088';ctx.lineWidth=1/view.scale;ctx.fillStyle='#FFFFFF';
  ctx.strokeRect(cell.x-pad,cell.y-pad,cell.w+pad*2,cell.h+pad*2);
  for(const h of letterHandles(cell)){ctx.fillRect(h.x-size/2,h.y-size/2,size,size);ctx.strokeRect(h.x-size/2,h.y-size/2,size,size);}
  ctx.restore();
}
function drawAlignmentGuides(){
  if(drag?.kind==='footer'&&state.snapping&&!drag.free){ctx.save();ctx.strokeStyle='#D52F8740';ctx.lineWidth=1/view.scale;ctx.setLineDash([3/view.scale,5/view.scale]);const m=lastScene.margin;ctx.strokeRect(m,m,lastScene.width-2*m,lastScene.height-2*m);ctx.restore();}
  if(!snapGuides.length)return;
  ctx.save();ctx.strokeStyle='#D52F87';ctx.fillStyle='#D52F87';ctx.lineWidth=1/view.scale;ctx.font=`${10/view.scale}px Inter,Arial,sans-serif`;
  for(const guide of snapGuides){
    const over=6/view.scale;ctx.beginPath();
    if(guide.axis==='x'){ctx.moveTo(guide.value,guide.start-over);ctx.lineTo(guide.value,guide.end+over);}else{ctx.moveTo(guide.start-over,guide.value);ctx.lineTo(guide.end+over,guide.value);}ctx.stroke();

  }
  ctx.restore();
}
function footerHit(p,pointerType='mouse'){
  if(!lastScene)return null;
  const active=selectedFooter&&footerRect(selectedFooter),radius=(pointerType==='touch'?16:10)/view.scale;
  if(active?.w>0&&active.h>0){const handle=footerHandles(active).find(h=>Math.hypot(p.x-h.x,p.y-h.y)<=radius);if(handle)return {part:selectedFooter,corner:handle.corner};}
  const pad=(pointerType==='touch'?10:5)/view.scale;
  for(const part of ['logo','text']){const r=footerRect(part);if(r?.w>0&&r.h>0&&p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad)return {part,corner:null};}
  return null;
}
const resizeCursor=corner=>corner==='n'||corner==='s'?'ns-resize':corner==='e'||corner==='w'?'ew-resize':corner==='nw'||corner==='se'?'nwse-resize':'nesw-resize';
function drawFooterSelection(part,active){
  const rect=footerRect(part);if(!rect?.w||!rect.h)return;
  const pad=4/view.scale;ctx.save();ctx.lineWidth=1/view.scale;ctx.strokeStyle=active?'#1769E0':'#1769E099';
  if(!active)ctx.setLineDash([3/view.scale,3/view.scale]);ctx.strokeRect(rect.x-pad,rect.y-pad,rect.w+pad*2,rect.h+pad*2);
  if(active){ctx.fillStyle='#FFFFFF';const size=7/view.scale;for(const h of footerHandles(rect)){ctx.fillRect(h.x-size/2,h.y-size/2,size,size);ctx.strokeRect(h.x-size/2,h.y-size/2,size,size);}}
  ctx.restore();
}
function render(){
  if(!ready)return;lastScene=makeScene();imageEditor?.sync();syncFooterAlignment(lastScene);const pad=28;
  view.scale=Math.min((view.w-pad*2)/lastScene.width,(view.h-pad*2)/lastScene.height);view.x=(view.w-lastScene.width*view.scale)/2;view.y=(view.h-lastScene.height*view.scale)/2;
  ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.clearRect(0,0,view.w,view.h);ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);
  ctx.save();ctx.beginPath();ctx.rect(0,0,lastScene.width,lastScene.height);ctx.clip();drawPosterScene(ctx,lastScene);ctx.restore();
  if(!playing){
    drawAlignmentGuides();
    const active=lastScene.cells.find(c=>c.index===selected);
    if(activeLayer==='image'&&lastScene.media){const r=lastScene.media.frame,pad=4/view.scale,size=7/view.scale;ctx.save();ctx.strokeStyle='#1769E0';ctx.fillStyle='#FFFFFF';ctx.lineWidth=1/view.scale;ctx.strokeRect(r.x-pad,r.y-pad,r.w+pad*2,r.h+pad*2);for(const h of imageHandles()){ctx.fillRect(h.x-size/2,h.y-size/2,size,size);ctx.strokeRect(h.x-size/2,h.y-size/2,size,size);}ctx.restore();}
    if(!selectedFooter&&activeLayer!=='image'){if(active)drawLetterSelection(active,true);else if(hovered!==null)drawLetterSelection(lastScene.cells.find(c=>c.index===hovered),false);}
    if(selectedFooter)drawFooterSelection(selectedFooter,true);else if(hoveredFooter)drawFooterSelection(hoveredFooter,false);
  }
  dirty=false;
}
function tick(now){if(!drag&&snapGuides.length&&now>guideUntil){snapGuides=[];dirty=true;}const elapsed=Math.max(0,(now-last)/1000||.016);last=now;if(!document.hidden){if(playing){state.phase+=elapsed/8;if(state.phase>=1){if(state.loop)state.phase%=1;else{state.phase=1;playing=false;saveState();}}dirty=true;syncTransport();}if(dirty)render();}requestAnimationFrame(tick);}


$('#play').addEventListener('click',()=>{if(state.phase>=.999)state.phase=0;playing=!playing;syncTransport();dirty=true;if(!playing)saveState();});
$('#timeline').addEventListener('input',event=>{const phase=Number(event.target.value)/1000;playing=false;state.phase=phase;selected=null;syncTransport();dirty=true;saveState();});
$('#motion-curve').addEventListener('change',event=>{state.motionCurve=event.target.value;dirty=true;saveState();});
$('#loop').addEventListener('change',event=>{state.loop=event.target.checked;saveState();});
$('#format').addEventListener('change',event=>{state.format=event.target.value;dirty=true;saveState();});
$('#palette').addEventListener('change',event=>{state.palette=event.target.value;state.customColors=null;syncColors();dirty=true;saveState();});
$('#headline').addEventListener('input',event=>{activeLayer='letters';selectedFooter=null;const clean=cleanHeadline(event.target.value);drafts[state.direction].headline=clean;drafts[state.direction].offsets=[];selected=null;syncPoseControls();if(event.target.value!==clean)event.target.value=clean;syncHeadlineCount();dirty=true;saveState();});
$('#detail').addEventListener('input',event=>{drafts[state.direction].detail=cleanDetail(event.target.value);if(event.target.value!==drafts[state.direction].detail)event.target.value=drafts[state.direction].detail;dirty=true;saveState();});
$('#energy').addEventListener('input',event=>{state.energy=Number(event.target.value)/100;$('#energy-value').value=Math.round(state.energy*100);dirty=true;saveState();});
for(const key of ['bg','fg','accent'])$('#custom-'+key).addEventListener('input',event=>{const p=palette();state.customColors={bg:p.bg,fg:p.fg,accent:p.accent,[key]:event.target.value};syncColors();dirty=true;saveState();});
$('#reset-colors').addEventListener('click',()=>{rememberPose();state.customColors=null;syncColors();dirty=true;saveState();});
function point(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left-view.x)/view.scale,y:(event.clientY-r.top-view.y)/view.scale};}
function syncPoseControls(){
  $('#undo-pose').disabled=!undoStack.length;$('#redo-pose').disabled=!redoStack.length;
  const cell=lastScene?.cells.find(c=>c.index===selected);
  if(activeLayer==='image'&&state.media){
    $('#reset-pose').disabled=true;$('#drag-note').textContent=imageEditor?.isCropping()?'Crop mode · drag to reframe · Esc to finish':'Image selected · drag to move · handles resize';
  }else if(selectedFooter){
    const item=drafts[state.direction].footer[selectedFooter],name=selectedFooter==='text'?'Supporting text':'Logo';
    $('#reset-pose').disabled=item.size===100&&item.x===0&&item.y===0;
    $('#reset-pose').textContent=selectedFooter==='text'?'Reset text':'Reset logo';
    $('#drag-note').textContent=`${name} selected · corners resize · arrows move`;
  }else{
    $('#reset-pose').disabled=!drafts[state.direction].offsets.some(Boolean);$('#reset-pose').textContent='Reset letters';
    $('#drag-note').textContent=cell?`${cell.char} · drag to move · handles reshape`:'Drag to move · pull a handle to reshape.';
  }
  syncSelectionUI(false);
}
function captureEdit(){return {project:studioProject(state,drafts),selection:{selected,selectedFooter,activeLayer}};}
function restoreEdit(edit){
  Object.assign(state,edit.project.state);Object.assign(drafts,structuredClone(edit.project.drafts));playing=false;drag=null;snapGuides=[];
  selected=edit.selection.selected;selectedFooter=edit.selection.selectedFooter;activeLayer=edit.selection.activeLayer;
  sync();preparePosterAssets(state.media?.asset).then(()=>dirty=true).catch(error=>announce(error.message));saveState();window.history.replaceState(null,'',`${location.pathname}?direction=${state.direction}`);
}
function rememberPose(){undoStack.push(captureEdit());if(undoStack.length>60)undoStack.shift();redoStack=[];syncPoseControls();}
function undoEdit(){const previous=undoStack.pop();if(!previous)return;redoStack.push(captureEdit());restoreEdit(previous);}
function redoEdit(){const next=redoStack.pop();if(!next)return;undoStack.push(captureEdit());restoreEdit(next);}
function syncSelectionUI(showProperties=false){
  const letter=lastScene?.cells.find(c=>c.index===selected);
  editorShell?.syncSelection(activeLayer,activeLayer==='letters'?(letter?`Letter ${letter.char}`:'Headline'):undefined,{showProperties});
}
function chooseEditorLayer(layer){
  if(layer!=='image'&&imageEditor?.isCropping())imageEditor.setCropping(false);
  if(layer==='text'||layer==='logo'){selectFooter(layer,false);return;}
  activeLayer=layer;selectedFooter=null;selected=layer==='letters'?(selected??lastScene?.cells[0]?.index??null):null;playing=false;syncTransport();syncPoseControls();syncSelectionUI(true);dirty=true;
}
function selectFooter(part,focusCanvas=true){if(imageEditor?.isCropping())imageEditor.setCropping(false);activeLayer=part;selectedFooter=part;selected=null;playing=false;syncTransport();syncPoseControls();syncSelectionUI(true);dirty=true;if(focusCanvas)canvas.focus({preventScroll:true});}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||!lastScene)return;
  snapGuides=[];const priorRedo=redoStack;const p=point(event),imageHandle=imageHandleHit(p,event.pointerType),letterHandle=imageHandle?null:letterHandleHit(p,event.pointerType),item=imageHandle||letterHandle?null:footerHit(p,event.pointerType);
  if(item){
    selectFooter(item.part);
    drag={kind:'footer',id:event.pointerId,start:p,part:item.part,corner:item.corner,visible:{...footerRect(item.part)},base:structuredClone(lastScene.footerBases[item.part]),width:lastScene.width,height:lastScene.height,margin:lastScene.margin,other:{...footerRect(item.part==='text'?'logo':'text')},footer:structuredClone(drafts[state.direction].footer),moved:false};
    if(item.corner){canvas.style.setProperty('--resize-cursor',resizeCursor(item.corner));canvas.classList.add('resizing');}
  }else if(imageHandle||!letterHandle&&hitPosterImage(lastScene,p,{includeTransparent:activeLayer==='image'})&&(lastScene.media.layout==='cutout'||activeLayer==='image'||!hitLetter(lastScene.cells,p))){
    chooseEditorLayer('image');hovered=hoveredFooter=null;drag={kind:'image',id:event.pointerId,start:p,media:state.media,info:lastScene.media,crop:imageEditor.isCropping(),handle:imageHandle?.handle||null,moved:false};
    if(drag.handle){canvas.style.setProperty('--resize-cursor',resizeCursor(drag.handle));canvas.classList.add('resizing');}
  }else{
    const cell=letterHandle?.cell||hitLetter(lastScene.cells,p);selectedFooter=null;hoveredFooter=null;
    if(imageEditor.isCropping())imageEditor.setCropping(false);
    if(!cell){selected=null;activeLayer='poster';syncPoseControls();syncSelectionUI(true);dirty=true;return;}
    playing=false;syncTransport();activeLayer='letters';selected=cell.index;
    const source=lastScene.unreactedCells?.find(item=>item.index===cell.index)||cell;
    drag={kind:'letter',id:event.pointerId,start:p,visible:{...source},motionScale:{x:Math.max(.55,cell.w/source.w),y:Math.max(.55,cell.h/source.h)},base:{...lastScene.baseCells.find(c=>c.index===cell.index)},bounds:{...lastScene.regions.type},handle:letterHandle?.handle||null,offsets:structuredClone(drafts[state.direction].offsets),moved:false};
  }
  drag.priorRedo=priorRedo;syncSelectionUI(true);
  if(drag.kind==='letter'&&drag.handle){canvas.style.setProperty('--resize-cursor',resizeCursor(drag.handle));canvas.classList.add('resizing');}
  canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');canvas.focus({preventScroll:true});syncPoseControls();dirty=true;event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
  const p=point(event);
  if(!drag){
    const imageHandle=imageHandleHit(p,event.pointerType),handle=imageHandle?null:letterHandleHit(p,event.pointerType),item=imageHandle||handle?null:footerHit(p,event.pointerType),cell=handle?.cell||(item?null:lastScene&&hitLetter(lastScene.cells,p));
    if(hoveredFooter!==(item?.part??null)||hovered!==(cell?.index??null))dirty=true;
    hoveredFooter=item?.part??null;hovered=cell?.index??null;
    const image=hitPosterImage(lastScene,p,{includeTransparent:activeLayer==='image'})&&(lastScene.media.layout==='cutout'||activeLayer==='image'||!cell);
    canvas.style.cursor=imageHandle?resizeCursor(imageHandle.handle):image?'grab':handle?resizeCursor(handle.handle):item?.corner?resizeCursor(item.corner):item||cell?'grab':'default';return;
  }
  if(event.pointerId!==drag.id)return;
  if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<1/view.scale&&!drag.moved)return;
  if(!drag.moved){rememberPose();drag.moved=true;}
  if(drag.kind==='image'){
    state.media=dragPosterImage(drag.media,drag.info,drag.start,p,{crop:drag.crop,handle:drag.handle});snapGuides=[];
    if(state.snapping&&!event.altKey&&!drag.crop&&!drag.handle){
      const box=state.media.boxes[state.media.layout],width=drag.info.width,height=drag.info.height,w=box.w*width,h=state.media.layout==='cutout'?w*state.media.asset.height/state.media.asset.width:box.h*height;
      const info={...drag.info,frame:{x:box.cx*width-w/2,y:box.cy*height-h/2,w,h}};
      const snapped=snapFooterRect(info.frame,{width:info.width,height:info.height,margin:lastScene.margin,other:lastScene.regions.details,tolerance:7/view.scale,allowOverflow:true});
      state.media=imageWithRect(state.media,snapped.rect,info);snapGuides=snapped.guides;
    }
    imageEditor.sync();
  }else if(drag.kind==='footer'){
    let settings=dragFooterItem(drag.base,drag.visible,drag.width,drag.height,drag.start,p,drag.corner);drag.free=event.altKey;
    snapGuides=[];
    if(state.snapping&&!event.altKey){
      const rect=placeFooterItem(drag.base.rect,settings,drag.width,drag.height,drag.base.anchor),actualSize=drag.visible.w/drag.base.rect.w*100;
      const snapped=snapFooterRect(rect,{width:drag.width,height:drag.height,margin:drag.margin,other:drag.other,tolerance:7/view.scale,corner:drag.corner,origin:drag.visible,minScale:FOOTER_LIMITS.size.min/actualSize,maxScale:FOOTER_LIMITS.size.max/actualSize});
      settings=footerSettingsFromRect(drag.base,snapped.rect,drag.width,drag.height);snapGuides=snapped.guides;
    }
    Object.assign(drafts[state.direction].footer[drag.part],settings);syncFooterControls();
  }else{
    const target={x:drag.start.x+(p.x-drag.start.x)/drag.motionScale.x,y:drag.start.y+(p.y-drag.start.y)/drag.motionScale.y};
    const offsets=structuredClone(drag.offsets);offsets[drag.visible.index]=drag.handle?resizeLetterOffset(drag.base,drag.visible,drag.start,target,drag.bounds,drag.handle):dragLetterOffset(drag.base,drag.visible,drag.start,target,drag.bounds,'move');drafts[state.direction].offsets=offsets;
  }
  syncPoseControls();dirty=true;
});
function releaseDrag(cancel=false){
  if(!drag)return;const previous=drag;drag=null;guideUntil=performance.now()+850;if(cancel)snapGuides=[];canvas.classList.remove('dragging','resizing');
  if(canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);
  if(cancel&&previous.moved){
    if(previous.kind==='image')state.media=previous.media;else if(previous.kind==='footer')drafts[state.direction].footer=previous.footer;else drafts[state.direction].offsets=previous.offsets;
    undoStack.pop();redoStack=previous.priorRedo||[];
  }
  imageEditor.sync();syncFooterControls();syncPoseControls();dirty=true;saveState();
}
canvas.addEventListener('dblclick',event=>{if(state.media?.layout==='window'&&hitPosterImage(lastScene,point(event))){event.preventDefault();chooseEditorLayer('image');imageEditor.setCropping(!imageEditor.isCropping());}});
canvas.addEventListener('pointerup',()=>releaseDrag());canvas.addEventListener('pointercancel',()=>releaseDrag(true));canvas.addEventListener('lostpointercapture',()=>releaseDrag(true));
canvas.addEventListener('pointerleave',()=>{if(!drag){hovered=hoveredFooter=null;canvas.style.cursor='default';dirty=true;}});
canvas.addEventListener('keydown',event=>{
  if(event.key==='Alt'&&drag){drag.free=true;snapGuides=[];dirty=true;return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(drag)releaseDrag(true);else if(event.shiftKey)redoEdit();else undoEdit();return;}
  if(event.code==='Space'){event.preventDefault();$('#play').click();return;}
  if(event.key==='Escape'){
    if(drag){event.preventDefault();event.stopPropagation();releaseDrag(true);}
    else if(imageEditor.isCropping()){event.preventDefault();event.stopPropagation();imageEditor.setCropping(false);}
    else if(selectedFooter||selected!==null||activeLayer==='image'){event.preventDefault();event.stopPropagation();selectedFooter=null;selected=null;activeLayer='poster';snapGuides=[];syncPoseControls();dirty=true;}
    return;
  }
  if(activeLayer==='image'&&state.media&&lastScene.media){
    const arrow=event.key.startsWith('Arrow'),resize=['+','=','-','_'].includes(event.key);if(!arrow&&!resize)return;
    event.preventDefault();rememberPose();playing=false;syncTransport();
    if(arrow){const step=event.shiftKey?10:1;state.media=dragPosterImage(state.media,lastScene.media,{x:0,y:0},{x:event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,y:event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0},{crop:imageEditor.isCropping()});}
    else{const delta=['-','_'].includes(event.key)?-.02:.02;if(imageEditor.isCropping())state.media={...state.media,zoom:Math.max(1,Math.min(4,state.media.zoom+delta))};else state.media=scalePosterImage(state.media,lastScene.media,lastScene.media.frame.w/lastScene.media.baseFrame.w+delta);}
    imageEditor.sync();syncPoseControls();dirty=true;saveState();return;
  }
  if(selectedFooter&&lastScene){
    const arrow=event.key.startsWith('Arrow'),resize=['+','=','-','_'].includes(event.key);if(!arrow&&!resize)return;
    event.preventDefault();playing=false;syncTransport();rememberPose();
    const rect=footerRect(selectedFooter),base=lastScene.footerBases[selectedFooter];
    const step=event.shiftKey?10:1,delta={x:0,y:0};
    if(arrow){delta.x=event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0;delta.y=event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0;}
    else{const factor=(event.key==='-'||event.key==='_')?-.02:.02;delta.x=rect.w*factor;delta.y=rect.h*factor;}
    Object.assign(drafts[state.direction].footer[selectedFooter],dragFooterItem(base,rect,lastScene.width,lastScene.height,{x:0,y:0},delta,resize?'se':null));
    syncFooterControls();syncPoseControls();dirty=true;saveState();return;
  }
  if(!lastScene?.cells.length)return;
  if(event.key==='['||event.key===']'){event.preventDefault();const current=lastScene.cells.findIndex(c=>c.index===selected);selected=lastScene.cells[(current+(event.key===']'?1:-1)+lastScene.cells.length)%lastScene.cells.length].index;activeLayer='letters';syncPoseControls();dirty=true;return;}
  const resize=['+','=','-','_'].includes(event.key);if(activeLayer==='poster'||!event.key.startsWith('Arrow')&&!resize)return;event.preventDefault();playing=false;syncTransport();
  const cell=lastScene.cells.find(c=>c.index===selected)||lastScene.cells[0];selected=cell.index;activeLayer='letters';
  const base=lastScene.baseCells.find(c=>c.index===cell.index),b=lastScene.regions.type,step=Math.min(b.w,b.h)*(event.shiftKey?.035:.01),factor=(event.key==='-'||event.key==='_')?-.02:.02;
  const delta=resize?{x:cell.w*factor,y:cell.h*factor}:{x:event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,y:event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0};
  const source=lastScene.unreactedCells?.find(item=>item.index===cell.index)||cell;
  const target={x:delta.x/Math.max(.55,cell.w/source.w),y:delta.y/Math.max(.55,cell.h/source.h)};
  rememberPose();drafts[state.direction].offsets[cell.index]=resize?resizeLetterOffset(base,source,{x:0,y:0},target,b,'se'):dragLetterOffset(base,source,{x:0,y:0},target,b,'move');syncPoseControls();dirty=true;saveState();
});
$('#snapping').addEventListener('change',event=>{state.snapping=event.target.checked;snapGuides=[];dirty=true;saveState();});
$('#undo-pose').addEventListener('click',undoEdit);$('#redo-pose').addEventListener('click',redoEdit);
$('#reset-pose').addEventListener('click',()=>{rememberPose();if(selectedFooter)drafts[state.direction].footer[selectedFooter]=normalizeFooter()[selectedFooter];else drafts[state.direction].offsets=[];selected=null;syncFooterControls();syncPoseControls();dirty=true;saveState();});
function focusArtwork(value){
  document.body.classList.toggle('focus',value);$('#focus').setAttribute('aria-expanded',String(value));
  for(const element of document.querySelectorAll('.app-header,.inspector-shell,.workspace-toolbar,.canvas-status,.transport'))element.inert=value;
  fit();if(value)canvas.focus();else $('#focus').focus();
}
$('#focus').addEventListener('click',()=>focusArtwork(true));$('#close-focus').addEventListener('click',()=>focusArtwork(false));
document.addEventListener('keydown',event=>{
  if($('#video-dialog').open)return;
  if(event.key==='Tab'&&document.body.classList.contains('focus')){event.preventDefault();(document.activeElement===canvas?$('#close-focus'):canvas).focus();return;}
  if(!event.defaultPrevented&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.target.matches('textarea,[contenteditable=true],input[type=text],input[type=number],input:not([type])')){event.preventDefault();if(event.shiftKey)redoEdit();else undoEdit();}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();$('#save-project').click();}
  if(event.key==='Escape'&&imageEditor.isCropping()){imageEditor.setCropping(false);event.preventDefault();}
  else if(event.key==='Escape'&&document.body.classList.contains('focus'))focusArtwork(false);});

function download(blob,extension){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`maker-faire-kochi-${state.direction}-${state.format}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);announce(extension==='json'?'Project file ready.':`${extension.toUpperCase()} ready.`);}
$('#export-svg').addEventListener('click',()=>{const scene=makeScene();download(new Blob([posterSVG(scene)],{type:'image/svg+xml;charset=utf-8'}),'svg');});
$('#export-png').addEventListener('click',async()=>{const scene=makeScene(),asset=state.media?.asset;try{await preparePosterAssets(asset);}catch(error){announce(error.message);return;}const scale=Math.min(2,4096/Math.max(scene.width,scene.height)),output=document.createElement('canvas');output.width=Math.round(scene.width*scale);output.height=Math.round(scene.height*scale);const context=output.getContext('2d');context.scale(scale,scale);drawPosterScene(context,scene);output.toBlob(blob=>{if(blob)download(blob,'png');else announce('The PNG could not be created. Try SVG.');},'image/png');});

const videoSupport=getVideoExportSupport();$('#export-video-label').textContent=videoSupport.label;$('#export-video').disabled=!videoSupport.supported;if(!videoSupport.supported)$('#export-video').title=videoSupport.reason;
function disposeVideoResult(){if(videoResult){$('#video-preview').pause();$('#video-preview').removeAttribute('src');$('#video-preview').load();URL.revokeObjectURL(videoResult.url);videoResult=null;}}
function closeVideo(){if(videoController){videoController.abort();return;}$('#video-dialog').close();disposeVideoResult();}
$('#cancel-video').addEventListener('click',closeVideo);$('#video-dialog').addEventListener('cancel',event=>{event.preventDefault();closeVideo();});
$('#download-video').addEventListener('click',()=>{if(!videoResult)return;const a=document.createElement('a');a.href=videoResult.url;a.download=`maker-faire-kochi-${videoResult.direction}-${videoResult.format}.${videoResult.extension}`;a.click();announce(`${videoResult.extension.toUpperCase()} video ready.`);});
$('#export-video').addEventListener('click',async()=>{
  if(videoController)return;playing=false;syncTransport();disposeVideoResult();
  const project=studioProject(state,drafts),draft=project.drafts[project.state.direction],first=createPosterScene({...project.state,...draft,phase:0}),controller=new AbortController();videoController=controller;
  $('#video-title').textContent='Exporting loop';$('#video-progress-wrap').hidden=false;$('#video-preview').hidden=true;$('#download-video').hidden=true;$('#video-progress').value=0;$('#video-details').textContent='';$('#video-progress-label').textContent='Preparing video…';$('#cancel-video').textContent='Cancel';$('#video-dialog').showModal();
  try{
    await preparePosterAssets(project.state.media?.asset);
    const result=await exportVideo({width:first.width,height:first.height,duration:8,fps:30,signal:controller.signal,renderFrame:(context,phase)=>drawPosterScene(context,createPosterScene({...project.state,...draft,phase})),onProgress:progress=>{$('#video-progress').value=progress;$('#video-progress-label').textContent=`Rendering ${Math.round(progress*100)}%`;}});
    videoController=null;videoResult={...result,url:URL.createObjectURL(result.blob),direction:project.state.direction,format:project.state.format};
    $('#video-title').textContent='Video ready';$('#video-progress-wrap').hidden=true;$('#video-preview').src=videoResult.url;$('#video-preview').hidden=false;$('#download-video').hidden=false;$('#download-video').textContent=`Download ${result.extension.toUpperCase()}`;$('#cancel-video').textContent='Done';$('#video-details').textContent=`${result.width} × ${result.height} · 8 seconds · 30 fps`;$('#video-preview').play().catch(()=>{});
  }catch(error){videoController=null;if(error.name==='AbortError'){$('#video-dialog').close();announce('Video export cancelled.');}else{$('#video-title').textContent='Video export failed';$('#video-progress-label').textContent=error.message;$('#cancel-video').textContent='Close';}}
});
for(const id of ['headline','detail','type-font','type-style','type-render','type-layout','type-contrast','type-pressure','type-variation','palette','format','energy','custom-bg','custom-fg','custom-accent','loop','snapping','motion-curve']){
  const input=$('#'+id);let recorded=false;
  const rememberOnce=()=>{if(!recorded){rememberPose();recorded=true;}};
  input.addEventListener('focus',()=>recorded=false);input.addEventListener('pointerdown',()=>recorded=false);
  input.addEventListener('input',rememberOnce,true);input.addEventListener('change',()=>{rememberOnce();recorded=false;},true);
}
$('#save-project').addEventListener('click',()=>download(new Blob([JSON.stringify(studioProject(state,drafts),null,2)],{type:'application/json'}),'json'));
$('#open-project').addEventListener('click',()=>$('#project-file').click());
$('#project-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>4*1024*1024)throw Error('Choose a Poster Studio project smaller than 4 MB.');
    const project=normalizeStudioProject(JSON.parse(await file.text()));rememberPose();
    restoreEdit({project,selection:{selected:null,selectedFooter:null,activeLayer:'letters'}});announce('Project opened.');
  }catch(error){announce(error instanceof SyntaxError?'This project file could not be read.':error.message);}
  finally{event.target.value='';}
});
imageEditor=mountImageEditor({getMedia:()=>state.media,getInfo:()=>lastScene?.media,onEditMode:()=>{snapGuides=[];syncPoseControls();dirty=true;},prepareAssets:preparePosterAssets,announce,onChange:(media,{remember=false}={})=>{
  if(remember)rememberPose();state.media=media;activeLayer=media?'image':'letters';selected=selectedFooter=null;playing=false;
  imageEditor?.sync();syncTransport();syncPoseControls();syncSelectionUI(true);dirty=true;saveState();
}});
editorShell=mountEditorShell({initialLayer:'letters',onSelectLayer:chooseEditorLayer});
new ResizeObserver(fit).observe(canvas);
sync();fit();saveState();
preparePosterAssets(state.media?.asset).then(()=>{ready=true;$('#loading').hidden=true;dirty=true;}).catch(()=>{$('#loading').textContent='A poster image could not load. Refresh to try again.';});
requestAnimationFrame(tick);
