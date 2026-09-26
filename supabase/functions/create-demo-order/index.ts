import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const allowedModels = new Set(['basic', 'over', 'kid'])
const allowedSizes = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
const allowedSides = new Set(['front', 'back', 'both'])
const hexColor = /^#[0-9a-f]{6}$/i
const normalizedPlace = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const shippingFor = (fulfillment: 'delivery' | 'pickup', region: string, quantity: number) => {
  if (fulfillment === 'pickup') return 0
  const place = normalizedPlace(region)
  let base = 7990
  if (place.includes('metropolitana')) base = 3990
  else if (place.includes('valparaiso') || place.includes("o'higgins")) base = 4990
  else if (['coquimbo', 'maule', 'nuble', 'biobio'].some(name => place.includes(name))) base = 5990
  else if (['araucania', 'rios', 'lagos'].some(name => place.includes(name))) base = 6990
  return base + Math.max(0, quantity - 1) * 1000
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes identificarte para crear el pedido.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La función no está configurada.' }, 500)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)

  let body: any
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const requestId = String(body?.requestId || '').trim()
  const items = Array.isArray(body?.items) ? body.items : []
  const customer = body?.customer || {}
  const fulfillment = body?.fulfillment === 'pickup' ? 'pickup' : 'delivery'
  if (!requestId || requestId.length > 120 || !items.length || items.length > 20) return json({ error: 'El pedido no contiene productos válidos.' }, 400)
  if (!String(customer.firstName || '').trim() || !String(customer.lastName || '').trim() || !String(customer.email || '').includes('@') || !String(customer.phone || '').trim()) return json({ error: 'Faltan datos de contacto.' }, 400)
  if (fulfillment === 'delivery') {
    const address = body?.shippingAddress || {}
    if (!address.region || !address.commune || !address.address) return json({ error: 'Falta la dirección de despacho.' }, 400)
  }

  for (const item of items) {
    if (!allowedModels.has(item.modelCode) || !allowedSizes.has(item.size) || !allowedSides.has(item.printSides) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || !hexColor.test(item.color || '')) return json({ error: 'Uno de los productos no es válido.' }, 400)
    if (item.catalogDesignSlug && item.printSides === 'both') return json({ error: 'Los diseños de colección solo permiten frente o espalda.' }, 400)
  }

  const { data: previousPayment } = await admin.from('payments').select('order_id,amount_clp').eq('provider_reference', requestId).maybeSingle()
  if (previousPayment) return json({ orderId: previousPayment.order_id, totalClp: previousPayment.amount_clp, reference: requestId })

  const { data: variants, error: variantError } = await admin.from('product_variants').select('id,sku,size,price_clp,product_models!inner(code,name)').eq('active', true)
  if (variantError) return json({ error: 'No pudimos validar los precios vigentes.' }, 503)
  const variantMap = new Map((variants || []).map((variant: any) => {
    const model = Array.isArray(variant.product_models) ? variant.product_models[0] : variant.product_models
    return [`${model?.code}:${variant.size}`, { ...variant, model }]
  }))

  const designSlugs = [...new Set(items.map((item: any) => item.catalogDesignSlug).filter(Boolean))]
  const designMap = new Map<string, any>()
  if (designSlugs.length) {
    const { data: designs, error: designError } = await admin.from('catalog_designs').select('id,slug,name,active').in('slug', designSlugs)
    if (designError) return json({ error: 'No pudimos validar el diseño de colección.' }, 503)
    for (const design of designs || []) if (design.active) designMap.set(design.slug, design)
    if (designSlugs.some(slug => !designMap.has(slug))) return json({ error: 'Uno de los diseños ya no está disponible.' }, 409)
  }

  const unavailable = items.find((item: any) => !variantMap.has(`${item.modelCode}:${item.size}`))
  if (unavailable) return json({ error: `No existe una variante activa para ${unavailable.modelCode} talla ${unavailable.size}.` }, 409)

  let subtotal = 0
  const preparedItems = items.map((item: any) => {
    const variant: any = variantMap.get(`${item.modelCode}:${item.size}`)
    const printExtra = item.printSides === 'both' ? 3990 : 0
    const qualityExtra = item.qualityReview ? 4990 : 0
    const unitPrice = variant.price_clp + printExtra + qualityExtra
    const lineTotal = unitPrice * item.quantity
    subtotal += lineTotal
    const design = item.catalogDesignSlug ? designMap.get(item.catalogDesignSlug) : null
    return {
      product_variant_id: variant.id,
      catalog_design_id: design?.id || null,
      name_snapshot: design?.name ? `Polera ${variant.model.name} · ${design.name}` : `Polera ${variant.model.name} personalizada`,
      sku_snapshot: variant.sku,
      print_sides: item.printSides,
      quantity: item.quantity,
      unit_price_clp: unitPrice,
      line_total_clp: lineTotal,
    }
  })

  const now = new Date().toISOString()
  const shipping = shippingFor(fulfillment, String(body?.shippingAddress?.region || ''), items.reduce((sum: number, item: any) => sum + item.quantity, 0))
  if (body?.shippingQuoteClp !== undefined && body.shippingQuoteClp !== null && Number(body.shippingQuoteClp) !== shipping) return json({ error: 'El valor del despacho cambió. Vuelve a calcularlo antes de pagar.' }, 409)
  const shippingAddress = {
    fulfillment,
    customer: {
      first_name: String(customer.firstName).trim(),
      last_name: String(customer.lastName).trim(),
      email: String(customer.email).trim(),
      phone: String(customer.phone).trim(),
    },
    ...(fulfillment === 'delivery' ? {
      region: String(body.shippingAddress.region).trim(),
      commune: String(body.shippingAddress.commune).trim(),
      address: String(body.shippingAddress.address).trim(),
      address_extra: String(body.shippingAddress.addressExtra || '').trim(),
      notes: String(body.shippingAddress.notes || '').trim(),
    } : {}),
  }

  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: userData.user.id,
    status: 'paid',
    subtotal_clp: subtotal,
    shipping_clp: shipping,
    discount_clp: 0,
    total_clp: subtotal + shipping,
    price_snapshot: { demo: true, request_id: requestId, provider: 'mercado_pago_simulation', shipping_calculated: true, shipping_quote_clp: shipping },
    shipping_address: shippingAddress,
    submitted_at: now,
  }).select('id,total_clp').single()
  if (orderError || !order) return json({ error: 'No pudimos crear el pedido.' }, 503)

  try {
    const orderItems = preparedItems.map(item => ({ ...item, order_id: order.id }))
    const { error: itemsError } = await admin.from('order_items').insert(orderItems)
    if (itemsError) throw itemsError
    const { error: historyError } = await admin.from('order_status_history').insert([
      { order_id: order.id, status: 'submitted', note: 'Pedido creado desde el checkout.' },
      { order_id: order.id, status: 'paid', note: 'Pago aprobado en la simulación de Mercado Pago.' },
    ])
    if (historyError) throw historyError
    const { error: paymentError } = await admin.from('payments').insert({
      order_id: order.id,
      provider: 'mercado_pago_simulation',
      provider_reference: requestId,
      kind: 'full',
      status: 'approved',
      amount_clp: subtotal + shipping,
      confirmed_at: now,
    })
    if (paymentError) throw paymentError
  } catch (error) {
    await admin.from('orders').delete().eq('id', order.id)
    console.error(error)
    return json({ error: 'No pudimos completar el registro del pedido.' }, 503)
  }

  return json({ orderId: order.id, totalClp: order.total_clp, reference: requestId }, 201)
})
