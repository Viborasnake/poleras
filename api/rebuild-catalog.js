import { createClient } from '@supabase/supabase-js';

export function bearerToken(header=''){
  const match=String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim()||'';
}

function send(response,status,payload){
  response.setHeader?.('Cache-Control','no-store');
  return response.status(status).json(payload);
}

export function createRebuildCatalogHandler({createClientImpl=createClient,fetchImpl=fetch,env=process.env}={}){
  return async function rebuildCatalog(request,response){
    if(request.method!=='POST'){
      response.setHeader?.('Allow','POST');
      return send(response,405,{error:'Método no permitido.'});
    }

    const token=bearerToken(request.headers?.authorization);
    if(!token)return send(response,401,{error:'Sesión requerida.'});

    const supabaseUrl=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
    const publishableKey=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const deployHook=env.VERCEL_DEPLOY_HOOK_URL;
    if(!supabaseUrl||!publishableKey||!deployHook)return send(response,503,{error:'La regeneración SEO todavía no está configurada.'});

    const client=createClientImpl(supabaseUrl,publishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{headers:{Authorization:`Bearer ${token}`}},
    });
    const {data:userData,error:userError}=await client.auth.getUser(token);
    if(userError||!userData?.user)return send(response,401,{error:'La sesión no es válida.'});
    const {data:isAdmin,error:roleError}=await client.rpc('is_admin');
    if(roleError||!isAdmin)return send(response,403,{error:'No tienes permisos para regenerar el catálogo.'});

    try{
      const deployment=await fetchImpl(deployHook,{method:'POST',headers:{'Content-Type':'application/json'}});
      if(!deployment.ok)throw new Error(`Vercel respondió ${deployment.status}`);
      return send(response,202,{queued:true,message:'Regeneración SEO en curso.'});
    }catch(error){
      console.error('No se pudo activar el deploy hook del catálogo.',error);
      return send(response,502,{error:'No se pudo iniciar la regeneración SEO.'});
    }
  };
}

export default createRebuildCatalogHandler();
