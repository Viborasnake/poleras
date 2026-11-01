import { createClient } from 'npm:@supabase/supabase-js@2.98.0'
import { isPrivateDesignPath, listPrivateDesigns, presignPrivateDesign } from '../_shared/private-design-r2.ts'

const headers = {
  'Access-Control-Allow-Origin': 'https://droska.frontbook.cl',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
// El cliente convierte los originales a WebP antes de pedir esta URL. Este
// límite se aplica también aquí para impedir que se eluda desde una petición.
const maxBytes = 3 * 1024 * 1024
const types = new Set(['image/webp'])

async function authorize(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return { error: json({ error: 'Debes iniciar sesión.' }, 401) }
  const url = Deno.env.get('SUPABASE_URL'), secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !secret || !publishable) return { error: json({ error: 'La función no está configurada.' }, 500) }
  const token = authorization.slice('Bearer '.length), admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return { error: json({ error: 'La sesión no es válida.' }, 401) }
  const caller = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  return { user: data.user, caller }
}

async function canRead(path: string, userId: string, caller: any) {
  if (isPrivateDesignPath(path, userId)) return true
  const { data, error } = await caller.rpc('is_admin')
  return !error && Boolean(data)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const auth = await authorize(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json().catch(() => null) as any
    const action = String(body?.action || '')
    if (action === 'create-upload') {
      const path = String(body?.path || ''), contentType = String(body?.contentType || ''), size = Number(body?.size)
      if (!isPrivateDesignPath(path, auth.user.id) || !types.has(contentType) || !Number.isInteger(size) || size < 1 || size > maxBytes) return json({ error: 'El archivo no cumple los límites permitidos.' }, 400)
      return json({ path, uploadUrl: await presignPrivateDesign('PUT', path, { contentType, expiresIn: 60 }) })
    }
    if (action === 'latest') {
      const side = String(body?.side || '')
      if (!['front', 'back'].includes(side)) return json({ error: 'Tipo de diseño no válido.' }, 400)
      const files = await listPrivateDesigns(`${auth.user.id}/${side}/`)
      const latest = files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      return json({ design: latest ? { path: latest.path, url: await presignPrivateDesign('GET', latest.path, { expiresIn: 60 }) } : null })
    }
    if (action === 'sign-download') {
      const path = String(body?.path || '')
      if (!isPrivateDesignPath(path) || !(await canRead(path, auth.user.id, auth.caller))) return json({ error: 'No tienes permiso para acceder a este archivo.' }, 403)
      return json({ path, url: await presignPrivateDesign('GET', path, { expiresIn: 60 }) })
    }
    if (action === 'share-download') {
      const path = String(body?.path || '')
      if (!isPrivateDesignPath(path, auth.user.id)) return json({ error: 'Solo puedes compartir tus propios archivos.' }, 403)
      return json({ path, url: await presignPrivateDesign('GET', path, { expiresIn: 7 * 24 * 60 * 60 }) })
    }
    return json({ error: 'Acción inválida.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: 'No pudimos procesar el archivo privado.' }, 502)
  }
})
