import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { sendAdminOrderNotice } from '../_shared/order-email.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

const signatureIsValid = async (request: Request, dataId: string) => {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
  const requestId = request.headers.get('x-request-id')
  const signature = request.headers.get('x-signature') || ''
  if (!secret || !requestId) return false
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')))
  if (!parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false
  const signedText = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedText)))].map(value => value.toString(16).padStart(2, '0')).join('')
  return safeEqual(digest, parts.v1.toLowerCase())
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!url || !secret || !mpToken) return json({ error: 'Webhook no configurado.' }, 500)

  const body = await request.json().catch(() => ({})) as any
  const params = new URL(request.url).searchParams
  const dataId = String(params.get('data.id') || body?.data?.id || '')
  if (!/^\d+$/.test(dataId) || (body?.data?.id && String(body.data.id) !== dataId) || !(await signatureIsValid(request, dataId))) return json({ error: 'Firma inválida.' }, 401)
  if (body.type && body.type !== 'payment') return json({ ok: true })

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, { headers: { Authorization: `Bearer ${mpToken}` } })
  if (!response.ok) return json({ error: 'No se pudo consultar el pago.' }, 502)
  const payment = await response.json()
  const reference = String(payment.external_reference || '')
  if (String(payment.id) !== dataId || !/^DROSKA-\d+$/.test(reference)) return json({ error: 'Pago no reconocido.' }, 422)
  const orderId = Number(reference.slice('DROSKA-'.length))
  if (!Number.isSafeInteger(orderId) || orderId < 1) return json({ error: 'Pedido inválido.' }, 422)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: pending, error: lookupError } = await admin.from('payments')
    .select('id,order_id,amount_clp,status,provider_payment_id,orders!inner(total_clp,status)')
    .eq('provider', 'mercado_pago').eq('provider_reference', reference).eq('order_id', orderId).maybeSingle()
  if (lookupError || !pending) return json({ error: 'Pago pendiente de registro.' }, 503)
  if (pending.status === 'approved' && pending.provider_payment_id !== dataId) return json({ error: 'El pedido ya tiene un pago aprobado.' }, 409)
  const order = Array.isArray(pending.orders) ? pending.orders[0] : pending.orders
  const amount = Number(payment.transaction_amount)
  if (payment.currency_id !== 'CLP' || !Number.isSafeInteger(amount) || amount !== pending.amount_clp || amount !== order?.total_clp) return json({ error: 'Monto inválido.' }, 422)

  const status = payment.status === 'approved' ? 'approved' : payment.status === 'rejected' ? 'rejected' : payment.status === 'cancelled' ? 'cancelled' : 'pending'
  if ((pending.status === 'approved' && status !== 'approved') || (pending.status === status && pending.provider_payment_id === dataId)) return json({ ok: true })
  const confirmedAt = status === 'approved' ? new Date().toISOString() : null
  const { error: updateError } = await admin.from('payments').update({ provider_payment_id: dataId, status, confirmed_at: confirmedAt }).eq('id', pending.id)
  if (updateError) return json({ error: 'No se pudo actualizar el pago.' }, 503)
  if (status !== 'approved') {
    const labels: Record<string, string> = { rejected: 'Pago rechazado por Mercado Pago.', cancelled: 'Pago cancelado en Mercado Pago.', pending: 'Pago pendiente de confirmación de Mercado Pago.' }
    await admin.from('order_status_history').insert({ order_id: orderId, status: (order as any)?.status || 'submitted', note: labels[status] || 'Pago actualizado por Mercado Pago.' })
    return json({ ok: true })
  }

  // El proveedor acredita el cobro, pero solo Administración confirma el pedido.
  const { error: historyError } = await admin.from('order_status_history').insert({
    order_id: orderId,
    status: (order as any)?.status || 'submitted',
    note: 'Mercado Pago aprobó el cobro. Pago por revisar en Administración.',
  })
  if (historyError) console.error('No pudimos registrar la revisión del pago', historyError)
  const { data: pendingOrder } = await admin.from('orders').select('shipping_address').eq('id', orderId).single()
  const customer = pendingOrder?.shipping_address?.customer || {}
  try { await sendAdminOrderNotice(String(orderId), 'Pago por revisar', String(customer.email || 'cliente')) }
  catch (error) { console.error('No pudimos avisar al administrador del pago', error) }
  return json({ ok: true })
})
