import test from 'node:test';
import assert from 'node:assert/strict';
import { airGlyphPaths } from '../src/air-glyphs.js';
import { supportedGlyphs } from '../src/flex-glyphs.js';

const topology = paths => paths.map(d => d.match(/[MLQZ]/g).join(''));

test('Air has stable closed-path topology across sizes, pressure, character, and phase', () => {
  for (const char of supportedGlyphs) {
    const baseline = topology(airGlyphPaths(char, 100, 160));
    for (const [w, h] of [[35, 350], [350, 35], [100, 160]]) {
      for (const amount of [0, .5, 1]) {
        const paths = airGlyphPaths(char, w, h, { pressure: amount, character: amount, phase: amount * .7 });
        assert.deepEqual(topology(paths), baseline, `${char} topology at ${w}×${h}`);
        for (const d of paths) {
          assert.ok(d.endsWith('Z'));
          assert.ok(!/NaN|Infinity/.test(d));
          const numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
          numbers.forEach((n, i) => assert.ok(n >= 0 && n <= (i % 2 ? h : w), `${char} ${n} bounds`));
        }
      }
    }
  }
});

test('Air loops deterministically without a phase seam', () => {
  for (const char of 'MAKERFAIREKOCHI') {
    assert.deepEqual(airGlyphPaths(char, 180, 280, { phase: 0 }), airGlyphPaths(char, 180, 280, { phase: 1 }));
    assert.deepEqual(airGlyphPaths(char, 180, 280, { phase: .25 }), airGlyphPaths(char, 180, 280, { phase: 1.25 }));
    assert.notDeepEqual(airGlyphPaths(char, 180, 280, { phase: 0 }), airGlyphPaths(char, 180, 280, { phase: .3 }));
  }
});

test('maximum character and inflation retain rounded shoulders instead of hard-clipped edges',()=>{
  for(const char of 'MAKERFOCHI')for(const phase of [0,.2,.55]){
    const paths=airGlyphPaths(char,180,240,{pressure:1,character:1,phase});
    for(const d of paths){
      const ns=d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      assert.ok(ns.every((v,i)=>v>.001&&v<(i%2?240:180)-.001),`${char} has no collapsed run of clipped boundary controls`);
    }
  }
});

// The silhouettes are densely sampled quadratic curves. Their endpoint polygon
// is sufficient to check counter winding without requiring a browser or canvas.
function winding(d, x, y) {
  const parts = d.split('M').slice(1);
  let total = 0;
  for (const part of parts) {
    const numbers = part.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const points = [[numbers[0], numbers[1]]];
    for (let i = 2; i < numbers.length; i += 4) points.push([numbers[i + 2], numbers[i + 3]]);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const cross = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y && b[1] > y && cross > 0) total++;
      if (a[1] > y && b[1] <= y && cross < 0) total--;
    }
  }
  return total;
}

test('closed O counters remain empty under nonzero fill while their ring stays solid', () => {
  for (const phase of [0, .125, .25, .5, .75]) {
    const paths = airGlyphPaths('O', 160, 220, { pressure: 1, character: 1, phase });
    assert.equal(paths.length, 1);
    assert.equal(winding(paths[0], 80, 110), 0);
    assert.notEqual(winding(paths[0], 80, 20), 0);
  }
});

test('empty text and invalid dimensions do not produce shapes', () => {
  assert.deepEqual(airGlyphPaths(' ', 100, 100), []);
  assert.deepEqual(airGlyphPaths('', 100, 100), []);
  assert.deepEqual(airGlyphPaths('A', -1, 100), []);
  assert.deepEqual(airGlyphPaths('A', NaN, 100), []);
});
