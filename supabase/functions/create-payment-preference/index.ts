import { printPrice } from '../_shared/print-pricing.js'
import {designProductArtworks,modelProductSlug} from '../_shared/catalog-product-artworks.js'
import {bodyCommerceReady,normalizeVariantRows,resolveExactVariant} from '../_shared/variant-selection.js'
import {catalogDesignForVariantSelection,catalogDesignRequiresCustomerImage} from '../_shared/catalog-personalization.js'
import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { sendAdminOrderNotice, sendOrderEmail } from '../_shared/order-email.ts'
import { headPrivateDesign } from '../_shared/private-design-r2.ts'
import { normalizePrintConfiguration, printConfigurationCount } from '../_shared/print-configuration.js'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
const models = new Set(['basic', 'woman', 'over', 'kids', 'kid', 'tote', 'body'])
const allowedSizeForModel = (_model: string, size: unknown) => typeof size === 'string' && size.trim().length > 0 && size.trim().length <= 40
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
  if (request.method !== 'POST' && request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405)
  const auth = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL'), secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), token = auth?.replace(/^Bearer\s+/, '')
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN'), siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || '').replace(/\/$/, '')
  if (!auth || !token || !url || !secret) return json({ error: 'La integración de pago no está configurada.' }, 500)
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)
  const bankTransfer = transferInstructions()
  const bankTransferAvailable = Boolean(bankTransfer.holder && bankTransfer.bank && bankTransfer.account_number && bankTransfer.rut)
  if (request.method === 'GET') return json({ bankTransferAvailable })
  const body = await request.json().catch(() => null) as any, paymentMethod = body?.paymentMethod === 'transfer' ? 'transfer' : body?.paymentMethod === 'draft' ? 'draft' : 'mercado_pago'
  if (paymentMethod === 'mercado_pago' && (!mpToken || !siteUrl)) return json({ error: 'La integración de Mercado Pago no está configurada.' }, 500)
  const transfer = paymentMethod === 'transfer' ? bankTransfer : null
  if (paymentMethod === 'transfer' && !bankTransferAvailable) return json({ error: 'La transferencia bancaria aún no está configurada. Elige Mercado Pago o inténtalo más tarde.' }, 503)
  const items = Array.isArray(body?.items) ? body.items : [], customer = body?.customer || {}, fulfillment = body?.fulfillment === 'pickup' ? 'pickup' : 'delivery'
  if (!items.length || items.length > 20 || !customer.firstName || !customer.lastName || !String(customer.email).includes('@') || !customer.phone) return json({ error: 'Faltan datos de contacto o productos.' }, 400)
  if (!bodyCommerceReady && items.some((item: any) => item.modelCode === 'body')) return json({ error: 'Los Bodys aún no están disponibles para compra.' }, 409)
  if (fulfillment === 'delivery' && (!body.shippingAddress?.region || !body.shippingAddress?.commune || !body.shippingAddress?.address)) return json({ error: 'Falta la dirección de despacho.' }, 400)
  if (items.some((item: any) => !models.has(item.modelCode) || !allowedSizeForModel(item.modelCode, item.size) || !sides.has(item.printSides) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || !hex.test(item.color || '') || (item.catalogDesignCustomerImage != null && typeof item.catalogDesignCustomerImage !== 'boolean') || (item.catalogDesignSlug && typeof item.catalogDesignSlug !== 'string') || (item.modelCode === 'tote' && (!['M', 'L'].includes(item.size) || item.printSides !== 'front')))) return json({ error: 'Uno de los productos no es válido.' }, 400)
  const printConfigurations = items.map((item: any) => normalizePrintConfiguration(item.printConfiguration, item.printSides))
  if (printConfigurations.some((configuration: any, index: number) => {
    const count = printConfigurationCount(configuration, items[index].printSides)
    const configuredSides = configuration.prints ? [...new Set(configuration.prints.map((print: any) => print.side))].sort().join(',') : items[index].printSides === 'both' ? 'back,front' : items[index].printSides
    const declaredSides = items[index].printSides === 'both' ? 'back,front' : items[index].printSides
    return count < 1 || count > 4 || configuredSides !== declaredSides
  })) return json({ error: 'La composición de estampados no es válida.' }, 400)

  const { data: variants, error: variantError } = await admin.from('product_variants').select('id,sku,size,color_name,color_hex,price_clp,active,product_models!inner(code,name,active)').eq('active', true).eq('product_models.active',true)
  if (variantError) return json({ error: 'No pudimos validar los precios vigentes.' }, 503)
  const normalizedVariants=normalizeVariantRows(variants||[])
  const slugs = [...new Set(items.map((item: any) => item.catalogDesignSlug).filter(Boolean))], designs = new Map<string, any>()
  if (slugs.length) { const { data, error } = await admin.from('catalog_designs').select('id,slug,name,active,accepts_customer_image,customer_photo_subject,allowed_colors,allowed_product_colors,sample_color,product_artworks').in('slug', slugs); if (error) return json({ error: 'No pudimos validar los diseños.' }, 503); for (const design of data || []) if (design.active) designs.set(design.slug, design); if (slugs.some(slug => !designs.has(slug))) return json({ error: 'Uno de los diseños ya no está disponible.' }, 409) }
  if (items.some((item: any) => item.catalogDesignCustomerImage && !designs.get(item.catalogDesignSlug)?.accepts_customer_image)) return json({ error: 'Este diseño no admite una imagen del cliente.' }, 409)
  if (items.some((item: any) => item.catalogDesignSlug && catalogDesignRequiresCustomerImage(designs.get(item.catalogDesignSlug), item.catalogDesignCustomerImage))) return json({ error: 'Este diseño requiere una foto del cliente.' }, 409)
  if (items.some((item: any) => item.catalogDesignSlug && !item.catalogDesignCustomerImage && !designProductArtworks(designs.get(item.catalogDesignSlug))[modelProductSlug(item.modelCode)])) return json({ error: 'El diseño no tiene un archivo para el producto elegido. Vuelve a elegir el producto.' }, 409)
  const selectedVariants=items.map((item: any)=>resolveExactVariant(normalizedVariants,item.modelCode,item.size,item.color,item.catalogDesignSlug?catalogDesignForVariantSelection(designs.get(item.catalogDesignSlug),item.catalogDesignCustomerImage):null))
  const unavailable=selectedVariants.find(result=>result.error)
  if(unavailable)return json({error:unavailable.error==='ambiguous'?'Hay más de una variante activa para esa combinación de modelo, talla y color.':'El color o la talla ya no está disponible para este diseño. Vuelve a elegir.'},409)
  if(items.some((item:any,index:number)=>item.variantId!=null&&Number(item.variantId)!==selectedVariants[index].variant?.id))return json({error:'La variante seleccionada cambió. Vuelve a revisar talla y color.'},409)
  const flowTypes = [...new Set(items.map((item: any) => {
    const design = item.catalogDesignSlug ? designs.get(item.catalogDesignSlug) : null
    if (item.catalogDesignCustomerImage) return design?.customer_photo_subject === 'people' ? 'people_personalization' : 'pet_personalization'
    if (!design) return 'own_artwork'
    if (design.accepts_customer_image && design.customer_photo_subject === 'people') return 'people_base'
    return 'catalog_design'
  }))]
  const flowType = flowTypes.length === 1 ? flowTypes[0] : 'mixed'
  const personalizedFlows = ['own_artwork', 'people_personalization', 'pet_personalization']
  const purchaseType = flowTypes.some(type => personalizedFlows.includes(type)) ? (flowTypes.every(type => personalizedFlows.includes(type)) ? 'personalized' : 'mixed') : 'catalog'
  if (paymentMethod !== 'draft') for (const [itemIndex, item] of items.entries()) {
    if (item.catalogDesignSlug && !item.catalogDesignCustomerImage) continue
    const configuredPrints = printConfigurations[itemIndex].prints
    const files = configuredPrints?.length ? configuredPrints.map((print: any) => ({ side: print.side, path: print.designPath })) : (item.printSides === 'both' ? ['front', 'back'] : [item.printSides]).map(side => ({ side, path: side === 'front' ? item.frontDesignPath : item.backDesignPath }))
    for (const file of files) {
      const side = file.side, path = String(file.path || '')
      if (!new RegExp(`^${userData.user.id}/${side}/[0-9a-f-]{36}\\.(png|jpg|webp)$`, 'i').test(path)) return json({ error: 'El diseño no pertenece a esta compra.' }, 400)
      const fileInfo = await headPrivateDesign(path)
      if (!fileInfo || !fileInfo.size || fileInfo.size > 3 * 1024 * 1024) return json({ error: 'No pudimos encontrar el diseño optimizado.' }, 409)
    }
  }
  const { data: storeSettings, error: settingsError } = await admin.from('storefront_settings').select('quality_review_fee_clp,front_large_clp,front_pocket_clp,back_large_clp,arm_clp').eq('id', true).single()
  if (settingsError) return json({ error: 'No pudimos validar el valor de revisión técnica.' }, 503)
  const qualityReviewFee = Number.isSafeInteger(storeSettings?.quality_review_fee_clp) && storeSettings.quality_review_fee_clp >= 0 && storeSettings.quality_review_fee_clp <= 1000000 ? storeSettings.quality_review_fee_clp : 4990
  let subtotal = 0
  const prepared = items.map((item: any,index:number) => { const modelCode = item.modelCode === 'kids' ? 'kid' : item.modelCode; const variant=selectedVariants[index].variant!; const model=Array.isArray(variants?.find((row:any)=>row.id===variant.id)?.product_models)?variants?.find((row:any)=>row.id===variant.id)?.product_models[0]:variants?.find((row:any)=>row.id===variant.id)?.product_models; const design = item.catalogDesignSlug ? designs.get(item.catalogDesignSlug) : null; const qualityReview = Boolean(item.qualityReview) && !(design && !item.catalogDesignCustomerImage); const unit = variant.priceClp + (modelCode === 'tote' ? 0 : printPrice(printConfigurations[index], item.printSides, storeSettings)) + (qualityReview ? qualityReviewFee : 0); const line = unit * item.quantity; subtotal += line; const label = modelCode === 'tote' ? 'Tote bag' : modelCode==='body'?'Body bebé':`Polera ${model?.name||modelCode}`; return { product_variant_id: variant.id, catalog_design_id: design?.id || null, catalog_artwork_path: design && !item.catalogDesignCustomerImage ? designProductArtworks(design)[modelProductSlug(item.modelCode)] : null, name_snapshot: design?.name ? `${label} · ${design.name}` : `${label} ${modelCode==='body'?'personalizado':'personalizada'}`, sku_snapshot: variant.sku, color_hex: variant.color.toUpperCase(), quality_review: qualityReview, print_sides: item.printSides, print_configuration: normalizePrintConfiguration(item.printConfiguration,item.printSides), front_design_path: design && !item.catalogDesignCustomerImage ? null : item.frontDesignPath || null, back_design_path: design && !item.catalogDesignCustomerImage ? null : item.backDesignPath || null, quantity: item.quantity, unit_price_clp: unit, line_total_clp: line } })
  const quantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0), shipping = shippingFor(fulfillment, body.shippingAddress?.region || '', quantity)
  if (body.shippingQuoteClp != null && Number(body.shippingQuoteClp) !== shipping) return json({ error: 'El valor del despacho cambió. Vuelve a calcularlo.' }, 409)
  const couponCode = String(body.couponCode || '').trim().toUpperCase(); let coupon: any = null; let discount = 0
  if (couponCode) { const { data } = await admin.from('coupons').select('*').eq('code', couponCode).eq('active', true).maybeSingle(); const now = Date.now(); if (!data || (data.starts_at && new Date(data.starts_at).getTime() > now) || (data.ends_at && new Date(data.ends_at).getTime() < now) || (data.max_uses !== null && data.used_count >= data.max_uses) || subtotal < data.min_subtotal_clp) return json({ error: 'El cupón ya no es válido para esta compra.' }, 409); coupon = data; discount = data.kind === 'percent' ? Math.floor(subtotal * data.value / 100) : data.value; if (data.max_discount_clp !== null) discount = Math.min(discount, data.max_discount_clp); discount = Math.min(subtotal, discount) }
  const total = subtotal + shipping - discount, now = new Date().toISOString(), address = { fulfillment, customer: { first_name: String(customer.firstName).trim(), last_name: String(customer.lastName).trim(), email: String(customer.email).trim(), phone: String(customer.phone).trim() }, ...(fulfillment === 'delivery' ? { region: String(body.shippingAddress.region).trim(), commune: String(body.shippingAddress.commune).trim(), address: String(body.shippingAddress.address).trim(), address_extra: String(body.shippingAddress.addressExtra || '').trim(), delivery_notes: String(body.shippingAddress.notes || '').trim() } : {}) }
  const draftOrderId = Number.isSafeInteger(Number(body?.draftOrderId)) ? Number(body.draftOrderId) : null
  let order: any = null
  const priceSnapshot = { provider: paymentMethod === 'transfer' ? 'bank_transfer' : paymentMethod === 'draft' ? 'checkout_draft' : 'mercado_pago', purchase_type: purchaseType, flow_type: flowType, flow_types: flowTypes, quality_review_fee_clp: qualityReviewFee, shipping_calculated: true, shipping_quote_clp: shipping, coupon_code: coupon?.code || null }
  const orderEmailDetails = { items: prepared, subtotal_clp: subtotal, shipping_clp: shipping, discount_clp: discount, coupon_code: coupon?.code || undefined, total_clp: total, shipping_address: address, price_snapshot: priceSnapshot }
  if (draftOrderId) {
    const { data: existing, error: existingError } = await admin.from('orders').select('id,total_clp,status,price_snapshot').eq('id', draftOrderId).eq('user_id', userData.user.id).in('status', ['draft', 'submitted']).maybeSingle()
    if (existingError || !existing) return json({ error: 'El borrador de compra ya no está disponible.' }, 409)
    if (paymentMethod === 'mercado_pago' && existing.status === 'submitted') {
      const { data: prior } = await admin.from('payments').select('status,amount_clp,provider_preference_id').eq('order_id', existing.id).eq('provider', 'mercado_pago').maybeSingle()
      if (prior?.status === 'approved') return json({ error: 'Este pedido ya tiene un pago aprobado.' }, 409)
      if (prior?.status === 'pending' && prior.amount_clp === total && prior.provider_preference_id === existing.price_snapshot?.mp_preference_id && existing.price_snapshot?.mp_checkout_url) return json({ orderId: existing.id, totalClp: total, preferenceId: prior.provider_preference_id, initPoint: existing.price_snapshot.mp_checkout_url }, 200)
    }
    const { data: updated, error: updateError } = await admin.from('orders').update({ status: paymentMethod === 'draft' ? 'draft' : 'submitted', coupon_code: coupon?.code || null, subtotal_clp: subtotal, shipping_clp: shipping, discount_clp: discount, total_clp: total, price_snapshot: priceSnapshot, shipping_address: address, payment_instructions: transfer ? { transfer } : null, submitted_at: paymentMethod === 'draft' ? null : now, updated_at: now }).eq('id', draftOrderId).select('id,total_clp').single()
    if (updateError || !updated) return json({ error: 'No pudimos actualizar el pedido.' }, 503)
    order = updated
    await admin.from('order_items').delete().eq('order_id', order.id)
  } else {
    const { data: created, error: orderError } = await admin.from('orders').insert({ user_id: userData.user.id, status: paymentMethod === 'draft' ? 'draft' : 'submitted', source: 'online', coupon_code: coupon?.code || null, subtotal_clp: subtotal, shipping_clp: shipping, discount_clp: discount, total_clp: total, price_snapshot: priceSnapshot, shipping_address: address, payment_instructions: transfer ? { transfer } : null, submitted_at: paymentMethod === 'draft' ? null : now }).select('id,total_clp').single()
    if (orderError || !created) return json({ error: 'No pudimos crear el pedido.' }, 503)
    order = created
  }
  try {
    const { error: itemError } = await admin.from('order_items').insert(prepared.map(item => ({ ...item, order_id: order.id }))); if (itemError) throw itemError
    if (paymentMethod === 'draft') return json({ orderId: order.id, totalClp: total, paymentMethod }, 201)
    if (paymentMethod === 'transfer') {
      const { error: paymentError } = await admin.from('payments').insert({ order_id: order.id, provider: 'transferencia_bancaria', kind: 'full', status: 'pending', amount_clp: total }); if (paymentError) throw paymentError
      await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Pedido creado; esperando confirmación de transferencia bancaria.' })
      try { await sendAdminOrderNotice(String(order.id), 'Pedido por transferencia', address.customer.email, orderEmailDetails) } catch (error) { console.error('Admin notice failed', error) }
      let email: { sent: boolean; reason?: string; id?: string } = { sent: false, reason: 'email_not_configured' }
      try {
        email = await sendOrderEmail(address.customer.email, address.customer.first_name, String(order.id), 'submitted', fulfillment === 'pickup', { ...orderEmailDetails, price_snapshot: { provider: 'bank_transfer', purchase_type: purchaseType, flow_type: flowType, flow_types: flowTypes }, payment_instructions: { transfer } })
        if (email.sent) await admin.from('orders').update({ payment_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id)
      } catch (emailError) { console.error('No pudimos enviar los datos de transferencia', emailError); email = { sent: false, reason: 'provider_error' } }
      return json({ orderId: order.id, totalClp: total, paymentMethod, paymentInstructions: { transfer }, email }, 201)
    }
    const externalReference = `DROSKA-${order.id}`
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: externalReference, title: `Pedido Droska #${order.id}`, description: `${quantity} producto${quantity === 1 ? '' : 's'} personalizados`, currency_id: 'CLP', quantity: 1, unit_price: total }], payer: { name: address.customer.first_name, surname: address.customer.last_name, email: address.customer.email }, external_reference: externalReference, notification_url: `${url}/functions/v1/mercado-pago-webhook`, back_urls: { success: `${siteUrl}/?mp_status=success&order_id=${order.id}`, failure: `${siteUrl}/?mp_status=failure&order_id=${order.id}`, pending: `${siteUrl}/?mp_status=pending&order_id=${order.id}` }, auto_return: 'approved' }) })
    const preference = await mpResponse.json(); if (!mpResponse.ok || !preference.id || !preference.init_point) throw new Error(preference.message || 'Mercado Pago rechazó la preferencia')
    const payment = { order_id: order.id, provider: 'mercado_pago', provider_reference: externalReference, provider_preference_id: preference.id, kind: 'full', status: 'pending', amount_clp: total, provider_payment_id: null, confirmed_at: null }
    const { data: priorPayment } = await admin.from('payments').select('id,status').eq('provider_reference', externalReference).maybeSingle()
    if (priorPayment?.status === 'approved') throw new Error('El pedido ya tiene un pago aprobado')
    const paymentResult = priorPayment ? await admin.from('payments').update(payment).eq('id', priorPayment.id).neq('status', 'approved') : await admin.from('payments').insert(payment)
    if (paymentResult.error) throw paymentResult.error
    const { error: snapshotError } = await admin.from('orders').update({ price_snapshot: { ...priceSnapshot, mp_preference_id: preference.id, mp_checkout_url: preference.init_point }, updated_at: new Date().toISOString() }).eq('id', order.id)
    if (snapshotError) throw snapshotError
    await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Pedido creado; esperando confirmación de Mercado Pago.' })
    try { await sendAdminOrderNotice(String(order.id), 'Nuevo pedido en Mercado Pago', address.customer.email, orderEmailDetails) } catch (error) { console.error('Admin notice failed', error) }
    return json({ orderId: order.id, totalClp: total, preferenceId: preference.id, initPoint: preference.init_point }, 201)
  } catch (error) {
    const failedAt = new Date().toISOString()
    if (order?.id) {
      await admin.from('orders').update({ status: 'draft', price_snapshot: { ...priceSnapshot, checkout_error: 'payment_initialization_failed', checkout_error_at: failedAt }, updated_at: failedAt }).eq('id', order.id)
      await admin.from('order_status_history').insert({ order_id: order.id, status: 'draft', note: 'No se pudo iniciar el pago. Conservamos contacto, selección y archivos para reintento o seguimiento de Administración.' })
      try { await sendAdminOrderNotice(String(order.id), 'Intento de pago no completado', address.customer.email, orderEmailDetails) } catch (noticeError) { console.error('Admin notice failed', noticeError) }
    }
    console.error(error)
    return json({ error: 'No pudimos iniciar el pago con Mercado Pago. Tu pedido quedó guardado para reintentar.', orderId: order?.id || null }, 503)
  }
})
