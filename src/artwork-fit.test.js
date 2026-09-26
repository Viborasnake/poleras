import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticPrintScale, visibleAlphaBounds } from './artwork-fit.js';

test('visibleAlphaBounds finds the artwork inside transparent padding', () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) pixels[(y * 4 + x) * 4 + 3] = 255;
  assert.deepEqual(visibleAlphaBounds(pixels, 4, 4), { x: 1, y: 1, width: 2, height: 2 });
});

test('visibleAlphaBounds returns null for a fully transparent image', () => {
  assert.equal(visibleAlphaBounds(new Uint8ClampedArray(16), 2, 2), null);
});

test('automaticPrintScale reduces tall artwork but leaves square artwork at the safe maximum', () => {
  assert.equal(automaticPrintScale(.45), .74);
  assert.equal(automaticPrintScale(.6), .82);
  assert.equal(automaticPrintScale(1), 1);
});
