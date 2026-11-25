import {orderPaymentState} from './payment-state.js';

const interruptedPayments = ['rejected', 'cancelled'];
const mercadoPagoStatuses = order => (order?.payments || [])
  .filter(payment => payment.provider === 'mercado_pago')
  .map(payment => payment.status);
export const hasPendingMercadoPagoCharge = order => Boolean(order?.payments?.some(payment =>
  payment.provider === 'mercado_pago' && payment.status === 'pending' && payment.provider_payment_id));

export function paymentConfirmationFollowUp(email) {
  return `Cuando Droska confirme el pago, te avisará ${email ? `a ${email}` : 'al correo del pedido'}.`;
}

export function quoteEmailFollowUp(email) {
  return `Te responderemos ${email ? `a ${email}` : 'al correo que ingresaste'} con la propuesta, el precio final y el plazo.`;
}

export function unconfirmedRequestFeedback(message, subject = 'solicitud') {
  return {
    label: 'Estado del envío',
    title: `No pudimos confirmar el registro ${subject === 'pedido' ? 'del pedido' : 'de la solicitud'}`,
    message: message || 'Tuvimos un problema al enviar tus datos.',
    tone: 'error',
    nextStep: 'Tus datos siguen en el formulario. Vuelve y reintenta el envío para confirmar el registro.'
  };
}

export function mercadoPagoFeedback({returnStatus, order, orderId}) {
  const creative = order?.request_type === 'creative';
  const reference = orderId ? `${creative ? 'Solicitud' : 'Pedido'} #${orderId}` : '';
  const statuses = mercadoPagoStatuses(order);
  const confirmed = Boolean(order?.payment_confirmed_at && order.payment_confirmed_by);
  const contents = creative ? ['Pago de la cotización de diseño'] :
    (order?.order_items || []).map(item => `${item.quantity} × ${item.name_snapshot}`);

  let title = 'Pago pendiente de confirmación';
  let message = 'Estamos esperando el estado del cobro de Mercado Pago.';
  let nextStep = `${paymentConfirmationFollowUp(order?.shipping_address?.customer?.email)} Puedes revisar el estado en «Mis pedidos».`;
  let tone = 'info';
  if (statuses.some(status => ['refunded', 'partially_refunded', 'charged_back', 'in_mediation'].includes(status))) {
    title = 'El pago requiere revisión';
    message = 'Mercado Pago registró una incidencia en el cobro.';
    nextStep = 'Revisa el estado en «Mis pedidos» antes de intentar otro pago.';
    tone = 'warning';
  } else if (confirmed || statuses.includes('approved')) {
    title = confirmed ? 'Pago confirmado' : 'Pago aprobado por Mercado Pago';
    message = confirmed ? 'Droska confirmó el pago de tu pedido.' : 'Recibimos la aprobación del cobro. Droska revisará el pago antes de continuar.';
    if (confirmed) nextStep = 'Sigue la preparación y la entrega de tu pedido en «Mis pedidos».';
    tone = 'success';
  } else if (!hasPendingMercadoPagoCharge(order) && (returnStatus === 'failure' || statuses.some(status => interruptedPayments.includes(status)))) {
    title = 'Pago no completado';
    message = 'El intento de pago en Mercado Pago quedó sin completar.';
    nextStep = creative ? 'Vuelve a «Mis pedidos» para reintentar el pago de la cotización.' :
      'Vuelve al carro para reintentar el pago.';
    if (!order) nextStep = 'Vuelve al carro para reintentar. Si estabas pagando una cotización, vuelve a «Mis pedidos».';
    tone = 'error';
  }
  return {label:tone==='success'?'Comprobante de pago':'Estado del pago', title, message, nextStep, tone, reference, contents};
}

export function whatsappFeedback({orderId, contents, pendingAttachments, preliminaryPrice, isPurchase = false}) {
  const reference = orderId ? `${isPurchase ? 'Pedido' : 'Solicitud'} #${orderId}` : '';
  const title = orderId ? (isPurchase ? 'Pedido registrado en Droska' : 'Solicitud registrada en Droska') : 'Mensaje de WhatsApp preparado';
  const message = pendingAttachments
    ? `El mensaje de WhatsApp está pendiente de envío. Abre el chat, adjunta ${pendingAttachments} y pulsa «Enviar».`
    : 'El mensaje de WhatsApp está pendiente de envío. Abre el chat y pulsa «Enviar».';
  const summary = preliminaryPrice ? [...contents, `Precio preliminar · ${preliminaryPrice} (por confirmar)`] : contents;
  const nextStep = 'Después de enviarlo, espera la respuesta de Droska en ese mismo chat de WhatsApp.';
  const label = orderId ? (isPurchase?'Comprobante de pedido':'Comprobante de solicitud') : 'Continuación por WhatsApp';
  return {label, title, message, nextStep, tone:orderId?'success':'info', reference, contents:summary, contentsLabel:orderId?(isPurchase?'Datos del pedido':'Datos de la solicitud'):'Mensaje preparado'};
}

export function receiptEmailFeedback(receipt, email, contents) {
  if (!email) return '';
  if (receipt?.sent === true) return `${contents} se enviaron a ${email}.`;
  if (receipt?.sent === false) return `No pudimos enviar el correo a ${email}.`;
  return '';
}

export function accountOrderFollowUp(order) {
  if (order.archived_at || order.status === 'cancelled') return '';
  const payment = orderPaymentState(order);
  if (payment === 'paid') return '';
  if (payment === 'issue') return 'El cobro está en revisión. Revisa el estado del pedido antes de intentar otro pago.';
  const email = order.shipping_address?.customer?.email;
  const statuses = mercadoPagoStatuses(order);
  if (payment === 'review' || hasPendingMercadoPagoCharge(order)) return paymentConfirmationFollowUp(email);
  if (order.status === 'draft') return 'Tu compra quedó pendiente. Vuelve al carro para continuar.';
  if (statuses.includes('pending')) return order.request_type === 'creative' ? 'Puedes continuar el pago de la cotización aquí.' : 'Puedes volver al carro para completar el pago en Mercado Pago.';
  if (statuses.some(status => interruptedPayments.includes(status))) {
    return order.request_type === 'creative' ? 'El pago quedó sin completar. Puedes volver a intentar pagar la cotización aquí.' :
      'El pago quedó sin completar. Puedes volver al carro para reintentar.';
  }
  if (order.status !== 'submitted') return '';
  if (order.source === 'whatsapp') return 'Continúa en el chat de WhatsApp para que Droska pueda responderte por ahí.';
  if (order.request_type === 'creative') return quoteEmailFollowUp(email);
  return '';
}
