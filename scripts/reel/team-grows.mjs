#!/usr/bin/env node
/**
 * "The team grows": a vertical Reel drawn with the Poster Studio lettering engine.
 *
 * The headline fills the poster. Each role joins as a new row of the same Air
 * lettering, and the rows above are redrawn shorter to make room. Nothing is
 * stretched as an image: every frame lays the letters out again at their new
 * size, so strokes and counters stay true.
 *
 * Run from the repository root:
 *   node scripts/reel/team-grows.mjs --out reel.mp4
 *   node scripts/reel/team-grows.mjs --out reel-4k.mp4 --scale 2 \
 *        --music lobby-time.mp3 --music-start 83.85
 *   node scripts/reel/team-grows.mjs --still 14.9 --out end-card.png --scale 2
 *
 * Needs Node 22+, plus `rsvg-convert` (librsvg) and `ffmpeg` on PATH.
 * See docs/reel-team-grows.md for the decisions behind the numbers.
 */
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {availableParallelism, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {posterSVG} from '../../src/scene.js';
import {layoutTreatment, appendTreatmentArtwork} from '../../src/treatment.js';
import {getLogoVariant} from '../../src/logo-library.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---- Content and timing: edit this block to make a new reel ----------------
export const CONFIG = {
  width: 1080, height: 1920, fps: 30, duration: 15,
  colors: {bg: '#ED1C24', fg: '#FFFFFF'},
  logo: 'long-white',
  treatment: 'air',
  // [text, row weight, time it enters (s)]. Weight is the row's share of height.
  headline: [['JOIN', 1.4, 0.1], ['THE TEAM', 1.4, 0.45]],
  // [text, time it enters (s)]. Each role leads while it is the newest row.
  roles: [['VIDEOGRAPHERS', 2.0], ['EDITORS', 3.1], ['WRITERS', 4.2], ['DESIGNERS', 5.3]],
  relaxAt: 6.5,                      // the last role settles to its normal height
  rollCall: [7.2, 7.85, 8.5, 9.15],  // each role swells once, in order
  footerAt: 10.0,                    // lettering tightens, then footer appears
  story: 'Help tell the stories of makers across Kerala.',
  url: 'makerfaire.in/volunteer',
  // Layout, in pixels of the 1080 × 1920 frame. Everything shares one left edge
  // and sits inside the centred 4:5 crop (y 285–1635) used for the grid preview.
  layout: {
    left: 70, column: 940, logoTop: 300, logoWidth: 340,
    fieldTop: 396, fieldBottom: 1620, fieldBottomWithFooter: 1372, rowGap: 14,
    storyBaseline: 1442, storySize: 38, barTop: 1516, barHeight: 104, urlSize: 46, urlInset: 34,
  },
  // Motion feel.
  motion: {
    energy: 0.9, curve: 'smooth', loopSeconds: 8, rowPhaseStep: 0.13,
    inflateFrom: 0.25, inflateTo: 0.84, inflateSeconds: 0.7,
    leadBoost: 0.75, callBoost: 0.6, callWidth: 0.26,
    springHz: 1.7, springDamping: 0.62,
  },
  // Muffled "music from the next room" treatment, tuned for phone speakers.
  music: {
    filter: 'highpass=f=120,highpass=f=120,equalizer=f=450:t=q:w=0.8:g=4,lowpass=f=950,lowpass=f=950,lowpass=f=1000',
    gainDb: 2, limit: 0.7, fadeIn: 0.04, fadeOut: 2.2,
  },
};

// ---- Easing ----------------------------------------------------------------
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - (1 - clamp(t)) ** 3;
function spring(t, hz, damping) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz, wd = w * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + damping * w / wd * Math.sin(wd * t));
}
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function blend(from, to, amount) {
  const a = hexToRgb(from), b = hexToRgb(to);
  return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * clamp(amount))).join(',')})`;
}
const xml = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));

// ---- One frame ---------------------------------------------------------------
/** Row heights are shares of the field; a share animates from 0 as a row joins. */
function rowWeights(t, c) {
  const m = c.motion, rise = at => spring(t - at, m.springHz, m.springDamping);
  const head = c.headline.map(([, weight, at]) => weight * rise(at));
  const roles = c.roles.map(([, at], i) => {
    const next = c.roles[i + 1]?.[1] ?? c.relaxAt;
    const lead = m.leadBoost * (1 - ease((t - next + .15) / .7));
    const call = m.callBoost * Math.exp(-(((t - c.rollCall[i]) / m.callWidth) ** 2));
    return rise(at) * (1 + lead + call);
  });
  return [...head, ...roles];
}

export function frameSVG(t, c = CONFIG) {
  const L = c.layout, m = c.motion, {bg, fg} = c.colors;
  const scene = {width: c.width, height: c.height, background: bg, ops: [], direction: c.treatment};
  const logo = getLogoVariant(c.logo);
  scene.ops.push({kind: 'image', src: logo.src, x: L.left, y: L.logoTop, w: L.logoWidth, h: L.logoWidth * logo.height / logo.width});

  // The field gives up its lower part when the footer arrives.
  const tighten = easeOut((t - c.footerAt) / .9);
  const fieldBottom = L.fieldBottom - (L.fieldBottom - L.fieldBottomWithFooter) * tighten;
  const rows = [...c.headline.map(([text, , at]) => [text, at]), ...c.roles];
  const weights = rowWeights(t, c);
  const live = weights.filter(w => w > .02).length, total = weights.reduce((a, b) => a + b, 0);
  const room = fieldBottom - L.fieldTop - L.rowGap * Math.max(0, live - 1);
  let y = L.fieldTop;
  rows.forEach(([text, at], i) => {
    if (weights[i] <= .02) return;
    const rect = {x: L.left, y, w: L.column, h: room * weights[i] / total};
    y += rect.h + L.rowGap;
    if (rect.h < 10) return;
    // Letters inflate as their row arrives, then keep breathing on the studio's loop.
    const pressure = m.inflateFrom + (m.inflateTo - m.inflateFrom) * easeOut((t - at) / m.inflateSeconds);
    const letters = layoutTreatment(text, rect, c.treatment, t / m.loopSeconds + i * m.rowPhaseStep, m.energy, {pressure}, m.curve);
    appendTreatmentArtwork(scene, letters, c.colors, rect);
  });

  // Footer waits until the field has made room for it.
  const show = easeOut((t - c.footerAt - .5) / .7), slide = 36 * (1 - show);
  let footer = '';
  if (show > 0) {
    const ink = blend(bg, fg, show), bar = L.barTop + slide;
    footer =
      `<text x="${L.left}" y="${L.storyBaseline + slide}" font-family="Inter" font-weight="500" font-size="${L.storySize}" fill="${ink}">${xml(c.story)}</text>` +
      `<rect x="${L.left}" y="${bar}" width="${L.column}" height="${L.barHeight}" fill="${ink}"/>` +
      `<text x="${L.left + L.urlInset}" y="${bar + L.barHeight / 2 + L.urlSize * .35}" font-family="Inter" font-weight="700" font-size="${L.urlSize}" fill="${bg}" opacity="${show}">${xml(c.url)}</text>`;
  }
  return posterSVG(scene).replace('</g></svg>', footer + '</g></svg>');
}

// ---- Rendering ---------------------------------------------------------------
function need(tool) {
  if (spawnSync(tool, ['--version'], {stdio: 'ignore'}).error) throw Error(`${tool} is required on PATH.`);
}
/** Point librsvg at the repository's bundled Inter so output matches on any machine. */
function fontEnvironment(dir) {
  const conf = join(dir, 'fonts.conf');
  writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xml(join(repo, 'assets/fonts'))}</dir><cachedir>${xml(join(dir, 'fontcache'))}</cachedir></fontconfig>`);
  return {...process.env, FONTCONFIG_FILE: conf};
}
function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'inherit'], ...options});
    child.on('error', fail);
    child.on('close', code => code ? fail(Error(`${command} exited with ${code}`)) : done());
  });
}
async function pool(items, size, work) {
  let next = 0;
  await Promise.all(Array.from({length: size}, async () => { while (next < items.length) await work(items[next++]); }));
}

async function main() {
  const args = process.argv.slice(2), option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
  const scale = Number(option('scale', 1)), still = option('still'), music = option('music'), musicStart = Number(option('music-start', 0));
  const out = resolve(option('out', still === undefined ? 'team-grows.mp4' : 'team-grows.png'));
  const c = CONFIG, work = mkdtempSync(join(tmpdir(), 'team-grows-'));
  need('rsvg-convert');
  const env = fontEnvironment(work);
  try {
    if (still !== undefined) {
      const svg = join(work, 'still.svg'); writeFileSync(svg, frameSVG(Number(still), c));
      await run('rsvg-convert', ['-z', String(scale), svg, '-o', out], {env});
      console.log(`Wrote ${out}`); return;
    }
    need('ffmpeg');
    const frames = join(work, 'frames'); mkdirSync(frames);
    const count = Math.round(c.duration * c.fps), names = Array.from({length: count}, (_, n) => `f${String(n).padStart(5, '0')}`);
    let finished = 0;
    await pool(names, Math.max(2, availableParallelism() - 1), async name => {
      const svg = join(frames, `${name}.svg`);
      writeFileSync(svg, frameSVG(Number(name.slice(1)) / c.fps, c));
      await run('rsvg-convert', ['-z', String(scale), svg, '-o', join(frames, `${name}.png`)], {env});
      rmSync(svg);
      if (++finished % 60 === 0 || finished === count) process.stdout.write(`\rRendered ${finished}/${count} frames`);
    });
    process.stdout.write('\n');
    const video = ['-framerate', String(c.fps), '-i', join(frames, 'f%05d.png')];
    const colour = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
    const m = c.music, audio = music ? ['-ss', String(musicStart), '-t', String(c.duration), '-i', resolve(music)] : [];
    const mix = music ? ['-map', '0:v', '-map', '1:a:0', '-af',
      `${m.filter},volume=${m.gainDb}dB,alimiter=limit=${m.limit}:level=0,afade=t=in:d=${m.fadeIn},afade=t=out:st=${c.duration - m.fadeOut}:d=${m.fadeOut}`,
      '-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an'];
    await run('ffmpeg', ['-v', 'error', '-y', ...video, ...audio, ...colour, ...mix, '-movflags', '+faststart', out]);
    console.log(`Wrote ${out} (${c.width * scale} × ${c.height * scale}, ${c.fps} fps, ${c.duration} s${music ? ', with music' : ', silent'})`);
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
