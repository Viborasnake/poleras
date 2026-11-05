import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { sendOrderEmail } from '../_shared/order-email.ts'
import { designProductArtworks, modelProductSlug } from '../_shared/catalog-product-artworks.js'
import { headPrivateDesign } from '../_shared/private-design-r2.ts'
import { allowedColorsForModel } from '../_shared/catalog-product-colors.js'
import { verifyTurnstile } from '../_shared/turnstile.ts'

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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Debes identificarte para enviar tu idea.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !secret) return json({ error: 'La función no está configurada.' }, 500)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'La sesión no es válida.' }, 401)

  let body: any
  try { body = await request.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const recovery = body?.recovery === true
  const recoveryReason = String(body?.recoveryReason || '').trim().slice(0, 300)
  const idea = String(body?.idea || '').trim()
  const requestId = String(body?.requestId || '').trim()
  const catalogDesignSlug = String(body?.catalogDesignSlug || '').trim()
  const customer = body?.customer || {}
  const firstName = String(customer.firstName || '').trim()
  const email = String(customer.email || '').trim().toLowerCase()
  const phone = String(customer.phone || '').trim()
  const maxReferences = 5
  const references = Array.isArray(body?.references)
    ? body.references.map((item: any) => ({ name: String(item?.name || '').trim().slice(0, 120), path: String(item?.path || '') })).filter((item: any) => item.name)
    : []
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: 'Identificador de solicitud inválido.' }, 400)
  if (Array.isArray(body?.references) && body.references.length > maxReferences) return json({ error: 'Puedes adjuntar hasta cinco referencias.' }, 400)
  if (idea.length < 10 || idea.length > 4000) return json({ error: 'Cuéntanos un poco más sobre tu idea.' }, 400)
  if (!firstName || !email.includes('@') || !phone) return json({ error: 'Faltan datos de contacto.' }, 400)
  let catalogDesign: any = null
  let selectedProduct: any = null
  let referenceVerificationPending = false
  if (catalogDesignSlug) {
    const { data, error } = await admin.from('catalog_designs').select('id,slug,name,active,accepts_customer_image,customer_photo_subject,product_artworks,allowed_colors,allowed_product_colors').eq('slug', catalogDesignSlug).maybeSingle()
    if (error) return json({ error: 'No pudimos validar el diseño de colección.' }, 503)
    if (!data?.active || !data.accepts_customer_image) return json({ error: 'Este diseño no admite referencias del cliente.' }, 409)
    catalogDesign = data
    const photoLimit = data.customer_photo_subject === 'people' ? 3 : 1
    if (references.length > photoLimit) return json({ error: `Puedes adjuntar hasta ${photoLimit} ${photoLimit === 1 ? 'foto' : 'fotos'} para este diseño.` }, 400)
    if (!references.length) return json({ error: data.customer_photo_subject === 'people' ? 'Sube la foto de la persona para personalizar este diseño.' : 'Sube la foto de tu mascota para personalizar este diseño.' }, 400)
    if (body.productSelection) {
      const { data: variant, error: variantError } = await admin.from('product_variants').select('id,sku,size,color_name,color_hex,active,product_models!inner(code,name,active)').eq('id', body.productSelection.variantId).maybeSingle()
      const model = Array.isArray(variant?.product_models) ? variant.product_models[0] : variant?.product_models
      const side = body.productSelection.side
      const selectedColors=allowedColorsForModel(data,model?.code)
      const invalidSelection = variantError || !variant?.active || !model?.active || !['front','back'].includes(side) || (model?.code === 'tote' && side !== 'front') || !designProductArtworks(data)[modelProductSlug(model?.code)] || (selectedColors&&!selectedColors.includes(String(variant?.color_hex||'').toLowerCase()))
      if (invalidSelection && !recovery) return json({ error: 'La selección ya no está disponible. Revisa producto, talla y color.' }, 409)
      if (!invalidSelection) selectedProduct = { variant_id: variant.id, sku: variant.sku, model: model.name, size: variant.size, color: variant.color_name, color_hex: variant.color_hex, side }
      else selectedProduct = {
        variant_id: variant?.id || null,
        sku: variant?.sku || 'CREATIVE-REVIEW',
        model: String(model?.name || body.productSelection.model || body.productSelection.modelCode || 'Por revisar').slice(0, 100),
        size: String(variant?.size || body.productSelection.size || 'Por revisar').slice(0, 40),
        color: String(variant?.color_name || body.productSelection.color || 'Por revisar').slice(0, 80),
        color_hex: variant?.color_hex || (/^#[0-9a-f]{6}$/i.test(body.productSelection.colorHex) ? body.productSelection.colorHex : null),
        side: ['front','back'].includes(side) ? side : 'front',
        verification_pending: true,
      }
    }
  }
  const { data: previous } = await admin.from('orders').select('id').eq('creative_request_id', requestId).eq('user_id', userData.user.id).maybeSingle()
  if (previous) return json({ orderId: previous.id, status: 'submitted', duplicate: true }, 200)
  if (!Deno.env.get('TURNSTILE_SECRET_KEY')) return json({ error: 'La verificación de seguridad no está configurada.' }, 503)
  if (!await verifyTurnstile(body?.captchaToken)) return json({ error: 'No pudimos verificar tu solicitud. Vuelve a intentarlo.' }, 403)
  for (const reference of references) {
    if (!new RegExp(`^${userData.user.id}/reference/[0-9a-f-]{36}\\.(png|jpg|webp)$`, 'i').test(reference.path)) return json({ error: 'Una referencia no pertenece a tu solicitud.' }, 400)
    let file: { size?: number } | null = null
    try { file = await headPrivateDesign(reference.path) } catch { file = null }
    if (!file?.size || file.size > 3 * 1024 * 1024) {
      if (!recovery) return json({ error: 'No pudimos comprobar una referencia optimizada. Vuelve a subirla.' }, 409)
      referenceVerificationPending = true
    }
  }

  const now = new Date().toISOString()
  const subjectLabel = catalogDesign?.customer_photo_subject === 'people' ? 'persona' : 'mascota'
  const flowType = !catalogDesign ? 'idea' : catalogDesign.customer_photo_subject === 'people' ? 'people_personalization' : 'pet_personalization'
  const recoveryNote = recovery ? `\nRecepción de respaldo: la confirmación automática falló${recoveryReason ? ` (${recoveryReason})` : ''}. El equipo debe contactar al cliente.` : ''
  const shippingAddress = { fulfillment: 'pending', customer: { first_name: firstName, email, phone } }
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: userData.user.id,
    source: 'idea_request',
    request_type: 'creative',
    creative_request_id: requestId,
    request_details: catalogDesign ? `Personalización de colección · ${catalogDesign.name}\n${selectedProduct ? `Producto: ${selectedProduct.model} · Talla/formato: ${selectedProduct.size} · Color: ${selectedProduct.color} · Estampado: ${selectedProduct.side === 'back' ? 'Espalda' : 'Frente'}\n` : ''}Foto de la ${subjectLabel} adjunta como referencia obligatoria.\n${idea}${recoveryNote}` : `${idea}${recoveryNote}`,
    request_references: references,
    status: 'submitted',
    subtotal_clp: 0,
    shipping_clp: 0,
    discount_clp: 0,
    total_clp: 0,
    shipping_address: shippingAddress,
    price_snapshot: { type: 'creative_request', quote_pending: true, purchase_type: 'personalized', flow_type: flowType, catalog_design_slug: catalogDesign?.slug || null, product_selection: selectedProduct, recovered_intake: recovery, recovery_reason: recoveryReason || null, reference_verification_pending: referenceVerificationPending },
    submitted_at: now,
  }).select('id').single()
  if (orderError || !order) {
    if (orderError?.code === '23505') {
      const { data: existing } = await admin.from('orders').select('id').eq('creative_request_id', requestId).eq('user_id', userData.user.id).maybeSingle()
      if (existing) return json({ orderId: existing.id, status: 'submitted', duplicate: true }, 200)
    }
    return json({ error: 'No pudimos registrar tu idea.' }, 503)
  }

  const { error: itemError } = await admin.from('order_items').insert({
    order_id: order.id,
    catalog_design_id: catalogDesign?.id || null,
    product_variant_id: selectedProduct?.variant_id || null,
    name_snapshot: catalogDesign?.name ? `Personalización con ${subjectLabel} · ${catalogDesign.name}` : 'Diseño personalizado por cotizar',
    sku_snapshot: selectedProduct?.sku || 'CREATIVE-QUOTE',
    color_hex: selectedProduct?.color_hex || null,
    print_sides: selectedProduct?.side || 'front',
    quantity: 1,
    unit_price_clp: 0,
    line_total_clp: 0,
  })
  if (itemError) {
    await admin.from('orders').delete().eq('id', order.id)
    return json({ error: 'No pudimos guardar el detalle de tu idea.' }, 503)
  }
  await admin.from('order_status_history').insert({ order_id: order.id, status: 'submitted', note: recovery ? 'Solicitud creativa recibida por respaldo automático; contactar al cliente y revisar la selección.' : 'Solicitud creativa recibida; pendiente de cotización.' })
  let receipt: { sent: boolean; reason?: string } = { sent: false, reason: 'email_not_configured' }
  let adminNotice: { sent: boolean; reason?: string } = { sent: false, reason: 'admin_email_not_configured' }
  try { receipt = await sendOrderEmail(email, firstName, String(order.id), 'submitted', false, { creative: true, request_details: idea }) }
  catch (error) { console.error('Creative receipt email failed', error); receipt = { sent: false, reason: 'provider_error' } }
  const adminEmail = String(Deno.env.get('ADMIN_ORDER_EMAIL') || '').trim()
  if (adminEmail) {
    try { adminNotice = await sendOrderEmail(adminEmail, firstName, String(order.id), 'submitted', false, { creative: true, request_details: idea, adminNotice: true, referenceCount: references.length }) }
    catch (error) { console.error('Creative admin email failed', error); adminNotice = { sent: false, reason: 'provider_error' } }
  }
  return json({ orderId: order.id, status: 'submitted', recovered: recovery, receipt, adminNotice }, recovery ? 202 : 201)
})
