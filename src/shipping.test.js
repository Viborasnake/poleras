import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteShipping } from './shipping.js';

test('cotiza despacho antes del pago según región y cantidad', () => {
  assert.deepEqual(quoteShipping('pickup', 'Metropolitana de Santiago', 3), { amount: 0, label: 'Retiro coordinado · gratis' });
  assert.equal(quoteShipping('delivery', 'Región Metropolitana de Santiago', 1).amount, 3990);
  assert.equal(quoteShipping('delivery', 'Región de Los Lagos', 2).amount, 7990);
});
