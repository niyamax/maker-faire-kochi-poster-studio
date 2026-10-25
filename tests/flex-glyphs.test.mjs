import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphPath, glyphMetrics, supportedGlyphs } from '../src/flex-glyphs.js';

test('all supported paths remain finite and inside their cells across dimensions and weights', () => {
  for (const char of supportedGlyphs) {
    for (const [w, h] of [[1, 1], [30, 400], [400, 30], [100, 160], [1000, 1000]]) {
      for (const roundness of [0, .5, 1]) {
        for (const weight of [0, Math.min(w, h) * .4]) {
          const d = glyphPath(char, w, h, { roundness, weight });
          assert.ok(!/NaN|Infinity/.test(d), `${char}: finite data`);
          assert.ok(!/[^MLCQ\d.\s-]/.test(d), `${char}: portable commands`);
          const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          nums.forEach((n, i) => assert.ok(n >= -.002 && n <= (i % 2 ? h : w) + .002,
            `${char}: coordinate ${n} inside ${w}×${h}`));
        }
      }
    }
  }
});

test('fixed-radius bowls lengthen straight runs without stretching their corners', () => {
  const narrow = glyphPath('O', 100, 200, { radius: 28 });
  const wide = glyphPath('O', 400, 200, { radius: 28 });
  assert.ok(narrow.startsWith('M28 0L72 0'));
  assert.ok(wide.startsWith('M28 0L372 0'));
  assert.equal(narrow.match(/C[^C]+$/)[0], wide.match(/C[^C]+$/)[0]);
});

test('C stays open at roundness one, including a square cell', () => {
  for (const [w, h] of [[100, 100], [400, 100], [100, 400]]) {
    const nums = glyphPath('C', w, h, { roundness: 1 }).match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(nums.at(-1) - nums[1] >= h * .60);
  }
});

test('text inputs normalize predictably and invalid dimensions have no geometry', () => {
  assert.equal(glyphPath('m', 100, 100), glyphPath('M', 100, 100));
  assert.equal(glyphPath(' ', 100, 100), '');
  assert.equal(glyphPath('A', NaN, 100), '');
  assert.equal(glyphPath('A', -1, 100), '');
  assert.equal(glyphMetrics('m'), glyphMetrics('M'));
  assert.ok(glyphMetrics('M') > glyphMetrics('I'));
  assert.ok(glyphPath('λ', 100, 100).length > 0);
});
