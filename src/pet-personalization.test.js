import test from 'node:test';
import assert from 'node:assert/strict';
import { petPhotoError } from './pet-personalization.js';

test('personalización exige una foto compatible y no vacía', () => {
  assert.match(petPhotoError(null), /Sube una foto/);
  assert.match(petPhotoError({type:'image/svg+xml',size:100}), /JPG/);
  assert.match(petPhotoError({type:'image/jpeg',size:0}), /12 MB/);
  assert.match(petPhotoError({type:'image/jpeg',size:12*1024*1024+1}), /12 MB/);
  for(const type of ['image/jpeg','image/png','image/webp']) assert.equal(petPhotoError({type,size:12*1024*1024}), '');
  assert.match(petPhotoError([{type:'image/jpeg',size:100},{type:'image/svg+xml',size:100}]), /JPG/);
});

import {sendPetRequest,petStepHtml,petSubmitLabel,petPhotoLimit} from './pet-personalization.js';
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
 await assert.rejects(sendPetRequest({draft,design:{id:'kaiju',name:'Kaiju'},selection:{variantId:42,model:'Body',size:'M',color:'Blanco',side:'front'},supabase,uploadPhoto:async()=>{uploads++;return 'private/photo.jpg'},onStatus:()=>{}}),/sin confirmar/);
 assert.equal(uploads,1);
 assert.ok(draft.attempt?.id);
 assert.equal(draft.uploaded[0].path,'private/photo.jpg');
});
test('la recepción recuperada explica que el equipo conserva los datos',()=>{
 const html=petStepHtml({step:3,draft:{orderId:123,recovered:true,firstName:'Ana Pérez',email:'ana@example.test',file:{name:'luna.webp'},receipt:{sent:false}},selection:{},designName:'Kaiju',escapeText:String});
 assert.match(html,/Tu solicitud quedó guardada para revisión/);
 assert.match(html,/A nombre de Ana Pérez/);
 assert.match(html,/Foto adjunta · luna.webp/);
 assert.match(html,/No necesitas volver a enviar la solicitud/);
 assert.match(html,/COMPROBANTE DE SOLICITUD/);
 assert.match(html,/Te responderemos a ana@example.test/);
 assert.match(html,/No pudimos enviar el correo a ana@example.test/);
});
test('la solicitud web exige una acción explícita y confirma la entrega de la foto',()=>{
 const review=petStepHtml({step:3,draft:{file:{name:'familia.jpg'}},selection:{model:'Polera',size:'M',color:'Blanco',side:'front'},designName:'Navidad',subject:'people',escapeText:String});
 assert.match(review,/Nada se envía automáticamente/);
 assert.match(review,/Enviar solicitud/);
 assert.equal(petSubmitLabel(3,'cart'),'Enviar solicitud');
 const success=petStepHtml({step:3,draft:{orderId:123,firstName:'Ana Pérez',petName:'Luna',file:{name:'luna.webp'}},selection:{model:'Polera',size:'M',color:'Blanco',preliminaryPrice:'$17.980'},designName:'Mascota Navidad',subject:'pets',escapeText:String});
 for(const text of ['Recibimos tu personalización','Solicitud #123','A nombre de Ana Pérez','Nombre de la mascota · Luna','Mascota Navidad · Polera · M · Blanco','Foto adjunta · luna.webp','Precio preliminar · $17.980','precio final'])assert.ok(success.includes(text),text);
});
test('WhatsApp aclara que abrir el chat no envía la solicitud',()=>{
 const html=petStepHtml({step:3,purchaseMethod:'whatsapp',draft:{},selection:{model:'Polera',size:'M',color:'Blanco',side:'front'},designName:'Navidad',subject:'people',escapeText:String});
 assert.match(html,/debes adjuntar las fotos/);
 assert.match(html,/abrir el chat no envía nada/);
 assert.equal(petSubmitLabel(3,'whatsapp'),'Abrir WhatsApp para enviar');
});
test('el paso de foto no introduce otro formulario ni solicita contacto anticipadamente',()=>{
 const html=petStepHtml({step:2,draft:{},selection:{},designName:'Kaiju',escapeText:String});
 assert.ok(!html.includes('<form'));
 assert.ok(!html.includes('data-pet-contact'));
 assert.ok(html.includes('type="file"'));
  assert.match(html,/class="custom-references pet-photo-references"/);
  assert.match(html,/multiple/);
  assert.doesNotMatch(html,/pet-photo-list/);
});
test('WhatsApp pide adjuntar la foto en el chat y no muestra carga local',()=>{
 const html=petStepHtml({step:2,purchaseMethod:'whatsapp',draft:{},selection:{},designName:'Kaiju',escapeText:String});
 assert.ok(!html.includes('type="file"'));
 assert.match(html,/Las fotos se envían por WhatsApp/);
 assert.match(html,/adjuntes las fotos/);
});
test('los diseños para personas piden una foto de persona y conservan el nombre en la solicitud',async()=>{
 const html=petStepHtml({step:2,subject:'people',draft:{},selection:{},designName:'Navidad',escapeText:String});
 assert.match(html,/Nombre de la persona/);
 assert.match(html,/Adjuntar fotos/);
 assert.match(html,/multiple/);
 assert.doesNotMatch(html,/Tu mascota/);
 assert.match(petPhotoError(null,'people'),/foto de la persona/);
 const draft={file:{name:'familia.jpg',size:100,type:'image/jpeg',lastModified:1},petName:'Familia',firstName:'Ana',email:'ana@example.com',phone:'123'};
 let payload;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async(_name,{body})=>{payload=body;return {data:{orderId:123}}}}};
 await sendPetRequest({draft,design:{id:'navidad',name:'Navidad',customerPhotoSubject:'people'},selection:{variantId:42,model:'Polera',size:'M',color:'Blanco',side:'front'},supabase,uploadPhoto:async()=>'/foto',onStatus:()=>{}});
 assert.match(payload.idea,/con la persona de las fotos adjuntas/);
 assert.match(payload.idea,/Persona: Familia/);
 assert.doesNotMatch(payload.idea,/Mascota:/);
});
test('personas y mascotas envían hasta tres fotos distintas en una solicitud',async()=>{
 const files=[1,2,3].map(number=>({name:`rostro-${number}.webp`,size:100,type:'image/webp',lastModified:number}));
 assert.equal(petPhotoLimit('people'),3);assert.equal(petPhotoLimit('pets'),3);
 const draft={files,firstName:'Ana',email:'ana@example.com',phone:'123'};
 let uploads=0,payload;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async(_name,{body})=>{payload=body;return {data:{orderId:124}}}}};
 await sendPetRequest({draft,design:{id:'angelito',name:'Mi Angelito',customerPhotoSubject:'people'},selection:{variantId:42,model:'Polera',size:'M',color:'Blanco',side:'front'},supabase,uploadPhoto:async(_user,file)=>{uploads++;return `private/${file.name}`},onStatus:()=>{}});
 assert.equal(uploads,3);assert.deepEqual(payload.references.map(reference=>reference.name),files.map(file=>file.name));
 assert.equal(draft.orderId,124);
});
test('mascotas envía las fotos múltiples y conserva sus nombres',async()=>{
 const files=[1,2,3].map(number=>({name:`mascota-${number}.jpg`,size:100,type:'image/jpeg',lastModified:number}));
 const draft={files,firstName:'Ana',email:'ana@example.com',phone:'123'};let uploads=0,payload;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},functions:{invoke:async(_name,{body})=>{payload=body;return {data:{orderId:125}}}}};
 await sendPetRequest({draft,design:{id:'navidad',name:'Navidad',customerPhotoSubject:'pets'},selection:{variantId:42,model:'Polera',size:'M',color:'Rojo',side:'front'},supabase,uploadPhoto:async(_user,file)=>{uploads++;return `private/${file.name}`},onStatus:()=>{}});
 assert.equal(uploads,3);assert.deepEqual(payload.references.map(reference=>reference.name),files.map(file=>file.name));
});
test('la solicitud rechaza una cuarta foto antes de subir archivos',async()=>{
 const draft={files:[1,2,3,4].map(number=>({name:`rostro-${number}.jpg`,size:100,type:'image/jpeg',lastModified:number}))};
 let uploads=0;
 await assert.rejects(sendPetRequest({draft,design:{id:'angelito',name:'Mi Angelito',customerPhotoSubject:'people'},selection:{},supabase:{},uploadPhoto:async()=>{uploads++},onStatus:()=>{}}),/hasta 3 fotos/);
 assert.equal(uploads,0);
});
