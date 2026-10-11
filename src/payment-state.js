export function orderPaymentState(order) {
  if (order.payment_confirmed_at && order.payment_confirmed_by) return 'paid';
  if (order.payment_transfer_notice_at || order.payment_confirmed_at ||
      (order.payments || []).some(payment => payment.status === 'approved')) return 'review';
  return 'unpaid';
}

export const paymentStateLabels = {
  unpaid: 'No pagado',
  review: 'Pagado por revisar',
  paid: 'Pagado',
};
