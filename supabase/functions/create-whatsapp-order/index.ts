import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { designProductArtworks, modelProductSlug } from '../_shared/catalog-product-artworks.js'
import { catalogDesignRequiresCustomerImage } from '../_shared/catalog-personalization.js'
import { allowedColorsForModel } from '../_shared/catalog-product-colors.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})
const validSides = new Set(['front', 'back', 'both'])
const validTypes = new Set(['purchase', 'creative'])

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes identificarte para registrar la solicitud.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La función no está configurada.' }, 500)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)

  let body: any
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const requestId = String(body?.requestId || '').trim()
  const requestType = String(body?.requestType || '').trim()
  const customer = body?.customer || {}
  const fullName = String(customer.name || '').trim()
  const email = String(customer.email || '').trim().toLowerCase()
  const phone = String(customer.phone || '').trim()
  const idea = String(body?.idea || '').trim()
  const details = String(body?.details || '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !validTypes.has(requestType)) return json({ error: 'Solicitud inválida.' }, 400)
  if (!fullName || !email.includes('@') || !phone) return json({ error: 'Faltan datos de contacto.' }, 400)
  if (idea.length > 4000 || details.length > 4000) return json({ error: 'El detalle es demasiado extenso.' }, 400)

  const { data: existing } = await admin.from('orders').select('id').eq('whatsapp_request_id', requestId).maybeSingle()
  if (existing) return json({ orderId: existing.id, duplicate: true })

  const now = new Date().toISOString()
  const shippingAddress = { fulfillment: 'pending', channel: 'whatsapp', customer: { first_name: fullName, email, phone } }
  if (requestType === 'creative') {
    if (idea.length < 10) return json({ error: 'Cuéntanos un poco más sobre tu idea.' }, 400)
    const { data: order, error } = await admin.from('orders').insert({
      user_id: userData.user.id, source: 'whatsapp', request_type: 'creative', whatsapp_request_id: requestId,
      request_details: [idea, details].filter(Boolean).join('\n\n'), request_references: [], status: 'submitted',
      subtotal_clp: 0, shipping_clp: 0, discount_clp: 0, total_clp: 0, shipping_address: shippingAddress,
      price_snapshot: { channel: 'whatsapp', quote_pending: true, purchase_type: 'personalized', flow_type: 'idea', attachment_pending: true }, submitted_at: now,
    }).select('id').single()
    if (error || !order) return json({ error: 'No pudimos registrar la solicitud.' }, 503)
    const { error: itemError } = await admin.from('order_items').insert({ order_id: order.id, name_snapshot: 'Diseño personalizado por cotizar · WhatsApp', sku_snapshot: 'WHATSAPP-CREATIVE', print_sides: 'front', quantity: 1, unit_price_clp: 0, line_total_clp: 0 })
    if (itemError) { await admin.from('orders').delete().eq('id', order.id); return json({ error: 'No pudimos guardar el detalle de la solicitud.' }, 503) }
    await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Solicitud creada antes de abrir WhatsApp; el cliente adjuntará las referencias en el chat.' })
    return json({ orderId: order.id }, 201)
  }

  const product = body?.product || {}
  const variantId = Number(product.variantId)
  const modelCode = String(product.modelCode || '').trim()
  const size = String(product.size || '').trim()
  const color = String(product.color || '').trim().toLowerCase()
  const printSides = String(product.printSides || '').trim()
  const catalogDesignSlug = String(product.catalogDesignSlug || '').trim()
  const customerImage = Boolean(product.catalogDesignCustomerImage)
  if (!Number.isInteger(variantId) || !modelCode || !size || !/^#[0-9a-f]{6}$/i.test(color) || !validSides.has(printSides)) return json({ error: 'La selección del producto no es válida.' }, 400)
  const { data: variant, error: variantError } = await admin.from('product_variants').select('id,sku,size,color_name,color_hex,price_clp,active,product_models!inner(code,name,active)').eq('id', variantId).maybeSingle()
  const model = Array.isArray(variant?.product_models) ? variant.product_models[0] : variant?.product_models
  if (variantError || !variant?.active || !model?.active || model.code !== modelCode || variant.size !== size || variant.color_hex?.toLowerCase() !== color || (model.code === 'tote' && printSides !== 'front')) return json({ error: 'La talla, color o producto ya no están disponibles.' }, 409)

  let design: any = null
  if (catalogDesignSlug) {
    const { data, error } = await admin.from('catalog_designs').select('id,slug,name,active,accepts_customer_image,customer_photo_subject,product_artworks,allowed_colors,allowed_product_colors').eq('slug', catalogDesignSlug).maybeSingle()
    if (error || !data?.active) return json({ error: 'El diseño elegido ya no está disponible.' }, 409)
    if (customerImage && !data.accepts_customer_image) return json({ error: 'Este diseño no acepta una imagen del cliente.' }, 409)
    if (catalogDesignRequiresCustomerImage(data, customerImage)) return json({ error: 'Este diseño requiere una foto del cliente.' }, 409)
    if (!designProductArtworks(data)[modelProductSlug(model.code)]) return json({ error: 'El diseño no está disponible para este producto.' }, 409)
    const productColors = allowedColorsForModel(data, model.code)
    if ((productColors && !productColors.includes(color)) || (!productColors && !customerImage && Array.isArray(data.allowed_colors) && !data.allowed_colors.some((value: string) => value.toLowerCase() === color))) return json({ error: 'Ese color no está disponible para el diseño elegido.' }, 409)
    design = data
  }
  const purchaseType = customerImage || !design ? 'personalized' : 'catalog'
  const flowType = customerImage
    ? design?.customer_photo_subject === 'people' ? 'people_personalization' : 'pet_personalization'
    : design?.accepts_customer_image && design?.customer_photo_subject === 'people' ? 'people_base'
    : design ? 'catalog_design' : 'own_artwork'
  const printExtra = printSides === 'both' ? 3990 : 0
  const total = Number(variant.price_clp) + printExtra
  const productLabel = model.code === 'tote' ? 'Tote bag' : model.code === 'body' ? 'Body bebé' : `Polera ${model.name}`
  const name = design?.name ? `${productLabel} · ${design.name}` : `${productLabel} personalizada`
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: userData.user.id, source: 'whatsapp', request_type: 'purchase', whatsapp_request_id: requestId,
    request_details: details || 'El cliente continuará la conversación y adjuntará los archivos por WhatsApp.', request_references: [], status: 'submitted',
    subtotal_clp: total, shipping_clp: 0, discount_clp: 0, total_clp: total, shipping_address: shippingAddress,
    price_snapshot: { channel: 'whatsapp', purchase_type: purchaseType, flow_type: flowType, attachment_pending: customerImage || purchaseType === 'personalized' }, submitted_at: now,
  }).select('id').single()
  if (orderError || !order) return json({ error: 'No pudimos registrar el pedido.' }, 503)
  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id, product_variant_id: variant.id, catalog_design_id: design?.id || null,
    catalog_artwork_path: design && !customerImage ? designProductArtworks(design)[modelProductSlug(model.code)] : null,
    name_snapshot: name, sku_snapshot: variant.sku, color_hex: variant.color_hex, print_sides: printSides,
    quantity: 1, unit_price_clp: total, line_total_clp: total,
  })
  if (itemError) { await admin.from('orders').delete().eq('id', order.id); return json({ error: 'No pudimos guardar el detalle del pedido.' }, 503) }
  await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: 'Pedido creado antes de abrir WhatsApp; el cliente continuará el envío de archivos en el chat.' })
  return json({ orderId: order.id }, 201)
})
