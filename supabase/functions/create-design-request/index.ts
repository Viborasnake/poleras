import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { sendOrderEmail } from '../_shared/order-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes identificarte para enviar tu idea.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La función no está configurada.' }, 500)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)

  let body: any
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const idea = String(body?.idea || '').trim()
  const requestId = String(body?.requestId || '').trim()
  const customer = body?.customer || {}
  const firstName = String(customer.firstName || '').trim()
  const email = String(customer.email || '').trim().toLowerCase()
  const phone = String(customer.phone || '').trim()
  const references = Array.isArray(body?.references)
    ? body.references.slice(0, 6).map((item: any) => ({ name: String(item?.name || '').trim().slice(0, 120), path: String(item?.path || '') })).filter((item: any) => item.name)
    : []
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Identificador de solicitud inválido.' }, 400)
  if (Array.isArray(body?.references) && body.references.length > 6) return json({ error: 'Puedes adjuntar hasta seis referencias.' }, 400)
  if (idea.length < 10 || idea.length > 4000) return json({ error: 'Cuéntanos un poco más sobre tu idea.' }, 400)
  if (!firstName || !email.includes('@') || !phone) return json({ error: 'Faltan datos de contacto.' }, 400)
  const { data: previous } = await admin.from('orders').select('id').eq('creative_request_id', requestId).eq('user_id', userData.user.id).maybeSingle()
  if (previous) return json({ orderId: previous.id, status: 'submitted', duplicate: true }, 200)
  for (const reference of references) {
    if (!new RegExp(`^${userData.user.id}/reference/[0-9a-f-]{36}\\.(png|jpg|webp)$`, 'i').test(reference.path)) return json({ error: 'Una referencia no pertenece a tu solicitud.' }, 400)
    const { data: file, error } = await admin.storage.from('customer-designs').info(reference.path)
    if (error || !file?.size || file.size > 50 * 1024 * 1024) return json({ error: 'No pudimos comprobar una referencia. Vuelve a subirla.' }, 409)
  }

  const now = new Date().toISOString()
  const shippingAddress = { fulfillment: 'pending', customer: { first_name: firstName, email, phone } }
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: userData.user.id,
    source: 'idea_request',
    request_type: 'creative',
    creative_request_id: requestId,
    request_details: idea,
    request_references: references,
    status: 'submitted',
    subtotal_clp: 0,
    shipping_clp: 0,
    discount_clp: 0,
    total_clp: 0,
    shipping_address: shippingAddress,
    price_snapshot: { type: 'creative_request', quote_pending: true },
    submitted_at: now,
  }).select('id').single()
  if (orderError || !order) {
    if (orderError?.code === '23505') {
      const { data: existing } = await admin.from('orders').select('id').eq('creative_request_id', requestId).eq('user_id', userData.user.id).maybeSingle()
      if (existing) return json({ orderId: existing.id, status: 'submitted', duplicate: true }, 200)
    }
    return json({ error: 'No pudimos registrar tu idea.' }, 503)
  }

  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id,
    name_snapshot: 'Diseño personalizado por cotizar',
    sku_snapshot: 'CREATIVE-QUOTE',
    print_sides: 'front',
    quantity: 1,
    unit_price_clp: 0,
    line_total_clp: 0,
  })
  if (itemError) {
    await admin.from('orders').delete().eq('id', order.id)
    return json({ error: 'No pudimos guardar el detalle de tu idea.' }, 503)
  }
  await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Solicitud creativa recibida; pendiente de cotización.' })
  let receipt: { sent: boolean; reason?: string } = { sent: false, reason: 'email_not_configured' }
  let adminNotice: { sent: boolean; reason?: string } = { sent: false, reason: 'admin_email_not_configured' }
  try { receipt = await sendOrderEmail(email, firstName, String(order.id), 'submitted', false, { creative: true, request_details: idea }) }
  catch (error) { console.error('Creative receipt email failed', error); receipt = { sent: false, reason: 'provider_error' } }
  const adminEmail = String(Deno.env.get('ADMIN_ORDER_EMAIL') || '').trim()
  if (adminEmail) {
    try { adminNotice = await sendOrderEmail(adminEmail, firstName, String(order.id), 'submitted', false, { creative: true, request_details: idea, adminNotice: true, referenceCount: references.length }) }
    catch (error) { console.error('Creative admin email failed', error); adminNotice = { sent: false, reason: 'provider_error' } }
  }
  return json({ orderId: order.id, status: 'submitted', receipt, adminNotice }, 201)
})
