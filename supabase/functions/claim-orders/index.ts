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
  if (userError || !user || user.is_anonymous || !user.email) return json({ error: 'La sesión no es válida.' }, 401)

  const email = user.email.trim().toLowerCase()
  const { data: candidates, error: readError } = await admin
    .from('orders')
    .select('id,user_id,shipping_address')
    .limit(100)
  if (readError) return json({ error: 'No pudimos buscar tus pedidos.' }, 500)

  const orderIds = (candidates || [])
    .filter(order => String(order.shipping_address?.customer?.email || '').trim().toLowerCase() === email)
    .map(order => order.id)
  if (!orderIds.length) return json({ claimed: 0 })

  const { error: updateError } = await admin.from('orders').update({ user_id: user.id, updated_at: new Date().toISOString() }).in('id', orderIds)
  if (updateError) return json({ error: 'No pudimos asociar tus pedidos a la cuenta.' }, 500)
  return json({ claimed: orderIds.length })
})
