import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTraceability} from './admin-order-traceability.js';

test('WhatsApp personalizado sin archivo queda pendiente, no fallido',()=>{
 const trace=orderTraceability({source:'whatsapp',whatsapp_request_id:'request-18',request_type:'purchase',price_snapshot:{purchase_type:'personalized',attachment_pending:true},request_references:[],order_items:[]});
 assert.equal(trace.state,'pending');
 assert.equal(trace.channel,'WhatsApp');
 assert.equal(trace.personalized,true);
 assert.equal(trace.attachmentCount,0);
 assert.match(trace.message,/Aún no hay archivos vinculados/);
});

test('recepción recuperada conserva motivo, id y cantidad de adjuntos',()=>{
 const trace=orderTraceability({source:'idea_request',creative_request_id:'recovered-id',request_type:'creative',price_snapshot:{recovered_intake:true,recovery_reason:'Selección rechazada'},request_references:[{path:'private/photo.webp'}],order_items:[]});
 assert.equal(trace.state,'recovered');
 assert.equal(trace.requestId,'recovered-id');
 assert.equal(trace.attachmentCount,1);
 assert.equal(trace.recoveryReason,'Selección rechazada');
});

test('archivos de producción también cuentan como adjuntos trazables',()=>{
 const trace=orderTraceability({price_snapshot:{purchase_type:'personalized'},request_references:[],order_items:[{front_design_path:'private/front.webp'}]});
 assert.equal(trace.state,'attached');
 assert.equal(trace.attachmentCount,1);
});
