import {createClient} from '@supabase/supabase-js'
import {ADMIN_AUTH_STORAGE_KEY,adminAuthOptions,localSignOutOptions} from '../../../src/auth-client-options.js'
import {requestCaptchaToken} from '../../../src/auth-captcha.js'

export {ADMIN_AUTH_STORAGE_KEY}

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co'
const SUPABASE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS'

export const adminSupabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:adminAuthOptions})

export async function hasAdminAccess() {
  const {data:{user},error:userError}=await adminSupabase.auth.getUser()
  if(userError||!user)return false
  const {data:isAdmin,error:roleError}=await adminSupabase.rpc('is_admin')
  return !roleError&&isAdmin===true
}

export async function authenticateAdmin(email:string,password:string) {
  const captchaToken=await requestCaptchaToken()
  const {error}=await adminSupabase.auth.signInWithPassword({email:email.trim(),password,options:{captchaToken}})
  if(error)return {ok:false,message:'El correo o la contraseña no son correctos.'}
  if(await hasAdminAccess())return {ok:true,message:''}
  await adminSupabase.auth.signOut(localSignOutOptions)
  return {ok:false,message:'Esta cuenta no tiene permisos de administración.'}
}
