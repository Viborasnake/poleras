import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

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
  const customer = body?.customer || {}
  const firstName = String(customer.firstName || '').trim()
  const email = String(customer.email || '').trim()
  const phone = String(customer.phone || '').trim()
  const references = Array.isArray(body?.references)
    ? body.references.slice(0, 6).map((item: any) => ({ name: String(item?.name || '').trim().slice(0, 120) })).filter((item: any) => item.name)
    : []
  if (idea.length < 10 || idea.length > 4000) return json({ error: 'Cuéntanos un poco más sobre tu idea.' }, 400)
  if (!firstName || !email.includes('@') || !phone) return json({ error: 'Faltan datos de contacto.' }, 400)

  const now = new Date().toISOString()
  const shippingAddress = { fulfillment: 'pending', customer: { first_name: firstName, email, phone } }
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: userData.user.id,
    source: 'idea_request',
    request_type: 'creative',
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
  if (orderError || !order) return json({ error: 'No pudimos registrar tu idea.' }, 503)

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
  return json({ orderId: order.id, status: 'submitted' }, 201)
})
