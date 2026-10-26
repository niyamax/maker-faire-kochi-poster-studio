import {Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,Quality,canEncodeVideo} from 'mediabunny';

export const VIDEO_DEFAULTS=Object.freeze({fps:60,renderScale:2,maxSide:3840});
const abortError=()=>new DOMException('Video export cancelled.','AbortError');
const checkAbort=signal=>{if(signal?.aborted)throw abortError();};
const artworkError=value=>Object.assign(value instanceof Error?value:new Error(String(value)),{artworkFailure:true});

export function videoFormatForMime(mimeType){
  const type=String(mimeType||'').split(';')[0].trim().toLowerCase();
  if(type==='video/mp4')return {mimeType,extension:'mp4',label:'MP4 video'};
  if(type==='video/webm')return {mimeType,extension:'webm',label:'WebM video'};
  return null;
}

// Codec and dimension support is negotiated when the user starts an export.
export function getVideoExportSupport(environment=globalThis){
  const supported=typeof environment.VideoEncoder==='function'&&typeof environment.VideoFrame==='function';
  if(!supported)return {supported:false,mimeType:null,extension:null,label:'Video unavailable',formats:[],reason:'High-quality video export needs WebCodecs. Open this page in a current Chrome, Edge or Safari browser.'};
  return {supported:true,mimeType:'video/mp4',extension:'mp4',label:'Video · High quality',formats:[videoFormatForMime('video/mp4'),videoFormatForMime('video/webm')],reason:null};
}

export function videoOutputSize(width,height,maxSide=VIDEO_DEFAULTS.maxSide,renderScale=VIDEO_DEFAULTS.renderScale){
  if(![width,height,maxSide,renderScale].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Video dimensions must be positive numbers.');
  const scale=Math.min(renderScale,maxSide/Math.max(width,height));
  const even=n=>Math.max(2,Math.min(Math.floor(maxSide/2)*2,Math.round(n*scale/2)*2));
  return {width:even(width),height:even(height)};
}
export function videoBitrateForSize(width,height,fps=60){return Math.round(Math.max(16e6,Math.min(64e6,width*height*fps*.14)));}

async function configurations(width,height,{fps,maxSide,renderScale,signal}){
  const high=videoOutputSize(width,height,maxSide,renderScale),native=videoOutputSize(width,height,maxSide,1);
  const sizes=[high];if(native.width!==high.width||native.height!==high.height)sizes.push(native);
  const rates=fps>30?[fps,30]:[fps],configs=[];
  for(const rate of rates)for(const size of sizes)for(const codec of ['avc','vp9']){
    checkAbort(signal);
    const bitrate=videoBitrateForSize(size.width,size.height,rate);
    const quality=new Quality({quantizer:18,bitrate,bitrateMode:'variable'});
    const settings={codec,quality,latencyMode:'quality',hardwareAcceleration:'no-preference',contentHint:'detail',alpha:'discard',keyFrameInterval:2};
    let supported=false;
    try{supported=await canEncodeVideo(codec,{...size,frameRate:rate,quality,latencyMode:'quality',hardwareAcceleration:'no-preference',contentHint:'detail',alpha:'discard'});}catch{}
    if(supported)configs.push({...size,fps:rate,codec,quality,settings,bitrate,...videoFormatForMime(codec==='avc'?'video/mp4':'video/webm')});
  }
  return configs;
}

/** Render each exact timestamp, await encoding backpressure, then finalize.
 * Drawing may take longer than playback; no wall-clock frame skipping occurs.
 * renderFrame receives poster coordinates and may return a promise.
 */
export async function exportVideo({width,height,duration=8,fps=60,maxSide=3840,renderScale=2,renderFrame,onSetup=()=>{},onProgress=()=>{},signal}={}){
  checkAbort(signal);
  if(typeof renderFrame!=='function')throw new TypeError('A poster frame renderer is required.');
  if(!Number.isFinite(duration)||duration<=0||duration>60||!Number.isInteger(fps)||fps<1||fps>60)throw new RangeError('Choose a duration up to 60 seconds and a frame rate from 1 to 60.');
  const support=getVideoExportSupport();if(!support.supported)throw new Error(support.reason);
  onProgress(0,{stage:'preparing'});
  const options=await configurations(width,height,{fps,maxSide,renderScale,signal});checkAbort(signal);
  if(!options.length)throw new Error('This browser cannot encode this poster at high quality. Try Chrome or Edge.');
  let lastError;
  for(const config of options){
    checkAbort(signal);let output,cancelPromise,success=false,framesEncoded=0;
    const canvas=document.createElement('canvas');canvas.width=config.width;canvas.height=config.height;
    const ctx=canvas.getContext('2d',{alpha:false,colorSpace:'srgb'});
    if(!ctx)throw new Error('A video drawing surface could not be created.');
    const totalFrames=Math.max(1,Math.round(duration*config.fps)),exactDuration=totalFrames/config.fps;
    const cancel=()=>{if(output&&output.state!=='finalized'&&output.state!=='canceled'&&!cancelPromise)cancelPromise=output.cancel().catch(()=>{});};
    signal?.addEventListener('abort',cancel,{once:true});
    try{
      const info={width:config.width,height:config.height,fps:config.fps,codec:config.codec,targetBitrate:config.bitrate,totalFrames,duration:exactDuration};
      try{await onSetup(info);}catch(error){throw artworkError(error);}
      checkAbort(signal);onProgress(0,{...info,stage:'rendering',frame:0});
      const target=new BufferTarget();output=new Output({format:config.codec==='avc'?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat(),target});
      const source=new CanvasSource(canvas,{...config.settings,onEncodedPacket:()=>{framesEncoded++;}});
      output.addVideoTrack(source,{frameRate:config.fps,maximumPacketCount:totalFrames});await output.start();
      for(let frame=0;frame<totalFrames;frame++){
        checkAbort(signal);ctx.save();
        try{
          ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.setTransform(config.width/width,0,0,config.height/height,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          await renderFrame(ctx,frame/totalFrames,{...info,frame,timestamp:frame/config.fps});
        }catch(error){throw artworkError(error);}finally{ctx.restore();}
        checkAbort(signal);
        await source.add(frame/config.fps,1/config.fps,{keyFrame:frame%(config.fps*2)===0});
        onProgress(.96*(frame+1)/totalFrames,{...info,stage:'rendering',frame:frame+1});
        if(frame%3===2)await new Promise(resolve=>setTimeout(resolve,0));
      }
      checkAbort(signal);onProgress(.97,{...info,stage:'finalizing',frame:totalFrames});await output.finalize();checkAbort(signal);
      if(framesEncoded!==totalFrames)throw new Error('The encoder did not preserve every frame.');
      if(!target.buffer?.byteLength)throw new Error('The encoder did not produce a video file.');
      const blob=new Blob([target.buffer],{type:config.mimeType});success=true;onProgress(1,{...info,stage:'complete',frame:totalFrames});
      return {blob,mimeType:config.mimeType,extension:config.extension,label:config.label,...info,framesRendered:totalFrames,framesEncoded,actualBitrate:Math.round(blob.size*8/exactDuration),encoding:'frame-by-frame'};
    }catch(error){
      if(signal?.aborted)throw abortError();
      if(error?.artworkFailure)throw error;
      lastError=error;
    }finally{
      signal?.removeEventListener('abort',cancel);if(!success){cancel();if(cancelPromise)await cancelPromise;}
      canvas.width=canvas.height=1;
    }
  }
  throw new Error(`High-quality video encoding failed. ${lastError?.message||'Try another browser.'}`);
}
