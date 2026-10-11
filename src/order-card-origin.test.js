import test from 'node:test';
import assert from 'node:assert/strict';
import { orderCardOriginLabel } from './order-card-origin.js';

test('mantiene el canal registrado en pedidos manuales y no inventa los antiguos', () => {
  assert.equal(orderCardOriginLabel({ source: 'manual', shipping_address: {} }), 'Manual · Sin canal');
  assert.equal(orderCardOriginLabel({ source: 'manual', shipping_address: { notes: 'Canal de origen: WhatsApp\n\nLlamar antes de entregar' } }), 'Manual · WhatsApp');
});

test('distingue los medios de pago web usando el pedido actual', () => {
  assert.equal(orderCardOriginLabel({ source: 'online', price_snapshot: { provider: 'bank_transfer' } }), 'Web · Transferencia');
  assert.equal(orderCardOriginLabel({ source: 'online', price_snapshot: { provider: 'mercado_pago' } }), 'Web · Mercado Pago');
  assert.equal(orderCardOriginLabel({ source: 'online', price_snapshot: { provider: 'checkout_draft' } }), 'Web · Sin medio de pago');
  assert.equal(orderCardOriginLabel({ source: 'online', payments: [{ provider: 'transferencia_bancaria' }] }), 'Web · Transferencia');
  assert.equal(orderCardOriginLabel({ source: 'idea_request', request_type: 'creative' }), 'Web · Idea');
});
