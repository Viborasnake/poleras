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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes iniciar sesión.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La función no está configurada.' }, 500)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  const user = userData.user
  if (userError || !user || user.is_anonymous) return json({ error: 'La sesión no es válida.' }, 401)

  let body: { orderId?: string }
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const orderId = String(body.orderId || '').trim()
  if (!orderId) return json({ error: 'Falta el pedido.' }, 400)

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id,user_id,payment_instructions,payment_confirmed_at,payment_transfer_notice_at')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError || !order) return json({ error: 'No encontramos el pedido.' }, 404)
  if (String(order.user_id) !== String(user.id)) return json({ error: 'No puedes avisar el pago de este pedido.' }, 403)
  if (!order.payment_instructions?.transfer) return json({ error: 'Este pedido no tiene transferencia bancaria habilitada.' }, 409)
  if (order.payment_confirmed_at) return json({ error: 'Este pago ya fue confirmado por administración.' }, 409)
  const { data: transferPayment, error: paymentError } = await admin.from('payments').select('id,status').eq('order_id', order.id).eq('provider', 'transferencia_bancaria').maybeSingle()
  if (paymentError || !transferPayment) return json({ error: 'No encontramos una transferencia pendiente para este pedido.' }, 409)
  if (transferPayment.status !== 'pending') return json({ error: 'Esta transferencia ya no está pendiente de revisión.' }, 409)
  if (order.payment_transfer_notice_at) return json({ noticedAt: order.payment_transfer_notice_at, alreadyNoticed: true })

  const noticedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await admin
    .from('orders')
    .update({ payment_transfer_notice_at: noticedAt, payment_transfer_notice_by: user.id, updated_at: noticedAt })
    .eq('id', order.id)
    .is('payment_transfer_notice_at', null)
    .select('id,payment_transfer_notice_at')
    .maybeSingle()
  if (updateError) return json({ error: 'No pudimos avisar la transferencia.' }, 500)
  if (!updated) return json({ noticedAt, alreadyNoticed: true })

  return json({ orderId: order.id, noticedAt: updated.payment_transfer_notice_at })
})
