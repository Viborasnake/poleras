import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const workflow = ['paid', 'in_production', 'ready', 'shipped', 'delivered'] as const
const labels: Record<string, string> = {
  paid: 'Pedido ingresado',
  in_production: 'Preparando pedido',
  ready: 'Listo para despacho',
  shipped: 'En despacho',
  delivered: 'Entregado',
}
const aliases: Record<string, number> = {
  draft: 0, submitted: 0, quoted: 0, awaiting_deposit: 0, deposit_paid: 0, paid: 0,
  in_design: 1, proposal_ready: 1, approved: 1, awaiting_balance: 1, in_production: 1,
  ready: 2, shipped: 3, delivered: 4,
}
const htmlEntities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
const escapeHtml = (value: unknown) => String(value || '').replace(/[&<>"']/g, char => htmlEntities[char] || char)

async function sendStatusEmail(to: string, name: string, orderId: string, status: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from) return { sent: false, reason: 'email_not_configured' }
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://poleras-smoky.vercel.app').replace(/\/$/, '')
  const label = labels[status]
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Tu pedido #${orderId} · ${label}`,
      text: `Hola ${name || 'creativa/o'}, tu pedido #${orderId} ahora está en: ${label}. Revisa el detalle en ${siteUrl}/?panel=account`,
      html: `<div style="font-family:Arial,sans-serif;color:#262920;line-height:1.55"><p>Hola ${escapeHtml(name || 'creativa/o')},</p><h1 style="font-size:24px">${escapeHtml(label)}</h1><p>Tu pedido <strong>#${escapeHtml(orderId)}</strong> avanzó a una nueva etapa.</p><p><a href="${escapeHtml(siteUrl)}/?panel=account" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#262920;color:#fff;text-decoration:none;font-weight:700">Ver mis pedidos</a></p><p style="color:#6d6b64">Droska · Hecho a tu pinta.</p></div>`,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'No se pudo enviar el correo.')
  return { sent: true, id: payload?.id }
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

  let body: { orderId?: string; status?: string; note?: string }
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const orderId = String(body.orderId || '').trim()
  const status = String(body.status || '').trim()
  if (!orderId || !workflow.includes(status as typeof workflow[number])) return json({ error: 'Estado de pedido inválido.' }, 400)

  const { data: order, error: orderError } = await admin.from('orders')
    .select('id,user_id,status,shipping_address')
    .eq('id', orderId)
    .single()
  if (orderError || !order) return json({ error: 'No encontramos el pedido.' }, 404)
  const currentIndex = aliases[order.status]
  const requestedIndex = workflow.indexOf(status as typeof workflow[number])
  if (currentIndex === undefined || requestedIndex !== currentIndex + 1) {
    return json({ error: 'El pedido debe avanzar una etapa a la vez.' }, 409)
  }

  const { data: updatedOrder, error: updateError } = await admin.from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')
    .maybeSingle()
  if (updateError) return json({ error: 'No pudimos actualizar el pedido.' }, 503)
  if (!updatedOrder) return json({ error: 'El pedido cambió en otra sesión. Recarga el panel.' }, 409)
  const customer = order.shipping_address?.customer || {}
  const authUser = customer.email ? null : await admin.auth.admin.getUserById(order.user_id)
  const email = String(customer.email || authUser?.data?.user?.email || '').trim()
  const name = String(customer.first_name || authUser?.data?.user?.user_metadata?.full_name || '').trim()
  let emailResult: Record<string, unknown> = { sent: false, reason: 'missing_customer_email' }
  if (email) {
    try { emailResult = await sendStatusEmail(email, name, orderId, status) }
    catch (error) {
      console.error(error)
      emailResult = { sent: false, reason: 'provider_error' }
    }
  }

  return json({ orderId, status, label: labels[status], email: emailResult })
})
