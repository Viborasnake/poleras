import assert from 'node:assert/strict';
import test from 'node:test';
import {mercadoPagoFeedback,receiptEmailFeedback,whatsappFeedback} from './commerce-feedback.js';

test('la vuelta de Mercado Pago requiere un cobro registrado para confirmar el éxito',()=>{
 const order={request_type:'purchase',order_items:[{name_snapshot:'Polera · Los Mox',quantity:2}],payments:[]};
 assert.equal(mercadoPagoFeedback({returnStatus:'success',order,orderId:'42'}).tone,'info');
 assert.equal(mercadoPagoFeedback({returnStatus:'failure',order,orderId:'42'}).tone,'error');
 order.payments=[{provider:'mercado_pago',status:'approved'}];
 const receipt=mercadoPagoFeedback({returnStatus:'success',order,orderId:'42'});
 assert.equal(receipt.title,'Pago aprobado por Mercado Pago');
 assert.equal(receipt.reference,'Pedido #42');
 assert.deepEqual(receipt.contents,['2 × Polera · Los Mox']);
 assert.match(receipt.message,/Droska revisará/);
});

test('WhatsApp distingue los datos registrados y las fotos pendientes',()=>{
 const receipt=whatsappFeedback({orderId:42,contents:['Mascota Navidad','A nombre de Ana Pérez','Nombre de la mascota · Luna'],pendingAttachments:'las fotos de tu mascota',preliminaryPrice:'$17.980'});
 assert.equal(receipt.title,'Solicitud registrada en Droska');
 assert.match(receipt.message,/pendiente de envío.*adjunta las fotos de tu mascota.*pulsa «Enviar»/);
 assert.ok(receipt.contents.includes('Precio preliminar · $17.980 (por confirmar)'));
 assert.equal(whatsappFeedback({contents:[]}).title,'Mensaje de WhatsApp preparado');
});

test('el estado del correo se comunica cuando la función informa el resultado',()=>{
 const email='ana@example.test';
 assert.equal(receiptEmailFeedback(undefined,email,'Los datos para transferir'),'');
 assert.equal(receiptEmailFeedback({sent:false},email,'Los datos para transferir'),'No pudimos enviar el correo a ana@example.test.');
 assert.equal(receiptEmailFeedback({sent:true},email,'Los datos para transferir'),'Los datos para transferir se enviaron a ana@example.test.');
});
