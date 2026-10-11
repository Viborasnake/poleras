import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRepairPaymentGate } from './admin-payment-gate.js';

function content({ nextStatus = 'in_production', mode = '', hasToggle = false } = {}) {
  return {
    dataset: { paymentGateMode: mode },
    querySelector(selector) {
      if (selector === '[data-next-status]') return nextStatus ? { dataset: { nextStatus } } : null;
      if (selector === '.admin-payment-toggle') return hasToggle ? {} : null;
      return null;
    },
  };
}

test('el pago en línea pendiente no reinicia el bloqueo al mutar el diálogo', () => {
  assert.equal(shouldRepairPaymentGate(content()), true);
  assert.equal(shouldRepairPaymentGate(content({ mode: 'automatic-pending' })), false);
});

test('repara el control de transferencia solo si falta y el pedido puede avanzar', () => {
  assert.equal(shouldRepairPaymentGate(content({ mode: 'manual-confirmation' })), true);
  assert.equal(shouldRepairPaymentGate(content({ mode: 'manual-confirmation', hasToggle: true })), false);
  assert.equal(shouldRepairPaymentGate(content({ nextStatus: 'delivered' })), false);
  assert.equal(shouldRepairPaymentGate(null), false);
});
