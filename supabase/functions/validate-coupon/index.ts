import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Método no permitido.'},405)
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!secret)return json({error:'La función no está configurada.'},500)
  const body=await request.json().catch(()=>({})),code=String(body.code||'').trim().toUpperCase(),subtotal=Math.max(0,Number(body.subtotal||0))
  if(!code||!subtotal)return json({error:'Ingresa un cupón válido.'},400)
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:coupon,error}=await admin.from('coupons').select('*').eq('code',code).eq('active',true).maybeSingle()
  if(error||!coupon)return json({error:'El cupón no existe o no está activo.'},404)
  const now=Date.now()
  if(coupon.starts_at&&new Date(coupon.starts_at).getTime()>now)return json({error:'Este cupón todavía no comienza.'},409)
  if(coupon.ends_at&&new Date(coupon.ends_at).getTime()<now)return json({error:'Este cupón ya venció.'},409)
  if(coupon.max_uses!==null&&coupon.used_count>=coupon.max_uses)return json({error:'Este cupón alcanzó su límite de usos.'},409)
  if(subtotal<coupon.min_subtotal_clp)return json({error:`Este cupón requiere una compra mínima de $${coupon.min_subtotal_clp.toLocaleString('es-CL')}.`},409)
  let discount=coupon.kind==='percent'?Math.floor(subtotal*coupon.value/100):coupon.value
  if(coupon.max_discount_clp!==null)discount=Math.min(discount,coupon.max_discount_clp)
  discount=Math.min(subtotal,discount)
  return json({code:coupon.code,discountClp:discount,label:coupon.kind==='percent'?`${coupon.value}% de descuento`:`$${coupon.value.toLocaleString('es-CL')} de descuento`})
})
