const SITE_KEY=import.meta.env?.VITE_TURNSTILE_SITE_KEY?.trim();
const SCRIPT_URL='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise;
const captchaError=message=>Object.assign(new Error(message),{name:'CaptchaError'});

function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=window.setTimeout(()=>reject(captchaError('La verificación de seguridad tardó demasiado. Intenta nuevamente.')),15000);
  script.src=SCRIPT_URL;script.async=true;
  script.onload=()=>{window.clearTimeout(timeout);window.turnstile?resolve(window.turnstile):reject(captchaError('No pudimos iniciar la verificación de seguridad.'))};
  script.onerror=()=>{window.clearTimeout(timeout);reject(captchaError('No pudimos cargar la verificación de seguridad. Revisa tu conexión.'))};
  document.head.append(script);
 }).catch(error=>{scriptPromise=null;throw error});
 return scriptPromise;
}

export async function requestCaptchaToken(){
 if(!SITE_KEY)return undefined;
 const turnstile=await loadTurnstile();
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');
  dialog.className='auth-captcha-dialog';
  dialog.setAttribute('aria-labelledby','auth-captcha-title');
  dialog.innerHTML='<div class="auth-captcha-head"><div><span class="eyebrow">SEGURIDAD</span><h2 id="auth-captcha-title">Confirma que eres una persona</h2></div><button type="button" class="auth-captcha-close" aria-label="Cerrar verificación">×</button></div><p>Verificaremos tu solicitud antes de continuar.</p><div class="auth-captcha-widget"></div><p class="auth-captcha-status" role="status" aria-live="polite">Verificando…</p>';
  document.body.append(dialog);
  let widgetId,settled=false;
  const finish=(token,error)=>{if(settled)return;settled=true;if(widgetId!==undefined)turnstile.remove(widgetId);dialog.close();dialog.remove();error?reject(error):resolve(token)};
  dialog.querySelector('.auth-captcha-close').onclick=()=>finish(null,captchaError('Verificación cancelada. Puedes volver a intentarlo.'));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null,captchaError('Verificación cancelada. Puedes volver a intentarlo.'))});
  dialog.showModal();
  try{widgetId=turnstile.render(dialog.querySelector('.auth-captcha-widget'),{
   sitekey:SITE_KEY,theme:'auto',appearance:'always',
   callback:token=>finish(token),
   'error-callback':()=>finish(null,captchaError('No pudimos verificar la solicitud. Intenta nuevamente.')),
   'timeout-callback':()=>finish(null,captchaError('La verificación venció. Intenta nuevamente.')),
  })}catch(error){finish(null,captchaError('No pudimos iniciar la verificación de seguridad. Intenta nuevamente.'))}
 });
}

export async function signInAnonymouslyWithCaptcha(supabase){
 return authWithCaptcha(captchaToken=>supabase.auth.signInAnonymously(captchaToken?{options:{captchaToken}}:undefined));
}

export async function authWithCaptcha(action){
 try{return await action(await requestCaptchaToken())}
 catch(error){return {data:{user:null,session:null},error}}
}
