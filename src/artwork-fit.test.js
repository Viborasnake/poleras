import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticPrintScale, visibleAlphaBounds, visibleAlphaEdgeSamples } from './artwork-fit.js';

test('visibleAlphaBounds finds the artwork inside transparent padding', () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) pixels[(y * 4 + x) * 4 + 3] = 255;
  assert.deepEqual(visibleAlphaBounds(pixels, 4, 4), { x: 1, y: 1, width: 2, height: 2 });
});

test('visibleAlphaBounds returns null for a fully transparent image', () => {
  assert.equal(visibleAlphaBounds(new Uint8ClampedArray(16), 2, 2), null);
});

test('visibleAlphaEdgeSamples follows irregular artwork rather than transparent canvas corners', () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (const [x, y] of [[2, 0], [1, 1], [2, 1], [3, 1], [2, 2], [2, 3]]) {
    pixels[(y * 5 + x) * 4 + 3] = 255;
  }
  assert.deepEqual(visibleAlphaEdgeSamples(pixels, 5, 5, 8, 2), [
    { u: .5, v: .1 }, { u: .5, v: .7 },
  ]);
  assert.deepEqual(visibleAlphaEdgeSamples(pixels, 5, 5, 8, 4).slice(1, 3), [
    { u: .3, v: .3 }, { u: .7, v: .3 },
  ]);
});

test('automaticPrintScale reduces tall artwork but leaves square artwork at the safe maximum', () => {
  assert.equal(automaticPrintScale(.45), .82);
  assert.equal(automaticPrintScale(.6), .88);
  assert.equal(automaticPrintScale(1), 1);
});
