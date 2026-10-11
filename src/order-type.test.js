import test from 'node:test';
import assert from 'node:assert/strict';
import { orderTypeLabel } from './order-type.js';

test('distingue catálogo, diseño adjunto e idea sin depender del medio de pago', () => {
  assert.equal(orderTypeLabel({ source: 'online', order_items: [{ catalog_design_id: 12 }] }), 'Catálogo');
  assert.equal(orderTypeLabel({ source: 'online', order_items: [{ front_design_path: 'user/front/file.png' }] }), 'Personalizado · diseño adjunto');
  assert.equal(orderTypeLabel({ source: 'idea_request', request_type: 'creative', order_items: [] }), 'Personalizado · idea');
});

test('explica los pedidos mixtos y los diseños aún no adjuntados', () => {
  assert.equal(orderTypeLabel({ source: 'online', order_items: [{ catalog_design_id: 12 }, { back_design_path: 'user/back/file.png' }] }), 'Mixto · catálogo y diseño');
  assert.equal(orderTypeLabel({ source: 'online', status: 'draft', order_items: [{ name_snapshot: 'Polera Básica personalizada' }] }), 'Personalizado · diseño pendiente');
});

test('usa el tipo elegido en pedidos manuales y no inventa el de los históricos', () => {
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: { order_type: 'idea' } }), 'Personalizado · idea');
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: { order_type: 'catalog' } }), 'Catálogo');
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: {} }), 'Sin registrar');
});
