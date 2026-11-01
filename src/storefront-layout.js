/** Public visitors always follow the saved setting; overrides are development-only. */
export function resolveStorefrontLayout(settings,{development=false,search=''}={}){
  const override=development?new URLSearchParams(search).get('preview-layout'):null;
  const layout=override==='classic'||override==='drop-wall'?override:settings?.storefront_layout;
  return layout==='drop-wall'?'drop-wall':'classic';
}

export async function loadStorefrontSettings(load,{timeoutMs=5000,fallback}={}){
  const controller=new AbortController();
  let timer;
  try{
    return await Promise.race([
      load(controller.signal),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Tiempo de espera de la configuración agotado.'))},timeoutMs)}),
    ]);
  }catch{
    return {...fallback,storefront_layout:'classic'};
  }finally{
    clearTimeout(timer);
  }
}
