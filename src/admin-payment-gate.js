export function shouldRepairPaymentGate(content) {
  const next = content?.querySelector('[data-next-status]');
  if (!next || next.dataset.nextStatus !== 'in_production') return false;
  if (content.dataset.paymentGateMode === 'automatic-pending') return false;
  return !content.querySelector('.admin-payment-toggle');
}
