export const ORDER_STEPS = [
  { status: 'paid', label: 'Pedido ingresado', adminAction: 'Pedido ingresado' },
  { status: 'in_production', label: 'Preparando pedido', adminAction: 'Preparar pedido' },
  { status: 'ready', label: 'Listo para despacho', adminAction: 'Marcar como listo' },
  { status: 'shipped', label: 'En despacho', adminAction: 'Despachar pedido' },
  { status: 'delivered', label: 'Entregado', adminAction: 'Marcar entregado' },
];

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
  ready: 'Listo para despacho',
  shipped: 'En despacho',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const progressGroups = [
  ['draft', 'submitted', 'quoted', 'awaiting_deposit', 'deposit_paid', 'paid'],
  ['in_design', 'proposal_ready', 'approved', 'awaiting_balance', 'in_production'],
  ['ready'],
  ['shipped'],
  ['delivered'],
];

export function orderProgressIndex(status) {
  if (status === 'cancelled') return -1;
  const index = progressGroups.findIndex(group => group.includes(status));
  return Math.max(0, index);
}

export function nextOrderStatus(status) {
  const current = orderProgressIndex(status);
  if (status === 'cancelled' || current >= ORDER_STEPS.length - 1) return null;
  return ORDER_STEPS[current + 1];
}

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || 'Sin estado';
}
