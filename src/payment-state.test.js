import test from 'node:test';
import assert from 'node:assert/strict';
import { orderPaymentState } from './payment-state.js';

test('un pedido nuevo parte sin pago', () => {
  assert.equal(orderPaymentState({ status: 'submitted', payments: [] }), 'unpaid');
  assert.equal(orderPaymentState({ status: 'paid', payments: [] }), 'unpaid');
});

test('el aviso de transferencia y la aprobación del proveedor quedan por revisar', () => {
  assert.equal(orderPaymentState({ payment_transfer_notice_at: '2026-10-10T22:00:00Z' }), 'review');
  assert.equal(orderPaymentState({ payments: [{ provider: 'mercado_pago', status: 'approved' }] }), 'review');
  assert.equal(orderPaymentState({ payment_confirmed_at: '2026-10-10T22:00:00Z' }), 'review');
});

test('solo una confirmación atribuida a administración muestra Pagado', () => {
  assert.equal(orderPaymentState({ payment_confirmed_at: '2026-10-10T22:00:00Z', payment_confirmed_by: 'admin-id' }), 'paid');
});
