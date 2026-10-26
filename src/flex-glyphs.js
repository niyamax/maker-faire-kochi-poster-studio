/**
 * Flex — an original, structural centreline alphabet.
 *
 * glyphPath(character, width, height, { roundness = 1, weight = 0, radius })
 * returns a native SVG/Path2D path. Draw with fill="none", round line caps and
 * round line joins. Coordinates occupy the supplied cell. Passing the actual
 * stroke `weight` insets the skeleton so its round caps remain inside the cell.
 * `roundness` is 0…1. `radius`, when supplied, fixes the preferred corner radius
 * in pixels while the cell stretches; it is limited only by available space.
 *
 * Curves are constructed again at the requested size. Straight runs lengthen;
 * circular corners do not become affine-stretched ellipses. All characters use
 * the same corner language, including the two-storey bowls of B, R, S and 8.
 * Lowercase input intentionally maps to the uppercase display alphabet.
 */

import {minimumInkGap,gCrossbarTip} from './glyph-anatomy.js';

const K = 0.5522847498307936;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const f = n => String(Math.round(n * 1000) / 1000);

const RATIOS = Object.freeze({
  A: .78, B: .74, C: .79, D: .79, E: .68, F: .66, G: .81,
  H: .79, I: .20, J: .65, K: .76, L: .66, M: 1.02, N: .82,
  O: .82, P: .72, Q: .85, R: .78, S: .77, T: .75, U: .80,
  V: .81, W: 1.09, X: .78, Y: .78, Z: .76,
  '0': .78, '1': .46, '2': .75, '3': .74, '4': .76,
  '5': .73, '6': .76, '7': .73, '8': .75, '9': .76,
  ' ': .36, '.': .18, ',': .22, ':': .18, ';': .22,
  '!': .20, '?': .67, '-': .50, '–': .70, '—': .95,
  '_': .65, '+': .65, '=': .65, '/': .55, '\\': .55,
  '(': .35, ')': .35, '[': .33, ']': .33, '{': .38, '}': .38,
  "'": .17, '’': .17, '"': .32, '“': .32, '”': .32,
  '&': .91, '*': .50, '#': .76, '@': .98, '%': .91,
});

/** Recommended cell width divided by cap height; returns a number. */
export function glyphMetrics(character) {
  return RATIOS[String(character ?? '').toUpperCase()] ?? .76;
}

export const supportedGlyphs = Object.freeze(Object.keys(RATIOS));

class Path {
  constructor() { this.commands = []; }
  m(x, y) { this.commands.push(`M${f(x)} ${f(y)}`); return this; }
  l(x, y) { this.commands.push(`L${f(x)} ${f(y)}`); return this; }
  c(x1, y1, x2, y2, x, y) {
    this.commands.push(`C${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x)} ${f(y)}`);
    return this;
  }
  q(x1, y1, x, y) { this.commands.push(`Q${f(x1)} ${f(y1)} ${f(x)} ${f(y)}`); return this; }
  toString() { return this.commands.join(''); }
}

function rect(p, l, t, r, b, radius) {
  const a = Math.max(0, Math.min(radius, (r - l) / 2, (b - t) / 2));
  const k = a * K;
  p.m(l + a, t).l(r - a, t)
    .c(r - a + k, t, r, t + a - k, r, t + a)
    .l(r, b - a).c(r, b - a + k, r - a + k, b, r - a, b)
    .l(l + a, b).c(l + a - k, b, l, b - a + k, l, b - a)
    .l(l, t + a).c(l, t + a - k, l + a - k, t, l + a, t);
}

function rightBowl(p, l, t, r, b, radius, move = true) {
  const a = Math.max(0, Math.min(radius, (r - l) * .52, (b - t) / 2));
  const k = a * K;
  if (move) p.m(l, t);
  p.l(r - a, t).c(r - a + k, t, r, t + a - k, r, t + a)
    .l(r, b - a).c(r, b - a + k, r - a + k, b, r - a, b).l(l, b);
}

// Filleted angular strokes, with trim lengths bounded by adjoining segments.
function polyline(p, points, radius = 0) {
  p.m(...points[0]);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const d1 = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const trim = Math.min(radius, d1 * .43, d2 * .43);
    if (trim === 0 || d1 === 0 || d2 === 0) { p.l(...b); continue; }
    const before = [b[0] + (a[0] - b[0]) / d1 * trim, b[1] + (a[1] - b[1]) / d1 * trim];
    const after = [b[0] + (c[0] - b[0]) / d2 * trim, b[1] + (c[1] - b[1]) / d2 * trim];
    p.l(...before).q(...b, ...after);
  }
  p.l(...points.at(-1));
}

// A tiny nonzero segment consistently renders round dots in SVG and Canvas.
const dot = (p, x, y) => p.m(x - .001, y).l(x + .001, y);

export function glyphPath(character, width, height, options = {}) {
  const W = finite(width, 0), H = finite(height, 0);
  if (W <= 0 || H <= 0) return '';
  const char = String(character ?? '').toUpperCase();
  if (!char || char === ' ') return '';
  const roundness = clamp(finite(options.roundness, 1), 0, 1);
  const stroke = clamp(finite(options.weight, 0), 0, Math.min(W, H) * .96);
  const inset = stroke / 2;
  const l = inset, t = inset, r = W - inset, b = H - inset;
  const w = r - l, h = b - t, cx = (l + r) / 2, m = t + h * .5;
  const x = u => l + w * u, y = v => t + h * v;
  const corner = Math.max(0, finite(options.radius, Math.min(w, h) * .5)) * roundness;
  const a = Math.min(corner, w / 2, h / 2), ak = a * K;
  const joint = Math.min(corner * .24, Math.min(w, h) * .12);
  const p = new Path();

  switch (char) {
    case 'A': {
      // An arched cap, two extensible pillars and an open, low crossbar.
      p.m(l, b).l(l, t + a).c(l, t + a - ak, l + a - ak, t, l + a, t)
        .l(r - a, t).c(r - a + ak, t, r, t + a - ak, r, t + a).l(r, b)
        .m(l, y(.59)).l(r, y(.59));
      break;
    }
    case 'B':
      p.m(l, b).l(l, t);
      rightBowl(p, l, t, x(.94), y(.47), corner);
      rightBowl(p, l, y(.47), r, b, corner, false);
      break;
    case 'C':
    case 'G': {
      // Broad outer shoulders with shorter right corners preserve a clear
      // aperture even when the letter is almost as wide as it is tall.
      const terminal = Math.min(corner, w * .27, h * .16), k = terminal * K;
      p.m(r, t + terminal)
        .c(r, t + terminal - k, r - terminal + k, t, r - terminal, t)
        .l(l + a, t).c(l + a - ak, t, l, t + a - ak, l, t + a)
        .l(l, b - a).c(l, b - a + ak, l + a - ak, b, l + a, b)
        .l(r - terminal, b)
        .c(r - terminal + k, b, r, b - terminal + k, r, b - terminal);
      if (char === 'G') {
        const barY=y(.60),ink=Math.max(stroke,finite(options.inkWeight,stroke));
        const bowl=l+(barY>b-a?a-Math.sqrt(Math.max(0,a*a-(barY-b+a)**2)):0);
        const tip=gCrossbarTip(x(.56),bowl,ink,minimumInkGap(W,H),Math.min(w,h)*.006);
        p.l(r,barY).l(Math.min(r,tip),barY);
      }
      break;
    }
    case 'D':
      p.m(l, b).l(l, t);
      rightBowl(p, l, t, r, b, corner, false);
      break;
    case 'E':
      polyline(p, [[r, t], [l, t], [l, b], [r, b]], joint);
      p.m(l, m).l(x(.82), m);
      break;
    case 'F':
      polyline(p, [[r, t], [l, t], [l, b]], joint);
      p.m(l, m).l(x(.82), m);
      break;
    case 'H':
      p.m(l, t).l(l, b).m(r, t).l(r, b).m(l, m).l(r, m);
      break;
    case 'I': p.m(cx, t).l(cx, b); break;
    case 'J':
      p.m(r, t).l(r, b - a).c(r, b - a + ak, r - a + ak, b, r - a, b)
        .l(l + a, b).c(l + a - ak, b, l, b - a + ak, l, b - a);
      break;
    case 'K':
      p.m(l, t).l(l, b);
      polyline(p, [[r, t], [l, y(.54)], [r, b]], joint);
      break;
    case 'L': polyline(p, [[l, t], [l, b], [r, b]], joint); break;
    case 'M':
      polyline(p, [[l, b], [l, t], [cx, y(.48)], [r, t], [r, b]], joint);
      break;
    case 'N': polyline(p, [[l, b], [l, t], [r, b], [r, t]], joint); break;
    case 'O':
    case '0': rect(p, l, t, r, b, corner); break;
    case 'P':
      p.m(l, b).l(l, t);
      rightBowl(p, l, t, r, y(.51), corner, false);
      break;
    case 'Q':
      rect(p, l, t, r, y(.94), corner);
      p.m(x(.57), y(.68)).l(r, b);
      break;
    case 'R':
      p.m(l, b).l(l, t);
      rightBowl(p, l, t, r, y(.49), corner, false);
      // The leg starts at the bowl's inner shoulder; no crowded third junction.
      p.m(x(.39), y(.49)).l(r, b);
      break;
    case 'S':
    case '5': {
      const z = Math.min(corner, w / 2, h / 4), k = z * K;
      if (char === 'S') {
        p.m(r, t + z).c(r, t + z - k, r - z + k, t, r - z, t)
          .l(l + z, t).c(l + z - k, t, l, t + z - k, l, t + z);
      } else p.m(r, t).l(l, t).l(l, t + z);
      p.l(l, m - z).c(l, m - z + k, l + z - k, m, l + z, m)
        .l(r - z, m).c(r - z + k, m, r, m + z - k, r, m + z)
        .l(r, b - z).c(r, b - z + k, r - z + k, b, r - z, b)
        .l(l + z, b).c(l + z - k, b, l, b - z + k, l, b - z);
      break;
    }
    case 'T': p.m(l, t).l(r, t).m(cx, t).l(cx, b); break;
    case 'U':
      p.m(l, t).l(l, b - a).c(l, b - a + ak, l + a - ak, b, l + a, b)
        .l(r - a, b).c(r - a + ak, b, r, b - a + ak, r, b - a).l(r, t);
      break;
    case 'V': polyline(p, [[l, t], [cx, b], [r, t]], joint); break;
    case 'W':
      polyline(p, [[l, t], [x(.21), b], [cx, y(.51)], [x(.79), b], [r, t]], joint);
      break;
    case 'X': p.m(l, t).l(r, b).m(r, t).l(l, b); break;
    case 'Y':
      polyline(p, [[l, t], [cx, y(.52)], [r, t]], joint);
      p.m(cx, y(.52)).l(cx, b);
      break;
    case 'Z': polyline(p, [[l, t], [r, t], [l, b], [r, b]], joint); break;
    case '1':
      polyline(p, [[l, y(.17)], [x(.57), t], [x(.57), b]], joint);
      p.m(l, b).l(r, b);
      break;
    case '2': {
      const z = Math.min(corner, w / 2, h * .24), k = z * K;
      p.m(l, t + z).c(l, t + z - k, l + z - k, t, l + z, t)
        .l(r - z, t).c(r - z + k, t, r, t + z - k, r, t + z)
        .c(r, y(.38), x(.78), y(.48), x(.60), y(.60));
      polyline(p, [[x(.60), y(.60)], [l, b], [r, b]], joint);
      break;
    }
    case '3':
      rightBowl(p, l, t, r, m, corner);
      rightBowl(p, x(.22), m, r, b, corner);
      p.l(l, b);
      break;
    case '4':
      polyline(p, [[x(.72), t], [l, y(.64)], [r, y(.64)]], joint);
      p.m(x(.72), t).l(x(.72), b);
      break;
    case '6':
      rect(p, l, y(.45), r, b, corner);
      p.m(l, y(.72)).l(l, t + a).c(l, t + a - ak, l + a - ak, t, l + a, t).l(x(.87), t);
      break;
    case '7': polyline(p, [[l, t], [r, t], [x(.24), b]], joint); break;
    case '8':
      rect(p, x(.05), t, x(.95), y(.47), corner);
      rect(p, l, y(.47), r, b, corner);
      break;
    case '9':
      rect(p, l, t, r, y(.55), corner);
      p.m(r, y(.28)).l(r, b - a).c(r, b - a + ak, r - a + ak, b, r - a, b).l(x(.13), b);
      break;
    case '.': dot(p, cx, b); break;
    case ',': p.m(x(.65), y(.83)).q(x(.69), y(.94), x(.24), b); break;
    case ':': dot(p, cx, y(.29)); dot(p, cx, y(.76)); break;
    case ';': dot(p, cx, y(.29)); p.m(x(.65), y(.76)).q(x(.69), y(.90), x(.24), b); break;
    case '!': p.m(cx, t).l(cx, y(.67)); dot(p, cx, b); break;
    case '?': {
      const z = Math.min(corner, w / 2, h * .24), k = z * K;
      p.m(l, t + z).c(l, t + z - k, l + z - k, t, l + z, t)
        .l(r - z, t).c(r - z + k, t, r, t + z - k, r, t + z)
        .c(r, y(.43), cx, y(.40), cx, y(.65));
      dot(p, cx, b);
      break;
    }
    case '-': case '–': case '—': p.m(l, m).l(r, m); break;
    case '_': p.m(l, b).l(r, b); break;
    case '+': p.m(l, m).l(r, m).m(cx, y(.18)).l(cx, y(.82)); break;
    case '=': p.m(l, y(.36)).l(r, y(.36)).m(l, y(.64)).l(r, y(.64)); break;
    case '/': p.m(l, b).l(r, t); break;
    case '\\': p.m(l, t).l(r, b); break;
    case '(':
      p.m(r, t).c(l, y(.12), l, y(.28), l, m).c(l, y(.72), l, y(.88), r, b);
      break;
    case ')':
      p.m(l, t).c(r, y(.12), r, y(.28), r, m).c(r, y(.72), r, y(.88), l, b);
      break;
    case '[': polyline(p, [[r, t], [l, t], [l, b], [r, b]], joint); break;
    case ']': polyline(p, [[l, t], [r, t], [r, b], [l, b]], joint); break;
    case '{':
      p.m(r, t).q(cx, t, cx, y(.20)).l(cx, y(.34)).q(cx, m, l, m)
        .q(cx, m, cx, y(.66)).l(cx, y(.80)).q(cx, b, r, b);
      break;
    case '}':
      p.m(l, t).q(cx, t, cx, y(.20)).l(cx, y(.34)).q(cx, m, r, m)
        .q(cx, m, cx, y(.66)).l(cx, y(.80)).q(cx, b, l, b);
      break;
    case "'": case '’': p.m(cx, t).l(cx, y(.20)); break;
    case '"': case '“': case '”': p.m(l, t).l(l, y(.20)).m(r, t).l(r, y(.20)); break;
    case '*':
      p.m(cx, y(.05)).l(cx, y(.53)).m(l, y(.17)).l(r, y(.41)).m(r, y(.17)).l(l, y(.41));
      break;
    case '#':
      p.m(x(.34), t).l(x(.18), b).m(x(.82), t).l(x(.66), b)
        .m(l, y(.32)).l(r, y(.32)).m(l, y(.68)).l(r, y(.68));
      break;
    case '%':
      rect(p, l, t, x(.34), y(.31), corner);
      rect(p, x(.66), y(.69), r, b, corner);
      p.m(x(.07), b).l(x(.93), t);
      break;
    case '&':
      // One continuous, open ampersand with a rounded upper eye and long leg.
      p.m(r, b).l(x(.20), y(.28))
        .c(x(.03), y(.08), x(.29), t, x(.43), t)
        .c(x(.74), t, x(.78), y(.25), x(.49), y(.43))
        .l(x(.23), y(.59)).c(l, y(.73), l, b, x(.31), b)
        .c(x(.64), b, x(.81), y(.71), x(.90), y(.52));
      break;
    case '@':
      rect(p, x(.29), y(.27), x(.70), y(.73), corner);
      p.m(x(.70), y(.27)).l(x(.70), y(.72))
        .c(x(.70), y(.91), r, y(.86), r, y(.51))
        .c(r, y(.15), x(.79), t, cx, t)
        .c(x(.19), t, l, y(.20), l, m)
        .c(l, y(.83), x(.21), b, cx, b).l(x(.78), b);
      break;
    default:
      // Deliberately visible unsupported glyph, without silently changing text.
      rect(p, l, t, r, b, Math.min(corner, Math.min(w, h) * .12));
      p.m(x(.22), y(.22)).l(x(.78), y(.78));
  }
  return p.toString();
}
