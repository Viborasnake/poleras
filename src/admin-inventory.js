import {inventoryStore,inventoryRows,inventoryToday,inventoryBackup,inventoryCsv,inventoryText,INVENTORY_STORAGE_KEY} from './inventory.js';
import {mountAdminFormDisclosure,unmountAdminFormDisclosure,adminFormData} from './admin-form-disclosure.js';
import './admin-inventory.css';

const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const date=value=>new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const state={query:'',brand:'',color:'',location:'',stock:'',sort:'date_desc'};
const sortOptions=[['date_desc','Ingreso · más reciente'],['date_asc','Ingreso · más antiguo'],...['name','brand','color','size','location'].map(key=>[`${key}_asc`,`${{name:'Producto',brand:'Marca',color:'Color',size:'Talla',location:'Ubicación'}[key]} · A–Z`]),['price_asc','Precio · menor a mayor'],['price_desc','Precio · mayor a menor'],['quantity_asc','Cantidad · menor a mayor'],['quantity_desc','Cantidad · mayor a menor']];
function download(content,name,type){
 const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function editorMarkup(){
 const field=(name,label,attrs='')=>`<label>${label}<input name="${name}" ${attrs}></label>`;
 return `<dialog class="admin-dialog admin-inventory-dialog" id="inventory-dialog" aria-labelledby="inventory-dialog-title"><form id="inventory-form"><div class="dialog-title"><div><span class="admin-eyebrow">INVENTARIO</span><h2 id="inventory-dialog-title">Agregar lote</h2><p>Un registro reúne prendas de la misma marca, color, talla, precio y ubicación.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-form-grid">${field('name','Producto o modelo','required maxlength="100" placeholder="Ej. Polera básica"')}${field('brand','Marca','required maxlength="80" placeholder="Ej. Gildan" list="inventory-brands"')}${field('color','Color','required maxlength="50" placeholder="Ej. Negro" list="inventory-colors"')}${field('size','Talla (opcional)','maxlength="30" placeholder="Ej. M"')}${field('price','Precio unitario (CLP)','required type="number" min="0" max="999999999" step="1" inputmode="numeric"')}${field('quantity','Cantidad disponible','required type="number" min="0" max="999999999" step="1" inputmode="numeric"')}${field('date','Fecha de ingreso',`required type="date" max="${inventoryToday()}"`)}${field('location','Ubicación','required maxlength="100" placeholder="Ej. Estante A · Caja 2" list="inventory-locations"')}<label class="admin-form-wide">Notas (opcional)<textarea name="notes" maxlength="300" rows="3" placeholder="Detalles para encontrar o identificar este lote"></textarea></label></div><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar lote</button></div><p class="admin-form-status" role="alert"></p></form></dialog><dialog class="admin-dialog admin-confirm-dialog" id="inventory-delete-dialog" aria-labelledby="inventory-delete-title"><form><div class="dialog-title"><div><span class="admin-eyebrow">INVENTARIO</span><h2 id="inventory-delete-title">Eliminar lote</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><p data-delete-description></p><p>El lote se quitará del registro. Descarga un respaldo si necesitas conservarlo.</p><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-danger">Eliminar lote</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
}
export function renderInventory(context){
 const {root,shell,toast}=context;
 const storage=context.storage||{getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
 // Order notifications may refresh the shell; keep an inventory draft intact.
 if(root.querySelector('#inventory-dialog[open],#inventory-delete-dialog[open]'))return;
 const store=inventoryStore(storage);
 let items=[],loadError='';try{items=store.read()}catch(error){loadError=error.message}
 const action='<div class="admin-page-heading-actions"><button type="button" class="admin-secondary" id="inventory-export">Exportar CSV</button><button type="button" class="admin-primary" id="new-inventory-item">＋ Agregar lote</button></div>';
 const filter=(key,label,all)=>{
  const values=[...new Map(items.map(row=>[inventoryText(row[key]),row[key]])).values()].sort((a,b)=>a.localeCompare(b,'es-CL'));
  if(state[key]&&!values.some(value=>inventoryText(value)===inventoryText(state[key])))state[key]='';
  return `<label>${label}<select data-inventory-filter="${key}"><option value="">${all}</option>${values.map(value=>`<option value="${safe(value)}" ${inventoryText(value)===inventoryText(state[key])?'selected':''}>${safe(value)}</option>`).join('')}</select></label>`;
 };
 const content=`<div class="admin-page-heading"><div><span class="admin-eyebrow">OPERACIÓN</span><h1>Inventario.</h1><p>Encuentra tus prendas y mantén al día las cantidades, precios y ubicaciones.</p></div>${action}</div><section class="inventory-storage-note"><p><strong>Guardado en este navegador.</strong> Para conservar una copia o trasladar tus registros a otro equipo, descarga un respaldo.</p><div><button class="admin-secondary" type="button" id="inventory-backup">Descargar respaldo</button><label class="admin-secondary inventory-import">Restaurar respaldo<input type="file" accept="application/json,.json" id="inventory-import"></label></div><p id="inventory-status" role="status" aria-live="polite"></p></section><section class="inventory-metrics" aria-label="Resumen de todo el inventario"></section><section class="admin-panel inventory-panel"><div class="admin-panel-head"><div><h2>Lotes de prendas</h2><p id="inventory-count" role="status" aria-live="polite"></p></div><label class="inventory-sort">Ordenar por<select id="inventory-sort">${sortOptions.map(([value,label])=>`<option value="${value}" ${value===state.sort?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="inventory-filters">${filter('brand','Marca','Todas las marcas')}${filter('color','Color','Todos los colores')}${filter('location','Ubicación','Todas las ubicaciones')}<label>Stock<select data-inventory-filter="stock"><option value="">Todo el stock</option><option value="available" ${state.stock==='available'?'selected':''}>Con unidades</option><option value="empty" ${state.stock==='empty'?'selected':''}>Sin unidades</option></select></label><button type="button" class="admin-secondary" id="inventory-clear">Limpiar filtros</button></div><div id="inventory-results"></div></section>${editorMarkup()}${['brand','color','location'].map((key,index)=>`<datalist id="inventory-${['brands','colors','locations'][index]}">${[...new Set(items.map(item=>item[key]))].map(value=>`<option value="${safe(value)}"></option>`).join('')}</datalist>`).join('')}`;
 shell(content,'inventario');
 const query=root.querySelector('#admin-search-input');
 query.value=state.query;query.placeholder='Producto, talla, marca, color o ubicación';
 query.oninput=()=>{state.query=query.value;updateResults()};
 function updateResults(){
  const rows=inventoryRows(items,state),units=items.reduce((sum,row)=>sum+row.quantity,0),value=items.reduce((sum,row)=>sum+row.price*row.quantity,0);
  root.querySelector('.inventory-metrics').innerHTML=[['Lotes registrados',items.length,'registros en total'],['Unidades disponibles',units,'en todo el inventario'],['Valor registrado',money(value),'precio unitario × cantidad'],['Ubicaciones',new Set(items.map(row=>inventoryText(row.location))).size,'lugares distintos']].map(([label,total,hint])=>`<article><span>${label}</span><strong>${total}</strong><small>${hint}</small></article>`).join('');
  root.querySelector('.inventory-metrics').hidden=Boolean(loadError);
  const count=`${rows.length} de ${items.length} lotes · ${rows.reduce((sum,row)=>sum+row.quantity,0)} unidades en esta vista`;
  root.querySelector('#inventory-count').textContent=loadError?'Carga pendiente':count;root.querySelector('#admin-search-count').textContent=loadError?'':count;
  root.querySelector('#inventory-results').innerHTML=loadError?`<div class="admin-empty" role="alert"><strong>No pudimos cargar el inventario.</strong><p>${safe(loadError)}</p><button type="button" class="admin-secondary" id="inventory-retry">Reintentar</button></div>`:!rows.length?`<div class="admin-empty"><strong>${items.length?'No hay lotes que coincidan.':'Aún no hay prendas registradas.'}</strong><p>${items.length?'Prueba otra búsqueda o limpia los filtros.':'Agrega tu primer lote para empezar a organizar tus prendas.'}</p></div>`:`<div class="admin-table-wrap"><table class="admin-table inventory-table"><caption class="inventory-sr-only">Inventario de prendas. Precio expresado por unidad en pesos chilenos.</caption><thead><tr>${['Producto / marca','Color / talla','Precio unitario','Cantidad','Ingreso','Ubicación / notas','Acciones'].map(text=>`<th scope="col">${text}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td data-label="Producto / marca"><div><strong>${safe(row.name)}</strong><small>${safe(row.brand)}</small></div></td><td data-label="Color / talla">${safe(row.color)}<small>${row.size?`Talla ${safe(row.size)}`:'Sin talla registrada'}</small></td><td data-label="Precio unitario">${money(row.price)}</td><td data-label="Cantidad"><strong>${row.quantity}</strong> <span class="inventory-stock">${row.quantity?'unidades':'· Sin stock'}</span></td><td data-label="Ingreso"><time datetime="${row.date}">${date(row.date)}</time></td><td data-label="Ubicación / notas">${safe(row.location)}${row.notes?`<small class="inventory-notes">${safe(row.notes)}</small>`:''}</td><td><div class="row-actions"><button type="button" class="admin-secondary" data-edit-inventory="${safe(row.id)}" aria-label="Editar ${safe(row.name)}, ${safe(row.color)}, ${safe(row.size)}">Editar</button><button type="button" class="admin-danger-link" data-delete-inventory="${safe(row.id)}" aria-label="Eliminar ${safe(row.name)}, ${safe(row.color)}, ${safe(row.size)}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>`;
  for(const id of ['new-inventory-item','inventory-export'])root.querySelector(`#${id}`).disabled=Boolean(loadError)||(id==='inventory-export'&&!rows.length);
  root.querySelector('#inventory-retry')?.addEventListener('click',()=>renderInventory(context));
 }
 updateResults();
 root.querySelector('#inventory-sort').onchange=event=>{state.sort=event.target.value;updateResults()};
 root.querySelectorAll('[data-inventory-filter]').forEach(select=>select.onchange=()=>{state[select.dataset.inventoryFilter]=select.value;updateResults()});
 root.querySelector('#inventory-clear').onclick=()=>{for(const key of ['query','brand','color','location','stock'])state[key]='';query.value='';root.querySelectorAll('[data-inventory-filter]').forEach(select=>select.value='');updateResults();query.focus()};
 const dialog=root.querySelector('#inventory-dialog'),form=dialog.querySelector('form'),deletion=root.querySelector('#inventory-delete-dialog');let editing=null,removing=null,opener=null;
 for(const modal of [dialog,deletion]){
  modal.querySelectorAll('.dialog-close,.dialog-cancel').forEach(button=>button.onclick=()=>modal.close());
  modal.addEventListener('close',()=>{if(modal===dialog)unmountAdminFormDisclosure(form);if(!modal.isConnected)return;if(opener?.isConnected)opener.focus();else root.querySelector('#new-inventory-item')?.focus()});
 }
 function openEditor(item=null,trigger){
  unmountAdminFormDisclosure(form);editing=item;opener=trigger;form.reset();
  root.querySelector('#inventory-dialog-title').textContent=item?'Editar lote':'Agregar lote';form.querySelector('[type="submit"]').textContent=item?'Guardar cambios':'Guardar lote';form.querySelector('.admin-form-status').textContent='';
  for(const key of ['name','brand','color','size','price','quantity','date','location','notes'])form.elements.namedItem(key).value=item?.[key]??({quantity:1,date:inventoryToday()}[key]??'');
  const specs=[['identity','Prenda y variante',['name','brand','color','size']],['stock','Cantidad y precio',['quantity','price']],['place','Ingreso y ubicación',['date','location','notes']]].map(([id,title,names])=>({id,title,nodes:names.map(name=>form.elements.namedItem(name).closest('label'))}));
  dialog.showModal();mountAdminFormDisclosure(form,'inventory',{specs,editableSections:Boolean(item)});
 }
 root.querySelector('#new-inventory-item').onclick=event=>openEditor(null,event.currentTarget);
 root.querySelector('#inventory-results').onclick=event=>{
  const trigger=event.target.closest('[data-edit-inventory],[data-delete-inventory]');if(!trigger)return;
  try{const item=store.read().find(row=>row.id===(trigger.dataset.editInventory||trigger.dataset.deleteInventory));if(!item)throw new Error('El registro ya no existe. Actualiza el inventario.');
   if(trigger.dataset.editInventory)openEditor(item,trigger);
   else{removing=item;opener=trigger;deletion.querySelector('[data-delete-description]').textContent=`${item.name} · ${item.brand} · ${item.color}${item.size?` · ${item.size}`:''} · ${item.quantity} unidades · ${item.location}`;deletion.querySelector('.admin-form-status').textContent='';deletion.showModal();deletion.querySelector('.dialog-cancel').focus()}
  }catch(error){toast(error.message)}
 };
 form.onsubmit=event=>{event.preventDefault();try{
  const record=store.save(Object.fromEntries(adminFormData(form)),editing);dialog.close();renderInventory(context);root.querySelector(`[data-edit-inventory="${CSS.escape(record.id)}"]`)?.focus();toast(editing?'Lote actualizado.':'Lote agregado al inventario.');
 }catch(error){form.querySelector('.admin-form-status').textContent=error.message}};
 deletion.querySelector('form').onsubmit=event=>{event.preventDefault();try{store.remove(removing);deletion.close();renderInventory(context);root.querySelector('#new-inventory-item').focus();toast('Lote eliminado.')}catch(error){deletion.querySelector('.admin-form-status').textContent=error.message}};
 root.querySelector('#inventory-export').onclick=()=>{try{download(inventoryCsv(inventoryRows(store.read(),state)),`inventario-${inventoryToday()}.csv`,'text/csv;charset=utf-8')}catch(error){toast(error.message)}};
 root.querySelector('#inventory-backup').onclick=()=>{try{download(loadError?storage.getItem(INVENTORY_STORAGE_KEY):inventoryBackup(store.read()),`respaldo-inventario-${inventoryToday()}.json`,'application/json')}catch(error){toast(error.message)}};
 root.querySelector('#inventory-import').onchange=async event=>{
  const input=event.target,file=input.files[0],status=root.querySelector('#inventory-status');if(!file)return;
  try{if(file.size>5*1024*1024)throw new Error('El respaldo debe pesar menos de 5 MB.');const added=store.restore(await file.text());renderInventory(context);toast(`${added} lotes restaurados. Los registros existentes se conservaron.`)}catch(error){status.textContent=error.message}finally{input.value=''}
 };
}
