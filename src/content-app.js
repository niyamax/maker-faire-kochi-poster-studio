import './styles/content.css';
import {CONTENT_TYPES,CONTENT_FORMATS,CONTENT_MAX_ASSETS,CONTENT_MAX_PAGES,createWorkspace,normalizeWorkspace,createContentItem,duplicateContentItem,createContentPage,contentItemLabel,contentCaption} from './content-project.js';
import {loadWorkspace,saveWorkspace} from './content-storage.js';
import {createContentScene,prepareContentAssets} from './content-scene.js';
import {contentPNG,contentSVG,contentPack,contentVideo,contentFilename,downloadContent} from './content-export.js';
import {drawPosterScene} from './scene.js';
import {importPosterImage} from './image-import.js';
import {getLogoVariant} from './logo-library.js';

const $=selector=>document.querySelector(selector);
const all=selector=>[...document.querySelectorAll(selector)];
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const typeLabel=type=>CONTENT_TYPES.find(entry=>entry.id===type)?.label||'Content';
const roleLabel=role=>({cover:'Cover',details:'Details',closing:'Closing card'}[role]||'Page');
const clone=value=>structuredClone(value);
const freshId=()=>crypto.randomUUID();
let workspace=createWorkspace(),selectedId=null,pageIndex=0,activeFormat='feed',activeTab='content';
let revision=0,pendingSave=false,saveTimer=null,lastSave=Promise.resolve(),saveFailed=false,ready=false;
let undoStack=[],redoStack=[],focusEdits=new WeakSet(),noticeTimer,drawTimer,drawGeneration=0,libraryGeneration=0;
let libraryThumbnailTask=Promise.resolve(),uiAssetsTask=Promise.resolve();
let playing=false,motionStart=0,animationFrame=0,exporting=false,exportController=null,exportCancelled=false,uploading=false;
const currentItem=()=>workspace.items.find(item=>item.id===selectedId);
const currentPage=()=>currentItem()?.pages[pageIndex];

function announce(message,{error=false,undo=false,persistent=false}={}){
  clearTimeout(noticeTimer);$('#notice-message').textContent=message;$('#content-notice').hidden=false;$('#content-notice').dataset.error=String(error);$('#notice-undo').hidden=!undo;
  if(!persistent)noticeTimer=setTimeout(()=>$('#content-notice').hidden=true,error?9000:5000);
}
function setSaveStatus(status,message){
  const output=$('#workspace-save-status');output.dataset.status=status;
  output.textContent=message||({saving:'Saving…',saved:'Saved on this device',error:'Save failed',idle:'Local library'}[status]);
}
function syncHistory(){
  $('#content-undo').disabled=!undoStack.length||exporting;$('#content-redo').disabled=!redoStack.length||exporting;
}
function remember(){
  undoStack.push(clone(workspace));if(undoStack.length>25)undoStack.shift();redoStack=[];syncHistory();
}
function rememberInput(input){if(!focusEdits.has(input)){remember();focusEdits.add(input);}}
function changed({immediate=false,preview=true}={}){
  workspace.updatedAt=new Date().toISOString();revision++;pendingSave=true;setSaveStatus('saving');
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushSave(),immediate?0:180);
  if(currentItem()&&!$('#item-title').value)$('#item-title').placeholder=contentItemLabel(currentItem());
  if(preview)schedulePreviews();syncCaption();
}
async function flushSave(){
  clearTimeout(saveTimer);saveTimer=null;
  if(!pendingSave)return lastSave;
  pendingSave=false;const thisRevision=revision,snapshot=clone(workspace);
  const writing=saveWorkspace(snapshot);
  lastSave=writing.then(()=>{
    if(revision===thisRevision){setSaveStatus('saved');saveFailed=false;}
    return true;
  }).catch(error=>{
    setSaveStatus('error');
    if(!saveFailed){announce(error.message||'Changes could not be saved. Download a project to keep your work.',{error:true,persistent:true});saveFailed=true;}
    return false;
  });
  return lastSave;
}
function mutate(callback,{rebuild=false,library=false,preview=true}={}){
  if(exporting)return;
  remember();callback();changed({immediate:true,preview});
  if(library)renderLibrary();
  if(rebuild&&currentItem())renderEditor();
}
function restoreHistory(source,destination){
  if(!source.length||exporting)return;
  destination.push(clone(workspace));workspace=source.pop();focusEdits=new WeakSet();
  if(selectedId&&!currentItem()){selectedId=null;history.replaceState(null,'',location.pathname);}
  if(currentItem())pageIndex=Math.min(pageIndex,currentItem().pages.length-1);
  changed({immediate:true});syncHistory();renderEventSummary();
  if(currentItem())renderEditor();else showLibrary();
}
function setTab(tab){
  activeTab=tab;for(const button of all('[data-inspector-tab]'))button.setAttribute('aria-pressed',String(button.dataset.inspectorTab===tab));
  for(const section of all('[data-inspector-panel]'))section.hidden=section.dataset.inspectorPanel!==tab;
}
function stopMotion(){playing=false;cancelAnimationFrame(animationFrame);$('#preview-play').setAttribute('aria-pressed','false');$('#preview-play').textContent='Play motion';}
function itemRoute(id){location.hash=id?`item=${encodeURIComponent(id)}`:'';}
async function openItem(id){
  const item=workspace.items.find(entry=>entry.id===id);if(!item)return;
  libraryGeneration++;drawGeneration++;
  if(item.type==='poster'){
    const saved=await flushSave();
    if(saved===false){announce('Save this library successfully before opening the poster editor. Download a project to keep your changes.',{error:true});return;}
    // Keep Back pointed at the library instead of a route that reopens this poster.
    history.replaceState(null,'',location.pathname);showLibrary();
    location.href=`poster.html?item=${encodeURIComponent(item.id)}`;return;
  }
  stopMotion();selectedId=id;pageIndex=0;activeFormat='feed';setTab('content');
  $('#library-screen').hidden=true;$('#editor-screen').hidden=false;renderEditor();window.scrollTo(0,0);
}
function showLibrary(){
  stopMotion();selectedId=null;drawGeneration++;$('#editor-screen').hidden=true;$('#library-screen').hidden=false;renderEventSummary();renderLibrary();
}
function route(){
  const id=new URLSearchParams(location.hash.slice(1)).get('item')||new URLSearchParams(location.search).get('item');
  if(id&&workspace.items.some(item=>item.id===id))openItem(id);else showLibrary();
}
function renderEventSummary(){
  $('#event-strip-title').textContent=workspace.event.name||'Maker Faire Kochi';
  $('#event-summary').textContent=[workspace.event.dates,workspace.event.venue,workspace.event.url].filter(Boolean).join(' · ')||'Add shared dates, venue and booking link.';
}
function paintCanvas(canvas,scene){
  if(!canvas)return;
  const context=canvas.getContext('2d');context.setTransform(canvas.width/scene.width,0,0,canvas.height/scene.height,0,0);drawPosterScene(context,scene);context.setTransform(1,0,0,1,0,0);
}
function prepareUiAssets(item){
  // One queue prevents an old library image from evicting an editor image after
  // the editor has finished preparing its eight-photo working set.
  const task=uiAssetsTask.then(()=>prepareContentAssets(item));
  uiAssetsTask=task.catch(()=>{});return task;
}
async function paintThumbnail(canvas,item,page=0,isCurrent=()=>canvas.isConnected){
  if(!isCurrent())return;
  const definition=item.pages[page],chosen=item.assets.find(asset=>asset.id===definition?.assetId)
    ||(definition?.role==='closing'?null:item.assets[0]);
  const thumbnailItem=item.type==='poster'?item:{...item,assets:chosen?[chosen]:[]};
  try{
    await prepareUiAssets(thumbnailItem);
    if(isCurrent())paintCanvas(canvas,createContentScene(item,workspace.event,{format:'feed',pageIndex:page,phase:0}));
  }catch{
    if(!isCurrent())return;
    const context=canvas.getContext('2d');context.fillStyle='#efefe4';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#77776a';context.font='12px sans-serif';context.fillText('Preview unavailable',10,30);
  }
}
function renderLibrary(){
  const generation=++libraryGeneration,query=$('#library-search').value.trim().toLocaleLowerCase(),thumbnailJobs=[];
  const items=workspace.items.filter(item=>[contentItemLabel(item),typeLabel(item.type),...Object.values(item.content)].join(' ').toLocaleLowerCase().includes(query));
  $('#library-count').textContent=String(workspace.items.length);$('#content-library').replaceChildren();
  $('#library-empty').hidden=items.length>0;$('#library-empty').textContent=query?'No content matches this search.':'Your next story starts above. Choose a content type to make your first pack.';
  for(const item of items){
    const card=el('article','library-item');card.dataset.itemId=item.id;
    const open=el('button','library-item-open');open.type='button';open.setAttribute('aria-label',`Open ${contentItemLabel(item)}`);open.addEventListener('click',()=>itemRoute(item.id));
    const visual=el('span','library-item-preview'),canvas=el('canvas');canvas.width=216;canvas.height=270;canvas.setAttribute('aria-hidden','true');visual.append(canvas);
    const text=el('span','library-item-text');text.append(el('span','library-item-type',typeLabel(item.type)),el('span','library-item-title',contentItemLabel(item)),el('span','library-item-meta',item.type==='poster'?'Original poster editor':`${item.pages.length} ${item.pages.length===1?'page':'pages'} · Feed + Story`));
    open.append(visual,text);card.append(open);
    const actions=el('div','library-item-actions'),duplicate=el('button','', 'Duplicate'),remove=el('button','', 'Remove');duplicate.type=remove.type='button';
    duplicate.setAttribute('aria-label',`Duplicate ${contentItemLabel(item)}`);remove.setAttribute('aria-label',`Remove ${contentItemLabel(item)}`);
    duplicate.addEventListener('click',()=>{mutate(()=>workspace.items.unshift(duplicateContentItem(item)),{library:true,preview:false});announce('Content duplicated.');});
    remove.addEventListener('click',()=>{mutate(()=>workspace.items=workspace.items.filter(entry=>entry.id!==item.id),{library:true,preview:false});announce('Content removed from the library.',{undo:true});});
    actions.append(duplicate,remove);card.append(actions);$('#content-library').append(card);
    thumbnailJobs.push({canvas,item});
  }
  const previous=libraryThumbnailTask;
  libraryThumbnailTask=(async()=>{
    await previous;
    for(const {canvas,item} of thumbnailJobs){
      if(generation!==libraryGeneration)break;
      await paintThumbnail(canvas,item,0,()=>generation===libraryGeneration&&canvas.isConnected);
    }
  })();
}
function addContent(type){
  const item=createContentItem(type,workspace.event);mutate(()=>workspace.items.unshift(item),{library:true,preview:false});itemRoute(item.id);
}
const fieldSpecs={
  name:{label:'Maker name',max:240,placeholder:'Who made it?'},project:{label:'Project name',max:240,placeholder:'What have they made?'},
  title:{label:'Workshop title',max:400,placeholder:'What will people learn or make?'},host:{label:'Host or facilitator',max:240,placeholder:'Who is leading the session?'},
  description:{label:'The story',max:8000,placeholder:'A short description in plain language.',rows:5,hint:'Keep the cover concise. Use details pages for longer stories.'},
  handle:{label:'Social handle',max:240,placeholder:'@maker'},time:{label:'Time',max:120,placeholder:'e.g. 10:30 AM'},duration:{label:'Duration',max:120,placeholder:'e.g. 60 minutes'},
  date:{label:'Date',max:240,placeholder:()=>workspace.event.dates||'Use the event dates'},location:{label:'Location',max:500,placeholder:()=>workspace.event.venue||'Use the event venue'},url:{label:'Booking or project link',max:2000,placeholder:()=>workspace.event.url||'Use the event link'},
};
function createContentField(key){
  const item=currentItem(),spec=fieldSpecs[key],label=el('label','field-label');label.htmlFor=`field-${key}`;
  const labelText=spec.label==='The story'&&item.type==='workshop'?'What participants will make':spec.label;label.append(el('span','',labelText));
  const input=el(spec.rows?'textarea':'input');input.id=`field-${key}`;input.name=key;input.maxLength=spec.max;input.value=item.content[key]||'';input.placeholder=typeof spec.placeholder==='function'?spec.placeholder():spec.placeholder;
  if(spec.rows)input.rows=spec.rows;
  input.addEventListener('input',()=>{const current=currentItem();if(!current)return;rememberInput(input);current.content[key]=input.value;changed();});
  label.append(input);if(spec.hint)label.append(el('span','field-hint',spec.hint));return label;
}
function renderEditor(){
  const item=currentItem();if(!item)return;
  pageIndex=Math.max(0,Math.min(pageIndex,item.pages.length-1));$('#editor-type').textContent=typeLabel(item.type).toUpperCase();$('#item-title').value=item.title;$('#item-title').placeholder=contentItemLabel(item);
  $('#content-form-heading').textContent=item.type==='maker'?'Introduce a maker':'Bring people together';
  const fields=item.type==='maker'?['name','project','description','handle']:['title','host','description','time','duration'];
  $('#content-fields').replaceChildren(...fields.map(createContentField));$('#event-override-fields').replaceChildren(...['date','location','url'].map(createContentField));
  $('#content-palette').value=item.palette;syncLogoControls();
  for(const button of all('[data-content-treatment]'))button.setAttribute('aria-pressed',String(button.dataset.contentTreatment===item.treatment));
  $('#content-caption').value=item.caption;$('#content-alt').value=item.altText;syncCaption();syncSwatches();syncPartner();syncCrop();renderPhotos();syncPageControls();renderPageStrip();setTab(activeTab);schedulePreviews();syncHistory();
}
function syncCaption(){
  const item=currentItem();if(!item)return;$('#auto-caption').textContent=contentCaption({...item,caption:''},workspace.event);
}
function syncSwatches(){
  const palette={ 'maker-red':['#ed1c24','#ffffff','#00aeef'],maker:['#ffffff','#ed1c24','#00aeef'],'maker-cyan':['#00aeef','#ffffff','#ed1c24']}[currentItem()?.palette]||[];
  $('#content-swatches').replaceChildren(...palette.map(colour=>{const swatch=el('span');swatch.style.background=colour;swatch.title=colour;return swatch;}));
}
function resolvedLogo(item){
  const variant=getLogoVariant(item.logoVariant);
  return item.logoColourMode==='auto'?getLogoVariant(`${variant.layout}-${item.palette==='maker-red'?'white':'black'}`):variant;
}
function syncLogoControls(){
  const item=currentItem();if(!item)return;
  const logo=resolvedLogo(item),automatic=item.logoColourMode==='auto';
  $('#content-logo-layout').value=logo.layout;$('#content-logo-colour').value=logo.colour;
  $('#logo-auto-contrast').checked=automatic;$('#content-logo-colour').disabled=automatic||exporting;
}
function syncPartner(){
  const item=currentItem();if(!item)return;
  const partner=item.partner||{name:'',asset:null};
  $('#partner-name').value=partner.name;$('#partner-logo-preview').hidden=!partner.asset;
  if(partner.asset){$('#partner-logo-image').src=partner.asset.src;$('#partner-logo-image').alt=partner.name||'Partner logo';}
  else $('#partner-logo-image').removeAttribute('src');
  $('#add-partner-logo').textContent=partner.asset?'Replace partner logo':'+ Add partner logo';
}
function syncCrop(){
  const item=currentItem();if(!item)return;const crop=item.variants[activeFormat];$('#crop-format').value=activeFormat;
  for(const [id,key] of [['zoom','zoom'],['x','focusX'],['y','focusY']]){$(`#crop-${id}`).value=crop[key];$(`#crop-${id}-value`).value=`${Math.round(crop[key]*100)}%`;}
  for(const button of all('[data-select-format]'))button.setAttribute('aria-pressed',String(button.dataset.selectFormat===activeFormat));
  for(const output of all('[data-preview-format]'))output.dataset.active=String(output.dataset.previewFormat===activeFormat);
  $('#single-export-label').textContent=`${CONTENT_FORMATS[activeFormat].name} · Page ${pageIndex+1}`;
  const noPhoto=!item.assets.length||(currentPage()?.role==='closing'&&!currentPage()?.assetId);
  for(const id of ['crop-zoom','crop-x','crop-y','reset-crop'])$('#'+id).disabled=noPhoto||exporting;
  $('#crop-help').textContent=noPhoto?(currentPage()?.role==='closing'?'Choose a photograph in Pages to add an image to this closing card.':'Add a photograph in Content to adjust its crop.'):'Each format keeps its own crop. Your content stays linked.';
}
function renderPhotos(){
  const item=currentItem();if(!item)return;$('#photo-count').textContent=`${item.assets.length} / ${CONTENT_MAX_ASSETS}`;$('#add-photos').disabled=item.assets.length>=CONTENT_MAX_ASSETS;$('#photo-gallery').replaceChildren();
  if(!item.assets.length)$('#photo-gallery').append(el('p','photo-empty','Add a photograph to bring your story to life.'));
  for(const asset of item.assets){
    const tile=el('div','photo-tile'),image=el('img'),name=el('span','',asset.name),remove=el('button','', '×');image.src=asset.src;image.alt=asset.name;image.loading='lazy';remove.type='button';remove.setAttribute('aria-label',`Remove photo ${asset.name}`);
    remove.addEventListener('click',()=>{mutate(()=>{item.assets=item.assets.filter(entry=>entry.id!==asset.id);for(const page of item.pages)if(page.assetId===asset.id)page.assetId=null;},{preview:true});renderPhotos();syncPageControls();renderPageStrip();announce('Photo removed.',{undo:true});});
    tile.append(image,remove,name);$('#photo-gallery').append(tile);
  }
  syncPageImage();
}
function syncPageImage(){
  const item=currentItem(),page=currentPage();if(!item||!page)return;
  $('#page-image').replaceChildren(new Option(page.role==='closing'?'No photo':item.assets.length?'Automatic · first photo':'No photographs yet',''),...item.assets.map((asset,index)=>new Option(`${index+1}. ${asset.name}`,asset.id)));$('#page-image').value=page.assetId||'';
}
function syncPageControls(){
  const item=currentItem(),page=currentPage();if(!item||!page)return;
  $('#page-edit-title').textContent=`Page ${pageIndex+1} of ${item.pages.length}`;$('#preview-page-label').textContent=`Page ${pageIndex+1} of ${item.pages.length} · ${roleLabel(page.role)}`;
  $('#page-role').value=page.role;$('#page-heading').value=page.heading;$('#page-body').value=page.body;
  $('#page-up').disabled=pageIndex===0;$('#page-down').disabled=pageIndex===item.pages.length-1;$('#delete-page').disabled=item.pages.length===1;$('#duplicate-page').disabled=item.pages.length>=CONTENT_MAX_PAGES;
  $('#add-page').disabled=$('#add-page-strip').disabled=item.pages.length>=CONTENT_MAX_PAGES;syncPageImage();syncCrop();
}
function renderPageStrip(){
  const item=currentItem();if(!item)return;$('#page-strip').replaceChildren();
  item.pages.forEach((page,index)=>{
    const button=el('button','page-thumbnail');button.type='button';button.dataset.pageId=page.id;button.setAttribute('aria-label',`Page ${index+1}: ${roleLabel(page.role)}`);button.setAttribute('aria-pressed',String(index===pageIndex));
    const canvas=el('canvas');canvas.width=162;canvas.height=203;canvas.setAttribute('aria-hidden','true');const text=el('span');text.append(el('span','',String(index+1).padStart(2,'0')),el('span','',roleLabel(page.role)));button.append(canvas,text);
    button.addEventListener('click',()=>{pageIndex=index;syncPageControls();for(const sibling of all('.page-thumbnail'))sibling.setAttribute('aria-pressed',String(sibling===button));schedulePreviews();});
    $('#page-strip').append(button);
  });
}
function drawPreviews(phase=0){
  const item=currentItem();if(!item)return;const warnings=new Set();let invalidCurrent=false;
  for(const format of Object.keys(CONTENT_FORMATS)){
    const scene=createContentScene(item,workspace.event,{format,pageIndex,phase});paintCanvas($(`#preview-${format}`),scene);
    for(const warning of scene.warnings||[])warnings.add(`${CONTENT_FORMATS[format].name}: ${warning}`);
    if(format===activeFormat)invalidCurrent=Boolean(scene.hasOverflow||scene.hasUnsupportedText);
  }
  $('#preview-warnings').hidden=warnings.size===0;
  const list=el('ul');for(const warning of warnings)list.append(el('li','',warning));$('#preview-warnings').replaceChildren(list);
  for(const id of ['export-png','export-svg','export-content-video'])$('#'+id).disabled=exporting||invalidCurrent;
}
function schedulePreviews(){
  clearTimeout(drawTimer);const generation=++drawGeneration;
  drawTimer=setTimeout(async()=>{
    const item=currentItem();if(!item)return;
    try{
      await libraryThumbnailTask;
      if(generation!==drawGeneration||currentItem()?.id!==item.id)return;
      await prepareUiAssets(item);if(generation===drawGeneration&&currentItem()?.id===item.id){
      drawPreviews(playing?(performance.now()-motionStart)/8000%1:0);
      const thumbnails=all('.page-thumbnail canvas');
      for(const [index,canvas] of thumbnails.entries())paintCanvas(canvas,createContentScene(item,workspace.event,{format:'feed',pageIndex:index,phase:0}));
    }}
    catch(error){if(generation===drawGeneration)announce(error.message||'This preview could not be rendered.',{error:true});}
  },70);
}
function animate(now){
  if(!playing||!currentItem())return;
  try{drawPreviews((now-motionStart)/8000%1);}catch(error){stopMotion();announce(error.message,{error:true});return;}
  animationFrame=requestAnimationFrame(animate);
}
function openEventDialog(){
  for(const key of ['name','dates','venue','url'])$('#event-'+key).value=workspace.event[key];$('#event-dialog').showModal();$('#event-name').focus();
}
function downloadWorkspace(){
  try{const project=normalizeWorkspace(workspace);downloadContent(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'maker-faire-content-studio-project.json');announce('Editable project downloaded.');}
  catch(error){announce(error.message,{error:true});}
}
let exportDisabled=[];
function setExporting(value){
  exporting=value;document.body.classList.toggle('is-exporting',value);
  if(value){exportDisabled=all('#editor-screen button, #editor-screen input, #editor-screen select, #editor-screen textarea, #open-workspace').map(input=>[input,input.disabled]);for(const [input] of exportDisabled)input.disabled=true;}
  else{for(const [input,disabled] of exportDisabled)input.disabled=disabled;exportDisabled=[];syncHistory();syncPageControls();schedulePreviews();}
}
async function exportCurrent(kind){
  const item=currentItem();if(!item||exporting)return;
  if(uploading){announce('Wait for your photographs to finish loading before exporting.');return;}
  const snapshot=clone(item),event=clone(workspace.event),options={format:activeFormat,pageIndex};
  stopMotion();exportController=new AbortController();exportCancelled=false;setExporting(true);
  $('#export-dialog-title').textContent=kind==='pack'?'Preparing your content pack':kind==='video'?'Rendering motion':'Preparing your page';
  $('#export-dialog-message').textContent=kind==='pack'?'Rendering ordered Feed and Story images…':kind==='video'?'Every frame is rendered before the video is finalized.':'Preparing the selected page and format…';
  $('#export-dialog-progress').value=0;$('#close-content-export').hidden=true;$('#cancel-content-export').hidden=false;$('#cancel-content-export').disabled=false;$('#cancel-content-export').textContent='Cancel';$('#export-dialog').showModal();
  const onProgress=(fraction,info={})=>{
    if(exportCancelled)throw new DOMException('Export cancelled.','AbortError');
    $('#export-dialog-progress').value=Number.isFinite(fraction)?fraction:0;
    $('#export-progress').textContent=`${Math.round((fraction||0)*100)}%`;
    if(kind==='pack'&&info.format)$('#export-dialog-message').textContent=`Preparing ${CONTENT_FORMATS[info.format]?.name||info.format}, page ${(info.pageIndex??0)+1}…`;
    if(kind==='video')$('#export-dialog-message').textContent=info.stage==='finalizing'?'Finishing video…':info.totalFrames?`Rendering frame ${info.frame||0} of ${info.totalFrames}`:'Checking video encoder…';
  };
  try{
    // Drain in-flight thumbnail work before the exporter prepares its images.
    await libraryThumbnailTask;await uiAssetsTask;
    if(exportCancelled)throw new DOMException('Export cancelled.','AbortError');
    let blob,filename;
    if(kind==='pack'){blob=await contentPack(snapshot,event,{onProgress});filename=contentFilename(snapshot,{extension:'zip'});}
    else if(kind==='png'){blob=await contentPNG(snapshot,event,options);filename=contentFilename(snapshot,{...options,extension:'png'});}
    else if(kind==='svg'){blob=new Blob([contentSVG(snapshot,event,options)],{type:'image/svg+xml;charset=utf-8'});filename=contentFilename(snapshot,{...options,extension:'svg'});}
    else if(kind==='video'){const result=await contentVideo(snapshot,event,{...options,onProgress,signal:exportController.signal});blob=result.blob;filename=contentFilename(snapshot,{...options,extension:result.extension});}
    if(exportCancelled)throw new DOMException('Export cancelled.','AbortError');
    if(!blob?.size)throw new Error('The export did not produce a file.');
    downloadContent(blob,filename);$('#export-dialog-progress').value=1;$('#export-dialog-title').textContent='Your download is ready';$('#export-dialog-message').textContent=kind==='pack'?'The ZIP contains Feed and Story images, captions, image descriptions and an editable project.':filename;
    $('#cancel-content-export').hidden=true;$('#close-content-export').hidden=false;
  }catch(error){
    if(error.name==='AbortError'){$('#export-dialog').close();announce('Export cancelled.');}
    else{$('#export-dialog-title').textContent='A little more editing is needed';$('#export-dialog-message').textContent=error.message||'This export could not be created.';$('#cancel-content-export').hidden=true;$('#close-content-export').hidden=false;$('#close-content-export').textContent='Back to editing';announce(error.message||'This export could not be created.',{error:true});}
  }finally{exportController=null;$('#export-progress').textContent='';setExporting(false);}
}
function cancelExport(){exportCancelled=true;exportController?.abort();$('#cancel-content-export').disabled=true;$('#cancel-content-export').textContent='Cancelling…';}

for(const button of all('[data-new-type]'))button.addEventListener('click',()=>{if(ready)addContent(button.dataset.newType);});
for(const button of all('[data-inspector-tab]'))button.addEventListener('click',()=>setTab(button.dataset.inspectorTab));
for(const button of all('[data-close-dialog]'))button.addEventListener('click',()=>$('#'+button.dataset.closeDialog).close());
$('#library-search').addEventListener('input',renderLibrary);
$('#back-library').addEventListener('click',()=>itemRoute(null));
$('.studio-brand').addEventListener('click',event=>{event.preventDefault();itemRoute(null);showLibrary();});
$('#content-undo').addEventListener('click',()=>restoreHistory(undoStack,redoStack));
$('#content-redo').addEventListener('click',()=>restoreHistory(redoStack,undoStack));
$('#notice-undo').addEventListener('click',()=>{$('#content-notice').hidden=true;restoreHistory(undoStack,redoStack);});
$('#notice-close').addEventListener('click',()=>$('#content-notice').hidden=true);
$('#save-workspace').addEventListener('click',downloadWorkspace);
$('#open-workspace').addEventListener('click',()=>$('#workspace-file').click());
$('#workspace-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>50*1024*1024)throw new Error('Choose a project smaller than 50 MB.');
    const incoming=normalizeWorkspace(JSON.parse(await file.text()));
    mutate(()=>workspace=incoming,{preview:false});selectedId=null;itemRoute(null);showLibrary();announce('Project opened. Undo restores your previous library.',{undo:true});
  }catch(error){announce(error instanceof SyntaxError?'This file is not a readable JSON project.':error.message,{error:true});}
  finally{event.target.value='';}
});
$('#edit-event').addEventListener('click',openEventDialog);$('#edit-event-from-editor').addEventListener('click',openEventDialog);
$('#event-form').addEventListener('submit',event=>{
  event.preventDefault();mutate(()=>{workspace.event=Object.fromEntries(['name','dates','venue','url'].map(key=>[key,$('#event-'+key).value]));},{preview:true});
  $('#event-dialog').close();renderEventSummary();if(currentItem())renderEditor();else renderLibrary();announce('Shared event details updated.');
});
$('#item-title').addEventListener('input',event=>{const item=currentItem();if(!item)return;rememberInput(event.target);item.title=event.target.value;changed({preview:false});});
for(const [id,key] of [['content-caption','caption'],['content-alt','altText']])$('#'+id).addEventListener('input',event=>{const item=currentItem();if(!item)return;rememberInput(event.target);item[key]=event.target.value;changed({preview:false});});
$('#use-auto-caption').addEventListener('click',()=>{const item=currentItem();if(!item)return;mutate(()=>item.caption=contentCaption({...item,caption:''},workspace.event),{preview:false});$('#content-caption').value=item.caption;announce('Caption added. You can edit it here.');});
$('#content-palette').addEventListener('change',event=>{const item=currentItem();if(!item)return;mutate(()=>item.palette=event.target.value);syncSwatches();syncLogoControls();renderPageStrip();});
for(const button of all('[data-content-treatment]'))button.addEventListener('click',()=>{
  const item=currentItem();if(!item||item.treatment===button.dataset.contentTreatment)return;
  mutate(()=>item.treatment=button.dataset.contentTreatment);for(const other of all('[data-content-treatment]'))other.setAttribute('aria-pressed',String(other===button));renderPageStrip();
});
$('#content-logo-layout').addEventListener('change',event=>{
  const item=currentItem();if(!item)return;
  mutate(()=>item.logoVariant=getLogoVariant(`${event.target.value}-${resolvedLogo(item).colour}`).id);
  syncLogoControls();renderPageStrip();
});
$('#content-logo-colour').addEventListener('change',event=>{
  const item=currentItem();if(!item)return;
  mutate(()=>{item.logoVariant=getLogoVariant(`${$('#content-logo-layout').value}-${event.target.value}`).id;item.logoColourMode='manual';});
  syncLogoControls();renderPageStrip();
});
$('#logo-auto-contrast').addEventListener('change',event=>{
  const item=currentItem();if(!item)return;
  mutate(()=>{const displayed=resolvedLogo(item);item.logoColourMode=event.target.checked?'auto':'manual';if(!event.target.checked)item.logoVariant=displayed.id;});
  syncLogoControls();renderPageStrip();
});
function chooseFormat(format){activeFormat=format;syncCrop();schedulePreviews();}
for(const button of all('[data-select-format]'))button.addEventListener('click',()=>chooseFormat(button.dataset.selectFormat));
$('#crop-format').addEventListener('change',event=>chooseFormat(event.target.value));
for(const [id,key] of [['crop-zoom','zoom'],['crop-x','focusX'],['crop-y','focusY']])$('#'+id).addEventListener('input',event=>{
  const item=currentItem();if(!item)return;rememberInput(event.target);item.variants[activeFormat][key]=Number(event.target.value);syncCrop();changed();
});
$('#reset-crop').addEventListener('click',()=>{const item=currentItem();if(!item)return;mutate(()=>item.variants[activeFormat]={zoom:1,focusX:.5,focusY:.5});syncCrop();renderPageStrip();});
$('#show-safe-guides').addEventListener('change',event=>$('#story-safe-guide').hidden=!event.target.checked);
$('#edit-current-page').addEventListener('click',()=>{setTab('pages');if(innerWidth<=680)$('#pages-panel').scrollIntoView({behavior:'smooth',block:'start'});});
function addPage(){
  const item=currentItem();if(!item||item.pages.length>=CONTENT_MAX_PAGES)return;
  mutate(()=>{item.pages.push(createContentPage('details'));pageIndex=item.pages.length-1;});syncPageControls();renderPageStrip();setTab('pages');
}
$('#add-page').addEventListener('click',addPage);$('#add-page-strip').addEventListener('click',addPage);
$('#page-role').addEventListener('change',event=>{const page=currentPage();if(!page)return;mutate(()=>page.role=event.target.value);syncPageControls();renderPageStrip();});
for(const [id,key] of [['page-heading','heading'],['page-body','body']])$('#'+id).addEventListener('input',event=>{
  const page=currentPage();if(!page)return;rememberInput(event.target);page[key]=event.target.value;changed();
});
$('#page-image').addEventListener('change',event=>{const page=currentPage();if(!page)return;mutate(()=>page.assetId=event.target.value||null);syncCrop();renderPageStrip();});
function movePage(direction){const item=currentItem(),next=pageIndex+direction;if(!item||next<0||next>=item.pages.length)return;mutate(()=>{const [page]=item.pages.splice(pageIndex,1);item.pages.splice(next,0,page);pageIndex=next;});syncPageControls();renderPageStrip();}
$('#page-up').addEventListener('click',()=>movePage(-1));$('#page-down').addEventListener('click',()=>movePage(1));
$('#duplicate-page').addEventListener('click',()=>{const item=currentItem(),page=currentPage();if(!item||!page||item.pages.length>=CONTENT_MAX_PAGES)return;mutate(()=>{item.pages.splice(pageIndex+1,0,{...clone(page),id:freshId()});pageIndex++;});syncPageControls();renderPageStrip();});
$('#delete-page').addEventListener('click',()=>{const item=currentItem();if(!item||item.pages.length===1)return;mutate(()=>{item.pages.splice(pageIndex,1);pageIndex=Math.min(pageIndex,item.pages.length-1);});syncPageControls();renderPageStrip();announce('Page removed.',{undo:true});});
$('#partner-name').addEventListener('input',event=>{
  const item=currentItem();if(!item)return;rememberInput(event.target);
  item.partner??={name:'',asset:null};item.partner.name=event.target.value;changed();
});
$('#add-partner-logo').addEventListener('click',()=>$('#partner-logo-file').click());
$('#remove-partner-logo').addEventListener('click',()=>{
  const item=currentItem();if(!item?.partner?.asset)return;
  mutate(()=>item.partner.asset=null);syncPartner();renderPageStrip();announce('Partner logo removed.',{undo:true});
});
$('#partner-logo-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0],item=currentItem();if(!file||!item)return;
  if(uploading){announce('Wait for the current images to finish loading.');event.target.value='';return;}
  const itemId=item.id;uploading=true;$('#add-partner-logo').disabled=true;$('#add-partner-logo').textContent='Adding…';
  try{
    const asset={...await importPosterImage(file),id:freshId()},target=workspace.items.find(entry=>entry.id===itemId);
    if(!target)throw new Error('The content item was removed before the logo finished loading.');
    mutate(()=>{target.partner??={name:'',asset:null};target.partner.asset=asset;});
    if(currentItem()?.id===itemId){syncPartner();renderPageStrip();}
    announce('Partner logo added.');
  }catch(error){announce(error.message||'This partner logo could not be added.',{error:true});}
  finally{uploading=false;event.target.value='';$('#add-partner-logo').disabled=false;if(currentItem())syncPartner();}
});
$('#add-photos').addEventListener('click',()=>$('#photos-file').click());
$('#photos-file').addEventListener('change',async event=>{
  const files=[...event.target.files||[]],item=currentItem();if(!files.length||!item)return;
  if(uploading){announce('Wait for the current images to finish loading.');event.target.value='';return;}
  const available=CONTENT_MAX_ASSETS-item.assets.length;if(files.length>available){announce(`You can add ${available} more ${available===1?'photo':'photos'} to this item.`,{error:true});event.target.value='';return;}
  const itemId=item.id;uploading=true;$('#add-photos').disabled=true;$('#add-photos').textContent='Adding…';
  try{
    const assets=[];for(const file of files)assets.push({...await importPosterImage(file),id:freshId()});
    const target=workspace.items.find(entry=>entry.id===itemId);if(!target)throw new Error('The content item was removed before the photos finished loading.');
    if(target.assets.length+assets.length>CONTENT_MAX_ASSETS)throw new Error('Keep at most eight photos in one content item.');
    mutate(()=>target.assets.push(...assets));
    if(currentItem()?.id===itemId){renderPhotos();syncPageControls();renderPageStrip();}
    announce(`${assets.length} ${assets.length===1?'photo added':'photos added'}. Choose a photograph for each page in Pages.`);
  }catch(error){announce(error.message||'These images could not be added.',{error:true});}
  finally{uploading=false;event.target.value='';$('#add-photos').textContent='+ Add photos';if(currentItem())$('#add-photos').disabled=currentItem().assets.length>=CONTENT_MAX_ASSETS;}
});
$('#preview-play').addEventListener('click',()=>{
  if(playing){stopMotion();schedulePreviews();return;}
  playing=true;motionStart=performance.now();$('#preview-play').setAttribute('aria-pressed','true');$('#preview-play').textContent='Pause motion';animationFrame=requestAnimationFrame(animate);
});
$('#export-pack').addEventListener('click',()=>exportCurrent('pack'));$('#export-png').addEventListener('click',()=>exportCurrent('png'));$('#export-svg').addEventListener('click',()=>exportCurrent('svg'));$('#export-content-video').addEventListener('click',()=>exportCurrent('video'));
$('#cancel-content-export').addEventListener('click',cancelExport);$('#close-content-export').addEventListener('click',()=>{$('#export-dialog').close();$('#close-content-export').textContent='Done';});
$('#export-dialog').addEventListener('cancel',event=>{if(exporting){event.preventDefault();cancelExport();}});
document.addEventListener('focusout',event=>{focusEdits.delete(event.target);});
document.addEventListener('pointerdown',event=>{if(event.target.matches('input[type=range]'))focusEdits.delete(event.target);});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();downloadWorkspace();}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!event.target.matches('input,textarea,[contenteditable=true]')){event.preventDefault();if(event.shiftKey)restoreHistory(redoStack,undoStack);else restoreHistory(undoStack,redoStack);}
});
for(const link of all('a[href="beam.html"], a[href="poster.html"]'))link.addEventListener('click',async event=>{
  event.preventDefault();const saved=await flushSave();if(saved===false){announce('Download your project to keep changes before leaving this page.',{error:true});return;}location.href=link.href;
});
window.addEventListener('hashchange',()=>{if(ready)route();});
window.addEventListener('pageshow',async event=>{
  if(!event.persisted||!ready)return;
  stopMotion();
  if(pendingSave||saveFailed||$('#workspace-save-status').dataset.status==='saving'){
    setSaveStatus('error');announce('This page has unsaved changes. Download your project before reloading to see updates from the poster editor.',{error:true,persistent:true});return;
  }
  try{
    workspace=await loadWorkspace();undoStack=[];redoStack=[];focusEdits=new WeakSet();revision++;
    setSaveStatus('saved');syncHistory();renderEventSummary();route();
  }catch(error){setSaveStatus('error');announce(error.message||'The latest library could not be opened. Download your project to keep this copy.',{error:true,persistent:true});}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave();});
window.addEventListener('pagehide',()=>{flushSave();stopMotion();});
async function start(){
  try{workspace=await loadWorkspace();ready=true;setSaveStatus('saved');renderEventSummary();route();}
  catch(error){ready=true;setSaveStatus('error');announce(error.message||'The saved library could not be opened. You can open a downloaded project.',{error:true,persistent:true});renderEventSummary();showLibrary();}
}
start();
