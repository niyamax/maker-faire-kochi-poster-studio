import {IMAGE_DEFAULTS} from './poster-image.js';
import {importPosterImage} from './image-import.js';

export function mountImageEditor({getMedia,onChange,prepareAssets,announce}){
  const $=id=>document.getElementById(id);let busy=false;
  async function load(file,layout){
    if(busy)return;busy=true;sync();$('image-status').textContent='Preparing image…';
    try{
      const asset=await importPosterImage(file);await prepareAssets(asset);
      onChange({...IMAGE_DEFAULTS,...(layout?{}:getMedia()),asset,layout:layout||getMedia()?.layout||'window',zoom:1,focusX:.5,focusY:.5},{remember:true});
      $('image-status').textContent='';
    }catch(error){$('image-status').textContent=error.message;announce(error.message);}
    finally{busy=false;sync();}
  }
  $('add-image').addEventListener('click',()=>$('image-file').click());
  $('replace-image').addEventListener('click',()=>$('image-file').click());
  $('image-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)load(file);event.target.value='';});
  $('remove-image').addEventListener('click',()=>onChange(null,{remember:true}));
  for(const button of document.querySelectorAll('[data-image-layout]'))button.addEventListener('click',()=>{
    const media=getMedia();if(media&&media.layout!==button.dataset.imageLayout)onChange({...media,layout:button.dataset.imageLayout},{remember:true});
  });
  for(const [id,key,multiplier]of [['image-zoom','zoom',100],['image-size','size',100],['image-overlap','overlap',100]]){
    const input=$(id);let recorded=false;
    input.addEventListener('pointerdown',()=>recorded=false);input.addEventListener('focus',()=>recorded=false);
    input.addEventListener('input',()=>{const media=getMedia();if(!media)return;onChange({...media,[key]:Number(input.value)/multiplier},{remember:!recorded});recorded=true;});
    input.addEventListener('change',()=>recorded=false);
  }
  for(const button of document.querySelectorAll('[data-image-position]'))button.addEventListener('click',()=>{
    const media=getMedia();if(media)onChange({...media,position:Number(button.dataset.imagePosition)},{remember:true});
  });
  $('reset-crop').addEventListener('click',()=>{const media=getMedia();if(media)onChange({...media,zoom:1,focusX:.5,focusY:.5},{remember:true});});
  for(const button of document.querySelectorAll('[data-image-sample]'))button.addEventListener('click',async()=>{
    if(busy)return;busy=true;sync();$('image-status').textContent='Preparing image…';
    try{
      const name=button.dataset.imageSample,response=await fetch(`assets/samples/${name}.png`);if(!response.ok)throw Error('The sample image could not load.');
      const blob=await response.blob();busy=false;await load(new File([blob],`${name}-sample.png`,{type:'image/png'}),name==='robot'?'cutout':'window');
    }catch(error){$('image-status').textContent=error.message;announce(error.message);}
    finally{busy=false;sync();}
  });
  function sync(){
    const media=getMedia();$('image-empty').hidden=Boolean(media);$('image-loaded').hidden=!media;
    $('add-image').disabled=busy;$('replace-image').disabled=busy;$('remove-image').disabled=busy;
    for(const button of document.querySelectorAll('[data-image-sample]'))button.disabled=busy;
    for(const button of document.querySelectorAll('[data-editor-layer="image"]'))button.disabled=!media;
    if(!media)return;
    if($('image-thumb').src!==media.asset.src)$('image-thumb').src=media.asset.src;
    $('image-name').textContent=media.asset.name;$('image-name').title=media.asset.name;
    for(const button of document.querySelectorAll('[data-image-layout]'))button.setAttribute('aria-pressed',String(button.dataset.imageLayout===media.layout));
    for(const element of document.querySelectorAll('[data-image-mode]'))element.hidden=element.dataset.imageMode!==media.layout;
    for(const [id,key]of [['image-zoom','zoom'],['image-size','size'],['image-overlap','overlap']]){$(id).value=Math.round(media[key]*100);$(id+'-value').textContent=`${Math.round(media[key]*100)}%`;}
    for(const button of document.querySelectorAll('[data-image-position]'))button.setAttribute('aria-pressed',String(Math.abs(Number(button.dataset.imagePosition)-media.position)<.015));
    $('image-object-hint').textContent=media.asset.hasAlpha?'Drag the object to place it. Overlap stays limited to the lettering.':'Use a transparent PNG or WebP for a floating object. This image keeps its background.';
  }
  sync();return {sync};
}
