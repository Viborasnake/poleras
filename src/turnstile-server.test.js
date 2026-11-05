import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import vm from 'node:vm';

const source=await readFile(new URL('../supabase/functions/_shared/turnstile.ts',import.meta.url),'utf8');
const {code}=await transform(source.replace('export async function verifyTurnstile','async function verifyTurnstile')+'\nthis.verifyTurnstile=verifyTurnstile;', {loader:'ts'});

async function verify(token,hostname){
 const context={Deno:{env:{get:key=>key==='TURNSTILE_SECRET_KEY'?'test-secret':key==='SITE_URL'?'https://droska.frontbook.cl':undefined}},fetch:async()=>new Response(JSON.stringify({success:true,hostname}),{status:200}),URLSearchParams,URL,AbortSignal,Response};
 vm.runInNewContext(code,context);
 return context.verifyTurnstile(token);
}

test('Turnstile acepta solo tokens válidos para el dominio de la tienda',async()=>{
 assert.equal(await verify('test-valid-token','droska.frontbook.cl'),true);
 assert.equal(await verify('test-valid-token','otro-sitio.cl'),false);
 assert.equal(await verify('short','droska.frontbook.cl'),false);
});
