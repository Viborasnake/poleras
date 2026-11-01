import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('WhatsApp exige persistencia previa y registra el origen del flujo',async()=>{
 const [client,server]=await Promise.all([read('./main.js'),read('../supabase/functions/create-whatsapp-order/index.ts')]);
 assert.doesNotMatch(client,/se abrirá el chat igualmente/);
 assert.match(client,/stableRequestId\(localStorage,'droska-whatsapp-attempt'/);
 assert.match(server,/flow_type: flowType/);
 assert.doesNotMatch(server,/product\.purchaseType/);
});

test('Mercado Pago conserva una preferencia reutilizable y configura webhook',async()=>{
 const [checkout,creative]=await Promise.all([read('../supabase/functions/create-payment-preference/index.ts'),read('../supabase/functions/create-creative-payment/index.ts')]);
 for(const source of [checkout,creative])assert.match(source,/notification_url: `\$\{url\}\/functions\/v1\/mercado-pago-webhook`/);
 assert.match(checkout,/mp_checkout_url/);
 assert.match(checkout,/prior\?\.status === 'pending'/);
  assert.match(checkout,/checkout_error: 'payment_initialization_failed'/);
  assert.doesNotMatch(checkout,/from\('orders'\)\.delete\(\)/);
  assert.match(checkout,/const qualityReview = Boolean\(item\.qualityReview\) && !\(design && !item\.catalogDesignCustomerImage\)/);
});

test('el webhook conserva trazabilidad de reversas y contracargos',async()=>{
 const webhook=await read('../supabase/functions/mercado-pago-webhook/index.ts');
 assert.match(webhook,/mercadoPaymentStatus/);
 assert.match(webhook,/partially_refunded/);
 assert.match(webhook,/charged_back/);
 assert.match(webhook,/payment_alert/);
});

test('todos los correos operativos reciben desglose y entrega del pedido',async()=>{
 const [checkout,statuses,resend,webhook,template]=await Promise.all([
  read('../supabase/functions/create-payment-preference/index.ts'),
  read('../supabase/functions/update-order-status/index.ts'),
  read('../supabase/functions/send-order-email/index.ts'),
  read('../supabase/functions/mercado-pago-webhook/index.ts'),
  read('../supabase/functions/_shared/order-email.ts'),
 ]);
 for(const source of [checkout,statuses,resend]){
  assert.match(source,/shipping_clp/);
  assert.match(source,/discount_clp/);
  assert.match(source,/coupon_code/);
  assert.match(source,/shipping_address/);
 }
 assert.match(checkout,/delivery_notes:/);
 assert.match(statuses,/delete shippingAddress\.notes/);
 assert.match(resend,/delete shippingAddress\.notes/);
 assert.match(checkout,/sendAdminOrderNotice\([^\n]+orderEmailDetails\)/);
 assert.match(webhook,/sendAdminOrderNotice\([^\n]+emailDetailsFromOrder/);
 assert.match(template,/const summary = orderDetails\(details\)/);
});
