/**
 * Shared parts of the Reel scripts: layout, easing, rows of live lettering,
 * the footer, and the SVG → PNG → MP4 pipeline.
 *
 * A style is one function, `frame(t, config, assets)`, that returns the SVG for
 * time `t` in seconds. See team-grows.mjs, swap.mjs and window.mjs, and
 * docs/reels.md for how to run them and write another.
 */
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {availableParallelism, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {posterSVG} from '../../src/scene.js';
import {layoutTreatment, appendTreatmentArtwork} from '../../src/treatment.js';
import {getLogoVariant} from '../../src/logo-library.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Settings every style starts from. A style spreads this and overrides what it needs. */
export const DEFAULTS = {
  width: 1080, height: 1920, fps: 30, duration: 10,
  // `text`, `bar` and `barText` default to fg, fg and bg when left out.
  colors: {bg: '#ED1C24', fg: '#FFFFFF'},
  logo: 'long-white',
  treatment: 'air',
  story: '', url: '',
  footerAt: 6,
  // Pixels of the 1080 × 1920 frame. One left edge, and everything inside the
  // centred 4:5 crop (y 285–1635) that the profile grid shows.
  layout: {
    left: 70, column: 940, logoTop: 300, logoWidth: 340,
    fieldTop: 396, fieldBottom: 1620, fieldBottomWithFooter: 1372, rowGap: 14,
    storyBaseline: 1442, storySize: 38, barTop: 1516, barHeight: 104, urlSize: 46, urlInset: 34,
  },
  motion: {
    energy: 0.9, curve: 'smooth', loopSeconds: 8, rowPhaseStep: 0.13,
    inflateFrom: 0.25, inflateTo: 0.84, inflateSeconds: 0.7,
    springHz: 1.7, springDamping: 0.62,
  },
  // Muffled "music from the next room" treatment, tuned for phone speakers.
  music: {
    filter: 'highpass=f=120,highpass=f=120,equalizer=f=450:t=q:w=0.8:g=4,lowpass=f=950,lowpass=f=950,lowpass=f=1000',
    gainDb: 2, limit: 0.7, fadeIn: 0.04, fadeOut: 2.2,
  },
};

// ---- Easing ----------------------------------------------------------------
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = t => 1 - (1 - clamp(t)) ** 3;
export function spring(t, hz = DEFAULTS.motion.springHz, damping = DEFAULTS.motion.springDamping) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz, wd = w * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + damping * w / wd * Math.sin(wd * t));
}
/** A row's entrance, using the config's spring. */
export const rise = (t, at, c) => spring(t - at, c.motion.springHz, c.motion.springDamping);
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function blend(from, to, amount) {
  const a = hexToRgb(from), b = hexToRgb(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * clamp(amount))).join(',')})`;
}
export const xml = s => String(s).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[ch]));

// ---- Building a frame ----------------------------------------------------------
/** A scene with the background and the logo at the top of the column. */
export function createScene(c) {
  const L = c.layout, logo = getLogoVariant(c.logo);
  const scene = {width: c.width, height: c.height, background: c.colors.bg, ops: [], direction: c.treatment};
  scene.ops.push({kind: 'image', src: logo.src, x: L.left, y: L.logoTop, w: L.logoWidth, h: L.logoWidth * logo.height / logo.width});
  return scene;
}
/** Where the lettering field ends: it gives up its lower part when the footer arrives. */
export function fieldBottom(t, c) {
  const L = c.layout;
  return L.fieldBottom - (L.fieldBottom - L.fieldBottomWithFooter) * easeOut((t - c.footerAt) / .9);
}
/**
 * Share the field between rows by weight. A weight near zero means the row is
 * absent. Returns one rectangle per weight, or null for rows too small to draw.
 */
export function stackRows(weights, top, bottom, c) {
  const L = c.layout, live = weights.filter(w => w > .02).length, total = weights.reduce((a, b) => a + b, 0) || 1;
  const room = bottom - top - L.rowGap * Math.max(0, live - 1);
  let y = top;
  return weights.map(w => {
    if (w <= .02) return null;
    const rect = {x: L.left, y, w: L.column, h: room * w / total};
    y += rect.h + L.rowGap;
    return rect.h < 10 ? null : rect;
  });
}
/**
 * Draw one row of lettering into `rect`. The letters are laid out afresh for
 * this size, inflate from `enteredAt`, and keep breathing on the studio's loop.
 */
export function drawRow(scene, text, rect, {t, index = 0, enteredAt = 0, config: c, pressureTo, settings = {}}) {
  if (!rect) return null;
  const m = c.motion, target = pressureTo ?? m.inflateTo;
  const pressure = m.inflateFrom + (target - m.inflateFrom) * easeOut((t - enteredAt) / m.inflateSeconds);
  const letters = layoutTreatment(text, rect, c.treatment, t / m.loopSeconds + index * m.rowPhaseStep, m.energy, {pressure, ...settings}, m.curve);
  appendTreatmentArtwork(scene, letters, c.colors, rect);
  return letters;
}
/** Story line and link bar. They wait half a second so the field has made room. */
export function footerMarkup(t, c) {
  const L = c.layout, {bg, fg} = c.colors, text = c.colors.text ?? fg, barFill = c.colors.bar ?? fg, barText = c.colors.barText ?? bg;
  const show = easeOut((t - c.footerAt - .5) / .7), slide = 36 * (1 - show);
  if (show <= 0) return '';
  const bar = L.barTop + slide;
  return (c.story ? `<text x="${L.left}" y="${L.storyBaseline + slide}" font-family="Inter" font-weight="500" font-size="${L.storySize}" fill="${blend(bg, text, show)}">${xml(c.story)}</text>` : '') +
    `<rect x="${L.left}" y="${bar}" width="${L.column}" height="${L.barHeight}" fill="${blend(bg, barFill, show)}"/>` +
    `<text x="${L.left + L.urlInset}" y="${bar + L.barHeight / 2 + L.urlSize * .35}" font-family="Inter" font-weight="700" font-size="${L.urlSize}" fill="${barText}" opacity="${show}">${xml(c.url)}</text>`;
}
/** Serialise the scene and append raw SVG markup (footer, overlays) on top. */
export const finishSVG = (scene, extra = '') => posterSVG(scene).replace('</g></svg>', extra + '</g></svg>');

// ---- Rendering ---------------------------------------------------------------
function need(tool, flag = '--version') {
  if (spawnSync(tool, [flag], {stdio: 'ignore'}).error) throw Error(`${tool} is required on PATH.`);
}
function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'inherit'], ...options});
    child.on('error', fail);
    child.on('close', code => code ? fail(Error(`${command} exited with ${code}`)) : done());
  });
}
/** Point librsvg at the repository's bundled Inter so output matches on any machine. */
function fontEnvironment(dir) {
  const conf = join(dir, 'fonts.conf');
  writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xml(join(repo, 'assets/fonts'))}</dir><cachedir>${xml(join(dir, 'fontcache'))}</cachedir></fontconfig>`);
  return {...process.env, FONTCONFIG_FILE: conf};
}
/**
 * Copy a photograph next to the frames, scaled to at most `maxWidth`, and
 * report its size. Frames refer to it by file name, which keeps each SVG small.
 */
export async function prepareImage(source, workDir, {name = 'photo.jpg', maxWidth = 1600} = {}) {
  need('ffmpeg', '-version'); need('ffprobe', '-version');
  const file = join(workDir, name);
  await run('ffmpeg', ['-v', 'error', '-y', '-i', resolve(source), '-vf', `scale='min(${maxWidth},iw)':-2`, '-q:v', '3', file]);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'});
  const [width, height] = probe.stdout.trim().split(',').map(Number);
  if (!width || !height) throw Error(`Could not read ${source}.`);
  return {file: name, width, height};
}
async function pool(items, size, work) {
  let next = 0;
  await Promise.all(Array.from({length: size}, async () => { while (next < items.length) await work(items[next++]); }));
}
export const option = (name, fallback) => { const args = process.argv.slice(2), i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };

/**
 * Command-line entry for a style.
 *   --out FILE  --scale 1|2  --still SECONDS  --music FILE  --music-start SECONDS
 * `prepare(workDir)` may return assets (for example a prepared photo) that are
 * passed to every `frame` call.
 */
export async function runReel({name, config: c, frame, prepare}) {
  const scale = Number(option('scale', 1)), still = option('still'), music = option('music'), musicStart = Number(option('music-start', 0));
  const out = resolve(option('out', still === undefined ? `${name}.mp4` : `${name}.png`));
  need('rsvg-convert');
  const work = mkdtempSync(join(tmpdir(), `${name}-`)), env = fontEnvironment(work);
  try {
    const assets = prepare ? await prepare(work) : {};
    const raster = async (file, t, png) => {
      const svg = join(work, `${file}.svg`);
      writeFileSync(svg, frame(t, c, assets));
      await run('rsvg-convert', ['-z', String(scale), svg, '-o', png], {env, cwd: work});
      rmSync(svg);
    };
    if (still !== undefined) { await raster('still', Number(still), out); console.log(`Wrote ${out}`); return; }
    need('ffmpeg', '-version');
    const count = Math.round(c.duration * c.fps), numbers = Array.from({length: count}, (_, n) => n);
    let finished = 0;
    await pool(numbers, Math.max(2, availableParallelism() - 1), async n => {
      const id = `f${String(n).padStart(5, '0')}`;
      await raster(id, n / c.fps, join(work, `${id}.png`));
      if (++finished % 60 === 0 || finished === count) process.stdout.write(`\rRendered ${finished}/${count} frames`);
    });
    process.stdout.write('\n');
    const m = c.music;
    await run('ffmpeg', ['-v', 'error', '-y', '-framerate', String(c.fps), '-i', join(work, 'f%05d.png'),
      ...(music ? ['-ss', String(musicStart), '-t', String(c.duration), '-i', resolve(music)] : []),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      ...(music ? ['-map', '0:v', '-map', '1:a:0', '-af',
        `${m.filter},volume=${m.gainDb}dB,alimiter=limit=${m.limit}:level=0,afade=t=in:d=${m.fadeIn},afade=t=out:st=${c.duration - m.fadeOut}:d=${m.fadeOut}`,
        '-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an']),
      '-movflags', '+faststart', out]);
    console.log(`Wrote ${out} (${c.width * scale} × ${c.height * scale}, ${c.fps} fps, ${c.duration} s${music ? ', with music' : ', silent'})`);
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
}
/** True when the given module is the script Node was started with. */
export const isMain = url => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(url);
