import {useEffect,useState,type FormEvent,type ReactNode} from 'react'
import {adminSupabase,authenticateAdmin,hasAdminAccess} from './auth'

type AccessState='checking'|'authorized'|'unauthorized'

export default function AuthGate({children}:{children:ReactNode}) {
  const [access,setAccess]=useState<AccessState>('checking')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    let active=true
    const verify=()=>hasAdminAccess().then(authorized=>{if(active)setAccess(authorized?'authorized':'unauthorized')}).catch(()=>{if(active)setAccess('unauthorized')})
    void verify()
    const {data:{subscription}}=adminSupabase.auth.onAuthStateChange((_event,session)=>{
      if(!active)return
      if(!session?.user){setAccess('unauthorized');return}
      window.setTimeout(()=>void verify(),0)
    })
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  if(access==='authorized')return <>{children}</>

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('')
    try {
      const result=await authenticateAdmin(email,password)
      if(result.ok){setPassword('');setAccess('authorized')}
      else {setPassword('');setError(result.message)}
    }catch {setError('No se pudo verificar el acceso. Intenta nuevamente.')}
    finally{setBusy(false)}
  }

  if(access==='checking')return <main className="auth-page"><section className="auth-card" aria-live="polite">
    <img className="auth-logo" src="/droska-print-logo-dark.png" alt="droska SHIRT" width="2366" height="542" />
    <span className="eyebrow">DROSKA · TRAMA DTF</span>
    <h1>Comprobando acceso…</h1>
    <p>Estamos verificando tu sesión de Administración.</p>
  </section></main>

  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <img className="auth-logo" src="/droska-print-logo-dark.png" alt="droska SHIRT" width="2366" height="542" />
    <span className="eyebrow">DROSKA · TRAMA DTF</span>
    <h1 id="auth-title">Acceso de administración</h1>
    <p>Usa la misma cuenta del panel de Droska. Al ingresar aquí, también quedará activa en Administración.</p>
    <form onSubmit={submit}>
      <label className="field">Correo<input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required /></label>
      <label className="field">Contraseña<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required /></label>
      <button className="btn export" disabled={busy}>{busy?'Verificando…':'Ingresar como administración'}</button>
    </form>
    {error&&<p className="error-text" role="alert">{error}</p>}
    <a href="/admin">Volver al panel de Administración</a>
  </section></main>
}
