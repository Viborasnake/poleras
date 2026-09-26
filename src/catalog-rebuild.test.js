import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, createRebuildCatalogHandler } from '../api/rebuild-catalog.js';

function responseRecorder(){
  return {
    headers:{},statusCode:0,payload:null,
    setHeader(name,value){this.headers[name]=value;},
    status(code){this.statusCode=code;return this;},
    json(payload){this.payload=payload;return this;},
  };
}

test('bearerToken acepta el esquema Bearer y rechaza valores incompletos',()=>{
  assert.equal(bearerToken('Bearer admin-token'),'admin-token');
  assert.equal(bearerToken('bearer   token-2'),'token-2');
  assert.equal(bearerToken('Basic abc'),'');
});

test('la regeneración exige una sesión autenticada',async()=>{
  const handler=createRebuildCatalogHandler({env:{},createClientImpl:()=>{throw new Error('No debe ejecutarse');}});
  const response=responseRecorder();
  await handler({method:'POST',headers:{}},response);
  assert.equal(response.statusCode,401);
  assert.equal(response.payload.error,'Sesión requerida.');
});

test('un administrador puede encolar el deploy sin exponer el hook',async()=>{
  let requestedHook='';
  const handler=createRebuildCatalogHandler({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-key',VERCEL_DEPLOY_HOOK_URL:'https://api.vercel.com/v1/integrations/deploy/example'},
    createClientImpl:()=>({auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},rpc:async()=>({data:true,error:null})}),
    fetchImpl:async url=>{requestedHook=url;return {ok:true,status:200};},
  });
  const response=responseRecorder();
  await handler({method:'POST',headers:{authorization:'Bearer admin-token'}},response);
  assert.equal(response.statusCode,202);
  assert.deepEqual(response.payload,{queued:true,message:'Regeneración SEO en curso.'});
  assert.equal(requestedHook,'https://api.vercel.com/v1/integrations/deploy/example');
  assert.equal(JSON.stringify(response.payload).includes('api.vercel.com'),false);
});

test('una cuenta sin rol de administración no puede activar el deploy',async()=>{
  let deployed=false;
  const handler=createRebuildCatalogHandler({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-key',VERCEL_DEPLOY_HOOK_URL:'https://api.vercel.com/hook'},
    createClientImpl:()=>({auth:{getUser:async()=>({data:{user:{id:'viewer'}},error:null})},rpc:async()=>({data:false,error:null})}),
    fetchImpl:async()=>{deployed=true;return {ok:true};},
  });
  const response=responseRecorder();
  await handler({method:'POST',headers:{authorization:'Bearer viewer-token'}},response);
  assert.equal(response.statusCode,403);
  assert.equal(deployed,false);
});
