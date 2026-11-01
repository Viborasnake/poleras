import {mountAdminFormDisclosure,adminFieldSummary,adminStepSnapshot,unmountAdminFormDisclosure} from './admin-form-disclosure.js';
import {focusDisclosure} from './progressive-disclosure.js';

function lineEditor(form,kind,onChange){
 const root=form.querySelector(kind==='manual'?'#manual-items':'#edit-order-items'),add=form.querySelector(kind==='manual'?'#add-manual-item':'#add-edit-order-item'),records=new Map(),abort=new AbortController(),signal=abort.signal;
 const invalid=panel=>{const disabled=panel.disabled;panel.disabled=false;try{return [...panel.querySelectorAll('input,select,textarea')].find(field=>!field.disabled&&(!field.validity.valid||field.required&&!field.value.trim()))}finally{panel.disabled=disabled}};
 function update(){
  for(const [row,item] of records){if(!row.isConnected){records.delete(row);continue}if(item.confirmed!==adminStepSnapshot(item.panel)){item.confirmed=null;item.summary.textContent='Pendiente de revisar'}else item.summary.textContent=adminFieldSummary(item.panel);}
  for(const [row] of records){const remove=row.querySelector('[data-remove-item],[data-remove-edit-item]');if(remove)remove.hidden=records.size<=1}
  add.disabled=![...records.values()].every(item=>item.confirmed!==null);
 }
 function open(item){for(const record of records.values()){record.panel.hidden=record!==item;record.panel.disabled=record!==item;record.edit.hidden=record===item}focusDisclosure(item.panel.querySelector('input,select,textarea'))}
 function scan(){
  for(const row of root.children){if(records.has(row))continue;
   const header=row.firstElementChild,panel=document.createElement('fieldset');panel.className='admin-order-line-panel';panel.dataset.orderLinePanel='';const legend=document.createElement('legend');legend.textContent='Datos del producto';panel.append(legend);
   const children=[...row.children].filter(child=>child!==header);panel.append(...children);row.append(panel);
   const summary=document.createElement('p'),edit=document.createElement('button'),done=document.createElement('button');summary.className='admin-line-summary';edit.type=done.type='button';edit.className='admin-secondary';edit.textContent='Editar producto';done.className='admin-secondary';done.textContent='Confirmar producto';panel.append(done);row.append(summary,edit);
   const item={panel,summary,edit,children,confirmed:null};records.set(row,item);if(kind==='edit'&&!invalid(panel))item.confirmed=adminStepSnapshot(panel);
   edit.onclick=()=>{open(item);onChange()};done.onclick=()=>{const field=invalid(panel);if(field){if(field.required&&field.value&&!field.value.trim())field.setCustomValidity('Completa este dato para continuar.');field.focus();field.reportValidity();return}item.confirmed=adminStepSnapshot(panel);panel.hidden=true;panel.disabled=true;edit.hidden=false;update();onChange();focusDisclosure(edit)};
   panel.addEventListener('input',event=>{event.target.setCustomValidity?.('');item.confirmed=null;update();onChange()},{signal});panel.addEventListener('change',()=>{item.confirmed=null;update();onChange()},{signal});
   if(item.confirmed){panel.hidden=true;panel.disabled=true}else open(item);
  }update();onChange();
 }
 const observer=new MutationObserver(scan);observer.observe(root,{childList:true});scan();
 return {summary:()=>{const rows=[...records.values()];const total=rows.reduce((sum,item)=>{const qty=item.panel.querySelector(kind==='manual'?'[name="item_quantity"]':'[name="edit_item_quantity"]'),price=item.panel.querySelector(kind==='manual'?'[name="item_unit_price"]':'[name="edit_item_price"]');return sum+(Number(qty.value)||0)*(Number(price.value)||0)},0);return rows.map((item,index)=>`Producto ${index+1}: ${adminFieldSummary(item.panel,{limit:Infinity})}`).join(' · ')+` · Subtotal productos: ${new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(total)}`},valid:()=>{update();return records.size>0&&[...records.values()].every(item=>item.confirmed!==null&&!invalid(item.panel))},destroy:()=>{observer.disconnect();abort.abort();add.disabled=false;for(const [row,item] of records){row.append(...item.children);item.panel.remove();item.summary.remove();item.edit.remove()}}};
}
export function mountAdminOrderDisclosure(form,kind){
 unmountAdminFormDisclosure(form);let controller=null;
 const sections=[...form.querySelectorAll(':scope > .admin-form-section')],abort=new AbortController(),signal=abort.signal;
 const saved=[];
 const deliveryNames=['region','commune','address','address_extra'],paymentNames=['transfer_holder','transfer_bank','transfer_account_type','transfer_account_number','transfer_rut','transfer_email','mercado_pago_url'];
 for(const name of [...deliveryNames,...paymentNames]){const field=form.elements.namedItem(name);if(field)saved.push({field,disabled:field.disabled,required:field.required,label:field.closest('label'),hidden:field.closest('label').hidden})}
 function conditional(){
  const delivery=form.elements.fulfillment.value==='delivery';
  for(const item of saved){let show=deliveryNames.includes(item.field.name)?delivery:item.field.name==='mercado_pago_url'?form.elements.payment_mercado_pago_enabled?.checked:form.elements.payment_transfer_enabled?.checked;item.label.hidden=!show;item.field.disabled=!show;item.field.required=delivery&&['region','commune','address'].includes(item.field.name)||show&&item.field.name==='mercado_pago_url';}
 }
 form.addEventListener('change',()=>{conditional();controller?.refresh()},{signal});conditional();
 const lines=lineEditor(form,kind,()=>controller?.refresh());
 const specs=[
  {id:'customer',title:kind==='manual'?'Comprador y canal':'Cliente',nodes:[sections[0]]},
  {id:'delivery',title:'Entrega',nodes:[sections[1]],summary:()=>form.elements.fulfillment.value==='pickup'?['Retiro en tienda',form.elements.delivery_notes.value.trim()&&`Indicaciones: ${form.elements.delivery_notes.value.trim()}`].filter(Boolean).join(' · '):adminFieldSummary(sections[1],{limit:Infinity})},
  {id:'products',title:'Productos',nodes:[sections[2]],summary:()=>lines.summary(),valid:()=>lines.valid(),error:'Confirma cada producto antes de continuar. Puedes editar las líneas anteriores.'},
 ];
 if(kind==='manual')specs.push({id:'payment',title:'Datos de pago',nodes:[sections[3]],valid:()=>!form.elements.send_payment_email.checked||form.elements.payment_mercado_pago_enabled.checked&&Boolean(form.elements.mercado_pago_url.value.trim())||form.elements.payment_transfer_enabled.checked&&paymentNames.filter(name=>name.startsWith('transfer_')).some(name=>form.elements.namedItem(name)?.value.trim()),error:'Agrega datos de transferencia o un link válido, o desactiva el envío de datos de pago.'});
 specs.push({id:'notes',title:'Notas internas opcionales',nodes:[sections.at(-1)]});
 controller=mountAdminFormDisclosure(form,kind,{specs,editableSections:kind==='edit',onDestroy:()=>{lines.destroy();abort.abort();for(const item of saved){item.field.disabled=item.disabled;item.field.required=item.required;item.label.hidden=item.hidden}}});
 return controller;
}
