import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_ADJUSTMENT_CLP, checkResolution, orderTotal, paymentBreakdown } from './print-check.js';
test('resolution gate respects actual aspect-fit print size', () => {
  assert.equal(checkResolution(400, 500).qualifies, false);
  assert.equal(checkResolution(1800, 2500).qualifies, true);
  assert.equal(checkResolution(1800, 1500).qualifies, true);
  assert.equal(checkResolution(0, 1500).qualifies, false);
  const result = checkResolution(3000, 1500);
  assert.ok(Math.abs(result.printWidth - 28) < 1e-9);
  assert.ok(Math.abs(result.printHeight - 14) < 1e-9);
});
test('paid review is credited once, not added to shirt price', () => {
  assert.deepEqual(paymentBreakdown(14990, 3000), { total: 14990, reviewCredit: 3000, depositDue: 4495, balanceDue: 7495 });
  const p = paymentBreakdown(14990, 9000);
  assert.equal(p.depositDue, 0);
  assert.equal(p.reviewCredit + p.depositDue + p.balanceDue, p.total);
  assert.throws(() => paymentBreakdown(8990, 9000));
});
test('price stays deterministic for each print choice', () => {
  assert.deepEqual(orderTotal(14990, 'front'), { base: 14990, print: 0, extras: 0, total: 14990 });
  assert.deepEqual(orderTotal(14990, 'back'), { base: 14990, print: 0, extras: 0, total: 14990 });
  assert.deepEqual(orderTotal(14990, 'both', 1000), { base: 14990, print: 3990, extras: 1000, total: 19980 });
  assert.throws(() => orderTotal(14990, 'sleeve'));
});
test('a team quality adjustment is explicit and added exactly once', () => {
  assert.equal(QUALITY_ADJUSTMENT_CLP, 4990);
  assert.deepEqual(orderTotal(14990, 'front', QUALITY_ADJUSTMENT_CLP), { base: 14990, print: 0, extras: 4990, total: 19980 });
});
