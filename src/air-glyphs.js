/**
 * Air — inflated silhouettes made from the original Flex skeletons.
 *
 * airGlyphPaths(char, width, height, { pressure=.68, character=.7, phase=0 })
 * returns CLOSED, same-colour SVG paths. Fill each with the nonzero winding
 * rule. Closed skeletons keep oppositely wound inner contours for counters.
 * There is no browser dependency. All command/sample counts are fixed for a
 * given glyph, making the result suitable for SVG `d` interpolation.
 *
 * Pressure sets volume; character sets gently uneven lobes and bowed stems.
 * Phase makes a periodic breathing cycle: 0 and 1 are exactly the same pose.
 * Silhouettes meet a cell's bounds softly, so packed cells become constraints.
 */
import { glyphPath, glyphMetrics } from './flex-glyphs.js';

const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const fmt = n => String(Math.round(n * 1000) / 1000);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a, b, t) => a + (b - a) * t;
const STEPS = Object.freeze({ L: 12, Q: 16, C: 26 });
const CAP_STEPS = 20;
const CORNER_STEPS = 28;

// Deliberately fixed sampling per segment, never dependent on dimensions.
function skeletons(d) {
  const tokens = d.match(/[MLCQ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const paths = [];
  let i = 0, current = null, point = null;
  const read = () => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') {
      point = read(); current = { points: [point], corners: [] }; paths.push(current);
      continue;
    }
    if (!current || !STEPS[command]) throw new Error('Unexpected Flex skeleton command.');
    const start = point, a = read();
    const b = command === 'L' ? a : read();
    const c = command === 'C' ? read() : b;
    const count = STEPS[command], before = current.points.length - 1;
    for (let j = 1; j <= count; j++) {
      const t = j / count, u = 1 - t;
      let q;
      if (command === 'L') q = { x: mix(start.x, a.x, t), y: mix(start.y, a.y, t) };
      if (command === 'Q') q = {
        x: u * u * start.x + 2 * u * t * a.x + t * t * b.x,
        y: u * u * start.y + 2 * u * t * a.y + t * t * b.y,
      };
      if (command === 'C') q = {
        x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * c.x,
        y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * c.y,
      };
      current.points.push(q);
    }
    // Tight quadratic elbows need their circular swept area filled explicitly.
    // This also keeps inflated K/M/N/V/W corners free of tiny offset pinholes.
    if (command === 'Q') current.corners.push(before + count / 2);
    point = c;
  }
  for (const path of paths) {
    // Flex represents punctuation dots with a tiny round-capped segment. Its
    // endpoints are close, but it is a point stroke rather than a closed loop.
    path.point = path.points.every(point => dist(path.points[0], point) < .005);
    path.closed = !path.point && path.points.length > 8 && dist(path.points[0], path.points.at(-1)) < .005;
    if (path.closed) path.points.pop();
  }
  return paths;
}

function unitTangent(points, i, closed) {
  const count = points.length;
  let before = closed ? (i - 1 + count) % count : Math.max(0, i - 1);
  let after = closed ? (i + 1) % count : Math.min(count - 1, i + 1);
  // Zero-length straight sections at fully rounded corners are intentional.
  // Search past their duplicate samples instead of introducing an unstable normal.
  for (let j = 0; j < count && dist(points[before], points[i]) < 1e-8; j++) {
    const next = closed ? (before - 1 + count) % count : Math.max(0, before - 1);
    if (next === before) break;
    before = next;
  }
  for (let j = 0; j < count && dist(points[after], points[i]) < 1e-8; j++) {
    const next = closed ? (after + 1) % count : Math.min(count - 1, after + 1);
    if (next === after) break;
    after = next;
  }
  const incoming = { x: points[i].x - points[before].x, y: points[i].y - points[before].y };
  const outgoing = { x: points[after].x - points[i].x, y: points[after].y - points[i].y };
  const il = Math.hypot(incoming.x, incoming.y), ol = Math.hypot(outgoing.x, outgoing.y);
  // Samples on a long straight run can be farther apart than curve samples.
  // Average directions, not distances, to preserve tangency at their join.
  const dx = (il > 1e-8 ? incoming.x / il : 0) + (ol > 1e-8 ? outgoing.x / ol : 0);
  const dy = (il > 1e-8 ? incoming.y / il : 0) + (ol > 1e-8 ? outgoing.y / ol : 0);
  const length = Math.hypot(dx, dy);
  return length > 1e-8 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
}

function closedCurve(points, width, height) {
  // Ease into the cell edge instead of chopping every overflowing sample onto
  // it. Hard clamps made inflated terminals develop flat cuts and tiny kinks.
  // This monotone map has a continuous first derivative and preserves winding.
  const shoulder = Math.min(width, height) * .075;
  const contain = (value, limit) => value < shoulder
    ? shoulder * Math.exp((value - shoulder) / shoulder)
    : value > limit - shoulder
      ? limit - shoulder * Math.exp((limit - shoulder - value) / shoulder)
      : value;
  const bounded = points.map(p => ({ x: contain(p.x, width), y: contain(p.y, height) }));
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(bounded.at(-1), bounded[0]);
  let d = `M${fmt(start.x)} ${fmt(start.y)}`;
  for (let i = 0; i < bounded.length; i++) {
    const p = bounded[i], next = mid(p, bounded[(i + 1) % bounded.length]);
    d += `Q${fmt(p.x)} ${fmt(p.y)} ${fmt(next.x)} ${fmt(next.y)}`;
  }
  return d + 'Z';
}

function disk(point, radius, width, height) {
  return closedCurve(Array.from({ length: CORNER_STEPS }, (_, i) => {
    const angle = TAU * i / CORNER_STEPS;
    return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
  }), width, height);
}

export function airGlyphPaths(character, width, height, options = {}) {
  const W = finite(width, 0), H = finite(height, 0);
  if (W <= 0 || H <= 0) return [];
  const char = String(character ?? '').toUpperCase();
  if (!char || char === ' ') return [];
  const pressure = clamp(finite(options.pressure, .68), 0, 1);
  const personality = clamp(finite(options.character, .7), 0, 1);
  const incomingPhase = finite(options.phase, 0);
  const phase = ((incomingPhase % 1) + 1) % 1;
  const narrow = glyphMetrics(char) <= .35;
  const stacked = 'ABGPRS2345689&?@'.includes(char);
  const ring = 'OQ0'.includes(char);
  const punctuated = char === '?' || char === '!';
  // Preserve a clear gap above the lower dot, including in wide/inflated cells.
  const cap = Math.min(W * (narrow ? .46 : ring ? .205 : .235), H * (punctuated ? .115 : stacked ? .135 : .195));
  const radius = cap * (.42 + pressure * .58) * clamp(finite(options.volume,1),.3,1.2);
  // A small amount of overfill supplies broad, flat contact rather than a gap
  // between the drawing's edge and the visible bounds of the packed cell.
  const d = typeof options.skeleton==='function'
    ? options.skeleton(W,H,radius*1.66)
    : glyphPath(char, W, H, { weight: radius * 1.66, roundness: .93 + .07 * personality });
  const paths = skeletons(d), output = [];
  const identity = [...char].reduce((s, c) => (s * 17 + c.codePointAt(0)) % 101, 0) / 101;

  paths.forEach((path, pathIndex) => {
    const points = path.points, count = points.length;
    if (path.point) {
      const center = points.reduce((total, point) => ({x:total.x+point.x/count,y:total.y+point.y/count}), {x:0,y:0});
      output.push(disk(center, radius, W, H));
      return;
    }
    const lengths = [0];
    for (let i = 1; i < count; i++) lengths.push(lengths.at(-1) + dist(points[i], points[i - 1]));
    const total = lengths.at(-1) + (path.closed ? dist(points[0], points.at(-1)) : 0) || 1;
    const seed = identity + pathIndex * .29;
    const positions = [], radii = [];
    for (let i = 0; i < count; i++) {
      const t = lengths[i] / total, tangent = unitTangent(points, i, path.closed);
      const n = { x: -tangent.y, y: tangent.x };
      const envelope = path.closed ? 1 : Math.sin(Math.PI * t) ** 2;
      const wave = .88 * Math.sin(TAU * (t + seed + phase))
        + .12 * Math.sin(TAU * (2 * t - seed - phase));
      const terminal = path.closed ? 0 : 1 - envelope;
      const swell = 1 + personality * (.20 * wave + .05 * envelope + .06 * terminal);
      radii.push(radius * swell);
      const bow = personality * radius * .15 * envelope * Math.sin(TAU * (t + phase + seed));
      positions.push({ x: points[i].x + n.x * bow, y: points[i].y + n.y * bow });
    }

    const left = [], right = [], normals = [];
    for (let i = 0; i < count; i++) {
      const tangent = unitTangent(positions, i, path.closed);
      const n = { x: -tangent.y, y: tangent.x }, p = positions[i], r = radii[i];
      normals.push(n);
      left.push({ x: p.x + n.x * r, y: p.y + n.y * r });
      right.push({ x: p.x - n.x * r, y: p.y - n.y * r });
    }

    if (path.closed) {
      // Opposite windings preserve the central counter with Canvas/SVG nonzero.
      output.push(closedCurve(left, W, H) + closedCurve(right.reverse(), W, H));
    } else {
      const outline = [...left];
      const end = positions.at(-1), er = radii.at(-1), en = normals.at(-1);
      const endAngle = Math.atan2(en.y, en.x);
      for (let j = 1; j <= CAP_STEPS; j++) {
        const angle = endAngle - Math.PI * j / (CAP_STEPS + 1);
        outline.push({ x: end.x + Math.cos(angle) * er, y: end.y + Math.sin(angle) * er });
      }
      outline.push(...right.reverse());
      const start = positions[0], sr = radii[0], sn = normals[0];
      const startAngle = Math.atan2(sn.y, sn.x) + Math.PI;
      for (let j = 1; j <= CAP_STEPS; j++) {
        const angle = startAngle - Math.PI * j / (CAP_STEPS + 1);
        outline.push({ x: start.x + Math.cos(angle) * sr, y: start.y + Math.sin(angle) * sr });
      }
      output.push(closedCurve(outline, W, H));
    }

    for (const index of path.corners) {
      output.push(disk(positions[index], radii[index], W, H));
    }
  });
  return output;
}
