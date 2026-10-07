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
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name,phone,region,commune,address,address_extra,delivery_notes')
    .eq('id', user.id)
    .maybeSingle()
  const metadataProfile = user.user_metadata?.customer_profile || {}
  const fullName = String(profile?.full_name || user.user_metadata?.full_name || '').trim()
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const accountCustomer = {
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    email,
    phone: String(profile?.phone || metadataProfile.phone || '').trim(),
  }
  const accountAddress = {
    region: String(profile?.region || metadataProfile.region || '').trim(),
    commune: String(profile?.commune || metadataProfile.commune || '').trim(),
    address: String(profile?.address || metadataProfile.address || '').trim(),
    address_extra: String(profile?.address_extra || metadataProfile.address_extra || '').trim(),
    notes: String(profile?.delivery_notes || metadataProfile.delivery_notes || '').trim(),
  }
  const { data: candidates, error: readError } = await admin
    .from('orders')
    .select('id,user_id,shipping_address')
    .limit(100)
  if (readError) return json({ error: 'No pudimos buscar tus pedidos.' }, 500)

  const matchingCandidates = (candidates || [])
    .filter(order => String(order.shipping_address?.customer?.email || '').trim().toLowerCase() === email)
  const eligibleOrders = []
  for (const order of matchingCandidates) {
    if (!order.user_id || String(order.user_id) === String(user.id)) {
      eligibleOrders.push(order)
      continue
    }
    const { data: ownerData } = await admin.auth.admin.getUserById(order.user_id)
    if (ownerData.user?.is_anonymous) eligibleOrders.push(order)
  }
  const orderIds = eligibleOrders.map(order => order.id)
  if (!orderIds.length) return json({ claimed: 0 })

  for (const order of eligibleOrders) {
    const previous = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : {}
    const previousCustomer = previous.customer && typeof previous.customer === 'object' ? previous.customer : {}
    const mergedAddress: Record<string, any> = {
      ...previous,
      customer: {
        ...previousCustomer,
        first_name: accountCustomer.first_name || previousCustomer.first_name || '',
        last_name: accountCustomer.last_name || previousCustomer.last_name || '',
        email: accountCustomer.email || previousCustomer.email || '',
        phone: accountCustomer.phone || previousCustomer.phone || '',
      },
    }
    for (const [key, value] of Object.entries(accountAddress)) {
      if (value) mergedAddress[key] = value
    }
    const { error: updateError } = await admin
      .from('orders')
      .update({ user_id: user.id, shipping_address: mergedAddress, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    if (updateError) return json({ error: 'No pudimos asociar tus pedidos a la cuenta.' }, 500)
  }
  return json({ claimed: orderIds.length })
})
