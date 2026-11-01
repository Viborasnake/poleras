export function orderPaymentState(order) {
  if ((order.payments || []).some(payment => ['refunded','partially_refunded','charged_back','in_mediation'].includes(payment.status))) return 'issue';
  if (order.payment_confirmed_at && order.payment_confirmed_by) return 'paid';
  if (order.payment_transfer_notice_at || order.payment_confirmed_at ||
      (order.payments || []).some(payment => payment.status === 'approved')) return 'review';
  return 'unpaid';
}

export const paymentStateLabels = {
  unpaid: 'No pagado',
  review: 'Pagado por revisar',
  paid: 'Pagado',
  issue: 'Pago revertido · revisar',
};
