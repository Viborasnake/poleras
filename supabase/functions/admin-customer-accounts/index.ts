import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

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
  return { admin, callerId: userData.user.id }
}

async function listCustomerFiles(admin: any, userId: string) {
  const paths: string[] = []
  const { data: folders, error } = await admin.storage.from('customer-designs').list(userId, { limit: 1000 })
  if (error) throw error
  for (const folder of folders || []) {
    const prefix = `${userId}/${folder.name}`
    if (folder.id) paths.push(prefix)
    else {
      const { data: files, error: nestedError } = await admin.storage.from('customer-designs').list(prefix, { limit: 1000 })
      if (nestedError) throw nestedError
      for (const file of files || []) if (file.id) paths.push(`${prefix}/${file.name}`)
    }
  }
  return paths
}

async function listAccounts(admin: any) {
  const users: any[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...(data.users || []))
    if (!data.users || data.users.length < 1000) break
  }
  const { data: profiles, error: profileError } = await admin.from('profiles').select('id,full_name,phone,created_at')
  if (profileError) throw profileError
  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  return users.map(user => ({ id: user.id, email: user.email || '', full_name: profileMap.get(user.id)?.full_name || user.user_metadata?.full_name || '', phone: profileMap.get(user.id)?.phone || '', created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, email_confirmed_at: user.email_confirmed_at })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

async function deleteAccount(admin: any, userId: string) {
  const { data: orders, error: orderError } = await admin.from('orders').select('id').eq('user_id', userId)
  if (orderError) throw orderError
  const orderIds = (orders || []).map((order: any) => order.id)
  if (orderIds.length) {
    const { error: paymentError } = await admin.from('payments').delete().in('order_id', orderIds)
    if (paymentError) throw paymentError
    const { error: ordersDeleteError } = await admin.from('orders').delete().in('id', orderIds)
    if (ordersDeleteError) throw ordersDeleteError
  }
  const { error: cartsError } = await admin.from('carts').delete().eq('user_id', userId)
  if (cartsError) throw cartsError
  const paths = await listCustomerFiles(admin, userId)
  if (paths.length) {
    const { error: storageError } = await admin.storage.from('customer-designs').remove(paths)
    if (storageError) throw storageError
  }
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) throw authError
  return { orders: orderIds.length, files: paths.length }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const auth = await authorize(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json().catch(() => ({}))
    if (body.action === 'list') return json({ accounts: await listAccounts(auth.admin) })
    if (body.action !== 'delete') return json({ error: 'Acción inválida.' }, 400)
    const userId = String(body.userId || '').trim()
    if (!userId) return json({ error: 'Falta la cuenta que se eliminará.' }, 400)
    if (userId === auth.callerId) return json({ error: 'No puedes eliminar la cuenta con la que estás administrando.' }, 409)
    const result = await deleteAccount(auth.admin, userId)
    return json({ deleted: true, userId, ...result })
  } catch (error) {
    console.error(error)
    return json({ error: 'No pudimos completar la eliminación. No se borró la cuenta de Auth.' }, 500)
  }
})
