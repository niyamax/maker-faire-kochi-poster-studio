#!/usr/bin/env node
/**
 * "The team grows": the headline fills the poster, then each role joins as a
 * new row of lettering and the rows above are redrawn shorter to make room.
 *
 *   node scripts/reel/team-grows.mjs --out reel.mp4
 *   node scripts/reel/team-grows.mjs --out reel-4k.mp4 --scale 2 --music lobby-time.mp3 --music-start 83.85
 *   node scripts/reel/team-grows.mjs --still 14.9 --out end-card.png --scale 2
 *
 * See docs/reels.md for the options and docs/reel-team-grows.md for the decisions.
 */
import {DEFAULTS, createScene, drawRow, ease, fieldBottom, finishSVG, footerMarkup, isMain, rise, runReel, stackRows} from './core.mjs';

export const CONFIG = {
  ...DEFAULTS,
  duration: 15,
  // [text, row weight, time it enters (s)]. Weight is the row's share of height.
  headline: [['JOIN', 1.4, 0.1], ['THE TEAM', 1.4, 0.45]],
  // [text, time it enters (s)]. Each role leads while it is the newest row.
  roles: [['VIDEOGRAPHERS', 2.0], ['EDITORS', 3.1], ['WRITERS', 4.2], ['DESIGNERS', 5.3]],
  relaxAt: 6.5,                      // the last role settles to its normal height
  rollCall: [7.2, 7.85, 8.5, 9.15],  // each role swells once, in order
  footerAt: 10.0,
  story: 'Help tell the stories of makers across Kerala.',
  url: 'makerfaire.in/volunteer',
  motion: {...DEFAULTS.motion, leadBoost: 0.75, callBoost: 0.6, callWidth: 0.26},
};

/** Row heights are shares of the field; a share animates from 0 as a row joins. */
function rowWeights(t, c) {
  const m = c.motion;
  const head = c.headline.map(([, weight, at]) => weight * rise(t, at, c));
  const roles = c.roles.map(([, at], i) => {
    const next = c.roles[i + 1]?.[1] ?? c.relaxAt;
    const lead = m.leadBoost * (1 - ease((t - next + .15) / .7));
    const call = m.callBoost * Math.exp(-(((t - c.rollCall[i]) / m.callWidth) ** 2));
    return rise(t, at, c) * (1 + lead + call);
  });
  return [...head, ...roles];
}

export function frame(t, c = CONFIG) {
  const scene = createScene(c);
  const rows = [...c.headline.map(([text, , at]) => [text, at]), ...c.roles];
  const rects = stackRows(rowWeights(t, c), c.layout.fieldTop, fieldBottom(t, c), c);
  rows.forEach(([text, at], i) => drawRow(scene, text, rects[i], {t, index: i, enteredAt: at, config: c}));
  return finishSVG(scene, footerMarkup(t, c));
}

if (isMain(import.meta.url)) await runReel({name: 'team-grows', config: CONFIG, frame});
