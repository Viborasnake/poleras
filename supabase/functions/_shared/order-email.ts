export const orderEmailLabels: Record<string, string> = {
  submitted: 'Pedido ingresado',
  quoted: 'Cotización disponible',
  paid: 'Pedido ingresado',
  in_production: 'Preparando pedido',
  ready: 'Pedido preparado',
  shipped: 'En despacho',
  ready_for_pickup: 'Listo para retirar',
  delivered: 'Pedido entregado',
}

const deliverySteps = [
  ['submitted', 'Pedido ingresado'],
  ['in_production', 'Preparando pedido'],
  ['ready', 'Pedido preparado'],
  ['shipped', 'En despacho'],
  ['delivered', 'Entregado'],
] as const
const pickupSteps = [
  ['submitted', 'Pedido ingresado'],
  ['in_production', 'Preparando pedido'],
  ['ready_for_pickup', 'Listo para retirar'],
  ['delivered', 'Retirado'],
] as const
const whatsappNumber = '56965217926'

const htmlEntities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
export const escapeHtml = (value: unknown) => String(value || '').replace(/[&<>"']/g, char => htmlEntities[char] || char)
type OrderEmailItem = { name_snapshot?: string; quantity?: number; unit_price_clp?: number; line_total_clp?: number; print_sides?: string }
type PaymentInstructions = { transfer?: { holder?: string; bank?: string; account_type?: string; account_number?: string; rut?: string; email?: string }; mercado_pago_url?: string }
type OrderEmailDetails = { items?: OrderEmailItem[]; subtotal_clp?: number; shipping_clp?: number; total_clp?: number; price_snapshot?: Record<string, unknown>; payment_instructions?: PaymentInstructions; orderEdited?: boolean; creative?: boolean; request_details?: string; quote_message?: string; adminNotice?: boolean; referenceCount?: number }
const formatClp = (value: unknown) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0))
function orderDetails(details: OrderEmailDetails = {}) {
  const items = Array.isArray(details.items) ? details.items : []
  const lines = items.map(item => `${item.quantity || 1} × ${item.name_snapshot || 'Producto'}${item.print_sides ? ` · ${item.print_sides}` : ''}`)
  const manual = details.price_snapshot || {}
  const notes = [manual.design_details, manual.substrate, manual.size, manual.color].filter(Boolean).map(String)
  const text = [...lines, ...notes.map(note => `Detalle: ${note}`)]
  if (details.total_clp !== undefined) text.push(`Total: ${formatClp(details.total_clp)}`)
  const htmlLines = [...items.map(item => `<tr><td style="padding:7px 0;border-bottom:1px solid #E8E3DA">${escapeHtml(item.quantity || 1)} × ${escapeHtml(item.name_snapshot || 'Producto')}</td><td style="padding:7px 0;border-bottom:1px solid #E8E3DA;text-align:right">${formatClp(item.line_total_clp || 0)}</td></tr>`), ...notes.map(note => `<tr><td colspan="2" style="padding:7px 0;color:#6B6A62;border-bottom:1px solid #E8E3DA">${escapeHtml(note)}</td></tr>`)]
  if (details.total_clp !== undefined) htmlLines.push(`<tr><td style="padding:10px 0 0;font-weight:700">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700">${formatClp(details.total_clp)}</td></tr>`)
  const payment = details.payment_instructions || {}
  const transfer = payment.transfer || {}
  const paymentText = [transfer.holder && `Titular: ${transfer.holder}`, transfer.bank && `Banco: ${transfer.bank}`, transfer.account_type && `Tipo de cuenta: ${transfer.account_type}`, transfer.account_number && `Número de cuenta: ${transfer.account_number}`, transfer.rut && `RUT: ${transfer.rut}`, transfer.email && `Email: ${transfer.email}`, payment.mercado_pago_url && `Link de pago Mercado Pago: ${payment.mercado_pago_url}`].filter(Boolean).join('\n')
  const paymentHtml = paymentText ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;padding:14px 16px;background:#F4F1EB;border-radius:12px;color:#262920;font-size:13px;line-height:1.55"><tr><td><strong style="display:block;margin-bottom:6px;color:#B52D6B;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Datos para pagar</strong>${paymentText.split('\n').map(line=>`${escapeHtml(line)}<br>`).join('')}</td></tr></table>` : ''
  return { text: [...text, paymentText].filter(Boolean).join('\n'), html: `${htmlLines.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;color:#262920;font-size:13px;line-height:1.4"><tr><td colspan="2" style="padding-bottom:6px;color:#B52D6B;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Detalle del pedido</td></tr>${htmlLines.join('')}</table>` : ''}${paymentHtml}` }
}

function copyFor(status: string, pickup: boolean) {
  const copies: Record<string, { subject: string; title: string; body: string; action: string }> = {
    submitted: {
      subject: 'Recibimos tu pedido',
      title: 'Recibimos tu pedido.',
      body: 'Ya tenemos tus datos y los detalles de tu pedido. Nuestro equipo lo revisará antes de comenzar a prepararlo.',
      action: 'Revisar mi pedido',
    },
    paid: {
      subject: 'Tu pedido fue ingresado',
      title: 'Tu pedido está ingresado.',
      body: 'Tu pedido quedó registrado y pronto comenzaremos a trabajar en él.',
      action: 'Ver mi pedido',
    },
    in_production: {
      subject: 'Estamos preparando tu pedido',
      title: 'Estamos preparando tu pedido.',
      body: 'Tu pedido ya entró a producción. Te avisaremos cuando esté listo para despacho o retiro.',
      action: 'Ver avance',
    },
    ready: {
      subject: pickup ? 'Tu pedido está listo para retirar' : 'Tu pedido está preparado',
      title: pickup ? 'Tu pedido está listo para retirar.' : 'Tu pedido está preparado.',
      body: pickup ? 'Ya puedes coordinar el retiro de tu pedido. Te contactaremos con los detalles.' : 'Tu pedido está preparado y será entregado a la transportista en el siguiente paso.',
      action: 'Ver detalles',
    },
    ready_for_pickup: {
      subject: 'Tu pedido está listo para retirar',
      title: 'Tu pedido está listo para retirar.',
      body: 'Tu pedido ya está disponible. Te enviaremos o confirmaremos los detalles del retiro.',
      action: 'Ver detalles',
    },
    shipped: {
      subject: 'Tu pedido va en camino',
      title: 'Tu pedido va en camino.',
      body: 'Tu pedido fue entregado a la transportista. Pronto recibirás novedades de la entrega.',
      action: 'Ver seguimiento',
    },
    delivered: {
      subject: pickup ? '¿Cómo fue tu retiro?' : '¿Cómo estuvo tu pedido?',
      title: pickup ? 'Gracias por retirar tu pedido.' : 'Tu pedido llegó.',
      body: pickup ? 'Gracias por retirar tu pedido en Droska. ¿Nos cuentas cómo fue tu experiencia?' : 'Gracias por confiar en Droska. Esperamos que disfrutes tu pedido. ¿Nos cuentas cómo fue tu experiencia?',
      action: 'Responder encuesta',
    },
  }
  return copies[status] || copies.submitted
}

export function buildOrderEmail(name: string, orderId: string, status: string, siteUrl: string, pickup = false, details: OrderEmailDetails = {}) {
  const label = orderEmailLabels[status] || 'Actualización de pedido'
  const copy = copyFor(status, pickup)
  const steps = pickup ? pickupSteps : deliverySteps
  const currentIndex = steps.findIndex(([key]) => key === status)
  const stepper = steps.map(([, stepLabel], index) => {
    const active = index === currentIndex
    const complete = index < currentIndex
    const background = active ? '#F957A4' : complete ? '#DFFF78' : '#F4F1EB'
    const color = active ? '#262920' : '#6B6A62'
    return `<td style="width:20%;padding:0 3px;text-align:center"><div style="height:8px;border-radius:99px;background:${background}"></div><p style="margin:7px 0 0;color:${color};font-size:11px;line-height:1.25;font-weight:${active ? 700 : 500}">${escapeHtml(stepLabel)}</p></td>`
  }).join('')
  const safeSiteUrl = escapeHtml(siteUrl)
  const safeName = escapeHtml(name || 'creativa/o')
  const safeOrderId = escapeHtml(orderId)
  const actionUrl = status === 'delivered' ? `${safeSiteUrl}/?encuesta=${encodeURIComponent(orderId)}` : `${safeSiteUrl}/?panel=account`
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola Droska, necesito ayuda con mi pedido #${orderId}`)}`
  const summary = orderDetails(details)
  if (details.creative) {
    const quote = status === 'quoted' || status === 'awaiting_deposit'
    const subject = `${details.adminNotice ? 'Nueva idea recibida' : quote ? 'Tu cotización está disponible' : status === 'paid' ? 'Confirmamos tu pago' : 'Recibimos tu idea'} · Solicitud #${orderId}`
    const message = details.adminNotice ? `Nueva solicitud de ${name}. Idea: ${details.request_details || ''}. Referencias adjuntas: ${details.referenceCount || 0}. Revisa los archivos en Administración.` : quote ? `Tu propuesta: ${details.quote_message || ''}. Total: ${formatClp(details.total_clp)}. Crea una cuenta con este correo o ingresa a Mis pedidos para aceptarla y continuar al pago.` : status === 'paid' ? `Confirmamos el pago de tu solicitud por ${formatClp(details.total_clp)}. Nuestro equipo continuará con tu diseño.` : 'Recibimos tu idea y la revisaremos. Crea una cuenta con este correo para seguir la solicitud en Mis pedidos.'
    const action = details.adminNotice ? `${siteUrl}/admin#pedidos` : `${siteUrl}/?panel=account`
    return { subject, text: `${message}\n\nSolicitud #${orderId}\n${action}`, html: `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;background:#F9F7F2;color:#262920;padding:24px"><main style="max-width:600px;margin:auto;background:#FFFDFA;padding:30px;border-radius:18px"><h1 style="font-size:27px">${escapeHtml(subject)}</h1><p style="line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p><a href="${escapeHtml(action)}" style="display:inline-block;background:#262920;color:white;padding:14px 20px;border-radius:99px;text-decoration:none">${details.adminNotice ? 'Abrir pedidos' : 'Ver mi solicitud'}</a></main></body></html>` }
  }
  const hasPaymentInstructions = Boolean(details.payment_instructions && (details.payment_instructions.transfer || details.payment_instructions.mercado_pago_url))
  const emailBody = hasPaymentInstructions ? 'Te dejamos los datos para pagar tu pedido. Cuando realices la transferencia, envíanos el comprobante por WhatsApp o responde este correo.' : details.orderEdited ? 'Actualizamos tu pedido con los cambios aprobados por nuestro equipo. Revisa el nuevo detalle y total a continuación.' : copy.body
  return {
    subject: `${hasPaymentInstructions ? 'Datos de pago' : details.orderEdited ? 'Tu pedido fue actualizado' : copy.subject} · Pedido #${orderId}`,
    text: `Hola ${name || 'creativa/o'},\n\n${emailBody}\n\n${summary.text ? `${summary.text}\n\n` : ''}Estado actual: ${label}\nPedido #${orderId}\n\n${status === 'delivered' ? `Responde la encuesta: ${siteUrl}/?encuesta=${encodeURIComponent(orderId)}` : `Revisa tu pedido: ${siteUrl}/?panel=account`}\n\n¿Necesitas ayuda? Escríbenos por WhatsApp: ${whatsappUrl}\n\nDroska · Hecho a tu pinta.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#F7F4EF;color:#262920;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdfa;border:1px solid #DEDAD1;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 30px 20px;border-bottom:1px solid #E8E3DA"><div style="font-size:25px;font-weight:800;letter-spacing:-1px">droska <span style="color:#F957A4">SHIRT</span></div></td></tr><tr><td style="padding:32px 30px 20px"><p style="margin:0 0 10px;color:#B52D6B;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">PEDIDO #${safeOrderId}</p><h1 style="margin:0 0 14px;font-size:30px;line-height:1.1;letter-spacing:-.6px">${escapeHtml(hasPaymentInstructions ? 'Datos para pagar tu pedido.' : copy.title)}</h1><p style="margin:0;color:#56564F;font-size:16px;line-height:1.6">Hola ${safeName}, ${escapeHtml(emailBody)}</p>${summary.html}</td></tr><tr><td style="padding:8px 30px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stepper}</tr></table></td></tr><tr><td style="padding:0 30px 30px"><a href="${actionUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 18px;border-radius:999px;background:#262920;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(copy.action)} →</a><a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;margin:0 0 8px;padding:13px 18px;border-radius:999px;background:#E4F6E8;color:#167B3C;border:1px solid #167B3C;text-decoration:none;font-size:14px;font-weight:700">💬 Hablar por WhatsApp</a></td></tr><tr><td style="padding:18px 30px;background:#F4F1EB;color:#6B6A62;font-size:12px;line-height:1.5">Estado actual: <strong style="color:#262920">${escapeHtml(label)}</strong><br>Droska · Hecho a tu pinta.</td></tr></table></td></tr></table></body></html>`,
  }
}

export async function sendOrderEmail(to: string, name: string, orderId: string, status: string, pickup = false, details: OrderEmailDetails = {}) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from) return { sent: false, reason: 'email_not_configured' }
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://poleras-smoky.vercel.app').replace(/\/$/, '')
  const email = buildOrderEmail(name, orderId, status, siteUrl, pickup, details)
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: email.subject, text: email.text, html: email.html }) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'No se pudo enviar el correo.')
  return { sent: true, id: payload?.id }
}

export async function sendAdminOrderNotice(orderId: string, kind: string, customer: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('RESEND_FROM_EMAIL'), to = Deno.env.get('ADMIN_ORDER_EMAIL')
  if (!apiKey || !from || !to) return { sent: false, reason: 'admin_email_not_configured' }
  const siteUrl = String(Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  const subject = `${kind} · Pedido #${orderId}`
  const message = `${kind} de ${customer}. Revisa el pedido #${orderId} en Administración.`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text: `${message}\n${siteUrl}/admin#pedidos`, html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(siteUrl)}/admin#pedidos">Abrir pedidos</a></p>` }) })
  if (!response.ok) throw new Error('No se pudo avisar al administrador.')
  return { sent: true }
}
