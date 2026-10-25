import {IMAGE_DEFAULTS,scalePosterImage,alignPosterImage,imageWithRect} from './poster-image.js';
import {importPosterImage} from './image-import.js';

export function mountImageEditor({getMedia,getInfo,onChange,prepareAssets,announce,onEditMode=()=>{}}){
  const $=id=>document.getElementById(id);let busy=false,cropping=false,displayedSrc=null,lastMedia,lastWidth,lastHeight,lastBaseWidth,lastBusy,lastCropping;
  function setCropping(value){cropping=Boolean(value)&&getMedia()?.layout==='window';sync();onEditMode();}
  async function load(file,layout){
    if(busy)return;busy=true;sync();$('image-status').textContent='Preparing image…';
    try{
      const asset=await importPosterImage(file);await prepareAssets(asset);cropping=false;
      let media={...IMAGE_DEFAULTS,...(layout?{}:getMedia()),asset,layout:layout||getMedia()?.layout||'window',zoom:1,focusX:.5,focusY:.5};
      const info=getInfo();if(!layout&&getMedia()&&info)media=imageWithRect(media,info.frame,info);
      onChange(media,{remember:true});
      $('image-status').textContent='';
    }catch(error){$('image-status').textContent=error.message;announce(error.message);}
    finally{busy=false;sync();}
  }
  $('add-image').addEventListener('click',()=>$('image-file').click());
  $('replace-image').addEventListener('click',()=>$('image-file').click());
  $('image-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)load(file);event.target.value='';});
  $('remove-image').addEventListener('click',()=>{cropping=false;onChange(null,{remember:true});});
  for(const button of document.querySelectorAll('[data-image-layout]'))button.addEventListener('click',()=>{
    const media=getMedia();if(media&&media.layout!==button.dataset.imageLayout){cropping=false;onChange({...media,layout:button.dataset.imageLayout,freePlacement:true,size:1},{remember:true});}
  });
  for(const [id,key,multiplier]of [['image-zoom','zoom',100],['image-size','size',100],['image-reaction','reaction',100]]){
    const input=$(id);let recorded=false;
    input.addEventListener('pointerdown',()=>recorded=false);input.addEventListener('focus',()=>recorded=false);
    input.addEventListener('input',()=>{
      const media=getMedia(),info=getInfo();if(!media)return;
      const value=Number(input.value)/multiplier;
      if(key==='size'&&!info)return;
      onChange(key==='size'?scalePosterImage(media,info,value):{...media,[key]:value},{remember:!recorded});recorded=true;
    });
    input.addEventListener('change',()=>recorded=false);
  }
  for(const button of document.querySelectorAll('[data-image-align]'))button.addEventListener('click',()=>{
    const media=getMedia(),info=getInfo();if(media&&info)onChange(alignPosterImage(media,info,button.dataset.imageAlign),{remember:true});
  });
  $('toggle-image-crop').addEventListener('click',()=>setCropping(!cropping));
  $('reset-crop').addEventListener('click',()=>{const media=getMedia();if(media)onChange({...media,zoom:1,focusX:.5,focusY:.5},{remember:true});});
  $('reset-image-placement').addEventListener('click',()=>{
    const media=getMedia();if(!media)return;cropping=false;
    onChange({...media,freePlacement:true,size:1,boxes:{...media.boxes,[media.layout]:null}},{remember:true});
  });
  const samples={workshop:'window',robot:'cutout','studio-robot':'cutout'};
  $('image-sample-choice').addEventListener('change',async event=>{
    const name=event.target.value;if(busy||!Object.hasOwn(samples,name))return;
    busy=true;sync();$('image-status').textContent='Preparing image…';
    try{
      const response=await fetch(`assets/samples/${name}.png`);if(!response.ok)throw Error('The sample image could not load.');
      const blob=await response.blob();busy=false;await load(new File([blob],`${name}-sample.png`,{type:'image/png'}),samples[name]);
    }catch(error){$('image-status').textContent=error.message;announce(error.message);}
    finally{busy=false;lastMedia=undefined;sync();}
  });

  function sync(){
    const media=getMedia(),info=getInfo();if(!media||media.layout!=='window')cropping=false;
    if(media===lastMedia&&info?.frame.w===lastWidth&&info?.frame.h===lastHeight&&info?.baseFrame.w===lastBaseWidth&&busy===lastBusy&&cropping===lastCropping)return;
    lastMedia=media;lastWidth=info?.frame.w;lastHeight=info?.frame.h;lastBaseWidth=info?.baseFrame.w;lastBusy=busy;lastCropping=cropping;
    $('image-empty').hidden=Boolean(media);$('image-loaded').hidden=!media;
    $('add-image').disabled=busy;$('replace-image').disabled=busy;$('remove-image').disabled=busy;
    $('image-sample-choice').disabled=busy;
    if(!busy)$('image-sample-choice').value=Object.keys(samples).find(name=>media?.asset.name===`${name}-sample.png`)||'';
    for(const button of document.querySelectorAll('[data-editor-layer="image"]'))button.disabled=!media;
    if(!media)return;
    if(displayedSrc!==media.asset.src){$('image-thumb').src=media.asset.src;displayedSrc=media.asset.src;}
    $('image-name').textContent=media.asset.name;$('image-name').title=media.asset.name;
    for(const button of document.querySelectorAll('[data-image-layout]'))button.setAttribute('aria-pressed',String(button.dataset.imageLayout===media.layout));
    for(const element of document.querySelectorAll('[data-image-mode]'))element.hidden=element.dataset.imageMode!==media.layout;
    const scale=info?info.frame.w/info.baseFrame.w:media.size;
    if(info){const max=Math.floor(Math.min(4,info.width*2/info.baseFrame.w,info.height*2*info.frame.w/info.frame.h/info.baseFrame.w)*100);$('image-size').max=Math.max(1,max);$('image-size').min=Math.max(1,Math.min(10,Math.floor(scale*100),max));}
    for(const [id,value]of [['image-zoom',media.zoom],['image-size',scale],['image-reaction',media.reaction]]){
      if(document.activeElement!==$(id))$(id).value=Math.round(value*100);
      $(id+'-value').textContent=`${Math.round(value*100)}%`;
    }
    $('toggle-image-crop').setAttribute('aria-pressed',String(cropping));$('toggle-image-crop').textContent=cropping?'Done cropping':'Adjust crop';
    $('image-crop-controls').hidden=!cropping;
    $('image-object-hint').textContent=media.asset.hasAlpha?'Drag anywhere. Corner handles keep the object in proportion.':'This image keeps its background. A transparent PNG or WebP gives a floating object.';
  }
  sync();return {sync,setCropping,isCropping:()=>cropping};
}
