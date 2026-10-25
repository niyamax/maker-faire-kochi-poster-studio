import test from 'node:test';
import assert from 'node:assert/strict';
import {getVideoExportSupport,videoFormatForMime,videoOutputSize,exportVideo} from '../src/video-export.js';

test('video dimensions fit all poster formats without enlarging and use even pixels', () => {
  assert.deepEqual(videoOutputSize(1080,1920), {width:1080,height:1920});
  assert.deepEqual(videoOutputSize(1920,1080), {width:1920,height:1080});
  assert.deepEqual(videoOutputSize(4000,5000), {width:1536,height:1920});
  const odd=videoOutputSize(851,1277);
  assert.equal(odd.width%2,0);assert.equal(odd.height%2,0);
  assert.throws(()=>videoOutputSize(0,100),RangeError);
});

test('support prefers available MP4 and reports a WebM fallback accurately', () => {
  class Canvas{};Canvas.prototype.captureStream=()=>{};
  class Recorder{};Recorder.isTypeSupported=mime=>mime==='video/mp4'||mime.includes('webm');
  assert.equal(getVideoExportSupport({MediaRecorder:Recorder,HTMLCanvasElement:Canvas}).extension,'mp4');
  Recorder.isTypeSupported=mime=>mime.includes('webm');
  const fallback=getVideoExportSupport({MediaRecorder:Recorder,HTMLCanvasElement:Canvas});
  assert.equal(fallback.extension,'webm');assert.equal(fallback.label,'WebM video');
  assert.equal(getVideoExportSupport({}).supported,false);
  assert.equal(videoFormatForMime('application/octet-stream'),null);
});

function installBrowser({manual=true,failMP4=false,empty=false}={}) {
  const descriptors=new Map(['document','MediaRecorder','HTMLCanvasElement'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const streams=[],recorders=[],contexts=[];
  class Track {stopped=false;frames=0;requestFrame=manual?()=>this.frames++:undefined;stop(){this.stopped=true;}}
  class Canvas {
    getContext(){const ctx={save(){},restore(){},setTransform(){},clearRect(){}};contexts.push(ctx);return ctx;}
    captureStream(rate){const track=new Track(),stream={rate,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(stream);return stream;}
  }
  class Recorder extends EventTarget {
    static isTypeSupported(mime){return mime.startsWith('video/mp4')||mime==='video/webm;codecs=vp8';}
    state='inactive';
    constructor(stream,options){super();if(failMP4&&options.mimeType.startsWith('video/mp4'))throw Error('No MP4 encoder');this.mimeType=options.mimeType;recorders.push(this);}
    start(){this.state='recording';queueMicrotask(()=>this.dispatchEvent(new Event('start')));}
    stop(){if(this.state==='inactive')return;this.state='inactive';queueMicrotask(()=>{const event=new Event('dataavailable');event.data=new Blob(empty?[]:['encoded frames'],{type:this.mimeType});this.dispatchEvent(event);this.dispatchEvent(new Event('stop'));});}
  }
  const doc=new EventTarget();doc.hidden=false;doc.createElement=()=>new Canvas();
  for(const [key,value] of Object.entries({document:doc,MediaRecorder:Recorder,HTMLCanvasElement:Canvas}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  return {streams,recorders,contexts,doc,restore(){for(const [key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('one complete recording samples the loop below phase one and stops every track', async () => {
  const browser=installBrowser();
  try{
    const phases=[],progress=[];
    const result=await exportVideo({width:1920,height:1080,duration:.12,fps:30,renderFrame:(ctx,phase)=>phases.push(phase),onProgress:value=>progress.push(value)});
    assert.equal(result.extension,'mp4');assert.equal(result.blob.type,result.mimeType.toLowerCase());
    assert.ok(result.blob.size>0);assert.equal(phases[0],0);
    assert.ok(phases.every(value=>value>=0&&value<1));
    assert.ok(phases.includes(.75));
    assert.equal(progress.at(-1),1);assert.equal(progress.filter(value=>value===1).length,1);
    assert.ok(browser.streams.every(stream=>stream.getTracks().every(track=>track.stopped)));
    assert.equal(browser.recorders[0].state,'inactive');
  }finally{browser.restore();}
});

test('unsupported manual frame capture falls back to automatic fps and actual container', async () => {
  const browser=installBrowser({manual:false,failMP4:true});
  try{
    const result=await exportVideo({width:1080,height:1080,duration:.08,fps:30,renderFrame(){}});
    assert.equal(result.extension,'webm');assert.ok(result.mimeType.startsWith('video/webm'));
    assert.deepEqual(browser.streams.map(stream=>stream.rate),[0,30]);
    assert.ok(browser.streams.every(stream=>stream.getTracks()[0].stopped));
  }finally{browser.restore();}
});

test('cancellation discards a partial recording and cleans up its stream', async () => {
  const browser=installBrowser();
  try{
    const controller=new AbortController();
    await assert.rejects(exportVideo({width:500,height:500,duration:8,renderFrame(){},signal:controller.signal,onProgress(){controller.abort();}}),{name:'AbortError'});
    assert.ok(browser.streams.every(stream=>stream.getTracks()[0].stopped));
    assert.equal(browser.recorders[0].state,'inactive');
  }finally{browser.restore();}
});

test('renderer errors and empty encodes reject instead of returning a broken video', async () => {
  const browser=installBrowser({empty:true});
  try{
    let renders=0;
    await assert.rejects(exportVideo({width:500,height:500,duration:.05,renderFrame(){if(++renders>1)throw Error('Frame failed');}}),/Frame failed/);
    assert.ok(browser.streams.every(stream=>stream.getTracks()[0].stopped));
    await assert.rejects(exportVideo({width:500,height:500,duration:.05,renderFrame(){}}),/did not produce/);
    assert.ok(browser.streams.every(stream=>stream.getTracks()[0].stopped));
  }finally{browser.restore();}
});
