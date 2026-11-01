import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://droska.frontbook.cl',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const bucket = 'droska-catalog'
const accountId = 'b387a7db8cbfc230f0a9be0a73b83a7c'
const r2Host = `${accountId}.r2.cloudflarestorage.com`
// La conversión sucede en Administración; este límite impide cargar un original
// pesado directo a R2 mediante una llamada manual a la Edge Function.
const maxImageBytes = 900 * 1024
const maxArtworkBytes = 3 * 1024 * 1024
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const imageExtensions: Record<string, RegExp> = {
  'image/jpeg': /\.jpe?g$/i,
  'image/png': /\.png$/i,
  'image/webp': /\.webp$/i,
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('')
const sha256 = async (value: string | ArrayBuffer) => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value))
const hmac = async (key: ArrayBuffer | string, value: string) => {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))
}
const r2Path = (path: string) => `/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
const isCatalogPath = (path: string) => path.length <= 500 && !path.startsWith('/') && !path.includes('..') && /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(?:-[a-z0-9]+)*\.(?:png|jpe?g|webp)$/i.test(path)

async function authorize(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return { error: json({ error: 'Debes iniciar sesión.' }, 401) }
  const url = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !secret || !publishable) return { error: json({ error: 'La función no está configurada.' }, 500) }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const caller = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const token = authorization.slice('Bearer '.length)
  const [{ data: userData, error: userError }, { data: isAdmin, error: adminError }] = await Promise.all([admin.auth.getUser(token), caller.rpc('is_admin')])
  if (userError || !userData.user) return { error: json({ error: 'La sesión no es válida.' }, 401) }
  if (adminError || !isAdmin) return { error: json({ error: 'No tienes permisos de administración.' }, 403) }
  return { url }
}

async function r2Request(method: 'PUT' | 'DELETE', path: string, body?: ArrayBuffer, contentType?: string) {
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!accessKeyId || !secretAccessKey) throw new Error('Faltan las credenciales de Cloudflare R2.')
  const now = new Date(), amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), dateStamp = amzDate.slice(0, 8)
  const payload = body || new ArrayBuffer(0), payloadHash = await sha256(payload), canonicalUri = r2Path(path)
  const signingHeaders: Record<string, string> = { host: r2Host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  if (method === 'PUT' && contentType) {
    signingHeaders['cache-control'] = 'max-age=259200'
    signingHeaders['content-type'] = contentType
  }
  const signedHeaderNames = Object.keys(signingHeaders).sort(), canonicalHeaders = signedHeaderNames.map(name => `${name}:${signingHeaders[name]}\n`).join('')
  const signedHeaders = signedHeaderNames.join(';'), credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`
  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = await hmac(dateKey, 'auto'), serviceKey = await hmac(regionKey, 's3'), signingKey = await hmac(serviceKey, 'aws4_request')
  const signature = hex(await hmac(signingKey, stringToSign))
  const headers: Record<string, string> = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (method === 'PUT' && contentType) {
    headers['Cache-Control'] = signingHeaders['cache-control']
    headers['Content-Type'] = contentType
  }
  const response = await fetch(`https://${r2Host}${canonicalUri}`, { method, headers, body: method === 'PUT' ? payload : undefined })
  if (!response.ok) throw new Error(`Cloudflare R2 rechazó la operación (${response.status}).`)
}

async function syncLegacyObject(sourceUrl: string, path: string) {
  const source = await fetch(`${sourceUrl}/storage/v1/object/public/catalog-designs/${path.split('/').map(encodeURIComponent).join('/')}`)
  if (!source.ok) throw new Error('No encontramos la imagen de Supabase.')
  const contentType = source.headers.get('content-type')?.split(';')[0] || '', image = await source.arrayBuffer()
  if (!imageTypes.has(contentType) || image.byteLength > maxImageBytes) throw new Error('La imagen no cumple los límites del catálogo.')
  await r2Request('PUT', path, image, contentType)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const auth = await authorize(request)
  if (auth.error) return auth.error
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.startsWith('multipart/form-data')) {
      const form = await request.formData(), path = String(form.get('path') || ''), file = form.get('file')
      if (!isCatalogPath(path)) return json({ error: 'La ruta de la imagen no es válida.' }, 400)
      const limit = /\/[^/]+-artwork-[^/]+\.(?:png|jpe?g|webp)$/i.test(path) ? maxArtworkBytes : maxImageBytes
      if (!(file instanceof File) || !imageTypes.has(file.type) || !imageExtensions[file.type]?.test(path) || file.size > limit) return json({ error: `La imagen optimizada debe ser JPG, PNG o WebP, coincidir con la extensión y no superar ${Math.round(limit / 1024 / 1024 * 10) / 10} MB.` }, 400)
      await r2Request('PUT', path, await file.arrayBuffer(), file.type)
      return json({ path, url: `https://images.frontbook.cl/${path}` })
    }
    const body = await request.json().catch(() => ({}))
    if (body.action === 'delete') {
      const paths = Array.isArray(body.paths) ? [...new Set(body.paths.map(String))] : []
      if (!paths.length || paths.length > 20 || paths.some(path => !isCatalogPath(path))) return json({ error: 'Las rutas de eliminación no son válidas.' }, 400)
      for (const path of paths) await r2Request('DELETE', path)
      return json({ deleted: paths.length })
    }
    const path = String(body.path || '')
    if (!isCatalogPath(path)) return json({ error: 'La ruta de la imagen no es válida.' }, 400)
    await syncLegacyObject(auth.url, path)
    return json({ path, url: `https://images.frontbook.cl/${path}` })
  } catch (error) {
    console.error(error)
    return json({ error: 'No pudimos publicar la imagen en Cloudflare.' }, 502)
  }
})
