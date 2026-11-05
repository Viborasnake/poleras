import { CUSTOMER_IMAGE_POLICY, imageFileError, optimizeImage } from './image-optimization.js';
import {requestCaptchaToken,signInAnonymouslyWithCaptcha} from './auth-captcha.js';

export function petPhotoError(file,subject='pets') {
  if(Array.isArray(file))file=file[0];
  if (!file) return subject==='people'?'Sube una foto de la persona para continuar.':'Sube una foto de tu mascota para continuar.';
  const error = imageFileError(file, CUSTOMER_IMAGE_POLICY);
  return error === 'Selecciona una imagen.' ? 'La foto debe pesar entre 1 byte y 12 MB.' : error;
}

export const petPhotoLimit=subject=>subject==='people'?3:1;
const petFiles=draft=>draft.files?.length?draft.files:draft.file?[draft.file]:[];
const escapeName=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function petSubmitLabel(step,purchaseMethod='cart') {
  if(step===2)return 'Revisar solicitud';
  return purchaseMethod==='whatsapp'?'Abrir WhatsApp para enviar':'Enviar solicitud';
}

export function petStepHtml({step,draft,selection,designName,subject='pets',purchaseMethod='cart',escapeText:e}) {
  const people=subject==='people';
  if(draft.orderId)return `<span class="eyebrow">SOLICITUD RECIBIDA</span><h2>${people?'Tu persona, protagonista.':'Tu mascota, protagonista.'}</h2><p>Solicitud #${e(String(draft.orderId))}</p><p>${draft.recovered?'La confirmación tuvo un problema, pero guardamos tu contacto, selección, foto e indicaciones para que el equipo te escriba. No necesitas enviarlas otra vez.':'Tu solicitud, foto e indicaciones ya fueron enviadas al equipo. No necesitas enviarlas otra vez. Te contactaremos para confirmar el diseño, precio y plazo.'}</p><button type="button" class="button dark ds-cta" data-pet-done>Listo</button>`;
  if(step===2){const files=petFiles(draft),limit=petPhotoLimit(subject);const photoInstruction=purchaseMethod==='whatsapp'?`<div class="pet-whatsapp-photo" role="note"><strong>La foto se envía por WhatsApp</strong><span>No subas archivos aquí. Al continuar abriremos WhatsApp para que adjuntes la foto directamente en el chat.</span></div>`:`<div><div class="detail-heading"><strong>${people?'Fotos para el diseño':'Su mejor foto'}</strong><small>Obligatoria</small></div><p id="pet-photo-help">${people?'Puedes subir una foto por rostro, hasta tres. Procura buena luz y enfoque, y pide permiso antes de subir fotos de otras personas.':'Cara completa y ojos visibles. Buena luz y enfoque, sin filtros ni borrosidad.'}</p><label class="reference-dropzone pet-photo-dropzone"><input id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="pet-photo-help" ${people?'multiple':''} ${files.length>=limit?'disabled':''}><strong>${files.length>=limit?'Límite de fotos alcanzado':`↑ Subir foto ${people?'de las personas':'de mi mascota'}`}</strong><small>JPG, PNG o WebP · hasta 12 MB · se optimiza antes de enviar</small></label><p data-pet-file role="status">${files.length?`${files.length} de ${limit} fotos listas`:people?'Hasta tres fotos por solicitud.':'Una mascota por solicitud.'}</p>${files.length?`<ul class="pet-photo-list">${files.map((file,index)=>`<li><span>${e(file.name)}</span><button type="button" data-remove-pet-photo="${index}" aria-label="Quitar ${e(file.name)}">Quitar</button></li>`).join('')}</ul>`:''}</div>`;return `<span class="eyebrow">PASO 2 · ${people?'TU FOTO':'TU MASCOTA'}</span><h2>${people?'Ahora, presenta a tus protagonistas.':'Ahora, presenta a tu protagonista.'}</h2><p>Adaptaremos ${e(designName)} con ${people?'sus fotos':'su foto'}.</p><section class="detail-block" data-pet-photo-block>${photoInstruction}</section><section class="detail-block" data-pet-notes-block><label class="field">${people?'Nombre de la persona (opcional)':'Nombre de tu mascota (opcional)'}<input data-pet-value="petName" maxlength="100" value="${e(draft.petName||'')}"></label><label class="field">Algo que debamos cuidar (opcional)<textarea data-pet-value="notes" maxlength="2000" placeholder="${people?'Ej. Mantener el fondo de la foto.':'Ej. Mantener la mancha sobre su ojo izquierdo.'}">${e(draft.notes||'')}</textarea></label></section>`;}
  const photoSummary=purchaseMethod==='whatsapp'?'La adjuntarás en WhatsApp':e(petFiles(draft).map(file=>file.name).join(', '));
  const sendNotice=purchaseMethod==='whatsapp'
    ?`Abriremos WhatsApp con el mensaje preparado. Allí debes adjuntar la foto ${people?'de la persona':'de tu mascota'} y pulsar Enviar; abrir el chat no envía nada.`
    :'Nada se envía automáticamente. Revisa la solicitud y pulsa «Enviar solicitud» al final; en ese momento guardaremos la foto de forma privada para el equipo.';
  return `<span class="eyebrow">PASO 3 · REVISAR Y ENVIAR</span><h2>Así será tu personalización.</h2><p class="pet-send-notice" role="note"><strong>El envío depende de ti.</strong><span>${sendNotice}</span></p><section data-pet-review><div class="order-summary"><div><span>Diseño</span><strong>${e(designName)}</strong></div><div><span>Producto</span><strong>${e(selection.model)}</strong></div><div><span>Talla / formato</span><strong>${e(selection.size)}</strong></div><div><span>Color</span><strong>${e(selection.color)}</strong></div><div><span>Estampado</span><strong>${selection.side==='back'?'Espalda':'Frente'}</strong></div><div><span>Foto</span><strong>${photoSummary}</strong></div></div><p>${purchaseMethod==='whatsapp'?`La foto queda pendiente hasta que la adjuntes y envíes en WhatsApp.`:'El precio final y el plazo se confirman con la propuesta, antes de pagar.'}</p></section><section class="detail-block" data-pet-contact-block><div class="detail-heading"><strong>¿Dónde te contactamos?</strong></div>${[['firstName','Tu nombre','text','name'],['email','Tu email','email','email'],['phone','Tu teléfono','tel','tel']].map(([key,label,type,autocomplete])=>`<label class="field">${label}<input data-pet-contact data-pet-value="${key}" type="${type}" autocomplete="${autocomplete}" required maxlength="254" value="${e(draft[key]||'')}"></label>`).join('')}</section><p data-pet-status role="status" aria-live="polite"></p>`;
}

export function bindPetStep(container,draft,onUpdate=()=>{},subject='pets') {
  container.querySelectorAll('[data-pet-value]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.petValue]=input.value}));
  const renderFiles=()=>{
    const files=petFiles(draft),limit=petPhotoLimit(subject),status=container.querySelector('[data-pet-file]');
    if(!status)return;
    status.textContent=`${files.length} de ${limit} fotos listas`;
    container.querySelector('.pet-photo-list')?.remove();
    if(files.length)status.insertAdjacentHTML('afterend',`<ul class="pet-photo-list">${files.map((file,index)=>`<li><span>${escapeName(file.name)}</span><button type="button" data-remove-pet-photo="${index}" aria-label="Quitar ${escapeName(file.name)}">Quitar</button></li>`).join('')}</ul>`);
    const input=container.querySelector('#pet-photo');if(input){input.disabled=files.length>=limit;input.value='';const label=input.closest('label')?.querySelector('strong');if(label)label.textContent=files.length>=limit?'Límite de fotos alcanzado':`↑ Subir foto ${subject==='people'?'de la persona':'de mi mascota'}`}
  };
  container.querySelector('[data-pet-photo-block]')?.addEventListener('click',event=>{const button=event.target.closest('[data-remove-pet-photo]');if(!button)return;
    draft.files=petFiles(draft).filter((_,index)=>index!==Number(button.dataset.removePetPhoto));draft.file=draft.files[0]||null;draft.uploaded=null;draft.attempt=null;onUpdate();
    renderFiles();
  });
  container.querySelector('#pet-photo')?.addEventListener('change',async event=>{
    const incoming=[...event.target.files],status=container.querySelector('[data-pet-file]');
    if(!incoming.length)return;
    try{draft.optimizing=true;onUpdate();let invalidFile='';for(const file of incoming.slice(0,petPhotoLimit(subject)-petFiles(draft).length)){
      const error=petPhotoError(file,subject);if(error){invalidFile=error;continue}
      status.textContent=`Optimizando ${file.name}…`;const optimized=await optimizeImage(file,{policy:CUSTOMER_IMAGE_POLICY,baseName:file.name});
      draft.files=[...petFiles(draft),optimized.file];draft.file=draft.files[0];draft.uploaded=null;draft.attempt=null;
    }renderFiles();if(invalidFile)status.textContent=invalidFile}
    catch(error){status.textContent=error.message||'No pudimos abrir esta imagen. Elige otra foto.'}
    finally{draft.optimizing=false;onUpdate()}
  });
}

export async function sendPetRequest({draft,design,selection,supabase,uploadPhoto,onStatus}) {
  const people=design.customerPhotoSubject==='people';
  const files=petFiles(draft),error=petPhotoError(files,design.customerPhotoSubject);if(error)throw new Error(error);
  if(files.length>petPhotoLimit(design.customerPhotoSubject))throw new Error(`Puedes enviar hasta ${petPhotoLimit(design.customerPhotoSubject)} fotos en esta solicitud.`);
  for(const file of files){const fileError=petPhotoError(file,design.customerPhotoSubject);if(fileError)throw new Error(fileError)}
  const customer={firstName:draft.firstName.trim(),email:draft.email.trim(),phone:draft.phone.trim()};
  const idea=`Personalizar ${design.name} con ${people?'la persona':'la mascota'} de la foto adjunta.\nProducto: ${selection.model}. Talla/formato: ${selection.size}. Color: ${selection.color}. Estampado: ${selection.side==='back'?'espalda':'frente'}.\n${people?'Persona':'Mascota'}: ${draft.petName?.trim()||'Sin nombre indicado'}.\nIndicaciones: ${draft.notes?.trim()||'Conservar el estilo del diseño elegido.'}`;
  const signature=JSON.stringify([design.id,selection,idea,customer,files.map(file=>[file.name,file.size,file.lastModified])]);
  if(draft.attempt?.signature!==signature)draft.attempt={signature,id:crypto.randomUUID()};
  let {data:{session}}=await supabase.auth.getSession();
  if(!session){const result=await signInAnonymouslyWithCaptcha(supabase);if(result.error)throw result.error;session=result.data.session}
  if(!session)throw new Error('No pudimos iniciar la solicitud. Intenta nuevamente.');
  onStatus(people?'Subiendo la foto de la persona…':'Subiendo la foto de tu mascota…');
  if(!Array.isArray(draft.uploaded)||draft.uploaded.some(item=>item.userId!==session.user.id))draft.uploaded=[];
  for(let index=draft.uploaded.length;index<files.length;index++)draft.uploaded.push({path:await uploadPhoto(session.user.id,files[index]),userId:session.user.id});
  onStatus('Enviando tu personalización…');
  const payload={requestId:draft.attempt.id,catalogDesignSlug:design.id,idea,customer,productSelection:{variantId:selection.variantId,modelCode:selection.modelCode,model:selection.model,size:selection.size,color:selection.color,colorHex:selection.colorHex,side:selection.side},references:files.map((file,index)=>({name:file.name,path:draft.uploaded[index].path}))};
  const primary=await supabase.functions.invoke('create-design-request',{body:{...payload,captchaToken:await requestCaptchaToken()}});
  if(primary.data?.orderId){draft.orderId=primary.data.orderId;draft.recovered=Boolean(primary.data.recovered);return}
  let primaryMessage=primary.data?.error||primary.error?.message||'No pudimos confirmar el envío.';
  if(primary.error?.context?.json){try{const context=await primary.error.context.json();primaryMessage=context?.error||primaryMessage}catch{}}
  if(/verificaci[oó]n de seguridad|verificar tu solicitud/i.test(primaryMessage))throw new Error(primaryMessage);
  onStatus('Guardando tus datos para que podamos contactarte…');
  const recovery=await supabase.functions.invoke('create-design-request',{body:{...payload,recovery:true,recoveryReason:String(primaryMessage).slice(0,300),captchaToken:await requestCaptchaToken()}});
  if(recovery.data?.orderId){draft.orderId=recovery.data.orderId;draft.recovered=true;return}
  throw new Error('No pudimos confirmar el envío todavía. Tu selección y foto siguen aquí; vuelve a intentarlo o escríbenos por WhatsApp.');
}
