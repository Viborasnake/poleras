import {mountFormDisclosure,fieldSummary,conciseSummary} from './form-disclosure.js';
import {petPhotoError} from './pet-personalization.js';

function section(node){const wrapper=document.createElement('section');wrapper.className='public-form-block';wrapper.append(node);return wrapper;}
function groupBefore(node){const group=document.createElement('div');group.className='public-form-disclosure';node.before(group);return group;}
function reviewBefore(button,container){const review=document.createElement('section');review.className='public-form-review';const heading=document.createElement('h3');heading.tabIndex=-1;heading.textContent='Revisa antes de continuar';const list=document.createElement('dl');list.className='public-form-review-list';review.append(heading,list);if(button.parentElement===container)button.before(review);else container.append(review);return {review,list};}
function setReview(list,rows){list.replaceChildren();for(const [label,value] of rows){const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=String(value||'Sin información adicional');row.append(term,description);list.append(row)}}
function mount({group,steps,...rest}){steps.forEach(step=>group.append(step.node));return mountFormDisclosure({container:group,steps,...rest});}

export function mountIdeaFlow({container,button,state,disclosure,purchaseMethod}){
 const idea=container.querySelector('#custom-idea'),contact=container.querySelector('.custom-request-contact');if(!idea||!contact)return null;
 const refs=container.querySelector('.custom-references,.whatsapp-file-note'),group=groupBefore(idea.closest('label'));
 const ideaNode=section(idea.closest('label')),refsNode=section(refs),contactNode=section(contact);
 const {review,list}=reviewBefore(button,container);
 return mount({group,state:disclosure,steps:[
  {id:'idea',title:'Tu idea',node:ideaNode,value:()=>idea.value.trim(),summary:()=>conciseSummary(idea.value.trim()),valid:()=>idea.value.trim().length>=10,error:'Cuéntanos tu idea con al menos 10 caracteres.'},
  {id:'references',title:purchaseMethod==='whatsapp'?'Referencias por WhatsApp':'Referencias opcionales',node:refsNode,value:()=>purchaseMethod==='whatsapp'?'whatsapp':JSON.stringify(state.references.map(file=>[file.name,file.file?.size,file.file?.lastModified])),summary:()=>purchaseMethod==='whatsapp'?'Las adjuntarás en WhatsApp':state.references.length?`${state.references.length} referencia(s): ${state.references.map(file=>file.name).join(', ')}`:'Sin referencias',valid:()=>!state.referencesBusy&&state.references.length<=5},
  {id:'contact',title:'Contacto',node:contactNode},
 ],finalButton:button,review,reviewOnFinal:true,prefix:'idea-flow',busy:()=>Boolean(state.referencesBusy||state.publicRequestBusy),onChange:result=>{button.textContent=result.complete?(purchaseMethod==='whatsapp'?'Solicitar por WhatsApp':'Enviar mi idea'):'Revisar solicitud';setReview(list,[['Tu idea',idea.value.trim()],['Referencias',purchaseMethod==='whatsapp'?'Pendientes de adjuntar en WhatsApp':`${state.references.length} archivo(s)`],['Contacto',fieldSummary(contactNode,{limit:Infinity})],['Siguiente paso','El equipo revisará tu solicitud y te contactará con una propuesta.']])}});
}

export function mountPetFlow({container,button,draft,step,disclosure,purchaseMethod}){
 if(draft.orderId)return null;
 if(step===2){
  const photo=container.querySelector('[data-pet-photo-block]'),notes=container.querySelector('[data-pet-notes-block]'),group=groupBefore(photo);
  return mount({group,state:disclosure,steps:[
   {id:'photo',title:purchaseMethod==='whatsapp'?'Foto por WhatsApp':'Fotos de tu personalización',node:photo,value:()=>purchaseMethod==='whatsapp'?'whatsapp':JSON.stringify((draft.files?.length?draft.files:draft.file?[draft.file]:[]).map(file=>[file.name,file.size,file.lastModified])),summary:()=>purchaseMethod==='whatsapp'?'Las adjuntarás en WhatsApp':(draft.files?.length?draft.files:draft.file?[draft.file]:[]).map(file=>file.name).join(', ')||'Foto pendiente',valid:()=>purchaseMethod==='whatsapp'||!draft.optimizing&&!petPhotoError(draft.files?.length?draft.files:draft.file),error:'Sube una foto válida y espera a que termine de optimizarse.'},
   {id:'notes',title:'Nombre e indicaciones opcionales',node:notes},
  ],finalButton:button,prefix:'pet-photo-flow',busy:()=>Boolean(draft.optimizing||draft.busy)});
 }
 const contact=container.querySelector('[data-pet-contact-block]'),review=container.querySelector('[data-pet-review]'),group=groupBefore(contact);
 container.append(review);
 return mount({group,state:disclosure,steps:[{id:'contact',title:'Contacto',node:contact}],review,finalButton:button,prefix:'pet-contact-flow',busy:()=>Boolean(draft.busy)});
}

export function mountWhatsAppFlow({container,button,disclosure,busy=()=>false}){
 const contact=container.querySelector('.whatsapp-contact-fields');if(!contact)return null;
 const group=groupBefore(contact),node=section(contact);
 const review=document.createElement('section');review.className='public-form-review';
 container.querySelectorAll('.order-summary,.mockup-note,.review-chip').forEach(element=>review.append(element));container.append(review);
 return mount({group,state:disclosure,steps:[{id:'contact',title:'Contacto',node}],finalButton:button,review,prefix:'whatsapp-contact-flow',busy});
}

export function mountCheckoutFlow({container,button,state,disclosure,regions,communesForRegion,samePlace,onConfirm=()=>{}}){
 const contact=container.querySelector('.fulfillment-contact'),fulfillment=container.querySelector('.fulfillment-picker'),details=container.querySelector('.fulfillment-details');
 if(!contact||!fulfillment)return null;
 contact.querySelector('#finish-contact-edit')?.remove();
 const group=groupBefore(fulfillment),contactNode=section(contact),fulfillmentNode=section(fulfillment);
 const steps=[{id:'contact',title:'Datos de contacto',node:contactNode},{id:'fulfillment',title:'Despacho o retiro',node:fulfillmentNode,choice:true,value:()=>state.fulfillment,summary:()=>state.fulfillment==='pickup'?'Retiro coordinado · Gratis':'Despacho a domicilio',valid:()=>['delivery','pickup'].includes(state.fulfillment)}];
 if(state.fulfillment==='delivery'){
  const fields=details.querySelector('.delivery-fields'),region=fields.querySelector('#delivery-region').closest('label'),commune=fields.querySelector('#delivery-commune').closest('label');
  steps.push({id:'region',title:'Región',node:section(region),value:()=>state.region,summary:()=>state.region,valid:()=>regions.some(name=>samePlace(name,state.region)),error:'Selecciona una región de la lista.'});
  steps.push({id:'commune',title:'Comuna',node:section(commune),value:()=>JSON.stringify([state.region,state.commune]),summary:()=>state.commune,valid:()=>communesForRegion(state.region).some(name=>samePlace(name,state.commune)),error:'Selecciona una comuna de la región elegida.'});
  const optional=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Agregar departamento o indicaciones (opcional)';optional.append(summary);
  fields.querySelector('#delivery-address-extra')?.closest('label')&&optional.append(fields.querySelector('#delivery-address-extra').closest('label'));
  fields.querySelector('#delivery-notes')?.closest('label')&&optional.append(fields.querySelector('#delivery-notes').closest('label'));
  fields.append(optional);
  steps.push({id:'address',title:'Dirección de entrega',node:section(fields),value:()=>JSON.stringify([state.region,state.commune,state.address,state.addressExtra,state.deliveryNotes]),summary:()=>[state.address,state.addressExtra,state.deliveryNotes].filter(Boolean).join(' · ')});
 }
 const review=document.createElement('section');review.className='public-form-review';container.append(review);
 if(details)review.append(details);
 container.querySelectorAll('.shipping-quote,.shipping-calculation-note,.notice').forEach(node=>review.append(node));
 const coupon=container.querySelector('.checkout-coupon');if(coupon){const optional=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Tengo un cupón (opcional)';optional.append(summary,coupon);review.append(optional)}
 const title=document.createElement('h3');title.textContent='Revisa tu pedido';review.prepend(title);
 return mount({group,state:disclosure,steps,finalButton:button,review,prefix:'checkout-flow',onConfirm});
}
