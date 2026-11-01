import { CUSTOMER_IMAGE_POLICY, imageFileError, optimizeImage } from './image-optimization.js';

export function petPhotoError(file,subject='pets') {
  if (!file) return subject==='people'?'Sube una foto de la persona para continuar.':'Sube una foto de tu mascota para continuar.';
  const error = imageFileError(file, CUSTOMER_IMAGE_POLICY);
  return error === 'Selecciona una imagen.' ? 'La foto debe pesar entre 1 byte y 12 MB.' : error;
}

export function petSubmitLabel(step,purchaseMethod='cart') {
  if(step===2)return 'Revisar solicitud';
  return purchaseMethod==='whatsapp'?'Abrir WhatsApp para enviar':'Enviar solicitud';
}

export function petStepHtml({step,draft,selection,designName,subject='pets',purchaseMethod='cart',escapeText:e}) {
  const people=subject==='people';
  if(draft.orderId)return `<span class="eyebrow">SOLICITUD RECIBIDA</span><h2>${people?'Tu persona, protagonista.':'Tu mascota, protagonista.'}</h2><p>Solicitud #${e(String(draft.orderId))}</p><p>${draft.recovered?'La confirmación tuvo un problema, pero guardamos tu contacto, selección, foto e indicaciones para que el equipo te escriba. No necesitas enviarlas otra vez.':'Tu solicitud, foto e indicaciones ya fueron enviadas al equipo. No necesitas enviarlas otra vez. Te contactaremos para confirmar el diseño, precio y plazo.'}</p><button type="button" class="button dark ds-cta" data-pet-done>Listo</button>`;
  if(step===2){const photoInstruction=purchaseMethod==='whatsapp'?`<div class="pet-whatsapp-photo" role="note"><strong>La foto se envía por WhatsApp</strong><span>No subas archivos aquí. Al continuar abriremos WhatsApp para que adjuntes la foto directamente en el chat.</span></div>`:`<div><div class="detail-heading"><strong>${people?'La foto elegida':'Su mejor foto'}</strong><small>Obligatoria</small></div><p id="pet-photo-help">${people?'Rostro visible, buena luz y enfoque. Pide permiso antes de subir la foto de otra persona.':'Cara completa y ojos visibles. Buena luz y enfoque, sin filtros ni borrosidad.'}</p><label class="reference-dropzone pet-photo-dropzone"><input id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="pet-photo-help"><strong>${draft.file?'Cambiar foto':`↑ Subir foto ${people?'de la persona':'de mi mascota'}`}</strong><small>JPG, PNG o WebP · hasta 12 MB · se optimiza antes de enviar</small></label><p data-pet-file role="status">${draft.file?e(draft.file.name):people?'Una foto por solicitud.':'Una mascota por solicitud.'}</p></div>`;return `<span class="eyebrow">PASO 2 · ${people?'TU FOTO':'TU MASCOTA'}</span><h2>Ahora, presenta a tu protagonista.</h2><p>Adaptaremos ${e(designName)} con su foto.</p><section class="detail-block" data-pet-photo-block>${photoInstruction}</section><section class="detail-block" data-pet-notes-block><label class="field">${people?'Nombre de la persona (opcional)':'Nombre de tu mascota (opcional)'}<input data-pet-value="petName" maxlength="100" value="${e(draft.petName||'')}"></label><label class="field">Algo que debamos cuidar (opcional)<textarea data-pet-value="notes" maxlength="2000" placeholder="${people?'Ej. Mantener el fondo de la foto.':'Ej. Mantener la mancha sobre su ojo izquierdo.'}">${e(draft.notes||'')}</textarea></label></section>`;}
  const photoSummary=purchaseMethod==='whatsapp'?'La adjuntarás en WhatsApp':e(draft.file?.name||'');
  const sendNotice=purchaseMethod==='whatsapp'
    ?`Abriremos WhatsApp con el mensaje preparado. Allí debes adjuntar la foto ${people?'de la persona':'de tu mascota'} y pulsar Enviar; abrir el chat no envía nada.`
    :'Nada se envía automáticamente. Revisa la solicitud y pulsa «Enviar solicitud» al final; en ese momento guardaremos la foto de forma privada para el equipo.';
  return `<span class="eyebrow">PASO 3 · REVISAR Y ENVIAR</span><h2>Así será tu personalización.</h2><p class="pet-send-notice" role="note"><strong>El envío depende de ti.</strong><span>${sendNotice}</span></p><section data-pet-review><div class="order-summary"><div><span>Diseño</span><strong>${e(designName)}</strong></div><div><span>Producto</span><strong>${e(selection.model)}</strong></div><div><span>Talla / formato</span><strong>${e(selection.size)}</strong></div><div><span>Color</span><strong>${e(selection.color)}</strong></div><div><span>Estampado</span><strong>${selection.side==='back'?'Espalda':'Frente'}</strong></div><div><span>Foto</span><strong>${photoSummary}</strong></div></div><p>${purchaseMethod==='whatsapp'?`La foto queda pendiente hasta que la adjuntes y envíes en WhatsApp.`:'El precio final y el plazo se confirman con la propuesta, antes de pagar.'}</p></section><section class="detail-block" data-pet-contact-block><div class="detail-heading"><strong>¿Dónde te contactamos?</strong></div>${[['firstName','Tu nombre','text','name'],['email','Tu email','email','email'],['phone','Tu teléfono','tel','tel']].map(([key,label,type,autocomplete])=>`<label class="field">${label}<input data-pet-contact data-pet-value="${key}" type="${type}" autocomplete="${autocomplete}" required maxlength="254" value="${e(draft[key]||'')}"></label>`).join('')}</section><p data-pet-status role="status" aria-live="polite"></p>`;
}

export function bindPetStep(container,draft,onUpdate=()=>{}) {
  container.querySelectorAll('[data-pet-value]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.petValue]=input.value}));
  container.querySelector('#pet-photo')?.addEventListener('change',async event=>{
    const file=event.target.files[0],status=container.querySelector('[data-pet-file]');
    if(!file)return;
    const error=petPhotoError(file);if(error){status.textContent=error;return}
    try{draft.optimizing=true;onUpdate();status.textContent='Optimizando foto…';const optimized=await optimizeImage(file,{policy:CUSTOMER_IMAGE_POLICY,baseName:file.name});draft.file=optimized.file;draft.uploaded=null;draft.attempt=null;status.textContent=`${optimized.file.name} · optimizada`;container.querySelector('.pet-photo-dropzone strong').textContent='Cambiar foto'}
    catch(error){status.textContent=error.message||'No pudimos abrir esta imagen. Elige otra foto.'}
    finally{draft.optimizing=false;onUpdate()}
  });
}

export async function sendPetRequest({draft,design,selection,supabase,uploadPhoto,onStatus}) {
  const people=design.customerPhotoSubject==='people';
  const error=petPhotoError(draft.file,design.customerPhotoSubject);if(error)throw new Error(error);
  const customer={firstName:draft.firstName.trim(),email:draft.email.trim(),phone:draft.phone.trim()};
  const idea=`Personalizar ${design.name} con ${people?'la persona':'la mascota'} de la foto adjunta.\nProducto: ${selection.model}. Talla/formato: ${selection.size}. Color: ${selection.color}. Estampado: ${selection.side==='back'?'espalda':'frente'}.\n${people?'Persona':'Mascota'}: ${draft.petName?.trim()||'Sin nombre indicado'}.\nIndicaciones: ${draft.notes?.trim()||'Conservar el estilo del diseño elegido.'}`;
  const signature=JSON.stringify([design.id,selection,idea,customer,draft.file.name,draft.file.size,draft.file.lastModified]);
  if(draft.attempt?.signature!==signature)draft.attempt={signature,id:crypto.randomUUID()};
  let {data:{session}}=await supabase.auth.getSession();
  if(!session){const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session}
  if(!session)throw new Error('No pudimos iniciar la solicitud. Intenta nuevamente.');
  onStatus(people?'Subiendo la foto de la persona…':'Subiendo la foto de tu mascota…');
  if(!draft.uploaded||draft.uploaded.userId!==session.user.id)draft.uploaded={path:await uploadPhoto(session.user.id,draft.file),userId:session.user.id};
  onStatus('Enviando tu personalización…');
  const payload={requestId:draft.attempt.id,catalogDesignSlug:design.id,idea,customer,productSelection:{variantId:selection.variantId,modelCode:selection.modelCode,model:selection.model,size:selection.size,color:selection.color,colorHex:selection.colorHex,side:selection.side},references:[{name:draft.file.name,path:draft.uploaded.path}]};
  const primary=await supabase.functions.invoke('create-design-request',{body:payload});
  if(primary.data?.orderId){draft.orderId=primary.data.orderId;draft.recovered=Boolean(primary.data.recovered);return}
  let primaryMessage=primary.data?.error||primary.error?.message||'No pudimos confirmar el envío.';
  if(primary.error?.context?.json){try{const context=await primary.error.context.json();primaryMessage=context?.error||primaryMessage}catch{}}
  onStatus('Guardando tus datos para que podamos contactarte…');
  const recovery=await supabase.functions.invoke('create-design-request',{body:{...payload,recovery:true,recoveryReason:String(primaryMessage).slice(0,300)}});
  if(recovery.data?.orderId){draft.orderId=recovery.data.orderId;draft.recovered=true;return}
  throw new Error('No pudimos confirmar el envío todavía. Tu selección y foto siguen aquí; vuelve a intentarlo o escríbenos por WhatsApp.');
}
