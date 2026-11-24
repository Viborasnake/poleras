import {adminActionTrigger,bindAdminActions,prepareAdminTable,updateAdminFilterCount} from './admin-ui.js';
import {inventoryStore,inventoryRows,inventoryToday,inventoryBackup,inventoryCsv,inventoryText,INVENTORY_STORAGE_KEY,INVENTORY_DEFAULT_GROUP,inventoryProduct,inventoryModelOptions} from './inventory.js';
import {inventoryListMarkup} from './admin-inventory-list.js';
import {inventoryPageMarkup} from './admin-inventory-page.js';
import {buildInventoryFilterField,inventoryFilterKeys,inventoryRangeKeys} from './admin-inventory-filters.js';
import {mountAdminFormDisclosure,unmountAdminFormDisclosure,adminFormData} from './admin-form-disclosure.js';
import {bindInventorySuggestions} from './admin-inventory-suggestions.js';
import {sharedInventoryStore} from './shared-inventory.js';
import './admin-inventory.css';

const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const state={query:'',groupBy:INVENTORY_DEFAULT_GROUP,sort:'date_desc',...Object.fromEntries(inventoryFilterKeys.map(key=>[key,'']))};
const sortOptions=[['date_desc','Ingreso reciente'],['date_asc','Ingreso antiguo'],...['name','brand','color','size','location'].map(key=>[`${key}_asc`,`${{name:'Nombre',brand:'Marca',color:'Color',size:'Talla',location:'Ubicación'}[key]} · A–Z`]),['price_asc','Precio · menor a mayor'],['price_desc','Precio · mayor a menor'],['quantity_asc','Cantidad · menor a mayor'],['quantity_desc','Cantidad · mayor a menor']];
function download(content,name,type){
 const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function editorMarkup(products){
 const field=(name,label,attrs='')=>`<label>${label}<input name="${name}" ${attrs}></label>`;
 return `<dialog class="admin-dialog admin-inventory-dialog" id="inventory-dialog" aria-labelledby="inventory-dialog-title"><form id="inventory-form"><div class="dialog-title"><div><span class="admin-eyebrow">INVENTARIO</span><h2 id="inventory-dialog-title">Agregar lote</h2><p>Un registro reúne prendas de la misma marca, color, talla, precio y ubicación.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-form-grid"><label class="admin-form-wide">Producto<select name="product_type_id" required aria-label="Producto"><option value="">Selecciona un producto</option>${products.map(product=>`<option value="${safe(product.id)}">${safe(product.name)}${product.missing?' (eliminado)':product.active===false?' (oculto)':''}</option>`).join('')}</select><small>Opciones definidas en Administración → Productos.</small></label><label class="admin-form-wide" data-inventory-model-field>Modelo de polera<select name="model_code" aria-label="Modelo de polera"></select></label>${field('name','Nombre o referencia','required maxlength="100" placeholder="Ej. Polera básica"')}${field('brand','Marca','required maxlength="80" placeholder="Ej. Gildan"')}${field('color','Color','required maxlength="50" placeholder="Ej. Negro"')}${field('size','Talla (opcional)','maxlength="30" placeholder="Ej. M"')}${field('price','Precio unitario (CLP)','required type="number" min="0" max="999999999" step="1" inputmode="numeric"')}${field('quantity','Cantidad disponible','required type="number" min="0" max="999999999" step="1" inputmode="numeric"')}${field('date','Fecha de ingreso',`required type="date" max="${inventoryToday()}"`)}${field('location','Ubicación','required maxlength="100" placeholder="Ej. Estante A · Caja 2"')}<label class="admin-form-wide">Notas (opcional)<textarea name="notes" maxlength="300" rows="3" placeholder="Detalles para encontrar o identificar este lote"></textarea></label></div><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar lote</button></div><p class="admin-form-status" role="alert"></p></form></dialog><dialog class="admin-dialog admin-confirm-dialog" id="inventory-delete-dialog" aria-labelledby="inventory-delete-title"><form><div class="dialog-title"><div><span class="admin-eyebrow">INVENTARIO</span><h2 id="inventory-delete-title">Eliminar lote</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><p data-delete-description></p><p>El lote se quitará del registro. Descarga un respaldo si necesitas conservarlo.</p><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-danger">Eliminar lote</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
}
export function renderInventory(context){
 const {root,shell,toast}=context;
 const storage=context.storage||{getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
 // Order notifications may refresh the shell; keep an inventory draft intact.
 if(root.querySelector('#inventory-dialog[open],#inventory-delete-dialog[open],#inventory-results[aria-busy="true"]'))return;
 if(context.client&&!context.store){
  if(root.querySelector('[data-inventory-loading]'))return;
  const store=sharedInventoryStore(context.client,storage,context.products||[]);
  shell('<section class="admin-panel admin-empty" data-inventory-loading aria-busy="true"><h1>Inventario</h1><p role="status">Cargando inventario…</p></section>','inventario');
  const loading=root.querySelector('[data-inventory-loading]');
  const finish=loadError=>{
   if(loading.isConnected)renderInventory({...context,store,loadError});
  };
  void store.open().then(()=>finish(''),error=>finish(error.message));
  return;
 }
 const store=context.store||inventoryStore(storage);
 let items=[],loadError=context.loadError||'',maintenanceNotice=store.notice||'';
 if(!loadError)try{items=store.read()}catch(error){loadError=error.message}
 if(!loadError&&!context.client)try{const renamed=store.removeShirtPrefixes(context.products||[]);if(renamed){items=store.read();maintenanceNotice=`${renamed} ${renamed===1?'nombre actualizado':'nombres actualizados'}: se quitó el prefijo Polera. Los demás datos se conservaron.`}}catch(error){maintenanceNotice=`No pudimos actualizar los nombres: ${error.message}`}
 const products=[...(context.products||[])];
 for(const item of items){if(item.product_type_id&&!products.some(product=>String(product.id)===item.product_type_id))products.push(inventoryProduct(item,products))}
 const field=buildInventoryFilterField(items,products,state);
 shell(inventoryPageMarkup({state,field,sortOptions,editor:editorMarkup(products),shared:Boolean(context.client),localBackup:Boolean(store.localBackup)}),'inventario');
 bindAdminActions(root);
 const query=root.querySelector('#admin-search-input');
 const filters=root.querySelector('#inventory-filter-options');
 const results=root.querySelector('#inventory-results');
 const fields=scope=>[...scope.querySelectorAll('[data-inventory-filter]')];
 const filterTrigger=root.querySelector('[popovertarget="inventory-filter-options"]');
 function syncModelFilter(scope){
  const productField=scope.querySelector('[name="product_type_id"]');
  if(!productField)return;
  const model=scope.querySelector('[name="model_code"]');
  const product=products.find(option=>String(option.id)===productField.value);
  model.disabled=Boolean(productField.value&&product?.slug!=='poleras');
  if(model.disabled)model.value='';
 }
 function checkRanges(scope){
  for(const [min,max] of [['priceMin','priceMax'],['quantityMin','quantityMax'],['dateFrom','dateTo']]){
   const lower=scope.querySelector(`[name="${min}"]`),upper=scope.querySelector(`[name="${max}"]`);
   if(!lower||!upper)continue;
   const reversed=lower.value&&upper.value&&(lower.type==='number'?lower.valueAsNumber>upper.valueAsNumber:lower.value>upper.value);
   upper.setCustomValidity(reversed?'El límite final debe ser igual o mayor que el inicial.':'');
  }
  return fields(scope).every(element=>element.reportValidity());
 }
 function syncFields(){
  for(const element of fields(filters)){
   const value=state[element.name];
   if(element.value!==value)element.value=value;
   element.setCustomValidity('');
  }
  syncModelFilter(filters);
 }
 root.querySelector('#inventory-status').textContent=maintenanceNotice;
 query.value=state.query;
 query.oninput=()=>{state.query=query.value;updateResults()};
 function updateResults(){
  const rows=inventoryRows(items,state,products),units=items.reduce((sum,row)=>sum+row.quantity,0),value=items.reduce((sum,row)=>sum+row.price*row.quantity,0);
  root.querySelector('.inventory-metrics').innerHTML=[['Unidades',units,'disponibles'],['Lotes',items.length,'registrados'],['Valor registrado',money(value),'precio × cantidad'],['Ubicaciones',new Set(items.map(row=>inventoryText(row.location))).size,'en el inventario']].map(([label,total,hint])=>`<article><span>${label}</span><strong>${total}</strong><small>${hint}</small></article>`).join('');
  root.querySelector('.inventory-metrics').hidden=Boolean(loadError);
  const count=`${rows.length} de ${items.length} lotes · ${rows.reduce((sum,row)=>sum+row.quantity,0)} unidades en esta vista`;
  root.querySelector('#inventory-count').textContent=loadError?'Carga pendiente':count;
  const activeFilters=inventoryFilterKeys.filter(key=>state[key]!=='').length;
  const activeRanges=inventoryRangeKeys.filter(key=>state[key]!=='').length;
  filters.querySelector('[data-inventory-range-count]').textContent=activeRanges?`(${activeRanges})`:'';
  updateAdminFilterCount(root,'inventory-filter-options',activeFilters);
  root.querySelector('#inventory-clear').disabled=!activeFilters&&!state.query;
  results.innerHTML=loadError?`<div class="admin-empty" role="alert"><strong>No pudimos cargar el inventario.</strong><p>${safe(loadError)}</p><button type="button" class="admin-secondary" id="inventory-retry">Reintentar</button></div>`:!rows.length?`<div class="admin-empty"><strong>${items.length?'No hay lotes que coincidan.':'Aún no hay prendas registradas.'}</strong><p>${items.length?'Prueba otra búsqueda o limpia los filtros.':'Agrega tu primer lote para empezar a organizar tus prendas.'}</p></div>`:inventoryListMarkup(rows,state,products,field);
  root.querySelectorAll('.inventory-table').forEach(prepareAdminTable);
  if(results.getAttribute('aria-busy')==='true')setStockBusy(true);
  for(const id of ['new-inventory-item','inventory-export'])root.querySelector(`#${id}`).disabled=Boolean(loadError)||(id==='inventory-export'&&!rows.length);
  root.querySelector('#inventory-retry')?.addEventListener('click',()=>renderInventory({...context,store:null,loadError:''}));
 }
 root.querySelector('#inventory-sort').onchange=event=>{state.sort=event.target.value;updateResults()};
 root.querySelector('#inventory-group-by').onchange=event=>{state.groupBy=event.target.value;updateResults()};
 syncModelFilter(filters);
 for(const element of fields(filters))state[element.name]=element.value;
 updateResults();
 filters.addEventListener('change',event=>{
  if(!event.target.matches('[data-inventory-filter]'))return;
  syncModelFilter(filters);
  if(!checkRanges(filters))return;
  for(const element of fields(filters))state[element.name]=element.value.trim();
  updateResults();
 });
 root.querySelector('#inventory-clear').onclick=()=>{
  state.query=query.value='';
  for(const key of inventoryFilterKeys)state[key]='';
  syncFields();
  updateResults();
  query.focus();
 };
 results.addEventListener('beforetoggle',event=>{
  if(event.newState!=='open')return;
  const form=event.target.querySelector('.inventory-column-form');
  if(!form)return;
  form.reset();
  for(const element of fields(form))element.setCustomValidity('');
  syncModelFilter(form);
 },true);
 results.addEventListener('change',event=>{
  const form=event.target.closest('.inventory-column-form');
  if(!form)return;
  syncModelFilter(form);
  if(event.target.type==='number'||event.target.type==='date')checkRanges(form);
 });
 function applyColumn(form,clear=false){
  if(!clear&&!checkRanges(form))return;
  const popover=form.closest('[popover]'),trigger=adminActionTrigger(popover);
  const {inventoryColumn,inventoryGroup}=trigger.dataset;
  for(const element of fields(form))state[element.name]=clear?'':element.value.trim();
  popover.hidePopover();
  syncFields();
  updateResults();
  const next=[...results.querySelectorAll('[data-inventory-column]')].find(button=>button.dataset.inventoryColumn===inventoryColumn&&button.dataset.inventoryGroup===inventoryGroup);
  (next||filterTrigger).focus({preventScroll:Boolean(next)});
 }
 results.addEventListener('submit',event=>{
  if(!event.target.matches('.inventory-column-form'))return;
  event.preventDefault();
  applyColumn(event.target);
 });
 results.addEventListener('click',event=>{
  const button=event.target.closest('[data-inventory-clear-column]');
  if(button)applyColumn(button.form,true);
 });
 const dialog=root.querySelector('#inventory-dialog'),form=dialog.querySelector('form'),deletion=root.querySelector('#inventory-delete-dialog');let editing=null,removing=null,opener=null;
 const suggestions=bindInventorySuggestions(form,()=>store.read());
 function syncEditorProduct(previous=form.elements.model_code.value){
  const product=products.find(row=>String(row.id)===form.elements.product_type_id.value),options=inventoryModelOptions(product),model=form.elements.model_code;
  model.innerHTML=`<option value="">${options.length?'Selecciona un modelo':'No aplica'}</option>${options.map(option=>`<option value="${option.code}">${safe(option.name)}</option>`).join('')}`;
  model.value=options.some(option=>option.code===previous)?previous:'';model.disabled=!options.length;model.required=Boolean(options.length);model.closest('label').hidden=!options.length;
 }
 form.elements.product_type_id.onchange=()=>{suggestions.close();syncEditorProduct()};
 for(const modal of [dialog,deletion]){
  const saving=()=>modal.querySelector('form').getAttribute('aria-busy')==='true';
  modal.addEventListener('cancel',event=>{if(saving())event.preventDefault()});
  modal.querySelectorAll('.dialog-close,.dialog-cancel').forEach(button=>button.onclick=()=>{if(!saving())modal.close()});
  modal.addEventListener('close',()=>{if(modal===dialog)unmountAdminFormDisclosure(form);if(!modal.isConnected)return;if(opener?.isConnected)opener.focus();else root.querySelector('#new-inventory-item')?.focus()});
 }
 function openEditor(item=null,trigger){
  suggestions.close();
  unmountAdminFormDisclosure(form);editing=item;opener=trigger;form.reset();
  root.querySelector('#inventory-dialog-title').textContent=item?'Editar lote':'Agregar lote';form.querySelector('[type="submit"]').textContent=item?'Guardar cambios':'Guardar lote';form.querySelector('.admin-form-status').textContent='';
  for(const key of ['model_code','name','brand','color','size','price','quantity','date','location','notes'])form.elements.namedItem(key).value=item?.[key]??({quantity:1,date:inventoryToday()}[key]??'');
  form.elements.product_type_id.value=item?String(inventoryProduct(item,products)?.id||''):'';syncEditorProduct(item?.model_code||'');
  const specs=[['identity','Producto y variante',['product_type_id','model_code','name','brand','color','size']],['stock','Cantidad y precio',['quantity','price']],['place','Ingreso y ubicación',['date','location','notes']]].map(([id,title,names])=>({id,title,nodes:names.map(name=>form.elements.namedItem(name).closest('label'))}));
  dialog.showModal();mountAdminFormDisclosure(form,'inventory',{specs,editableSections:Boolean(item)});
 }
 root.querySelector('#new-inventory-item').onclick=event=>openEditor(null,event.currentTarget);
 function setStockBusy(busy){
  if(busy)results.setAttribute('aria-busy','true');
  else results.removeAttribute('aria-busy');
  for(const button of results.querySelectorAll('[data-stock-change]')){
   if(busy)button.setAttribute('aria-disabled','true');
   else button.removeAttribute('aria-disabled');
  }
 }
 async function adjustStock(trigger){
  if(trigger.disabled||results.getAttribute('aria-busy')==='true')return;
  setStockBusy(true);
  let record;
  try{
   const lot=store.read().find(row=>row.id===trigger.dataset.stockId);
   if(!lot)throw new Error('El lote ya no existe. Actualiza el inventario.');
   record=await store.adjustStock(lot,Number(trigger.dataset.stockChange));
  }catch(error){
   if(results.isConnected)toast(error.message);
   return;
  }finally{setStockBusy(false)}
  if(!results.isConnected)return;
  const focusedStock=results.contains(document.activeElement)?document.activeElement.closest('[data-stock-change]'):null;
  items=store.read();
  updateResults();
  if(focusedStock){
   const {stockId,stockChange}=focusedStock.dataset;
   const sameLot=`[data-stock-id="${CSS.escape(stockId)}"]:not(:disabled)`;
   const next=results.querySelector(`${sameLot}[data-stock-change="${stockChange}"]`)||results.querySelector(sameLot)||query;
   next.focus({preventScroll:true});
  }
  root.querySelector('#inventory-status').textContent=`${record.name} · ${record.quantity} ${record.quantity===1?'unidad disponible':'unidades disponibles'}.`;
 }
 results.onclick=event=>{
  const stockButton=event.target.closest('[data-stock-change]');
  if(stockButton){void adjustStock(stockButton);return}
  const trigger=event.target.closest('[data-edit-inventory],[data-delete-inventory]');if(!trigger)return;
  try{const item=store.read().find(row=>row.id===(trigger.dataset.editInventory||trigger.dataset.deleteInventory));if(!item)throw new Error('El registro ya no existe. Actualiza el inventario.');
   if(trigger.dataset.editInventory)openEditor(item,trigger);
   else{removing=item;opener=adminActionTrigger(trigger)||trigger;deletion.querySelector('[data-delete-description]').textContent=`${item.name} · ${item.brand} · ${item.color}${item.size?` · ${item.size}`:''} · ${item.quantity} unidades · ${item.location}`;deletion.querySelector('.admin-form-status').textContent='';deletion.showModal();deletion.querySelector('.dialog-cancel').focus()}
  }catch(error){toast(error.message)}
 };
 function submitInventory(dialog,action,done){
  const form=dialog.querySelector('form'),status=form.querySelector('.admin-form-status');
  form.onsubmit=async event=>{
   event.preventDefault();
   const managesBusy=dialog===deletion;
   if(managesBusy&&form.getAttribute('aria-busy')==='true')return;
   const button=event.submitter||form.querySelector('[type="submit"]');
   status.textContent='';
   if(managesBusy){form.setAttribute('aria-busy','true');button.disabled=true}
   try{
    const result=await action(form);
    if(!dialog.isConnected)return;
    dialog.close();renderInventory(context);done(result);
   }catch(error){status.textContent=error.message}
   finally{if(managesBusy){form.removeAttribute('aria-busy');button.disabled=false}}
  };
 }
 submitInventory(dialog,()=>{
  const draft=Object.fromEntries(adminFormData(form)),product=products.find(row=>String(row.id)===draft.product_type_id);
  if(!product)throw new Error('Selecciona un producto de la lista de Productos.');
  Object.assign(draft,{product_type_name:product.name,product_type_slug:product.slug,model_code:inventoryModelOptions(product).length?draft.model_code:({bodys:'body',totebags:'tote'}[product.slug]||'')});
  return store.save(draft,editing);
 },record=>{
  root.querySelector(`[data-edit-inventory="${CSS.escape(record.id)}"]`)?.focus();
  toast(editing?'Lote actualizado.':'Lote agregado al inventario.');
 });
 submitInventory(deletion,()=>store.remove(removing),()=>{
  root.querySelector('#new-inventory-item').focus();toast('Lote eliminado.');
 });
 root.querySelector('#inventory-export').onclick=()=>{try{download(inventoryCsv(inventoryRows(store.read(),state,products),products),`inventario-${inventoryToday()}.csv`,'text/csv;charset=utf-8')}catch(error){toast(error.message)}};
 root.querySelector('#inventory-backup').onclick=()=>{try{download(loadError?storage.getItem(INVENTORY_STORAGE_KEY):inventoryBackup(store.read()),`respaldo-inventario-${inventoryToday()}.json`,'application/json')}catch(error){toast(error.message)}};
 root.querySelector('#inventory-local-backup')?.addEventListener('click',()=>download(store.localBackup,`respaldo-local-inventario-${inventoryToday()}.json`,'application/json'));
 root.querySelector('#inventory-restore').onclick=()=>root.querySelector('#inventory-import').click();
 root.querySelector('#inventory-import').onchange=async event=>{
  const input=event.target,file=input.files[0],status=root.querySelector('#inventory-status');if(!file)return;
  try{if(file.size>5*1024*1024)throw new Error('El respaldo debe pesar menos de 5 MB.');const added=await store.restore(await file.text());if(!input.isConnected)return;renderInventory(context);toast(`${added} lotes restaurados. Los registros existentes se conservaron.`)}catch(error){status.textContent=error.message}finally{input.value=''}
 };
}
