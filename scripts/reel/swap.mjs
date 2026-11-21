#!/usr/bin/env node
/**
 * "Swap": one line stays and the other keeps changing. Each new word rises
 * from below and presses the previous one flat against the fixed line.
 *
 *   node scripts/reel/swap.mjs --out swap.mp4
 *   node scripts/reel/swap.mjs --still 10.5 --out swap-end-card.png --scale 2
 *
 * See docs/reels.md.
 */
import {DEFAULTS, createScene, drawRow, ease, fieldBottom, finishSVG, footerMarkup, isMain, rise, runReel, stackRows} from './core.mjs';

export const CONFIG = {
  ...DEFAULTS,
  duration: 11,
  lead: ['COME AND', 0.1],            // [text, time it enters (s)]
  // [word, time it enters (s)]. The last word stays for the end card.
  words: [['BUILD', 0.5], ['REPAIR', 2.6], ['EXPERIMENT', 4.7], ['MAKE', 6.8]],
  leadWeight: 1, wordWeight: 2.1,     // the changing word is about twice the lead's height
  swapSeconds: 0.5,                   // how long a word takes to give way
  deflate: 0.5,                       // how much an outgoing word thins as it leaves
  footerAt: 8.2,
  story: 'Bring your curiosity.',
  url: 'makerfaire.in',
};

export function frame(t, c = CONFIG) {
  const scene = createScene(c), m = c.motion;
  const leaving = i => { const next = c.words[i + 1]?.[1]; return next === undefined ? 0 : ease((t - next + .05) / c.swapSeconds); };
  const weights = [c.leadWeight * rise(t, c.lead[1], c), ...c.words.map(([, at], i) => c.wordWeight * rise(t, at, c) * (1 - leaving(i)))];
  const rects = stackRows(weights, c.layout.fieldTop, fieldBottom(t, c), c);
  drawRow(scene, c.lead[0], rects[0], {t, index: 0, enteredAt: c.lead[1], config: c});
  c.words.forEach(([word, at], i) => drawRow(scene, word, rects[i + 1], {
    t, index: i + 1, enteredAt: at, config: c, pressureTo: m.inflateTo - c.deflate * leaving(i),
  }));
  return finishSVG(scene, footerMarkup(t, c));
}

if (isMain(import.meta.url)) await runReel({name: 'swap', config: CONFIG, frame});
