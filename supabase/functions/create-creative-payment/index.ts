import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '')
  const url = Deno.env.get('SUPABASE_URL'), secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN'), siteUrl = String(Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  if (!token || !url || !secret) return json({ error: 'El pago no está configurado.' }, 503)
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: identity, error: authError } = await admin.auth.getUser(token)
  if (authError || !identity.user) return json({ error: 'Inicia sesión para aceptar la cotización.' }, 401)
  const body = await request.json().catch(() => ({}))
  const paymentMethod = body?.paymentMethod === 'transfer' ? 'transfer' : 'mercado_pago'
  if (paymentMethod === 'mercado_pago' && (!mpToken || !siteUrl)) return json({ error: 'Mercado Pago no está configurado.' }, 503)
  const orderId = Number(body?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) return json({ error: 'Solicitud inválida.' }, 400)
  const { data: order, error } = await admin.from('orders').select('id,user_id,request_type,status,quoted_total_clp,total_clp,shipping_address,price_snapshot').eq('id', orderId).eq('user_id', identity.user.id).single()
  if (error || !order || order.request_type !== 'creative') return json({ error: 'No encontramos tu cotización.' }, 404)
  if (!['quoted', 'awaiting_deposit'].includes(order.status) || !Number.isSafeInteger(order.quoted_total_clp) || order.quoted_total_clp <= 0 || order.total_clp !== order.quoted_total_clp) return json({ error: 'La cotización ya no está disponible para pago.' }, 409)
  const email = String(order.shipping_address?.customer?.email || identity.user.email || '')
  if (!email.includes('@')) return json({ error: 'Falta un correo de contacto válido.' }, 422)
  const bankTransfer = {
    holder: String(Deno.env.get('BANK_TRANSFER_HOLDER') || '').trim(),
    bank: String(Deno.env.get('BANK_TRANSFER_BANK') || '').trim(),
    account_type: String(Deno.env.get('BANK_TRANSFER_ACCOUNT_TYPE') || '').trim(),
    account_number: String(Deno.env.get('BANK_TRANSFER_ACCOUNT_NUMBER') || '').trim(),
    rut: String(Deno.env.get('BANK_TRANSFER_RUT') || '').trim(),
    email: String(Deno.env.get('BANK_TRANSFER_EMAIL') || '').trim(),
  }
  const { data: existingPayments, error: paymentLookupError } = await admin.from('payments').select('id,provider,status,amount_clp,provider_preference_id').eq('order_id',order.id)
  if (paymentLookupError) return json({ error: 'No pudimos comprobar los pagos anteriores.' }, 503)
  if (existingPayments?.some((item:any)=>item.status === 'approved')) return json({ error: 'Esta cotización ya está pagada.' }, 409)
  if (paymentMethod === 'transfer') {
    if (!bankTransfer.holder || !bankTransfer.bank || !bankTransfer.account_number || !bankTransfer.rut) return json({ error: 'La transferencia bancaria aún no está configurada.' }, 503)
    if (existingPayments?.some((item:any)=>item.provider === 'mercado_pago' && item.status === 'pending')) return json({ error: 'Ya existe un pago pendiente en Mercado Pago. Contáctanos para cambiar el medio de pago.' }, 409)
    const previous = existingPayments?.find((item:any)=>item.provider === 'transferencia_bancaria' && item.status === 'pending')
    if (previous && previous.amount_clp !== order.total_clp) return json({ error: 'La cotización cambió. Actualiza Mis pedidos antes de pagar.' }, 409)
    if (!previous) {
      const { error: insertError } = await admin.from('payments').insert({order_id:order.id,provider:'transferencia_bancaria',kind:'full',status:'pending',amount_clp:order.total_clp})
      if (insertError) return json({ error: 'No pudimos registrar la transferencia. Intenta nuevamente.' }, 503)
    }
    const { data: saved, error: saveError } = await admin.from('orders').update({status:'awaiting_deposit',payment_instructions:{transfer:bankTransfer},price_snapshot:{...(order.price_snapshot||{}),provider:'bank_transfer'}}).eq('id',order.id).in('status',['quoted','awaiting_deposit']).eq('total_clp',order.total_clp).select('id').maybeSingle()
    if (saveError || !saved) return json({ error: 'La cotización cambió. Actualiza Mis pedidos.' }, 409)
    return json({orderId:order.id,totalClp:order.total_clp,paymentMethod:'transfer',paymentInstructions:{transfer:bankTransfer}},previous?200:201)
  }
  if (existingPayments?.some((item:any)=>item.provider === 'transferencia_bancaria' && item.status === 'pending')) return json({ error: 'Ya elegiste transferencia. Revisa los datos de pago en Mis pedidos.' }, 409)
  const externalReference = `DROSKA-${order.id}`
  const { data: prior } = await admin.from('payments').select('id,status,amount_clp,provider_preference_id').eq('provider_reference', externalReference).maybeSingle()
  if (prior?.status === 'approved') return json({ error: 'Esta cotización ya está pagada.' }, 409)
  if (prior?.status === 'pending' && prior.amount_clp === order.total_clp && prior.provider_preference_id === order.price_snapshot?.creative_preference_id && order.price_snapshot?.creative_checkout_url) return json({ orderId: order.id, totalClp: order.total_clp, initPoint: order.price_snapshot.creative_checkout_url }, 200)
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: externalReference, title: `Cotización Droska #${order.id}`, currency_id: 'CLP', quantity: 1, unit_price: order.total_clp }], payer: { email }, external_reference: externalReference, notification_url: `${url}/functions/v1/mercado-pago-webhook`, back_urls: { success: `${siteUrl}/?mp_status=success&order_id=${order.id}`, failure: `${siteUrl}/?mp_status=failure&order_id=${order.id}`, pending: `${siteUrl}/?mp_status=pending&order_id=${order.id}` }, auto_return: 'approved' }) })
  const preference = await response.json().catch(() => ({}))
  if (!response.ok || !preference.id || !preference.init_point) return json({ error: 'Mercado Pago no pudo preparar el pago. Intenta nuevamente.' }, 503)
  const { data: current } = await admin.from('orders').select('status,total_clp').eq('id', order.id).single()
  if (!current || !['quoted', 'awaiting_deposit'].includes(current.status) || current.total_clp !== order.total_clp) return json({ error: 'La cotización cambió. Actualiza Mis pedidos antes de pagar.' }, 409)
  const payment = { order_id: order.id, provider: 'mercado_pago', provider_reference: externalReference, provider_preference_id: preference.id, kind: 'full', status: 'pending', amount_clp: order.total_clp }
  const result = prior ? await admin.from('payments').update(payment).eq('id', prior.id).neq('status', 'approved').select('id').maybeSingle() : await admin.from('payments').insert(payment).select('id').maybeSingle()
  if (result.error || !result.data) return json({ error: 'No pudimos registrar el intento de pago. Actualiza e intenta nuevamente.' }, 503)
  const { data: saved, error: snapshotError } = await admin.from('orders').update({ status: 'awaiting_deposit', price_snapshot: { ...(order.price_snapshot || {}), provider: 'mercado_pago', creative_preference_id: preference.id, creative_checkout_url: preference.init_point } }).eq('id', order.id).in('status', ['quoted', 'awaiting_deposit']).select('id').maybeSingle()
  if (snapshotError || !saved) return json({ error: 'No pudimos guardar el enlace de pago. Actualiza e intenta nuevamente.' }, 503)
  return json({ orderId: order.id, totalClp: order.total_clp, initPoint: preference.init_point }, 201)
})
