import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveDay, filterArchivedOrders } from './archive-history.js';

const orders = [
  { id: 10, status: 'delivered', archived_from_status: 'delivered', archived_at: '2026-10-11T02:30:00Z', shipping_address: { customer: { first_name: 'José', last_name: 'Pizarro', email: 'jose@example.cl', rut: '12.345.678-9' } }, payment_confirmed_at: '2026-10-10T22:00:00Z', payment_confirmed_by: 'admin' },
  { id: 9, status: 'cancelled', archived_at: '2026-10-08T14:00:00Z', shipping_address: { customer: { first_name: 'Ana', last_name: 'Rojas', email: 'ana@example.cl' } } },
];

test('busca pedidos archivados por número, nombre sin tilde, correo y RUT con o sin puntuación', () => {
  for (const query of ['10', 'jose pizarro', 'jose@example.cl', '123456789', '12.345.678-9']) {
    assert.deepEqual(filterArchivedOrders(orders, { query }).map(order => order.id), [10]);
  }
});

test('combina estado, pago y rango de fecha local de archivo', () => {
  assert.equal(archiveDay(orders[0].archived_at), '2026-10-10');
  assert.deepEqual(filterArchivedOrders(orders, { status: 'delivered', payment: 'paid', from: '2026-10-10', to: '2026-10-10' }).map(order => order.id), [10]);
  assert.deepEqual(filterArchivedOrders(orders, { status: 'cancelled', from: '2026-10-10' }), []);
});
