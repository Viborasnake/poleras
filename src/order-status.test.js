import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOrderStatus, orderProgressIndex, orderStatusLabel } from './order-status.js';

test('normaliza estados históricos al stepper operativo', () => {
  assert.equal(orderProgressIndex('submitted'), 0);
  assert.equal(orderProgressIndex('in_design'), 1);
  assert.equal(orderProgressIndex('ready'), 2);
  assert.equal(orderProgressIndex('shipped'), 3);
  assert.equal(orderProgressIndex('delivered'), 4);
});

test('entrega la próxima acción operativa', () => {
  assert.deepEqual(nextOrderStatus('paid'), { status: 'in_production', label: 'Preparando pedido', adminAction: 'Preparar pedido' });
  assert.equal(nextOrderStatus('delivered'), null);
  assert.equal(nextOrderStatus('cancelled'), null);
});

test('muestra nombres comprensibles al cliente', () => {
  assert.equal(orderStatusLabel('paid'), 'Pedido ingresado');
  assert.equal(orderStatusLabel('in_production'), 'Preparando pedido');
});
