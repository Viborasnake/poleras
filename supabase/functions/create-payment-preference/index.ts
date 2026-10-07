import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { sendOrderEmail } from '../_shared/order-email.ts'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
const models = new Set(['basic', 'over', 'kids', 'kid'])
const sizes = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
const sides = new Set(['front', 'back', 'both'])
const hex = /^#[0-9a-f]{6}$/i
const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const transferInstructions = () => ({
  holder: String(Deno.env.get('BANK_TRANSFER_HOLDER') || '').trim(),
  bank: String(Deno.env.get('BANK_TRANSFER_BANK') || '').trim(),
  account_type: String(Deno.env.get('BANK_TRANSFER_ACCOUNT_TYPE') || '').trim(),
  account_number: String(Deno.env.get('BANK_TRANSFER_ACCOUNT_NUMBER') || '').trim(),
  rut: String(Deno.env.get('BANK_TRANSFER_RUT') || '').trim(),
  email: String(Deno.env.get('BANK_TRANSFER_EMAIL') || '').trim(),
})
const shippingFor = (fulfillment: string, region: string, quantity: number) => {
  if (fulfillment === 'pickup') return 0
  const place = normalize(region)
  const base = place.includes('metropolitana') ? 3990 : place.includes('valparaiso') || place.includes("o'higgins") ? 4990 : ['coquimbo', 'maule', 'nuble', 'biobio'].some(name => place.includes(name)) ? 5990 : ['araucania', 'rios', 'lagos'].some(name => place.includes(name)) ? 6990 : 7990
  return base + Math.max(0, quantity - 1) * 1000
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const auth = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL'), secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), token = auth?.replace(/^Bearer\s+/, '')
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN'), siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || '').replace(/\/$/, '')
  if (!auth || !token || !url || !secret) return json({ error: 'La integración de pago no está configurada.' }, 500)
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)
  const body = await request.json().catch(() => null) as any, paymentMethod = body?.paymentMethod === 'transfer' ? 'transfer' : body?.paymentMethod === 'draft' ? 'draft' : 'mercado_pago'
  if (paymentMethod === 'mercado_pago' && (!mpToken || !siteUrl)) return json({ error: 'La integración de Mercado Pago no está configurada.' }, 500)
  const transfer = paymentMethod === 'transfer' ? transferInstructions() : null
  if (paymentMethod === 'transfer' && (!transfer?.holder || !transfer.bank || !transfer.account_number || !transfer.rut)) return json({ error: 'La transferencia bancaria aún no está configurada. Elige Mercado Pago o inténtalo más tarde.' }, 503)
  const items = Array.isArray(body?.items) ? body.items : [], customer = body?.customer || {}, fulfillment = body?.fulfillment === 'pickup' ? 'pickup' : 'delivery'
  if (!items.length || items.length > 20 || !customer.firstName || !customer.lastName || !String(customer.email).includes('@') || !customer.phone) return json({ error: 'Faltan datos de contacto o productos.' }, 400)
  if (fulfillment === 'delivery' && (!body.shippingAddress?.region || !body.shippingAddress?.commune || !body.shippingAddress?.address)) return json({ error: 'Falta la dirección de despacho.' }, 400)
  if (items.some((item: any) => !models.has(item.modelCode) || !sizes.has(item.size) || !sides.has(item.printSides) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || !hex.test(item.color || '') || (item.catalogDesignSlug && (typeof item.catalogDesignSlug !== 'string' || item.printSides === 'both')))) return json({ error: 'Uno de los productos no es válido.' }, 400)

  const { data: variants, error: variantError } = await admin.from('product_variants').select('id,sku,size,price_clp,product_models!inner(code,name)').eq('active', true)
  if (variantError) return json({ error: 'No pudimos validar los precios vigentes.' }, 503)
  const variantMap = new Map((variants || []).map((variant: any) => { const model = Array.isArray(variant.product_models) ? variant.product_models[0] : variant.product_models; return [`${model?.code}:${variant.size}`, { ...variant, model }] }))
  const slugs = [...new Set(items.map((item: any) => item.catalogDesignSlug).filter(Boolean))], designs = new Map<string, any>()
  if (slugs.length) { const { data, error } = await admin.from('catalog_designs').select('id,slug,name,active').in('slug', slugs); if (error) return json({ error: 'No pudimos validar los diseños.' }, 503); for (const design of data || []) if (design.active) designs.set(design.slug, design); if (slugs.some(slug => !designs.has(slug))) return json({ error: 'Uno de los diseños ya no está disponible.' }, 409) }
  const unavailable = items.find((item: any) => !variantMap.has(`${item.modelCode === 'kids' ? 'kid' : item.modelCode}:${item.size}`))
  if (unavailable) return json({ error: `No existe una variante activa para ${unavailable.modelCode} talla ${unavailable.size}.` }, 409)
  const artworkBucket = admin.storage.from('customer-designs')
  if (paymentMethod !== 'draft') for (const item of items) {
    if (item.catalogDesignSlug) continue
    for (const side of item.printSides === 'both' ? ['front', 'back'] : [item.printSides]) {
      const path = String(side === 'front' ? item.frontDesignPath || '' : item.backDesignPath || '')
      if (!new RegExp(`^${userData.user.id}/${side}/[0-9a-f-]{36}\\.(png|jpg|webp)$`, 'i').test(path)) return json({ error: 'El diseño no pertenece a esta compra.' }, 400)
      const { data: fileInfo, error: fileError } = await artworkBucket.info(path)
      if (fileError || !fileInfo || !fileInfo.size || fileInfo.size > 50 * 1024 * 1024) return json({ error: 'No pudimos encontrar el archivo original del diseño.' }, 409)
    }
  }
  let subtotal = 0
  const prepared = items.map((item: any) => { const modelCode = item.modelCode === 'kids' ? 'kid' : item.modelCode; const variant: any = variantMap.get(`${modelCode}:${item.size}`); if (!variant) throw new Error('variant'); const unit = variant.price_clp + (item.printSides === 'both' ? 3990 : 0) + (item.qualityReview ? 4990 : 0); const line = unit * item.quantity; subtotal += line; const design = item.catalogDesignSlug ? designs.get(item.catalogDesignSlug) : null; return { product_variant_id: variant.id, catalog_design_id: design?.id || null, name_snapshot: design?.name ? `Polera ${variant.model.name} · ${design.name}` : `Polera ${variant.model.name} personalizada`, sku_snapshot: variant.sku, color_hex: item.color.toUpperCase(), quality_review: Boolean(item.qualityReview), print_sides: item.printSides, front_design_path: design ? null : item.frontDesignPath || null, back_design_path: design ? null : item.backDesignPath || null, quantity: item.quantity, unit_price_clp: unit, line_total_clp: line } })
  const quantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0), shipping = shippingFor(fulfillment, body.shippingAddress?.region || '', quantity)
  if (body.shippingQuoteClp != null && Number(body.shippingQuoteClp) !== shipping) return json({ error: 'El valor del despacho cambió. Vuelve a calcularlo.' }, 409)
  const couponCode = String(body.couponCode || '').trim().toUpperCase(); let coupon: any = null; let discount = 0
  if (couponCode) { const { data } = await admin.from('coupons').select('*').eq('code', couponCode).eq('active', true).maybeSingle(); const now = Date.now(); if (!data || (data.starts_at && new Date(data.starts_at).getTime() > now) || (data.ends_at && new Date(data.ends_at).getTime() < now) || (data.max_uses !== null && data.used_count >= data.max_uses) || subtotal < data.min_subtotal_clp) return json({ error: 'El cupón ya no es válido para esta compra.' }, 409); coupon = data; discount = data.kind === 'percent' ? Math.floor(subtotal * data.value / 100) : data.value; if (data.max_discount_clp !== null) discount = Math.min(discount, data.max_discount_clp); discount = Math.min(subtotal, discount) }
  const total = subtotal + shipping - discount, now = new Date().toISOString(), address = { fulfillment, customer: { first_name: String(customer.firstName).trim(), last_name: String(customer.lastName).trim(), email: String(customer.email).trim(), phone: String(customer.phone).trim() }, ...(fulfillment === 'delivery' ? { region: String(body.shippingAddress.region).trim(), commune: String(body.shippingAddress.commune).trim(), address: String(body.shippingAddress.address).trim(), address_extra: String(body.shippingAddress.addressExtra || '').trim(), notes: String(body.shippingAddress.notes || '').trim() } : {}) }
  const draftOrderId = Number.isSafeInteger(Number(body?.draftOrderId)) ? Number(body.draftOrderId) : null
  let order: any = null
  if (draftOrderId) {
    const { data: existing, error: existingError } = await admin.from('orders').select('id,total_clp,status').eq('id', draftOrderId).eq('user_id', userData.user.id).eq('status', 'draft').maybeSingle()
    if (existingError || !existing) return json({ error: 'El borrador de compra ya no está disponible.' }, 409)
    const { data: updated, error: updateError } = await admin.from('orders').update({ status: paymentMethod === 'draft' ? 'draft' : 'submitted', coupon_code: coupon?.code || null, subtotal_clp: subtotal, shipping_clp: shipping, discount_clp: discount, total_clp: total, price_snapshot: { provider: paymentMethod === 'transfer' ? 'bank_transfer' : paymentMethod === 'draft' ? 'checkout_draft' : 'mercado_pago', shipping_calculated: true, shipping_quote_clp: shipping, coupon_code: coupon?.code || null }, shipping_address: address, payment_instructions: transfer ? { transfer } : null, submitted_at: paymentMethod === 'draft' ? null : now, updated_at: now }).eq('id', draftOrderId).select('id,total_clp').single()
    if (updateError || !updated) return json({ error: 'No pudimos actualizar el pedido.' }, 503)
    order = updated
    await admin.from('order_items').delete().eq('order_id', order.id)
  } else {
    const { data: created, error: orderError } = await admin.from('orders').insert({ user_id: userData.user.id, status: paymentMethod === 'draft' ? 'draft' : 'submitted', source: 'online', coupon_code: coupon?.code || null, subtotal_clp: subtotal, shipping_clp: shipping, discount_clp: discount, total_clp: total, price_snapshot: { provider: paymentMethod === 'transfer' ? 'bank_transfer' : paymentMethod === 'draft' ? 'checkout_draft' : 'mercado_pago', shipping_calculated: true, shipping_quote_clp: shipping, coupon_code: coupon?.code || null }, shipping_address: address, payment_instructions: transfer ? { transfer } : null, submitted_at: paymentMethod === 'draft' ? null : now }).select('id,total_clp').single()
    if (orderError || !created) return json({ error: 'No pudimos crear el pedido.' }, 503)
    order = created
  }
  try {
    const { error: itemError } = await admin.from('order_items').insert(prepared.map(item => ({ ...item, order_id: order.id }))); if (itemError) throw itemError
    if (paymentMethod === 'draft') return json({ orderId: order.id, totalClp: total, paymentMethod }, 201)
    if (paymentMethod === 'transfer') {
      const { error: paymentError } = await admin.from('payments').insert({ order_id: order.id, provider: 'transferencia_bancaria', kind: 'full', status: 'pending', amount_clp: total }); if (paymentError) throw paymentError
      await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Pedido creado; esperando confirmación de transferencia bancaria.' })
      let email: { sent: boolean; reason?: string; id?: string } = { sent: false, reason: 'email_not_configured' }
      try {
        email = await sendOrderEmail(address.customer.email, address.customer.first_name, String(order.id), 'submitted', fulfillment === 'pickup', { items: prepared, subtotal_clp: subtotal, shipping_clp: shipping, total_clp: total, price_snapshot: { provider: 'bank_transfer' }, payment_instructions: { transfer } })
        if (email.sent) await admin.from('orders').update({ payment_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id)
      } catch (emailError) { console.error('No pudimos enviar los datos de transferencia', emailError); email = { sent: false, reason: 'provider_error' } }
      return json({ orderId: order.id, totalClp: total, paymentMethod, paymentInstructions: { transfer }, email }, 201)
    }
    const externalReference = `DROSKA-${order.id}`
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: externalReference, title: `Pedido Droska #${order.id}`, description: `${quantity} producto${quantity === 1 ? '' : 's'} personalizados`, currency_id: 'CLP', quantity: 1, unit_price: total }], payer: { name: address.customer.first_name, surname: address.customer.last_name, email: address.customer.email }, external_reference: externalReference, back_urls: { success: `${siteUrl}/?mp_status=success&order_id=${order.id}`, failure: `${siteUrl}/?mp_status=failure&order_id=${order.id}`, pending: `${siteUrl}/?mp_status=pending&order_id=${order.id}` }, auto_return: 'approved' }) })
    const preference = await mpResponse.json(); if (!mpResponse.ok || !preference.id || !preference.init_point) throw new Error(preference.message || 'Mercado Pago rechazó la preferencia')
    const { error: paymentError } = await admin.from('payments').insert({ order_id: order.id, provider: 'mercado_pago', provider_reference: externalReference, provider_preference_id: preference.id, kind: 'full', status: 'pending', amount_clp: total }); if (paymentError) throw paymentError
    await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Pedido creado; esperando confirmación de Mercado Pago.' })
    return json({ orderId: order.id, totalClp: total, preferenceId: preference.id, initPoint: preference.init_point }, 201)
  } catch (error) { if (draftOrderId) await admin.from('orders').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', order.id); else await admin.from('orders').delete().eq('id', order.id); console.error(error); return json({ error: 'No pudimos iniciar el pago con Mercado Pago.' }, 503) }
})
