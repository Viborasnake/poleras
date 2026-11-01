import {mountAdminFormDisclosure,adminStepSnapshot,adminFieldSummary} from './admin-form-disclosure.js';
const nodeFor=(form,name)=>form.elements.namedItem(name).closest('label');
export function mountCouponDisclosure(form){
 const value=form.elements.value,kind=form.elements.kind,ends=form.elements.ends_at,abort=new AbortController(),signal=abort.signal;
 const label=value.closest('label'),caption=document.createElement('span');caption.className='admin-coupon-value-label';label.firstChild.before(caption);label.firstChild.nextSibling.textContent='';
 function update(){caption.textContent=kind.value==='percent'?'Valor (%)':'Valor (CLP)';value.max=kind.value==='percent'?'100':'';value.step='1';ends.min=form.elements.starts_at.value;}
 form.addEventListener('input',update,{signal});form.addEventListener('change',update,{signal});update();
 return mountAdminFormDisclosure(form,'coupon',{specs:[
  {id:'identity',title:'Código y descripción',nodes:[nodeFor(form,'code'),nodeFor(form,'description')],valid:()=>form.elements.code.value.trim().length>=3,error:'El código debe tener al menos tres caracteres.'},
  {id:'discount',title:'Tipo y valor del descuento',nodes:[nodeFor(form,'kind'),nodeFor(form,'value')]},
  {id:'restrictions',title:'Restricciones opcionales',nodes:[nodeFor(form,'min_subtotal_clp'),nodeFor(form,'max_uses')]},
  {id:'validity',title:'Vigencia opcional',nodes:[nodeFor(form,'starts_at'),nodeFor(form,'ends_at')],valid:()=>!form.elements.starts_at.value||!ends.value||new Date(ends.value)>new Date(form.elements.starts_at.value),error:'El fin debe ser posterior al inicio. Puedes dejar la vigencia sin límites.'},
 ],onDestroy:()=>{abort.abort();caption.remove();label.firstChild.textContent='Valor';}});
}
export function mountPaymentInstructionsDisclosure(form){
 const transfer=form.elements.payment_transfer_enabled,link=form.elements.payment_mercado_pago_enabled,url=form.elements.mercado_pago_url;
 const bank=form.querySelector('.admin-payment-fields'),urlLabel=url.closest('label'),source=[...form.querySelectorAll(':scope > fieldset')],hidden=source.map(node=>node.hidden),abort=new AbortController(),signal=abort.signal;
 const fields=[...bank.querySelectorAll('input')],disabled=fields.map(field=>field.disabled),urlDisabled=url.disabled,urlRequired=url.required;
 const update=()=>{bank.hidden=!transfer.checked;fields.forEach(field=>field.disabled=!transfer.checked);urlLabel.hidden=!link.checked;url.disabled=!link.checked;url.required=link.checked};
 form.addEventListener('change',update,{capture:true,signal});update();
 const controller=mountAdminFormDisclosure(form,'payment-instructions',{specs:[
  {id:'methods',title:'Medios de pago',nodes:[transfer.closest('label'),link.closest('label')],valid:()=>transfer.checked||link.checked,error:'Incluye transferencia o un enlace de pago.'},
  {id:'transfer',title:'Datos de transferencia',nodes:[bank],single:()=>!transfer.checked,singleLabel:'No aplica',value:()=>JSON.stringify([transfer.checked,adminStepSnapshot(bank)]),summary:()=>transfer.checked?adminFieldSummary(bank):'Transferencia no incluida'},
  {id:'link',title:'Enlace de pago',nodes:[urlLabel],single:()=>!link.checked,singleLabel:'No aplica',value:()=>JSON.stringify([link.checked,url.value]),summary:()=>link.checked?url.value:'Enlace no incluido'},
 ],onDestroy:()=>{abort.abort();source.forEach((node,index)=>node.hidden=hidden[index]);fields.forEach((field,index)=>field.disabled=disabled[index]);bank.hidden=false;urlLabel.hidden=false;url.disabled=urlDisabled;url.required=urlRequired}});
 source.forEach(node=>node.hidden=true);return controller;
}
export function mountStoreSettingsDisclosure(form){
 const root=form.querySelector(':scope > fieldset'),announcement=[root.querySelector('.admin-setting-option'),nodeFor(form,'announcement_text'),nodeFor(form,'announcement_origin_text')];
 const hero=form.querySelector('.admin-hero-mockups'),contact=form.querySelector('.admin-settings-grid'),purchase=form.querySelector('.admin-purchase-settings');
 return mountAdminFormDisclosure(form,'store-settings',{editableSections:true,specs:[
  {id:'contact',title:'Contacto público',nodes:[contact],valid:()=>/^56\d{9}$/.test(form.elements.whatsapp_number.value.replace(/\D/g,''))&&(!form.elements.support_email.value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.support_email.value.trim())),error:'Revisa el WhatsApp chileno y el correo de contacto.'},
  {id:'purchase',title:'Métodos de compra',nodes:[purchase]},
  {id:'layout',title:'Diseño de la tienda',nodes:[form.querySelector('.admin-home-layout')]},
  {id:'hero',title:'Mockups de portada',nodes:[hero],valid:()=>{const count=form.querySelectorAll('[name="hero_catalog_design_ids"]:checked').length;return count===0||count===3},summary:()=>{const count=form.querySelectorAll('[name="hero_catalog_design_ids"]:checked').length;return count?`${count} de 3 · ${adminFieldSummary(hero,{limit:Infinity})}`:'Selección automática de diseños activos'},error:'Elige exactamente tres mockups o deja la selección automática.'},
  {id:'announcement',title:'Aviso superior',nodes:announcement},
 ]});
}
export function mountNotificationSettingsDisclosure(form){
 const row=form.querySelector('.admin-notification-row'),nodes=row?[row]:[...form.querySelector(':scope > fieldset').querySelectorAll(':scope > label')];
 return mountAdminFormDisclosure(form,'notification-settings',{editableSections:true,specs:[{id:'notifications',title:'Avisos de pedidos',nodes}]});
}
