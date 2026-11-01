import test from 'node:test';
import assert from 'node:assert/strict';
import { petPhotoError } from './pet-personalization.js';

test('personalización exige una foto compatible y no vacía', () => {
  assert.match(petPhotoError(null), /Sube una foto/);
  assert.match(petPhotoError({type:'image/svg+xml',size:100}), /JPG/);
  assert.match(petPhotoError({type:'image/jpeg',size:0}), /12 MB/);
  assert.match(petPhotoError({type:'image/jpeg',size:12*1024*1024+1}), /12 MB/);
  for(const type of ['image/jpeg','image/png','image/webp']) assert.equal(petPhotoError({type,size:12*1024*1024}), '');
});

import {sendPetRequest,petStepHtml,petSubmitLabel} from './pet-personalization.js';
test('el respaldo automático conserva foto, selección e identificador sin duplicar la carga',async()=>{
 const draft={file:{name:'pet.jpg',size:100,type:'image/jpeg',lastModified:1},firstName:'Test',email:'test@example.com',phone:'123'};
 const payloads=[];let uploads=0;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async(name,{body})=>{payloads.push(body);return payloads.length===1?{error:new Error('offline')}:{data:{orderId:123,recovered:true}}}}};
 const options={draft,design:{id:'kaiju',name:'Kaiju'},selection:{variantId:42,modelCode:'body',model:'Body',size:'0-3 meses',color:'Blanco',colorHex:'#ffffff',side:'front'},supabase,uploadPhoto:async()=>{uploads++;return 'private/photo.jpg'},onStatus:()=>{}};
 await sendPetRequest(options);
 assert.equal(uploads,1);
 assert.equal(payloads[0].requestId,payloads[1].requestId);
 assert.equal(payloads[1].productSelection.variantId,42);
 assert.match(payloads[1].idea,/0-3 meses/);
 assert.equal(payloads[1].recovery,true);
 assert.equal(payloads[1].recoveryReason,'offline');
 assert.equal(draft.orderId,123);
 assert.equal(draft.recovered,true);
});
test('si fallan confirmación y respaldo conserva el intento y la foto para reintentar',async()=>{
 const draft={file:{name:'pet.jpg',size:100,type:'image/jpeg',lastModified:1},firstName:'Test',email:'test@example.com',phone:'123'};
 let uploads=0;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async()=>({error:new Error('offline')})}};
 await assert.rejects(sendPetRequest({draft,design:{id:'kaiju',name:'Kaiju'},selection:{variantId:42,model:'Body',size:'M',color:'Blanco',side:'front'},supabase,uploadPhoto:async()=>{uploads++;return 'private/photo.jpg'},onStatus:()=>{}}),/WhatsApp/);
 assert.equal(uploads,1);
 assert.ok(draft.attempt?.id);
 assert.equal(draft.uploaded.path,'private/photo.jpg');
});
test('la recepción recuperada explica que el equipo conserva los datos',()=>{
 const html=petStepHtml({step:3,draft:{orderId:123,recovered:true},selection:{},designName:'Kaiju',escapeText:String});
 assert.match(html,/guardamos tu contacto, selección, foto e indicaciones/);
 assert.match(html,/No necesitas enviarlas otra vez/);
});
test('la solicitud web exige una acción explícita y confirma la entrega de la foto',()=>{
 const review=petStepHtml({step:3,draft:{file:{name:'familia.jpg'}},selection:{model:'Polera',size:'M',color:'Blanco',side:'front'},designName:'Navidad',subject:'people',escapeText:String});
 assert.match(review,/Nada se envía automáticamente/);
 assert.match(review,/Enviar solicitud/);
 assert.equal(petSubmitLabel(3,'cart'),'Enviar solicitud');
 const success=petStepHtml({step:3,draft:{orderId:123},selection:{},designName:'Navidad',subject:'people',escapeText:String});
 assert.match(success,/ya fueron enviadas al equipo/);
 assert.match(success,/No necesitas enviarlas otra vez/);
});
test('WhatsApp aclara que abrir el chat no envía la solicitud',()=>{
 const html=petStepHtml({step:3,purchaseMethod:'whatsapp',draft:{},selection:{model:'Polera',size:'M',color:'Blanco',side:'front'},designName:'Navidad',subject:'people',escapeText:String});
 assert.match(html,/debes adjuntar la foto/);
 assert.match(html,/abrir el chat no envía nada/);
 assert.equal(petSubmitLabel(3,'whatsapp'),'Abrir WhatsApp para enviar');
});
test('el paso de foto no introduce otro formulario ni solicita contacto anticipadamente',()=>{
 const html=petStepHtml({step:2,draft:{},selection:{},designName:'Kaiju',escapeText:String});
 assert.ok(!html.includes('<form'));
 assert.ok(!html.includes('data-pet-contact'));
 assert.ok(html.includes('type="file"'));
});
test('WhatsApp pide adjuntar la foto en el chat y no muestra carga local',()=>{
 const html=petStepHtml({step:2,purchaseMethod:'whatsapp',draft:{},selection:{},designName:'Kaiju',escapeText:String});
 assert.ok(!html.includes('type="file"'));
 assert.match(html,/La foto se envía por WhatsApp/);
 assert.match(html,/adjuntes la foto/);
});
test('los diseños para personas piden una foto de persona y conservan el nombre en la solicitud',async()=>{
 const html=petStepHtml({step:2,subject:'people',draft:{},selection:{},designName:'Navidad',escapeText:String});
 assert.match(html,/Nombre de la persona/);
 assert.match(html,/Subir foto de la persona/);
 assert.doesNotMatch(html,/Tu mascota/);
 assert.match(petPhotoError(null,'people'),/foto de la persona/);
 const draft={file:{name:'familia.jpg',size:100,type:'image/jpeg',lastModified:1},petName:'Familia',firstName:'Ana',email:'ana@example.com',phone:'123'};
 let payload;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async(_name,{body})=>{payload=body;return {data:{orderId:123}}}}};
 await sendPetRequest({draft,design:{id:'navidad',name:'Navidad',customerPhotoSubject:'people'},selection:{variantId:42,model:'Polera',size:'M',color:'Blanco',side:'front'},supabase,uploadPhoto:async()=>'/foto',onStatus:()=>{}});
 assert.match(payload.idea,/con la persona de la foto adjunta/);
 assert.match(payload.idea,/Persona: Familia/);
 assert.doesNotMatch(payload.idea,/Mascota:/);
});
