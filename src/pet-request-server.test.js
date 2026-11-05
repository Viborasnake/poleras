import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import vm from 'node:vm';
import {designProductArtworks,modelProductSlug} from '../supabase/functions/_shared/catalog-product-artworks.js';
import {allowedColorsForModel} from '../supabase/functions/_shared/catalog-product-colors.js';

const source = await readFile(new URL('../supabase/functions/create-design-request/index.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*\n/gm, ''), { loader:'ts' });
const userId = '11111111-1111-4111-8111-111111111111';
const photoPath = `${userId}/reference/22222222-2222-4222-8222-222222222222.jpg`;
async function send(references,productSelection,extra={}) {
  const saved = {};
  const admin = {
    auth: { getUser: async () => ({data:{user:{id:userId}}}) },
    storage: { from: () => ({info: async () => ({data:{size:1234}})}) },
    from(table) {
      const query = {
        select(){return this}, eq(){return this},
        async maybeSingle(){return {data: table==='catalog_designs' ? {id:'design-uuid',slug:'pet-design',name:'Mascota Kaiju',active:true,accepts_customer_image:true,customer_photo_subject:'people',allowed_colors:['#ffffff'],product_artworks:{totebags:'catalog/tote.png'}} : table==='product_variants'?{id:42,sku:'TOTE-L',size:'L',color_name:'Natural',color_hex:'#e8e0cf',active:true,product_models:{code:'tote',name:'Tote bag',active:true}}:null}},
        insert(value){saved[table]=value;return this},
        async single(){return {data:{id:'order-123'}}},
      };
      return query;
    },
  };
  let handler;
  vm.runInNewContext(code, {
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':key==='SUPABASE_SECRET_KEY'||key==='TURNSTILE_SECRET_KEY'?'test-secret':undefined},serve:fn=>handler=fn},
    designProductArtworks,modelProductSlug,allowedColorsForModel,createClient:()=>admin, headPrivateDesign:async()=>({size:1234}), sendOrderEmail:async()=>({sent:false}), verifyTurnstile:async token=>token==='valid-token', Response, console,
  });
  const response=await handler(new Request('https://example.test', {method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({
    requestId:'33333333-3333-4333-8333-333333333333', catalogDesignSlug:'pet-design',idea:'Mantener su mancha sobre el ojo.',
    customer:{firstName:'Test',email:'test@example.com',phone:'123456789'},references,productSelection,captchaToken:'valid-token',...extra,
  })}));
  return {response,saved};
}
test('servidor rechaza personalización sin foto antes de crear pedido',async()=>{
  const {response,saved}=await send([]);
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/foto/);
  assert.equal(saved.orders,undefined);
});
test('servidor rechaza una foto de otro usuario',async()=>{
  const {response,saved}=await send([{name:'mascota.jpg',path:photoPath.replace(userId,'44444444-4444-4444-8444-444444444444')}]);
  assert.equal(response.status,400);
  assert.equal(saved.orders,undefined);
});
test('servidor rechaza una solicitud sin CAPTCHA válido',async()=>{
  const {response,saved}=await send([{name:'mascota.jpg',path:photoPath}],undefined,{captchaToken:'invalid'});
  assert.equal(response.status,403);
  assert.equal(saved.orders,undefined);
});
test('admin recibe diseño, foto privada e indicaciones en el mismo pedido',async()=>{
  const {response,saved}=await send([{name:'mascota.jpg',path:photoPath}]);
  assert.equal(response.status,201);
  assert.equal(saved.orders.request_references[0].path,photoPath);
  assert.match(saved.orders.request_details,/Mascota Kaiju/);
  assert.match(saved.orders.request_details,/mancha sobre el ojo/);
  assert.match(saved.orders.request_details,/Foto de la persona/);
  assert.equal(saved.order_items.catalog_design_id,'design-uuid');
  assert.equal(saved.orders.price_snapshot.catalog_design_slug,'pet-design');
});

test('guarda variante y formato de tote verificados para administración',async()=>{
 const {response,saved}=await send([{name:'pet.jpg',path:photoPath}],{variantId:42,side:'front'});
 assert.equal(response.status,201);
 assert.equal(saved.order_items.product_variant_id,42);
 assert.equal(saved.orders.price_snapshot.product_selection.size,'L');
 assert.match(saved.orders.request_details,/Tote bag/);
});
test('rechaza estampar la espalda de una tote',async()=>{
 const {response,saved}=await send([{name:'pet.jpg',path:photoPath}],{variantId:42,side:'back'});
 assert.equal(response.status,409);
 assert.equal(saved.orders,undefined);
});
test('el respaldo guarda contacto, referencia y selección para revisión manual',async()=>{
 const {response,saved}=await send([{name:'persona.jpg',path:photoPath}],{variantId:42,modelCode:'tote',model:'Tote bag',size:'L',color:'Natural',colorHex:'#e8e0cf',side:'back'},{recovery:true,recoveryReason:'La selección cambió mientras se enviaba.'});
 assert.equal(response.status,202);
 assert.equal(saved.orders.price_snapshot.recovered_intake,true);
 assert.equal(saved.orders.price_snapshot.recovery_reason,'La selección cambió mientras se enviaba.');
 assert.equal(saved.orders.request_references[0].path,photoPath);
 assert.match(saved.orders.request_details,/El equipo debe contactar al cliente/);
 assert.match(saved.order_status_history.note,/contactar al cliente/);
});
