import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWhatsAppPurchaseMessage,effectivePurchaseMethod,hasCartPurchase,purchaseTypeFor} from './purchase-methods.js';

test('la configuracion individual tiene prioridad sobre la global',()=>{
  const settings={catalog_purchase_method:'whatsapp',personalized_purchase_method:'whatsapp'};
  assert.equal(effectivePurchaseMethod({product:{purchase_method:'cart'},settings,purchaseType:'catalog'}),'cart');
  assert.equal(effectivePurchaseMethod({product:{purchase_method:'inherit'},settings,purchaseType:'catalog'}),'whatsapp');
});

test('distingue catalogo de flujos con archivos o idea propia',()=>{
  assert.equal(purchaseTypeFor({catalogDesignSlug:'retro',catalogDesignCustomerImage:false}),'catalog');
  assert.equal(purchaseTypeFor({catalogDesignSlug:'kaiju',catalogDesignCustomerImage:true}),'personalized');
  assert.equal(purchaseTypeFor({mode:'custom'}),'personalized');
});

test('el carrito se conserva cuando existe al menos una excepcion',()=>{
  const settings={catalog_purchase_method:'whatsapp',personalized_purchase_method:'whatsapp'};
  assert.equal(hasCartPurchase([{active:true,purchase_method:'inherit'}],settings),false);
  assert.equal(hasCartPurchase([{active:true,purchase_method:'cart'}],settings),true);
});

test('el mensaje incluye datos e imagenes temporales',()=>{
  const message=buildWhatsAppPurchaseMessage({purchaseType:'personalized',productName:'Polera',designName:'Kaiju',quantity:2,customer:{name:'Ana',email:'ana@example.cl'},imageUrls:['https://signed.example/image']});
  assert.match(message,/solicitud personalizada/);
  assert.match(message,/Cantidad: 2/);
  assert.match(message,/enlaces privados temporales/);
  assert.match(message,/signed\.example/);
});
