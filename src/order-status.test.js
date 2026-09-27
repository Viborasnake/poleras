import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOrderStatus, orderProgressIndex, orderStatusLabel, orderSteps, orderKanbanStage } from './order-status.js';

test('normaliza estados históricos al stepper operativo', () => {
  assert.equal(orderProgressIndex('submitted'), 0);
  assert.equal(orderProgressIndex('in_design'), 1);
  assert.equal(orderProgressIndex('ready'), 2);
  assert.equal(orderProgressIndex('shipped'), 3);
  assert.equal(orderProgressIndex('delivered'), 3);
});

test('entrega la próxima acción operativa', () => {
  assert.deepEqual(nextOrderStatus('paid'), { status: 'in_production', label: 'Preparando pedido', adminAction: 'Tomar pedido' });
  assert.equal(nextOrderStatus('delivered'), null);
  assert.equal(nextOrderStatus('cancelled'), null);
});

test('separa el cierre operativo según despacho o retiro', () => {
  assert.equal(nextOrderStatus('in_production', 'delivery').status, 'ready');
  assert.equal(nextOrderStatus('ready', 'delivery').status, 'shipped');
  assert.equal(nextOrderStatus('in_production', 'pickup').status, 'ready_for_pickup');
  assert.equal(nextOrderStatus('ready_for_pickup', 'pickup'), null);
  assert.equal(orderSteps('pickup').length, 3);
  assert.equal(orderKanbanStage('ready_for_pickup'), 'completed');
});

test('muestra nombres comprensibles al cliente', () => {
  assert.equal(orderStatusLabel('paid'), 'Pedido ingresado');
  assert.equal(orderStatusLabel('in_production'), 'Preparando pedido');
});
