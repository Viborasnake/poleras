import { CUSTOMER_IMAGE_POLICY, imageFileError, optimizeImage } from './image-optimization.js';
import {requestCaptchaToken,signInAnonymouslyWithCaptcha} from './auth-captcha.js';
import {quoteEmailFollowUp,receiptEmailFeedback} from './commerce-feedback.js';

export function petPhotoError(file,subject='pets') {
  if(Array.isArray(file)){
    if(!file.length)return petPhotoError(null,subject);
    for(const entry of file){const error=petPhotoError(entry,subject);if(error)return error}
    return '';
  }
  if (!file) return subject==='people'?'Sube una foto de la persona para continuar.':'Sube una foto de tu mascota para continuar.';
  const error = imageFileError(file, CUSTOMER_IMAGE_POLICY);
  return error === 'Selecciona una imagen.' ? 'La foto debe pesar entre 1 byte y 12 MB.' : error;
}

export const PET_PHOTO_LIMIT=3;
export const petPhotoLimit=()=>PET_PHOTO_LIMIT;
export const petFiles=(draft={})=>draft.files?.length?draft.files:draft.file?[draft.file]:[];
const escapeName=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const petReferenceThumbs=files=>files.map((file,index)=>`<div class="reference-thumb pet-reference-thumb"><span class="pet-file-preview" aria-hidden="true">IMG</span><span title="${escapeName(file.name)}">${escapeName(file.name)}</span><button type="button" data-remove-pet-photo="${index}" aria-label="Quitar ${escapeName(file.name)}">×</button></div>`).join('');
const petReferencesMarkup=({files,limit,subject})=>{const people=subject==='people';return `<div class="custom-references pet-photo-references"><div class="custom-references-heading"><strong>Fotos para el diseño <span>Obligatorias</span></strong><small>${people?'Puedes usar hasta tres fotos, una por rostro. Pide permiso antes de subir fotos de otras personas.':'Puedes usar hasta tres fotos de tu mascota. Procura mostrar la cara completa, los ojos visibles y buena luz, sin filtros ni borrosidad.'}</small></div><label class="reference-dropzone pet-photo-dropzone ${files.length>=limit?'is-full':''}"><input id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="pet-photo-help" multiple ${files.length>=limit?'disabled':''}><span>＋</span><strong>${files.length>=limit?'Límite de fotos alcanzado':'Adjuntar fotos'}</strong><small>${files.length} de ${limit} fotos · JPG, PNG o WebP · hasta 12 MB cada una · se optimizan antes de enviar${files.length>=limit?' · Quita una para agregar otra':''}</small></label><p id="pet-photo-help" data-pet-file role="status">${files.length?`${files.length} de ${limit} fotos listas`:'Aún no has adjuntado fotos.'}</p>${files.length?`<div class="reference-thumbs pet-reference-thumbs">${petReferenceThumbs(files)}</div>`:''}</div>`};

export function petSubmitLabel(step,purchaseMethod='cart') {
  if(step===2)return 'Revisar solicitud';
  return purchaseMethod==='whatsapp'?'Abrir WhatsApp para enviar':'Enviar solicitud';
}

export function petRequestIdentity(draft,subject){
  const customer = draft.firstName?.trim();
  const name = draft.petName?.trim();
  return [
    customer && `A nombre de ${customer}`,
    name && `${subject==='people'?'Nombre de la persona':'Nombre de la mascota'} · ${name}`
  ].filter(Boolean);
}

export function petStepHtml({step,draft,selection,designName,subject='pets',purchaseMethod='cart',escapeText:e}) {
  const people=subject==='people';
  if(draft.orderId){
    const {model,size,sizeLabel,color,preliminaryPrice}=draft.submittedSelection||selection;
    const contents=[[designName,model,sizeLabel||size,color].filter(Boolean).join(' · '),...petRequestIdentity(draft,subject),
      draft.email?.trim()&&`Correo de contacto · ${draft.email.trim()}`,draft.phone?.trim()&&`Teléfono · ${draft.phone.trim()}`,...petFiles(draft).map(file=>`Foto adjunta · ${file.name}`),
      draft.notes?.trim()&&'Tus indicaciones para el diseño'].filter(Boolean);
    const emailNote=receiptEmailFeedback(draft.receipt,draft.email?.trim(),'Los datos de la solicitud');
    return `<span class="eyebrow">COMPROBANTE DE SOLICITUD</span><h2 data-request-receipt tabindex="-1">Recibimos tu personalización.</h2><p><strong>Solicitud #${e(String(draft.orderId))}</strong></p><ul>${contents.map(item=>`<li>${e(item)}</li>`).join('')}</ul><p><strong>Precio preliminar · ${e(preliminaryPrice||'Por confirmar')}</strong></p><p>${draft.recovered?'Tu solicitud quedó guardada para revisión. No necesitas volver a enviar la solicitud. ':''}${e(quoteEmailFollowUp(draft.email?.trim()))} Puedes seguir la solicitud en «Mis pedidos» con ese mismo correo.</p>${emailNote?`<p>${e(emailNote)}</p>`:''}<button type="button" class="button dark ds-cta" data-pet-done>Entendido</button>`;
  }
  const price=selection.purchasePrice;
  const purchaseSummary=price?`<div class="order-summary" aria-label="Precio de tu personalización"><div><span>Producto base</span><strong>${e(price.base)}</strong></div>${price.print?`<div><span>Estampados adicionales</span><strong>${e(price.print)}</strong></div>`:''}<div><span>Revisión técnica de fotos</span><strong>${e(price.review)}</strong></div><div class="order-summary-total"><span>Subtotal sin despacho</span><strong>${e(price.subtotal)}</strong></div></div>`:'';
  if(step===2){const files=petFiles(draft),limit=petPhotoLimit(subject);const photoInstruction=purchaseMethod==='whatsapp'?`<div class="pet-whatsapp-photo" role="note"><strong>Las fotos se envían por WhatsApp</strong><span>No subas archivos aquí. Al continuar abriremos WhatsApp para que adjuntes las fotos directamente en el chat.</span></div>`:petReferencesMarkup({files,limit,subject});return `<span class="eyebrow">PASO 2 · ${people?'TUS FOTOS':'TU MASCOTA'}</span><h2>${people?'Ahora, presenta a tus protagonistas.':'Ahora, presenta a tu protagonista.'}</h2><p>Adaptaremos ${e(designName)} con ${people?'sus fotos':'tus fotos'}.</p><section class="detail-block" data-pet-photo-block>${photoInstruction}</section><section class="detail-block" data-pet-notes-block><label class="field">${people?'Nombre de la persona (opcional)':'Nombre de tu mascota (opcional)'}<input data-pet-value="petName" maxlength="100" value="${e(draft.petName||'')}"></label><label class="field">Algo que debamos cuidar (opcional)<textarea data-pet-value="notes" maxlength="2000" placeholder="${people?'Ej. Mantener el fondo de la foto.':'Ej. Mantener la mancha sobre su ojo izquierdo.'}">${e(draft.notes||'')}</textarea></label></section>${purchaseSummary}`;}
  const photoSummary=purchaseMethod==='whatsapp'?'Las adjuntarás en WhatsApp':e(petFiles(draft).map(file=>file.name).join(', '));
  const sendNotice=purchaseMethod==='whatsapp'
    ?`Abriremos WhatsApp con el mensaje preparado. Allí debes adjuntar las fotos ${people?'de las personas':'de tu mascota'} y pulsar Enviar; abrir el chat no envía nada.`
    :'Nada se envía automáticamente. Revisa la solicitud y pulsa «Enviar solicitud» al final; en ese momento guardaremos las fotos de forma privada para el equipo.';
  return `<span class="eyebrow">PASO 3 · REVISAR Y ENVIAR</span><h2>Así será tu personalización.</h2><p class="pet-send-notice" role="note"><strong>El envío depende de ti.</strong><span>${sendNotice}</span></p><section data-pet-review><div class="order-summary"><div><span>Diseño</span><strong>${e(designName)}</strong></div><div><span>Producto</span><strong>${e(selection.model)}</strong></div><div><span>Talla / formato</span><strong>${e(selection.size)}</strong></div><div><span>Color</span><strong>${e(selection.color)}</strong></div><div><span>Estampado</span><strong>${selection.side==='back'?'Espalda':'Frente'}</strong></div><div><span>Fotos</span><strong>${photoSummary}</strong></div>${draft.petName?.trim()?`<div><span>${people?'Nombre de la persona':'Nombre de la mascota'}</span><strong>${e(draft.petName.trim())}</strong></div>`:''}<div><span>A nombre de</span><strong data-pet-review-name></strong></div><div><span>Precio preliminar</span><strong>${e(selection.preliminaryPrice||'Por confirmar')}</strong></div></div><p>${purchaseMethod==='whatsapp'?`Las fotos quedan pendientes hasta que las adjuntes y envíes en WhatsApp.`:'El precio final y el plazo se confirman con la propuesta, antes de pagar.'}</p></section><section class="detail-block" data-pet-contact-block><div class="detail-heading"><strong>¿Dónde te contactamos?</strong></div>${[['firstName','Tu nombre completo','text','name'],['email','Tu email','email','email'],['phone','Tu teléfono','tel','tel']].map(([key,label,type,autocomplete])=>`<label class="field">${label}<input data-pet-contact data-pet-value="${key}" type="${type}" autocomplete="${autocomplete}" required maxlength="254" value="${e(draft[key]||'')}"></label>`).join('')}</section><p data-pet-status role="status" aria-live="polite"></p>`;
}

export function bindPetStep(container,draft,onUpdate=()=>{},subject='pets') {
  container.querySelectorAll('[data-pet-value]').forEach(input=>input.addEventListener('input',()=>{draft[input.dataset.petValue]=input.value}));
  const renderFiles=()=>{
    const files=petFiles(draft),limit=petPhotoLimit(subject),status=container.querySelector('[data-pet-file]');
    if(!status)return;
    status.textContent=`${files.length} de ${limit} fotos listas`;
    container.querySelector('.pet-reference-thumbs')?.remove();
    if(files.length)status.insertAdjacentHTML('afterend',`<div class="reference-thumbs pet-reference-thumbs">${petReferenceThumbs(files)}</div>`);
    const input=container.querySelector('#pet-photo');if(input){input.disabled=files.length>=limit;input.value='';const label=input.closest('label')?.querySelector('strong');if(label)label.textContent=files.length>=limit?'Límite de fotos alcanzado':'Adjuntar fotos';const dropzone=input.closest('.reference-dropzone');dropzone?.classList.toggle('is-full',files.length>=limit);const detail=dropzone?.querySelector('small');if(detail)detail.textContent=`${files.length} de ${limit} fotos · JPG, PNG o WebP · hasta 12 MB cada una · se optimizan antes de enviar${files.length>=limit?' · Quita una para agregar otra':''}`}
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
  const idea=`Personalizar ${design.name} con ${people?'la persona':'la mascota'} de las fotos adjuntas.\nProducto: ${selection.model}. Talla/formato: ${selection.size}. Color: ${selection.color}. Estampado: ${selection.side==='back'?'espalda':'frente'}.\n${people?'Persona':'Mascota'}: ${draft.petName?.trim()||'Sin nombre indicado'}.\nIndicaciones: ${draft.notes?.trim()||'Conservar el estilo del diseño elegido.'}`;
  const signature=JSON.stringify([design.id,selection,idea,customer,files.map(file=>[file.name,file.size,file.lastModified])]);
  if(draft.attempt?.signature!==signature)draft.attempt={signature,id:crypto.randomUUID()};
  let {data:{session}}=await supabase.auth.getSession();
  if(!session){const result=await signInAnonymouslyWithCaptcha(supabase);if(result.error)throw result.error;session=result.data.session}
  if(!session)throw new Error('No pudimos iniciar la solicitud. Intenta nuevamente.');
  onStatus(people?'Subiendo las fotos de las personas…':'Subiendo las fotos de tu mascota…');
  if(!Array.isArray(draft.uploaded)||draft.uploaded.some(item=>item.userId!==session.user.id))draft.uploaded=[];
  for(let index=draft.uploaded.length;index<files.length;index++)draft.uploaded.push({path:await uploadPhoto(session.user.id,files[index]),userId:session.user.id});
  onStatus('Enviando tu personalización…');
  const payload={requestId:draft.attempt.id,catalogDesignSlug:design.id,idea,customer,productSelection:{variantId:selection.variantId,modelCode:selection.modelCode,model:selection.model,size:selection.size,color:selection.color,colorHex:selection.colorHex,side:selection.side},references:files.map((file,index)=>({name:file.name,path:draft.uploaded[index].path}))};
  const primary=await supabase.functions.invoke('create-design-request',{body:{...payload,captchaToken:await requestCaptchaToken()}});
  if(!primary.error&&primary.data?.orderId){draft.orderId=primary.data.orderId;draft.recovered=Boolean(primary.data.recovered);draft.receipt=primary.data.receipt;draft.submittedSelection=selection;return}
  let primaryMessage=primary.data?.error||primary.error?.message||'No pudimos confirmar el envío.';
  if(primary.error?.context?.json){try{const context=await primary.error.context.json();primaryMessage=context?.error||primaryMessage}catch{}}
  if(/verificaci[oó]n de seguridad|verificar tu solicitud/i.test(primaryMessage))throw new Error(primaryMessage);
  onStatus('Guardando tus datos para que podamos contactarte…');
  const recovery=await supabase.functions.invoke('create-design-request',{body:{...payload,recovery:true,recoveryReason:String(primaryMessage).slice(0,300),captchaToken:await requestCaptchaToken()}});
  if(!recovery.error&&recovery.data?.orderId){draft.orderId=recovery.data.orderId;draft.recovered=true;draft.receipt=recovery.data.receipt;draft.submittedSelection=selection;return}
  throw new Error('El envío de tu personalización quedó sin confirmar.');
}
