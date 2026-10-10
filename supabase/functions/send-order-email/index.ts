import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { buildOrderEmail, orderEmailLabels, sendOrderEmail } from '../_shared/order-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
  const caller = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const [{ data: userData, error: userError }, { data: isAdmin, error: adminError }] = await Promise.all([admin.auth.getUser(token), caller.rpc('is_admin')])
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)
  if (adminError || !isAdmin) return json({ error: 'No tienes permisos de administración.' }, 403)
  const body = await request.json().catch(() => ({}))
  const orderId = String(body.orderId || '').trim()
  const resend = body.resend === true
  const paymentEmail = body.paymentEmail === true
  const orderEditEmail = body.orderEditEmail === true
  const preview = body.preview === true
  const requestedStatus = String(body.status || '').trim()
  if (!orderId) return json({ error: 'Falta el pedido.' }, 400)
  const { data: order, error } = await admin.from('orders').select('id,status,source,request_type,request_details,quote_message,user_id,shipping_address,subtotal_clp,shipping_clp,total_clp,price_snapshot,payment_instructions,payment_confirmed_at,edit_pending_approval,order_edit_version,order_edit_email_sent_at,order_items(name_snapshot,quantity,unit_price_clp,line_total_clp,print_sides)').eq('id', orderId).single()
  if (error || !order) return json({ error: 'No encontramos el pedido.' }, 404)
  const supportedStatuses = ['submitted', 'paid', 'in_production', 'ready', 'ready_for_pickup', 'shipped', 'delivered', ...(order.request_type === 'creative' ? ['quoted', 'awaiting_deposit'] : [])]
  const previewStatus = preview && supportedStatuses.includes(requestedStatus) ? requestedStatus : order.status
  const isStatusTransitionPreview = preview && previewStatus !== order.status
  if (paymentEmail && order.source !== 'manual' && order.price_snapshot?.provider !== 'bank_transfer') return json({ error: 'Este pedido no admite datos de pago por email.' }, 409)
  const approvedEditAwaitingEmail = Number(order.order_edit_version || 0) > 0 && !order.order_edit_email_sent_at && !order.edit_pending_approval
  if (orderEditEmail && !order.edit_pending_approval && !approvedEditAwaitingEmail) return json({ error: 'No hay una edición aprobada pendiente de envío.' }, 409)
  if ((order.edit_pending_approval || approvedEditAwaitingEmail) && !orderEditEmail) return json({ error: 'Este pedido tiene cambios pendientes de revisión o envío. Usa la acción correspondiente antes de enviar otro email.' }, 409)
  if (!supportedStatuses.includes(order.status) || (!resend && !paymentEmail && !isStatusTransitionPreview && (order.source !== 'manual' || !['submitted', 'paid'].includes(order.status)))) return json({ error: 'El pedido no tiene una plantilla de email disponible para reenviar.' }, 409)
  if (isStatusTransitionPreview && previewStatus === 'in_production' && !order.payment_confirmed_at) return json({ error: 'Confirma primero que recibiste el pago antes de preparar el pedido.' }, 409)
  const customer = order.shipping_address?.customer || {}
  const email = String(customer.email || '').trim()
  if (!email) return json({ error: 'El cliente no tiene email.' }, 422)
  const name = String(customer.first_name || '').trim()
  try {
    const paymentInstructions = body.paymentInstructions || order.payment_instructions || null
    if (paymentEmail && !paymentInstructions?.transfer && !paymentInstructions?.mercado_pago_url) return json({ error: 'Agrega datos de transferencia o un link de Mercado Pago.' }, 422)
    const details = { items: order.order_items, subtotal_clp: order.subtotal_clp, shipping_clp: order.shipping_clp, total_clp: order.total_clp, price_snapshot: order.price_snapshot, payment_instructions: paymentEmail ? paymentInstructions : undefined, orderEdited: orderEditEmail, creative: order.request_type === 'creative', request_details: order.request_details, quote_message: order.quote_message }
    if (preview) {
      const siteUrl = (Deno.env.get('SITE_URL') || 'https://poleras-smoky.vercel.app').replace(/\/$/, '')
      const emailPreview = buildOrderEmail(name, order.id, previewStatus, siteUrl, order.shipping_address?.fulfillment === 'pickup', details)
      return json({ orderId: order.id, status: previewStatus, label: orderEmailLabels[previewStatus], preview: true, recipient: email, email: emailPreview, paymentEmail, orderEditEmail })
    }
    const result = await sendOrderEmail(email, name, order.id, order.status, order.shipping_address?.fulfillment === 'pickup', details)
    if (paymentEmail && result.sent) {
      const { error: trackingError } = await admin.from('orders').update({ payment_instructions: paymentInstructions, payment_email_sent_at: new Date().toISOString(), payment_email_sent_by: userData.user.id, updated_at: new Date().toISOString() }).eq('id', order.id)
      if (trackingError) throw trackingError
    }
    if (orderEditEmail && result.sent) {
      const now = new Date().toISOString()
      const nextVersion = order.edit_pending_approval ? Number(order.order_edit_version || 0) + 1 : Number(order.order_edit_version || 0)
      const { error: trackingError } = await admin.from('orders').update({ edit_pending_approval: false, order_edit_version: nextVersion, order_edit_email_sent_at: now, order_edit_email_sent_by: userData.user.id, updated_at: now }).eq('id', order.id).eq('edit_pending_approval', true)
      if (trackingError) throw trackingError
      await admin.from('order_status_history').insert({ order_id: order.id, status: order.status, note: `Edición #${nextVersion} aprobada por administración y enviada por email.` })
    }
    return json({ orderId: order.id, status: order.status, label: orderEmailLabels[order.status], email: result, paymentEmail: paymentEmail, orderEditEmail: orderEditEmail })
  } catch (sendError) {
    console.error(sendError)
    return json({ error: 'No pudimos enviar el correo inicial.' }, 503)
  }
})
