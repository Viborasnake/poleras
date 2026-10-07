import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { orderEmailLabels, sendOrderEmail } from '../_shared/order-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const deliveryWorkflow = ['paid', 'in_production', 'ready', 'shipped', 'delivered'] as const
const pickupWorkflow = ['paid', 'in_production', 'ready_for_pickup', 'delivered'] as const
const aliases: Record<string, number> = {
  draft: 0, submitted: 0, quoted: 0, awaiting_deposit: 0, deposit_paid: 0, paid: 0,
  in_design: 1, proposal_ready: 1, approved: 1, awaiting_balance: 1, in_production: 1,
  ready: 2, shipped: 3, ready_for_pickup: 2, delivered: 3,
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes iniciar sesión.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !secret || !publishable) return json({ error: 'La función no está configurada.' }, 500)

  const token = authorization.slice('Bearer '.length)
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const caller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [{ data: userData, error: userError }, { data: isAdmin, error: adminError }] = await Promise.all([
    admin.auth.getUser(token),
    caller.rpc('is_admin'),
  ])
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)
  if (adminError || !isAdmin) return json({ error: 'No tienes permisos de administración.' }, 403)

  let body: { orderId?: string; status?: string; note?: string; rollback?: boolean; confirmPayment?: boolean }
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const orderId = String(body.orderId || '').trim()
  const status = String(body.status || '').trim()
  const confirmingPayment = body.confirmPayment === true
  if (!orderId || (!confirmingPayment && ![...deliveryWorkflow, ...pickupWorkflow].includes(status as any))) return json({ error: 'Estado de pedido inválido.' }, 400)

  const { data: order, error: orderError } = await admin.from('orders')
    .select('id,user_id,status,shipping_address,subtotal_clp,shipping_clp,total_clp,price_snapshot,payment_instructions,payment_confirmed_at,edit_pending_approval,order_items(name_snapshot,quantity,unit_price_clp,line_total_clp,print_sides)')
    .eq('id', orderId)
    .single()
  if (orderError || !order) return json({ error: 'No encontramos el pedido.' }, 404)
  if (order.edit_pending_approval) return json({ error: 'Este pedido tiene cambios pendientes de revisión. Compáralos y apruébalos o recházalos antes de avanzar.' }, 409)
  if (confirmingPayment) {
    if (!['submitted', 'paid'].includes(order.status)) return json({ error: 'Este pedido ya avanzó y no puede confirmar un pago pendiente desde aquí.' }, 409)
    const { data: payments, error: paymentsError } = await admin.from('payments').select('id,provider,status').eq('order_id', order.id).order('created_at', { ascending: false })
    if (paymentsError) return json({ error: 'No pudimos revisar el estado del pago.' }, 503)
    const mercadoPago = (payments || []).find(payment => payment.provider === 'mercado_pago')
    if (mercadoPago && mercadoPago.status !== 'approved') return json({ error: 'Mercado Pago todavía no aprobó este cobro. Espera el webhook o pide al cliente que reintente el pago.' }, 409)
    const transferable = (payments || []).find(payment => payment.provider === 'transferencia_bancaria')
    const paymentAt = new Date().toISOString()
    if (transferable) {
      const { error: paymentUpdateError } = await admin.from('payments').update({ status: 'approved', confirmed_at: paymentAt }).eq('id', transferable.id).eq('status', 'pending')
      if (paymentUpdateError) return json({ error: 'No pudimos confirmar la transferencia.' }, 503)
    } else if (!mercadoPago) {
      const provider = order.payment_instructions?.transfer ? 'transferencia_bancaria' : 'manual'
      const { error: paymentInsertError } = await admin.from('payments').insert({ order_id: order.id, provider, kind: 'full', status: 'approved', amount_clp: order.total_clp, confirmed_at: paymentAt })
      if (paymentInsertError) return json({ error: 'No pudimos registrar la confirmación del pago.' }, 503)
    }
    const { data: confirmedOrder, error: confirmOrderError } = await admin.from('orders')
      .update({ status: 'paid', payment_confirmed_at: paymentAt, payment_confirmed_by: userData.user.id, updated_at: paymentAt })
      .eq('id', order.id).in('status', ['submitted', 'paid']).select('id,status').maybeSingle()
    if (confirmOrderError || !confirmedOrder) return json({ error: 'No pudimos confirmar el pago del pedido.' }, 503)
    if (order.status === 'paid') await admin.from('order_status_history').insert({ order_id: order.id, status: 'paid', note: 'Pago confirmado manualmente por administración.' })
    return json({ orderId, status: 'paid', label: orderEmailLabels.paid, paymentConfirmedAt: paymentAt, email: { sent: false, reason: 'payment_confirmation_without_email' } })
  }
  if (body.rollback) {
    if (status !== 'paid' || order.status === 'paid' || order.status === 'delivered') return json({ error: 'Este pedido no puede volver a Pedido ingresado.' }, 409)
    const { data: rolledBack, error: rollbackError } = await admin.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', orderId).eq('status', order.status).select('id').maybeSingle()
    if (rollbackError) return json({ error: 'No pudimos devolver el pedido a Pedido ingresado.' }, 503)
    if (!rolledBack) return json({ error: 'El pedido cambió en otra sesión. Recarga el panel.' }, 409)
    return json({ orderId, status: 'paid', label: orderEmailLabels.paid, email: { sent: false, reason: 'rollback_without_email' } })
  }
  const workflow = order.shipping_address?.fulfillment === 'pickup' ? pickupWorkflow : deliveryWorkflow
  const currentIndex = aliases[order.status]
  const requestedIndex = workflow.indexOf(status as any)
  if (currentIndex === undefined || requestedIndex !== currentIndex + 1) {
    return json({ error: 'El pedido debe avanzar una etapa a la vez.' }, 409)
  }
  if (status === 'in_production' && !order.payment_confirmed_at) return json({ error: 'Confirma primero que recibiste el pago antes de preparar el pedido.' }, 409)

  const { data: updatedOrder, error: updateError } = await admin.from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')
    .maybeSingle()
  if (updateError) return json({ error: 'No pudimos actualizar el pedido.' }, 503)
  if (!updatedOrder) return json({ error: 'El pedido cambió en otra sesión. Recarga el panel.' }, 409)
  const customer = order.shipping_address?.customer || {}
  const pickup = order.shipping_address?.fulfillment === 'pickup'
  const authUser = customer.email || !order.user_id ? null : await admin.auth.admin.getUserById(order.user_id)
  const email = String(customer.email || authUser?.data?.user?.email || '').trim()
  const name = String(customer.first_name || authUser?.data?.user?.user_metadata?.full_name || '').trim()
  let emailResult: Record<string, unknown> = { sent: false, reason: 'missing_customer_email' }
  if (email) {
    try { emailResult = await sendOrderEmail(email, name, orderId, status, pickup, { items: order.order_items, subtotal_clp: order.subtotal_clp, shipping_clp: order.shipping_clp, total_clp: order.total_clp, price_snapshot: order.price_snapshot }) }
    catch (error) {
      console.error(error)
      emailResult = { sent: false, reason: 'provider_error' }
    }
  }

  return json({ orderId, status, label: orderEmailLabels[status], email: emailResult })
})
