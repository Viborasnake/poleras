export const DELIVERY_STEPS = [
  { status: 'paid', label: 'Pedido ingresado', adminAction: 'Pedido ingresado' },
  { status: 'in_production', label: 'Preparando pedido', adminAction: 'Tomar pedido' },
  { status: 'ready', label: 'Pedido preparado', adminAction: 'Marcar preparado' },
  { status: 'shipped', label: 'Entregado a transportista', adminAction: 'Entregar a transportista' },
];

export const PICKUP_STEPS = [
  { status: 'paid', label: 'Pedido ingresado', adminAction: 'Pedido ingresado' },
  { status: 'in_production', label: 'Preparando pedido', adminAction: 'Tomar pedido' },
  { status: 'ready_for_pickup', label: 'Listo en tienda para retirar', adminAction: 'Listo para retirar' },
];

export const ORDER_STEPS = DELIVERY_STEPS;

export const ORDER_STATUS_LABELS = {
  draft: 'Borrador',
  submitted: 'Pedido ingresado',
  quoted: 'Cotizado',
  awaiting_deposit: 'Esperando abono',
  deposit_paid: 'Abono pagado',
  in_design: 'En diseño',
  proposal_ready: 'Propuesta lista',
  approved: 'Aprobado',
  awaiting_balance: 'Esperando saldo',
  paid: 'Pedido ingresado',
  in_production: 'Preparando pedido',
  ready: 'Pedido preparado',
  shipped: 'Entregado a transportista',
  ready_for_pickup: 'Listo en tienda para retirar',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const incoming = ['draft', 'submitted', 'quoted', 'awaiting_deposit', 'deposit_paid', 'paid'];
const processing = ['in_design', 'proposal_ready', 'approved', 'awaiting_balance', 'in_production'];

export function orderFulfillment(orderOrFulfillment) {
  if (typeof orderOrFulfillment === 'string') return orderOrFulfillment === 'pickup' ? 'pickup' : 'delivery';
  return orderOrFulfillment?.shipping_address?.fulfillment === 'pickup' ? 'pickup' : 'delivery';
}

export function orderSteps(orderOrFulfillment = 'delivery') {
  return orderFulfillment(orderOrFulfillment) === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS;
}

export function orderProgressIndex(status, orderOrFulfillment = 'delivery') {
  if (status === 'cancelled') return -1;
  const steps = orderSteps(orderOrFulfillment);
  if (incoming.includes(status)) return 0;
  if (processing.includes(status)) return 1;
  if (status === 'delivered') return steps.length - 1;
  const index = steps.findIndex(step => step.status === status);
  return index < 0 ? 0 : index;
}

export function nextOrderStatus(status, orderOrFulfillment = 'delivery') {
  if (status === 'cancelled' || status === 'delivered') return null;
  const steps = orderSteps(orderOrFulfillment);
  const current = orderProgressIndex(status, orderOrFulfillment);
  return current >= steps.length - 1 ? null : steps[current + 1];
}

export function orderKanbanStage(status) {
  if (incoming.includes(status)) return 'incoming';
  if (processing.includes(status)) return 'processing';
  if (['shipped', 'ready_for_pickup', 'delivered', 'cancelled'].includes(status)) return 'completed';
  return 'handoff';
}

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || 'Sin estado';
}
