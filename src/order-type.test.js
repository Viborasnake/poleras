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
  assert.equal(orderTypeLabel({ source: 'whatsapp', price_snapshot: { purchase_type: 'personalized' }, order_items: [] }), 'Personalizado · archivo por WhatsApp');
});

test('prioriza el flujo canónico guardado por backend', () => {
  assert.equal(orderTypeLabel({ price_snapshot: { flow_type: 'people_base' } }), 'Personas · diseño tal cual');
  assert.equal(orderTypeLabel({ price_snapshot: { flow_type: 'people_personalization' } }), 'Personalizado · personas');
  assert.equal(orderTypeLabel({ price_snapshot: { flow_type: 'pet_personalization' } }), 'Personalizado · mascotas');
  assert.equal(orderTypeLabel({ price_snapshot: { flow_type: 'own_artwork' } }), 'Personalizado · diseño adjunto');
});

test('usa el tipo elegido en pedidos manuales y no inventa el de los históricos', () => {
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: { order_type: 'idea' } }), 'Personalizado · idea');
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: { order_type: 'catalog' } }), 'Catálogo');
  assert.equal(orderTypeLabel({ source: 'manual', price_snapshot: {} }), 'Sin registrar');
});
