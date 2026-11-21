import test from 'node:test';
import assert from 'node:assert/strict';
import {exportVideo,getVideoExportSupport,videoBitrateForSize,videoFormatForMime,videoOutputSize} from '../src/video-export.js';

test('high-quality video sizes double the artwork, fit the output limit, and use even pixels',()=>{
  assert.deepEqual(videoOutputSize(1080,1920),{width:2160,height:3840});
  assert.deepEqual(videoOutputSize(1920,1080),{width:3840,height:2160});
  assert.deepEqual(videoOutputSize(4000,5000),{width:3072,height:3840});
  assert.deepEqual(videoOutputSize(1080,1920,3840,1),{width:1080,height:1920});
  const odd=videoOutputSize(851,1277,3840,1);
  assert.equal(odd.width%2,0);
  assert.equal(odd.height%2,0);
  assert.throws(()=>videoOutputSize(0,100),RangeError);
});

test('video capability requires WebCodecs and advertises both supported containers',()=>{
  const support=getVideoExportSupport({VideoEncoder:class {},VideoFrame:class {}});
  assert.equal(support.extension,'mp4');
  assert.deepEqual(support.formats.map(format=>format.extension),['mp4','webm']);
  assert.equal(getVideoExportSupport({VideoEncoder:class {}}).supported,false);
  assert.equal(videoFormatForMime('video/webm; codecs=vp9').extension,'webm');
  assert.equal(videoFormatForMime('application/octet-stream'),null);
});

test('bitrate scales with output size and frame rate within quality limits',()=>{
  assert.equal(videoBitrateForSize(320,240,30),16e6);
  assert.equal(videoBitrateForSize(3840,2160,60),64e6);
  assert.ok(videoBitrateForSize(2160,3840,60)>videoBitrateForSize(1080,1920,60));
});

test('invalid settings and an already cancelled export stop before encoding',async()=>{
  const options={width:500,height:500,renderFrame(){}};
  await assert.rejects(exportVideo({...options,duration:0}),RangeError);
  await assert.rejects(exportVideo({...options,fps:61}),RangeError);
  await assert.rejects(exportVideo({...options,renderFrame:null}),TypeError);
  await assert.rejects(exportVideo({...options,signal:AbortSignal.abort()}),{name:'AbortError'});
});
