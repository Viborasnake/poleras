import assert from 'node:assert/strict';
import test from 'node:test';
import {accountOrderFollowUp,mercadoPagoFeedback,receiptEmailFeedback,unconfirmedRequestFeedback,whatsappFeedback} from './commerce-feedback.js';

test('la vuelta de Mercado Pago requiere un cobro registrado para confirmar el éxito',()=>{
 const order={request_type:'purchase',order_items:[{name_snapshot:'Polera · Los Mox',quantity:2}],payments:[]};
 assert.equal(mercadoPagoFeedback({returnStatus:'success',order,orderId:'42'}).tone,'info');
 assert.equal(mercadoPagoFeedback({returnStatus:'failure',order,orderId:'42'}).tone,'error');
 order.payments=[{provider:'mercado_pago',status:'approved'}];
 const receipt=mercadoPagoFeedback({returnStatus:'success',order,orderId:'42'});
 assert.equal(receipt.title,'Pago aprobado por Mercado Pago');
 assert.equal(receipt.label,'Comprobante de pago');
 assert.equal(receipt.reference,'Pedido #42');
 assert.deepEqual(receipt.contents,['2 × Polera · Los Mox']);
 assert.match(receipt.message,/Droska revisará/);
 assert.match(receipt.nextStep,/te avisará al correo del pedido/);
});

test('WhatsApp distingue los datos registrados y las fotos pendientes',()=>{
 const receipt=whatsappFeedback({orderId:42,contents:['Mascota Navidad','A nombre de Ana Pérez','Nombre de la mascota · Luna'],pendingAttachments:'las fotos de tu mascota',preliminaryPrice:'$17.980'});
 assert.equal(receipt.title,'Solicitud registrada en Droska');
 assert.match(receipt.message,/pendiente de envío.*adjunta las fotos de tu mascota.*pulsa «Enviar»/);
 assert.ok(receipt.contents.includes('Precio preliminar · $17.980 (por confirmar)'));
 assert.match(receipt.nextStep,/Después de enviarlo.*mismo chat de WhatsApp/);
 const direct = whatsappFeedback({contents:[]});
 assert.equal(direct.title,'Mensaje de WhatsApp preparado');
 assert.equal(direct.reference,'');
 assert.equal(whatsappFeedback({orderId:43,contents:[],isPurchase:true}).reference,'Pedido #43');
});

test('el estado del correo se comunica cuando la función informa el resultado',()=>{
 const email='ana@example.test';
 assert.equal(receiptEmailFeedback(undefined,email,'Los datos para transferir'),'');
 assert.equal(receiptEmailFeedback({sent:false},email,'Los datos para transferir'),'No pudimos enviar el correo a ana@example.test.');
 assert.equal(receiptEmailFeedback({sent:true},email,'Los datos para transferir'),'Los datos para transferir se enviaron a ana@example.test.');
});

test('el checkout abierto y un cobro pendiente requieren acciones distintas',()=>{
 const payment = {provider:'mercado_pago',status:'pending'};
 const order = {status:'submitted',payments:[payment],shipping_address:{customer:{email:'ana@example.test'}}};
 assert.match(accountOrderFollowUp(order),/volver al carro para completar/);
 assert.equal(mercadoPagoFeedback({returnStatus:'failure',order}).tone,'error');
 payment.provider_payment_id = '128';
 assert.match(accountOrderFollowUp(order),/te avisará a ana@example.test/);
 assert.equal(mercadoPagoFeedback({returnStatus:'failure',order}).tone,'info');
});

test('el seguimiento distingue solicitud web, contacto por chat y fallo de registro',()=>{
 const order = {status:'submitted',request_type:'creative',shipping_address:{customer:{email:'ana@example.test'}}};
 assert.match(accountOrderFollowUp(order),/Te responderemos a ana@example.test.*propuesta/);
 assert.match(accountOrderFollowUp({...order,source:'whatsapp'}),/chat de WhatsApp/);
 const error = unconfirmedRequestFeedback('No pudimos subir tus fotos.');
 assert.equal(error.tone,'error');
 assert.equal(error.message,'No pudimos subir tus fotos.');
 assert.match(error.nextStep,/reintenta el envío/);
});
