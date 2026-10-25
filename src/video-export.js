// Canvas capture is a real-time recorder: the poster is drawn on its own canvas,
// with the same scene renderer as the preview and image exports.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E028',
  'video/mp4',
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp9',
  'video/webm',
];

export function videoFormatForMime(mimeType) {
  const type = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (type === 'video/mp4') return {mimeType, extension: 'mp4', label: 'MP4 video'};
  if (type === 'video/webm') return {mimeType, extension: 'webm', label: 'WebM video'};
  return null;
}

/** Query without allocating a stream or asking for device permissions. */
export function getVideoExportSupport(environment = globalThis) {
  const Recorder = environment.MediaRecorder;
  if (typeof Recorder !== 'function' || typeof environment.HTMLCanvasElement?.prototype?.captureStream !== 'function') {
    return {supported: false, mimeType: null, extension: null, label: 'Video unavailable', formats: [], reason: 'This browser does not support canvas video export.'};
  }
  const formats = MIME_CANDIDATES.filter(mime => {
    try { return Recorder.isTypeSupported(mime); } catch { return false; }
  }).map(videoFormatForMime);
  if (!formats.length) return {supported: false, mimeType: null, extension: null, label: 'Video unavailable', formats, reason: 'This browser has no supported MP4 or WebM recorder.'};
  return {supported: true, ...formats[0], formats, reason: null};
}

export function videoOutputSize(width, height, maxSide = 1920) {
  if (![width, height, maxSide].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Video dimensions must be positive numbers.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const even = value => Math.max(2, Math.min(Math.floor(maxSide / 2) * 2, Math.round(value * scale / 2) * 2));
  return {width: even(width), height: even(height)};
}

const abortError = () => new DOMException('Video export cancelled.', 'AbortError');

/**
 * Record one loop. renderFrame(ctx, phase) is synchronous and receives source
 * poster coordinates; output scaling is already applied. phase never reaches 1.
 * onProgress is a number from 0 to 1; 1 means the complete Blob is available.
 */
export async function exportVideo({width, height, duration = 8, fps = 30, renderFrame, onProgress = () => {}, signal} = {}) {
  if (signal?.aborted) throw abortError();
  if (typeof renderFrame !== 'function') throw new TypeError('A poster frame renderer is required.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 || !Number.isFinite(fps) || fps < 1 || fps > 60) throw new RangeError('Choose a video duration up to 60 seconds and a frame rate from 1 to 60.');
  const size = videoOutputSize(width, height), support = getVideoExportSupport();
  if (!support.supported) throw new Error(support.reason);
  if (document.hidden) throw new Error('Keep the poster tab visible while exporting a video.');

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('A video drawing surface could not be created.');
  const scaleX = size.width / width, scaleY = size.height / height;
  function draw(phase) {
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      const result = renderFrame(ctx, phase);
      if (result && typeof result.then === 'function') throw new TypeError('Video frame rendering must be synchronous.');
    } finally { ctx.restore(); }
  }

  // Prepare a complete poster before capture starts, so the stream cannot begin
  // with an empty or selection-overlay frame.
  draw(0);
  let stream = null, recorder = null;
  try {
    stream = canvas.captureStream(0);
    let track = stream.getVideoTracks()[0];
    if (!track) throw new Error('The browser could not create a video track.');
    if (typeof track.requestFrame !== 'function') {
      for (const item of stream.getTracks()) item.stop();
      stream = canvas.captureStream(fps);
      track = stream.getVideoTracks()[0];
      if (!track) throw new Error('The browser could not create a video track.');
    }
    // Hardware encoders may reject a MIME that isTypeSupported advertised. Try
    // the remaining supported containers before showing a failure.
    for (const format of support.formats) {
      try {
        recorder = new MediaRecorder(stream, {mimeType: format.mimeType, videoBitsPerSecond: 10000000});
        break;
      } catch { /* Try the next supported native format. */ }
    }
    if (!recorder) throw new Error('The browser could not start an MP4 or WebM encoder.');
    if (signal?.aborted) throw abortError();

    return await new Promise((resolve, reject) => {
      const chunks = [], totalFrames = Math.max(1, Math.round(duration * fps)), durationMs = duration * 1000, frameMs = durationMs / totalFrames;
      let finished = false, stopping = false, frameTimer = null, watchdog = null, startedAt = 0, lastFrame = -1, framesRendered = 0;
      const listeners = [];
      function listen(target, name, callback) {
        target.addEventListener(name, callback);
        listeners.push(() => target.removeEventListener(name, callback));
      }
      function cleanup() {
        clearTimeout(frameTimer);
        clearTimeout(watchdog);
        for (const remove of listeners) remove();
        if (recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
        for (const item of stream.getTracks()) item.stop();
      }
      function fail(error) {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error instanceof Error || error instanceof DOMException ? error : new Error('Video export failed.'));
      }
      function stopRecording() {
        if (stopping || finished) return;
        stopping = true;
        clearTimeout(frameTimer);
        clearTimeout(watchdog);
        watchdog = setTimeout(() => fail(new Error('The video encoder did not finish. Please try again.')), 10000);
        try { recorder.stop(); } catch (error) { fail(error); }
      }
      function paintFrame() {
        if (finished || stopping) return;
        try {
          const elapsed = Math.max(0, performance.now() - startedAt);
          if (elapsed >= durationMs) { stopRecording(); return; }
          // Use wall time rather than a cumulative timeout. A delayed callback
          // skips ahead instead of stretching the loop or batching stale frames.
          const index = Math.min(totalFrames - 1, Math.floor(elapsed / frameMs));
          if (index > lastFrame) {
            draw(index / totalFrames);
            track.requestFrame?.();
            lastFrame = index;
            framesRendered++;
            onProgress(Math.min(.99, elapsed / durationMs));
          }
          if (finished || stopping) return;
          const nextTime = Math.min(durationMs, (index + 1) * frameMs);
          frameTimer = setTimeout(paintFrame, Math.max(1, startedAt + nextTime - performance.now()));
        } catch (error) { fail(error); }
      }

      listen(recorder, 'dataavailable', event => { if (!finished && event.data?.size) chunks.push(event.data); });
      listen(recorder, 'error', event => fail(event.error || new Error('The browser video encoder failed.')));
      listen(recorder, 'start', () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => fail(new Error('Video export took too long. Please try again.')), durationMs + 10000);
        paintFrame();
      });
      listen(recorder, 'stop', () => {
        if (finished) return;
        if (!stopping) { fail(new Error('Video recording ended before the loop finished.')); return; }
        const mimeType = recorder.mimeType || chunks.find(chunk => chunk.type)?.type || support.mimeType;
        const format = videoFormatForMime(mimeType);
        const blob = new Blob(chunks, {type: mimeType});
        if (!format || !blob.size) { fail(new Error('The encoder did not produce a playable video. Please try again.')); return; }
        try { onProgress(1); } catch (error) { fail(error); return; }
        if (finished) return;
        finished = true;
        cleanup();
        resolve({blob, ...format, ...size, duration, fps, framesRendered});
      });
      if (signal) listen(signal, 'abort', () => fail(abortError()));
      listen(document, 'visibilitychange', () => {
        if (document.hidden) fail(new Error('Video export paused because the poster tab was hidden. Keep it visible and try again.'));
      });
      if (signal?.aborted) { fail(abortError()); return; }
      watchdog = setTimeout(() => fail(new Error('The video encoder did not start. Please try again.')), 5000);
      try {
        startedAt = performance.now();
        recorder.start();
        // Some recorders emit `start` only after receiving their first sample.
        // Push that sample now instead of waiting for the event to draw it.
        draw(0);
        track.requestFrame?.();
        lastFrame = 0;
        framesRendered = 1;
        onProgress(0);
      } catch (error) { fail(error); }
    });
  } catch (error) {
    if (recorder?.state !== 'inactive') { try { recorder?.stop(); } catch {} }
    for (const track of stream?.getTracks() || []) track.stop();
    throw error;
  }
}
