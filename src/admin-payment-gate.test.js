import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirmQuotedPayment, canReturnOrderToIncoming, shouldRepairPaymentGate } from './admin-payment-gate.js';

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


const quote = {request_type:'creative', status:'quoted', quoted_total_clp:17980, total_clp:17980};

test('permite confirmar una cotización vigente con un pago externo verificado', () => {
  assert.equal(canConfirmQuotedPayment(quote), true);
  assert.equal(canConfirmQuotedPayment({...quote, quoted_total_clp:null}), false);
  assert.equal(canConfirmQuotedPayment({...quote, total_clp:19980}), false);
  assert.equal(canConfirmQuotedPayment({...quote, edit_pending_approval:true}), false);
  assert.equal(canConfirmQuotedPayment({...quote, archived_at:'2026-11-25'}), false);
});

test('espera el cobro en línea y bloquea pagos con incidencias', () => {
  const mercadoPago = status => [{provider:'mercado_pago', status}];
  assert.equal(canConfirmQuotedPayment({...quote, payments:mercadoPago('pending')}), false);
  assert.equal(canConfirmQuotedPayment({...quote, payments:mercadoPago('approved')}), true);
  assert.equal(canConfirmQuotedPayment({...quote, payments:mercadoPago('charged_back')}), false);
});

test('volver a ingresado requiere un pago confirmado y una etapa posterior activa', () => {
  const confirmed = {payment_confirmed_at:'2026-11-25', payment_confirmed_by:'admin'};
  assert.equal(canReturnOrderToIncoming(quote), false);
  assert.equal(canReturnOrderToIncoming({...quote, ...confirmed}), false);
  assert.equal(canReturnOrderToIncoming({...quote, status:'in_production'}), false);
  assert.equal(canReturnOrderToIncoming({...quote, ...confirmed, status:'in_production'}), true);
  assert.equal(canReturnOrderToIncoming({...quote, ...confirmed, status:'delivered'}), false);
});
