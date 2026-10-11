export function orderChannelLabel(order) {
  const raw = order.shipping_address?.channel || String(order.shipping_address?.notes || '').match(/^Canal de origen:\s*(.+)$/m)?.[1]?.trim();
  const channel = String(raw || '').trim();
  return { whatsapp: 'WhatsApp', web: 'Web', instagram: 'Instagram', other: 'Otro' }[channel.toLowerCase()] || channel || 'Sin canal';
}

export function orderCardOriginLabel(order) {
  if (order.source === 'manual') return `Manual · ${orderChannelLabel(order)}`;

  const provider = order.price_snapshot?.provider || (order.payments || []).find(payment => ['mercado_pago', 'transferencia_bancaria'].includes(payment.provider))?.provider;
  if (['bank_transfer', 'transferencia_bancaria', 'transfer'].includes(provider)) return 'Web · Transferencia';
  if (provider === 'mercado_pago') return 'Web · Mercado Pago';
  if (order.source === 'idea_request' || order.request_type === 'creative') return 'Web · Idea';
  return 'Web · Sin medio de pago';
}
