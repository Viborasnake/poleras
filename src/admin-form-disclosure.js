import {createDisclosureState,focusDisclosure} from './progressive-disclosure.js';
import {mountFormDisclosure,conciseSummary} from './form-disclosure.js';

const controllers=new WeakMap();
const controls=node=>[...node.querySelectorAll('input,select,textarea')];
export function adminStepSnapshot(node){
 return JSON.stringify(controls(node).map(field=>[field.name,field.type==='file'?[...field.files].map(file=>[file.name,file.size,file.lastModified]):['radio','checkbox'].includes(field.type)?field.checked:field.value]));
}
export function adminFormData(form){
 // Enable only disclosure-owned panels. Preserve application-disabled controls,
 // including file inputs for unselected products and original disabled groups.
 const panels=[...form.querySelectorAll('[data-admin-disclosure] > .ds-disclosure > .ds-disclosure-panel,[data-order-line-panel]')],disabled=panels.map(panel=>panel.disabled);
 panels.forEach(panel=>panel.disabled=false);
 try{return new FormData(form)}finally{panels.forEach((panel,index)=>panel.disabled=disabled[index])}
}
function labelFor(field){
 const label=field.closest('label');
 if(!label)return field.name;
 const copy=label.cloneNode(true);copy.querySelectorAll('input,select,textarea,small,output,svg').forEach(node=>node.remove());return copy.textContent.trim().replace(/\s+/g,' ');
}
export function adminFieldSummary(node,{limit=180}={}){
 const result=controls(node).filter(field=>!field.disabled&&field.type!=='hidden'&&field.type!=='file'&&(field.type!=='radio'||field.checked)&&(!['design_products','allowed_colors'].includes(field.name)&&!field.name.startsWith('design_colors_')||field.checked)&&(!field.name.startsWith('clear_mockup_')||field.checked)).map(field=>{
  const label=labelFor(field);if(field.type==='radio')return label||field.value;
  if(field.type==='checkbox')return ['design_products','allowed_colors'].includes(field.name)||field.name.startsWith('design_colors_')?label||field.value:`${label}: ${field.checked?'Sí':'No'}`;
  const value=field.tagName==='SELECT'?field.selectedOptions[0]?.textContent:field.value.trim();return value?`${label}: ${value}`:'';
 }).filter(Boolean);
 for(const field of controls(node).filter(field=>field.type==='file')){
  const current=field.closest('[data-design-product]');
  if(current&&!current.querySelector('[name="design_products"]')?.checked)continue;
  if(field.files.length)result.push(`${labelFor(field)}: ${[...field.files].map(file=>file.name).join(', ')}`);
  else if(current?.dataset.currentArtwork)result.push(`${labelFor(field)}: archivo actual conservado`);
  else if(!current&&field.closest('label')?.querySelector('output')?.textContent.includes('actual'))result.push(`${labelFor(field)}: imagen actual conservada`);
 }
 return conciseSummary(result.join(' · ')||'Sin opciones adicionales',limit);
}
function designProductsValid(form){return [...form.querySelectorAll('[data-design-product]')].some(section=>section.querySelector('[name="design_products"]').checked)}
function colorsValid(form){
 const selected=[...form.querySelectorAll('[name="design_products"]:checked')].map(field=>field.value),panels=[...form.querySelectorAll('[data-design-color-product]')];
 if(panels.some(panel=>!panel.querySelector('input[type="checkbox"]:checked')))return false;
 if(selected.includes('poleras')){const allowed=[...form.querySelectorAll('[name="design_colors_poleras"]:checked')].map(field=>field.value);return allowed.includes(form.querySelector('[name="sample_color"]:checked')?.value)}
 return true;
}
function designColorsSummary(form){
 const products=[...form.querySelectorAll('[data-design-color-product]')].map(panel=>{
  const name=panel.querySelector('h3')?.textContent.trim()||panel.dataset.designColorProduct;
  const colors=[...panel.querySelectorAll('input[type="checkbox"]:checked')].map(field=>labelFor(field)||field.value);
  return `${name}: ${colors.join(', ')||'sin colores'}`;
 });
 const sample=form.querySelector('[name="sample_color"]:checked');
 if(sample)products.push(`Muestra polera: ${labelFor(sample)||sample.value}`);
 return conciseSummary(products.join(' · ')||'Selecciona productos para elegir sus colores',180);
}
function collect(form,names){return names.map(name=>form.elements.namedItem(name)).filter(Boolean).map(field=>field.closest('label')||field).filter((field,index,list)=>list.indexOf(field)===index)}
export function adminFlowSchema(form,kind){
 if(kind==='product')return [
  {id:'identity',title:'Nombre y descripción',nodes:collect(form,['name','menu_description'])},
  {id:'purchase',title:'Método de compra',nodes:[form.querySelector('.admin-purchase-method')]},
  {id:'publication',title:'Opciones y visibilidad',nodes:collect(form,['slug','sort_order','active']).concat([...form.querySelectorAll(':scope > .admin-notice')]),advanced:['slug','sort_order']},
 ];
 if(kind==='collection')return [
  {id:'hierarchy',title:'Producto y categoría',nodes:collect(form,['product_type_id','category_id'])},
  {id:'identity',title:'Nombre de la colección',nodes:collect(form,['name','slug']),advanced:['slug']},
  {id:'publication',title:'Orden y visibilidad',nodes:collect(form,['sort_order','is_featured','is_new_collection','active']).concat([...form.querySelectorAll(':scope > .admin-notice')]),advanced:['sort_order']},
 ];
 if(kind==='design')return [
  {id:'identity',title:'Colección e identidad',nodes:collect(form,['collection_id','name','caption','slug']),advanced:['slug']},
  {id:'products',title:'Productos y archivos',nodes:[form.querySelector('.admin-product-artworks')],valid:()=>designProductsValid(form),error:'Selecciona al menos un producto y su archivo. Los archivos actuales se conservan.'},
  {id:'colors',title:'Colores por producto',nodes:[...form.querySelectorAll('.admin-sample-colors')],valid:()=>colorsValid(form),summary:()=>designColorsSummary(form),error:'Elige al menos un color global para cada producto. En Poleras, incluye también el color de muestra.'},
  {id:'mockups',title:'Mockups opcionales',nodes:[form.querySelector('.admin-mockup-files')]},
  {id:'publication',title:'Comportamiento y publicación',nodes:[form.querySelector('.admin-design-flags')]},
 ];
 throw new Error(`Formulario administrativo no configurado: ${kind}`);
}
export function unmountAdminFormDisclosure(form){controllers.get(form)?.destroy()}
export function mountAdminFormDisclosure(form,kind,{validateFile=()=>null,specs:providedSpecs,editableSections=false,onDestroy=()=>{}}={}){
 unmountAdminFormDisclosure(form);
 const specs=providedSpecs||adminFlowSchema(form,kind),submit=form.querySelector('[type="submit"]'),actions=submit.closest('.dialog-actions,.admin-settings-actions'),dialog=form.closest('dialog'),originalSubmit=form.onsubmit;
 const markers=[],group=document.createElement('div');group.className='admin-form-disclosure';group.dataset.adminDisclosure='';actions.before(group);
 const steps=specs.map(spec=>{
  const node=document.createElement('section');
  for(const field of spec.nodes.filter(Boolean)){const marker=document.createComment('admin-field');field.before(marker);markers.push([field,marker]);node.append(field)}
  group.append(node);
  if(spec.advanced?.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Opciones avanzadas';details.append(summary);for(const name of spec.advanced){const field=form.elements.namedItem(name);if(field)details.append(field.closest('label'))}node.append(details)}
  return {...spec,node,valid:()=> (!spec.valid||spec.valid())&&controls(node).filter(field=>field.type==='file'&&!field.disabled).every(field=>[...field.files].every(file=>!validateFile(file))),value:()=>spec.value?String(spec.value()):adminStepSnapshot(node),summary:()=>spec.summary?spec.summary():adminFieldSummary(node)};
 });
 const review=document.createElement('section');review.className='admin-disclosure-review';const heading=document.createElement('h3'),list=document.createElement('dl');heading.textContent='Revisa antes de guardar';review.append(heading,list);actions.before(review);
 const state=createDisclosureState();if(editableSections)steps.forEach(step=>{state.confirmed[step.id]=step.value()});const initial=adminStepSnapshot(form),before=steps.map(step=>step.summary?step.summary():adminFieldSummary(step.node,{limit:Infinity}));let pending=false,destroyed=false;
 let expandToggle=null;
 if(editableSections){const tools=document.createElement('div');tools.className='admin-disclosure-tools';expandToggle=document.createElement('button');expandToggle.type='button';expandToggle.className='admin-secondary';expandToggle.textContent='Expandir todo';expandToggle.setAttribute('aria-expanded','false');tools.append(expandToggle);group.prepend(tools)}
 const abort=new AbortController(),signal=abort.signal;
 const controller=mountFormDisclosure({container:group,state,steps,finalButton:submit,review,prefix:`admin-${kind}`,busy:()=>pending,multiple:editableSections,onChange:()=>{
  if(expandToggle){const allExpanded=steps.every(step=>Boolean(state.expanded?.[step.id]));expandToggle.textContent=allExpanded?'Cerrar todo':'Expandir todo';expandToggle.setAttribute('aria-expanded',String(allExpanded));expandToggle.disabled=pending}
  list.replaceChildren();for(const step of steps){const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=step.title;const after=step.summary?step.summary():adminFieldSummary(step.node,{limit:Infinity}),index=steps.indexOf(step);value.textContent=editableSections&&before[index]!==after?`Antes: ${before[index]}\nDespués: ${after}`:after;row.append(label,value);list.append(row)}if(editableSections&&adminStepSnapshot(form)===initial){submit.disabled=true;const status=group.querySelector('.ds-disclosure-status');status.textContent='Edita la sección que necesitas cambiar y revisa las diferencias antes de guardar.';status.dataset.tone='hint'}
 }});
 if(expandToggle)expandToggle.onclick=()=>{const allExpanded=steps.every(step=>Boolean(state.expanded?.[step.id]));controller.setExpanded(allExpanded?[]:steps.map(step=>step.id));if(!allExpanded)focusDisclosure(group.querySelector('.ds-disclosure-panel:not([hidden]) input, .ds-disclosure-panel:not([hidden]) select, .ds-disclosure-panel:not([hidden]) textarea')||group.querySelector('.ds-disclosure-head h3'))};
 const closeButtons=[...form.querySelectorAll('.dialog-close,.dialog-cancel')];
 const refresh=()=>{if(!destroyed)controller.refresh()};
 const invalid=event=>{for(let node=event.target.parentElement;node&&node!==form;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true};
 form.addEventListener('invalid',invalid,{capture:true,signal});
 // Existing actions such as Select all colors and mockup focus pickers modify
 // values without native input events. Read them after their handlers complete.
 form.addEventListener('click',()=>queueMicrotask(refresh),{signal});
 form.addEventListener('keydown',()=>queueMicrotask(refresh),{signal});
 dialog?.addEventListener('cancel',event=>{if(pending)event.preventDefault()},{signal});
 const submitAction=async(event,handler=originalSubmit)=>{
  event.preventDefault();if(editableSections&&adminStepSnapshot(form)===initial)return;if(!controller.guardFinal(event)||pending)return;
  pending=true;const submitLabel=submit.textContent;const disabled=closeButtons.map(button=>button.disabled);closeButtons.forEach(button=>button.disabled=true);form.setAttribute('aria-busy','true');refresh();
  try{await handler?.call(form,event)}catch(error){const status=form.querySelector('.admin-form-status');if(status)status.textContent=`No pudimos guardar: ${error.message}`}
  finally{pending=false;submit.textContent=submitLabel;closeButtons.forEach((button,index)=>button.disabled=disabled[index]);form.removeAttribute('aria-busy');refresh()}
 };
 form.onsubmit=submitAction;
 const result={...controller,state,refresh,submit:submitAction,destroy:()=>{
  if(destroyed)return;destroyed=true;onDestroy();abort.abort();controller.destroy();form.onsubmit=originalSubmit;
  for(const [field,marker] of markers){marker.replaceWith(field)}group.remove();review.remove();controllers.delete(form);
 }};controllers.set(form,result);return result;
}

export function submitAdminFormDisclosure(form,event,handler){return controllers.get(form)?.submit(event,handler)}
