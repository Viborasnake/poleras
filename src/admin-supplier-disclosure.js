import {mountAdminFormDisclosure,unmountAdminFormDisclosure,adminStepSnapshot,adminFieldSummary} from './admin-form-disclosure.js';
import {focusDisclosure} from './progressive-disclosure.js';

export function syncSupplierDisclosureFields(form){
 for(const section of form.querySelectorAll('[data-buy],[data-dtf],[data-principal]'))for(const field of section.querySelectorAll('input,select,textarea'))field.disabled=section.hidden||Boolean(field.closest('label')?.hidden);
}
export function mountSupplierProductDisclosure(form){
 const sections=[...form.querySelectorAll(':scope > .supplier-form-section')],cost=document.createElement('output');cost.className='supplier-flow-cost';cost.setAttribute('aria-live','polite');form.querySelector('.dialog-actions').before(cost);
 const fields=[...form.querySelectorAll('input,select,textarea')],disabled=fields.map(field=>field.disabled),abort=new AbortController(),signal=abort.signal;
 const update=()=>{syncSupplierDisclosureFields(form);cost.textContent=`Costo efectivo: ${form.querySelector('[data-effective]').textContent}`};
 form.addEventListener('input',update,{signal});form.addEventListener('change',update,{signal});update();
 const controller=mountAdminFormDisclosure(form,'supplier-product',{specs:[
  {id:'identity',title:'Categoría e identidad',nodes:[sections[0]]},
  {id:'purchase',title:'Compra y costo',nodes:[sections[1]]},
  {id:'production',value:()=>JSON.stringify([sections[2].hidden,sections[3].hidden,adminStepSnapshot(sections[2]),adminStepSnapshot(sections[3])]),title:'Dimensiones y producción',nodes:[sections[2],sections[3]],singleLabel:'No aplica',single:()=>sections[2].hidden&&sections[3].hidden,summary:()=>sections[2].hidden&&sections[3].hidden?'Sin dimensiones adicionales':adminFieldSummary(sections[2].hidden?sections[3]:sections[2])},
  {id:'publication',title:'Estado del insumo',nodes:[form.querySelector('.supplier-active-field')]},
 ],onDestroy:()=>{abort.abort();cost.remove();fields.forEach((field,index)=>field.disabled=disabled[index])}});
 form.querySelector('.dialog-actions').before(cost);return controller;
}
export function mountSupplierWorkflowDisclosure(form){
 const sections=[...form.querySelectorAll(':scope > .supplier-workflow-step')],existing=form.querySelector('[data-workflow-existing]');
 return mountAdminFormDisclosure(form,'supplier-workflow',{specs:[
  {id:'action',title:'Acción',nodes:[sections[0]]},
  {id:'scope',title:'Principal o secundario',nodes:[sections[1]]},
  {id:'selection',title:'Insumo a editar',nodes:[existing],singleLabel:'Resuelto',single:()=>form.elements.workflow_action.value!=='edit',valid:()=>form.elements.workflow_action.value!=='edit'||Boolean(existing.querySelector('input:checked')),summary:()=>form.elements.workflow_action.value==='edit'?adminFieldSummary(existing):'No requiere elegir un insumo existente',error:'Elige un insumo de la lista antes de continuar.'},
 ]});
}
export function mountSupplierRecipeDisclosure(form,{validateLine=()=>'',refreshTotal=()=>{}}={}){
 unmountAdminFormDisclosure(form);
 const list=form.querySelector('[data-lines]'),add=form.querySelector('[data-add]'),records=new Map(),abort=new AbortController(),signal=abort.signal;let controller=null,firstScan=true;
 const status=form.querySelector('.admin-form-status');
 const invalid=row=>[...row.querySelectorAll('input,select')].find(field=>!field.validity.valid||field.required&&!field.value.trim());
 function read(record,callback){const fields=[...record.row.querySelectorAll('input,select')],saved=fields.map(field=>field.disabled);fields.forEach(field=>field.disabled=false);try{return callback(record.row)}finally{fields.forEach((field,index)=>field.disabled=saved[index])}}
 const inspect=record=>read(record,invalid);
 function setOpen(record,open){record.row.classList.toggle('is-recipe-open',open);record.sources.forEach(node=>{if(!node.matches('[data-remove]'))node.hidden=!open});record.row.querySelectorAll('input,select').forEach(field=>field.disabled=!open);record.edit.hidden=open;record.done.hidden=!open;record.summary.hidden=open;}
 function update(){
  for(const [row,record] of records){if(!list.contains(row)){records.delete(row);continue}if(record.confirmed!==adminStepSnapshot(row))record.confirmed=null;record.summary.textContent=read(record,adminFieldSummary)+' · '+(row.querySelector('[data-cost]')?.textContent||'');}
  add.disabled=[...records.values()].some(record=>record.confirmed===null);refreshTotal();controller?.refresh();
 }
 function scan(){
  for(const row of list.querySelectorAll('.supplier-recipe-line')){
   if(records.has(row))continue;const sources=[...row.children],summary=document.createElement('p'),edit=document.createElement('button'),done=document.createElement('button');summary.className='supplier-recipe-summary';edit.type=done.type='button';edit.className=done.className='admin-secondary';edit.textContent='Editar componente';done.textContent='Confirmar componente';row.append(summary,edit,done);
   const record={row,sources,summary,edit,done,confirmed:null};records.set(row,record);
   if(firstScan&&!row.dataset.needsConfirmation&&!inspect(record)&&!validateLine(row))record.confirmed=adminStepSnapshot(row);
   const open=()=>{for(const item of records.values())setOpen(item,item===record);focusDisclosure(row.querySelector('select'))};
   edit.onclick=open;done.onclick=()=>{const field=inspect(record),message=validateLine(row);if(field||message){status.textContent=message||'Completa el insumo y una cantidad válida.';field?.focus();field?.reportValidity();return}const selected=row.querySelector('[name="component"]').value;if([...records.keys()].some(other=>other!==row&&other.querySelector('[name="component"]').value===selected)){status.textContent='No repitas un mismo componente.';return}record.confirmed=adminStepSnapshot(row);setOpen(record,false);status.textContent='Componente revisado. Guarda la receta para aplicar los cambios.';update();focusDisclosure(edit)};
   const changed=()=>{record.confirmed=null;update()};row.addEventListener('input',changed,{signal});row.addEventListener('change',changed,{signal});
   setOpen(record,record.confirmed===null);
  }firstScan=false;update();
 }
 const observer=new MutationObserver(scan);observer.observe(list,{childList:true});scan();
 const tools=form.querySelector('.supplier-recipe-tools'),columns=form.querySelector('.supplier-recipe-columns');if(columns)columns.hidden=true;
 controller=mountAdminFormDisclosure(form,'supplier-recipe',{specs:[{id:'components',title:'Componentes y cantidades',nodes:[list,tools],valid:()=>{const values=[...records.values()];return values.every(record=>record.confirmed!==null&&!inspect(record)&&!validateLine(record.row))&&new Set(values.map(record=>record.row.querySelector('[name="component"]').value)).size===values.length},summary:()=>`${records.size} componente(s) · ${form.querySelector('.supplier-recipe-total')?.textContent||'Sin componentes'}`,error:'Revisa y confirma cada componente; no repitas insumos y comprueba su rendimiento.'}],onDestroy:()=>{observer.disconnect();abort.abort();add.disabled=false;if(columns)columns.hidden=false;for(const record of records.values()){record.sources.forEach(node=>node.hidden=false);record.row.querySelectorAll('input,select').forEach(field=>field.disabled=false);record.summary.remove();record.edit.remove();record.done.remove()}}});
 form.addEventListener('click',()=>queueMicrotask(update),{signal});return controller;
}
