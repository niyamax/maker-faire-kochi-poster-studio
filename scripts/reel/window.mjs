#!/usr/bin/env node
/**
 * "Window": two lines of lettering fill the poster, then part to open a
 * photograph between them. The photograph drifts slowly while it is on screen.
 *
 *   node scripts/reel/window.mjs --out window.mp4 --photo path/to/photo.jpg
 *   node scripts/reel/window.mjs --still 9.5 --out window-end-card.png --scale 2
 *
 * Without --photo it uses the sample workshop image. See docs/reels.md.
 */
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULTS, createScene, drawRow, ease, fieldBottom, finishSVG, footerMarkup, isMain, option, prepareImage, rise, runReel, spring, stackRows} from './core.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const CONFIG = {
  ...DEFAULTS,
  duration: 10,
  above: ['HANDS-ON', 0.1],           // [text, time it enters (s)]
  below: ['WORKSHOPS', 0.45],
  openAt: 1.7,                        // the window starts to open
  lineWeight: 1, windowWeight: 2.5,   // the photo takes a little over half the field
  windowSpring: {hz: 1.4, damping: 0.7},   // slower and calmer than the lettering
  photo: 'assets/samples/workshop.png',
  focus: {x: 0.5, y: 0.42},           // which part of the photo stays in view (0–1)
  zoomFrom: 1.12, zoomTo: 1.02,       // slow pull-back while the window is open
  footerAt: 5.2,
  story: 'Learn by making, alongside the makers.',
  url: 'makerfaire.in',
};

export function frame(t, c = CONFIG, {photo} = {}) {
  const scene = createScene(c);
  const weights = [
    c.lineWeight * rise(t, c.above[1], c),
    c.windowWeight * spring(t - c.openAt, c.windowSpring.hz, c.windowSpring.damping),
    c.lineWeight * rise(t, c.below[1], c),
  ];
  const [top, window, bottom] = stackRows(weights, c.layout.fieldTop, fieldBottom(t, c), c);
  drawRow(scene, c.above[0], top, {t, index: 0, enteredAt: c.above[1], config: c});
  drawRow(scene, c.below[0], bottom, {t, index: 2, enteredAt: c.below[1], config: c});
  if (window && photo) {
    // Cover the window, then crop around the focus point.
    const zoom = c.zoomFrom + (c.zoomTo - c.zoomFrom) * ease((t - c.openAt) / (c.duration - c.openAt));
    const scale = Math.max(window.w / photo.width, window.h / photo.height) * zoom, w = window.w / scale, h = window.h / scale;
    scene.ops.push({kind: 'image', src: photo.file, ...window, source: {x: (photo.width - w) * c.focus.x, y: (photo.height - h) * c.focus.y, w, h}, naturalWidth: photo.width, naturalHeight: photo.height});
  }
  return finishSVG(scene, footerMarkup(t, c));
}

if (isMain(import.meta.url)) await runReel({
  name: 'window', config: CONFIG, frame,
  prepare: async work => ({photo: await prepareImage(resolve(option('photo', resolve(repo, CONFIG.photo))), work)}),
});
