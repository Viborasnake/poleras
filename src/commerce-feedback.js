export function mercadoPagoFeedback({returnStatus, order, orderId}) {
  const creative = order?.request_type === 'creative';
  const reference = orderId ? `${creative ? 'Solicitud' : 'Pedido'} #${orderId}` : '';
  const statuses = (order?.payments || [])
    .filter(payment => payment.provider === 'mercado_pago')
    .map(payment => payment.status);
  const confirmed = Boolean(order?.payment_confirmed_at && order.payment_confirmed_by);
  const contents = creative ? ['Pago de la cotización de diseño'] :
    (order?.order_items || []).map(item => `${item.quantity} × ${item.name_snapshot}`);

  let title = 'Pago pendiente de confirmación';
  let message = 'Aún no podemos confirmar el pago con Mercado Pago. Puedes revisar su estado en Mis pedidos con el correo de la compra.';
  let tone = 'info';
  if (statuses.some(status => ['refunded', 'partially_refunded', 'charged_back', 'in_mediation'].includes(status))) {
    title = 'El pago requiere revisión';
    message = 'Mercado Pago registró una novedad en el pago. Puedes revisar el estado en Mis pedidos.';
    tone = 'warning';
  } else if (confirmed || statuses.includes('approved')) {
    title = confirmed ? 'Pago confirmado' : 'Pago aprobado por Mercado Pago';
    message = confirmed ? 'Puedes seguir el avance en Mis pedidos.' : 'Recibimos la aprobación del cobro. Droska revisará el pago antes de continuar.';
    tone = 'success';
  } else if (returnStatus === 'failure' || statuses.some(status => ['rejected', 'cancelled'].includes(status))) {
    title = 'Pago no completado';
    message = creative ? 'Puedes volver a Mis pedidos para intentar pagar la cotización.' :
      'Puedes volver al carro para intentar pagar el pedido.';
    tone = 'error';
  }
  return {title, message, tone, reference, contents};
}

export function whatsappFeedback({orderId, contents, pendingAttachments, preliminaryPrice}) {
  const reference = orderId ? `Solicitud #${orderId}` : '';
  const title = orderId ? 'Solicitud registrada en Droska' : 'Mensaje de WhatsApp preparado';
  const message = pendingAttachments
    ? `El mensaje de WhatsApp está pendiente de envío. Abre el chat, adjunta ${pendingAttachments} y pulsa «Enviar».`
    : 'El mensaje de WhatsApp está pendiente de envío. Abre el chat y pulsa «Enviar».';
  const summary = preliminaryPrice ? [...contents, `Precio preliminar · ${preliminaryPrice} (por confirmar)`] : contents;
  return {title, message, tone:'info', reference, contents:summary, contentsLabel:orderId?'Datos de la solicitud':'Mensaje preparado'};
}

export function receiptEmailFeedback(receipt, email, contents) {
  if (!email) return '';
  if (receipt?.sent === true) return `${contents} se enviaron a ${email}.`;
  if (receipt?.sent === false) return `No pudimos enviar el correo a ${email}.`;
  return '';
}
