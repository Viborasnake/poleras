import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrderEmail} from '../supabase/functions/_shared/order-email.ts';

const deliveryDetails={
  items:[{name_snapshot:'Polera Básica · Navidad El Grinch',quantity:1,line_total_clp:15990,print_sides:'front'}],
  subtotal_clp:15990,
  shipping_clp:3990,
  discount_clp:0,
  total_clp:19980,
  shipping_address:{fulfillment:'delivery',region:'Metropolitana de Santiago',commune:'Santiago',address:'Av. Siempre Viva 123',address_extra:'Depto. 4',delivery_notes:'Tocar el timbre rojo'},
};

test('el email desglosa productos, despacho, total y dirección',()=>{
  const email=buildOrderEmail('Cristian','22','submitted','https://droska.frontbook.cl',false,deliveryDetails);
  for(const expected of ['Subtotal de productos','$15.990','Despacho','$3.990','Total','$19.980','Despacho a domicilio','Av. Siempre Viva 123','Depto. 4','Santiago','Tocar el timbre rojo']){
    assert.match(email.html,new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(email.text,new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(email.html,/Polera Básica · Navidad El Grinch · Frente/);
});

test('retiro y descuentos tienen un desglose inequívoco',()=>{
  const email=buildOrderEmail('Claudia','23','paid','https://droska.frontbook.cl',true,{
    ...deliveryDetails,
    shipping_clp:0,
    discount_clp:2000,
    coupon_code:'DROSKA10',
    total_clp:13990,
    shipping_address:{fulfillment:'pickup'},
  });
  assert.match(email.html,/Retiro coordinado/);
  assert.match(email.html,/Gratis/);
  assert.match(email.html,/Descuento · DROSKA10/);
  assert.match(email.html,/−\$2\.000/);
  assert.match(email.html,/>\$13\.990</);
  assert.match(email.text,/Retiro coordinado: Gratis/);
});

test('todos los estados de despacho y retiro conservan el resumen de entrega',()=>{
  for(const status of ['submitted','paid','in_production','ready','shipped','delivered']){
    const email=buildOrderEmail('Ana','30',status,'https://droska.frontbook.cl',false,deliveryDetails);
    assert.match(email.html,/Subtotal de productos/);
    assert.match(email.html,/Despacho a domicilio/);
  }
  for(const status of ['submitted','paid','in_production','ready_for_pickup','delivered']){
    const email=buildOrderEmail('Ana','31',status,'https://droska.frontbook.cl',true,{...deliveryDetails,shipping_clp:0,total_clp:15990,shipping_address:{fulfillment:'pickup'}});
    assert.match(email.html,/Retiro coordinado/);
    assert.match(email.html,/Gratis/);
  }
});

test('pago, edición y cotización creativa usan el mismo detalle completo',()=>{
  const payment=buildOrderEmail('Ana','40','submitted','https://droska.frontbook.cl',false,{...deliveryDetails,payment_instructions:{transfer:{holder:'Droska SpA',bank:'Banco Uno',account_number:'123'}}});
  assert.match(payment.html,/Datos para pagar/);
  assert.match(payment.html,/Despacho/);
  assert.match(payment.html,/Av\. Siempre Viva 123/);
  const edited=buildOrderEmail('Ana','41','paid','https://droska.frontbook.cl',false,{...deliveryDetails,orderEdited:true});
  assert.match(edited.subject,/pedido fue actualizado/i);
  assert.match(edited.html,/Subtotal de productos/);
  const quote=buildOrderEmail('Ana','42','quoted','https://droska.frontbook.cl',false,{...deliveryDetails,creative:true,quote_message:'Incluye dos rondas de cambios.'});
  assert.match(quote.html,/Incluye dos rondas de cambios/);
  assert.match(quote.html,/Despacho a domicilio/);
  assert.match(quote.html,/>\$19\.980</);
});

test('las notas internas no se filtran al correo del cliente',()=>{
  const email=buildOrderEmail('Ana','50','submitted','https://droska.frontbook.cl',false,{...deliveryDetails,shipping_address:{...deliveryDetails.shipping_address,notes:'NOTA INTERNA SECRETA'}});
  assert.doesNotMatch(email.html,/NOTA INTERNA SECRETA/);
  assert.doesNotMatch(email.text,/NOTA INTERNA SECRETA/);
  assert.match(email.html,/Tocar el timbre rojo/);
});
