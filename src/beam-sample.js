import './styles/beam.css';
import {BEAM_GLYPHS,beamGlyphGeometry,cleanBeamText,createBeamScene,drawBeamScene,beamSVG} from './beam-glyphs.js';

const $=id=>document.getElementById(id),canvas=$('beam-artwork'),context=canvas.getContext('2d');
const defaults={text:'MAKER\nFAIRE\nKOCHI',weight:.55,width:.85,joint:.55,contrast:.4,energy:1,connected:false,palette:'red',hero:0};
const state={...defaults};
try{
 const saved=JSON.parse(localStorage.getItem('maker-beam-sans-sample-v1')||'null');
 if(saved){
  if(typeof saved.text==='string')state.text=cleanBeamText(saved.text);
  for(const key of ['weight','width','joint','contrast','energy'])if(Number.isFinite(saved[key]))state[key]=Math.max(0,Math.min(key==='energy'?1.5:1,saved[key]));
  if(['red','white','cyan'].includes(saved.palette))state.palette=saved.palette;
  state.connected=saved.connected===true;
  if(Number.isFinite(saved.hero))state.hero=Math.max(0,Math.floor(saved.hero));
 }
}catch{}
let phase=0,playing=false,last=0,scene,dirty=true,noticeTimer;
const notice=message=>{$('beam-notice').textContent=message;$('beam-notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('beam-notice').hidden=true,3500);};
function save(){try{localStorage.setItem('maker-beam-sans-sample-v1',JSON.stringify(state));}catch{notice('Your browser could not save these sample settings. Downloads are still available.');}}
function sync(){
 $('beam-text').value=state.text;
 for(const key of ['weight','width','joint','contrast','energy']){
  $('beam-'+key).value=Math.round(state[key]*100);
  if($('beam-'+key+'-value'))$('beam-'+key+'-value').value=Math.round(state[key]*100);
 }
 $('beam-palette').value=state.palette;$('beam-connected').checked=state.connected;syncTransport();
}
function syncTransport(){
 $('beam-play').setAttribute('aria-label',playing?'Pause motion':'Play motion');$('beam-play-symbol').textContent=playing?'Ⅱ':'▶';
 $('beam-timeline').value=Math.round(phase*1000);$('beam-time').value=`${(phase*8).toFixed(1)} / 8s`;
 $('beam-mode').textContent=state.connected?'Connected words':'Individual letters';
 $('beam-emphasis').textContent=state.hero?`Emphasis follows column ${state.hero+1}. Click another letter to move it.`:'Click a letter to move the emphasis.';
}
function drawAlphabet(){
 const c=$('beam-alphabet'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#202522';
 const rows=['ABCDEFGHIJKLM','NOPQRSTUVWXYZ','0123456789&!?'];
 rows.forEach((line,row)=>{
  const slot=c.width/13,h=65,y=row*94+8;
  [...line].forEach((char,col)=>{
   const w=char==='I'?23:char==='M'||char==='W'?84:65;
   const geometry=beamGlyphGeometry(char,w,h,{weight:state.weight,joint:state.joint});
   ctx.save();ctx.translate(col*slot+(slot-w)/2,y);for(const d of geometry.paths)ctx.fill(new Path2D(d));ctx.restore();
  });
 });
}
function render(){
 scene=createBeamScene({...state,phase});drawBeamScene(context,scene,{guides:$('beam-guides').checked});dirty=false;
}
$('beam-text').addEventListener('input',event=>{
 const input=event.target.value,cleaned=cleanBeamText(input);state.text=cleaned;
 const changed=cleaned!==input.toUpperCase().replace(/\r\n?/g,'\n');
 $('beam-text-note').textContent=changed?'Preview uses supported characters, the first 4 lines and 26 characters per line.':'Uppercase Latin, numbers and punctuation. Up to 4 lines, 26 characters per line.';
 $('beam-text-note').dataset.warning=String(changed);dirty=true;save();
});
for(const key of ['weight','width','joint','contrast','energy'])$('beam-'+key).addEventListener('input',event=>{
 state[key]=Number(event.target.value)/100;if($('beam-'+key+'-value'))$('beam-'+key+'-value').value=event.target.value;
 dirty=true;if(key==='weight'||key==='joint')drawAlphabet();save();
});
$('beam-connected').addEventListener('change',event=>{state.connected=event.target.checked;syncTransport();dirty=true;save();});
$('beam-palette').addEventListener('change',event=>{state.palette=event.target.value;dirty=true;save();});
$('beam-guides').addEventListener('change',()=>dirty=true);
$('beam-play').addEventListener('click',()=>{playing=!playing;syncTransport();});
$('beam-timeline').addEventListener('input',event=>{playing=false;phase=Number(event.target.value)/1000;syncTransport();dirty=true;});
$('beam-reset').addEventListener('click',()=>{Object.assign(state,defaults);phase=0;playing=false;$('beam-guides').checked=false;sync();drawAlphabet();dirty=true;save();});
canvas.addEventListener('pointerdown',event=>{
 if(!scene)return;const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left)*scene.width/bounds.width,y=(event.clientY-bounds.top)*scene.height/bounds.height;
 const cell=scene.cells.find(cell=>x>=cell.x&&x<=cell.x+cell.w&&y>=cell.y&&y<=cell.y+cell.h);
 if(cell){state.hero=cell.col;dirty=true;syncTransport();save();canvas.focus({preventScroll:true});}
});
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();playing=!playing;syncTransport();}});
function download(blob,filename){
 const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(href),30000);
}
$('beam-download-svg').addEventListener('click',()=>{
 try{download(new Blob([beamSVG(createBeamScene({...state,phase}))],{type:'image/svg+xml;charset=utf-8'}),'beam-sans-specimen.svg');notice('SVG specimen downloaded.');}catch(error){notice(error.message);}
});
$('beam-download-png').addEventListener('click',async event=>{
 event.target.disabled=true;
 try{
  const output=document.createElement('canvas');output.width=1080;output.height=1350;drawBeamScene(output.getContext('2d'),createBeamScene({...state,phase}));
  const blob=await new Promise((resolve,reject)=>output.toBlob(blob=>blob?resolve(blob):reject(Error('The PNG could not be created. Try SVG.')),'image/png'));
  download(blob,'beam-sans-specimen.png');notice('PNG specimen downloaded.');
 }catch(error){notice(error.message);}finally{event.target.disabled=false;}
});
function tick(now){
 const elapsed=Math.min(.1,Math.max(0,(now-last)/1000||0));last=now;
 if(playing&&!document.hidden){phase=(phase+elapsed/8)%1;dirty=true;syncTransport();}
 if(dirty)render();requestAnimationFrame(tick);
}
sync();drawAlphabet();render();requestAnimationFrame(tick);
