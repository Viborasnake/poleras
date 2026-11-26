import {orderPaymentState} from './payment-state.js';
import {orderProgressIndex} from './order-status.js';

export function canConfirmQuotedPayment(order) {
  if (order.request_type !== 'creative' || order.status !== 'quoted' || order.archived_at || order.edit_pending_approval ||
      !Number.isSafeInteger(order.quoted_total_clp) || order.quoted_total_clp <= 0 || order.quoted_total_clp !== order.total_clp ||
      ['issue', 'paid'].includes(orderPaymentState(order))) return false;

  const payments = order.payments || [];
  return Boolean(order.payment_instructions?.transfer) ||
    payments.some(payment => payment.provider === 'mercado_pago' && payment.status === 'approved') ||
    payments.some(payment => ['transferencia_bancaria', 'manual'].includes(payment.provider) && ['pending', 'approved'].includes(payment.status)) ||
    !payments.some(payment => payment.provider === 'mercado_pago');
}

export function canReturnOrderToIncoming(order) {
  return !order.archived_at && !order.edit_pending_approval &&
    order.status !== 'delivered' && orderProgressIndex(order.status, order) > 0 && orderPaymentState(order) === 'paid';
}

export function shouldRepairPaymentGate(content) {
  const next = content?.querySelector('[data-next-status]');
  if (!next || next.dataset.nextStatus !== 'in_production') return false;
  if (content.dataset.paymentGateMode === 'automatic-pending') return false;
  return !content.querySelector('.admin-payment-toggle');
}
