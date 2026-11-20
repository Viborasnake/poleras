import {adminFilters,adminSearch,updateAdminFilterCount} from './admin-ui.js';
function priceOverviewMarkup({total,review,published,missingBase}){
 return `<div class="price-overview" role="group" aria-label="Filtrar productos por estado">${[
  ['all','Todos los productos',total,'con receta configurada'],
  ['review','Por revisar',review,'precios que necesitan atención'],
  ['published','Publicados',published,'precios confirmados'],
  ['missing-base','Sin base personalizada',missingBase,'prendas con precio de respaldo'],
 ].map(([value,label,count,detail])=>`<button type="button" data-price-filter="${value}" aria-pressed="${value==='all'}" aria-controls="price-products"><span>${label}</span><strong>${count}</strong><small>${detail}</small><i aria-hidden="true">↗</i></button>`).join('')}</div>`;
}

export function priceGuideMarkup(){
 return `<details class="price-help"><summary>Cómo leer estos precios <span aria-hidden="true">+</span></summary><div><p><strong>Mínimo con IVA</strong>Cubre el costo de la receta y el impuesto, sin margen.</p><p><strong>Catálogo</strong>Precio final para comprar diseños listos.</p><p><strong>Base personalizada</strong>Precio de la prenda para pedidos con diseño propio. Los estampados se suman aparte; sin base definida se usa el catálogo.</p><p><strong>IVA incluido</strong>La columna IVA desglosa el impuesto del catálogo o, si no está publicado, del sugerido. No se cobra otra vez.</p></div></details>`;
}

const printFields=[['front_large_clp','Frente','Grande centrado arriba'],['front_pocket_clp','Bolsillo','Izquierdo o derecho'],['back_large_clp','Espalda','Grande centrado'],['arm_clp','Brazo','Valor por brazo']];
export function priceServicesMarkup(){
 return `<details class="price-services"><summary><span class="price-services-icon" aria-hidden="true">+</span><span><strong>Servicios y estampados</strong><small>Configura los cobros adicionales de los pedidos personalizados.</small></span><span class="price-services-toggle"><span class="price-services-closed">Editar valores</span><span class="price-services-open">Cerrar ajustes</span><i aria-hidden="true">⌄</i></span></summary><div class="price-services-content"><p class="price-services-note">Valores en pesos chilenos, con IVA incluido. Usa $0 para ofrecer un servicio sin costo.</p><div class="price-services-grid"><section class="price-service-card" aria-labelledby="review-price-title"><header><span class="admin-eyebrow">SERVICIO ADICIONAL</span><h2 id="review-price-title">Revisión técnica</h2><p>Se cobra por producto solo si el archivo necesita corrección antes de imprimir.</p></header><form id="admin-review-price-form" aria-busy="true"><label for="admin-review-price">Valor por producto</label><div class="admin-currency-field"><span aria-hidden="true">$</span><input id="admin-review-price" name="quality_review_fee_clp" type="number" min="0" max="1000000" step="1" inputmode="numeric" required disabled></div><footer><p class="admin-form-status" role="status" aria-live="polite">Cargando valor…</p><button class="admin-primary" type="submit" disabled>Guardar revisión</button></footer></form></section><section class="price-service-card" aria-labelledby="print-prices-title"><header><span class="admin-eyebrow">ESTAMPADOS</span><h2 id="print-prices-title">Precios por ubicación</h2><p>Se suma cada ubicación añadida. Ambos brazos cuestan el doble del valor por brazo.</p></header><form id="admin-print-prices-form" aria-busy="true"><div class="price-print-fields">${printFields.map(([key,label,detail])=>`<label for="price-${key}"><strong>${label}</strong><small id="price-${key}-help">${detail}</small><span class="admin-currency-field"><span aria-hidden="true">$</span><input id="price-${key}" aria-describedby="price-${key}-help" name="${key}" type="number" min="0" max="1000000" step="1" inputmode="numeric" required disabled></span></label>`).join('')}</div><footer><p class="admin-form-status" role="status" aria-live="polite">Cargando valores…</p><button class="admin-primary" type="submit" disabled>Guardar estampados</button></footer></form></section></div></div></details>`;
}

export function priceTableToolsMarkup(counts){
 const {total}=counts;
 return `<div class="admin-panel-head price-table-heading"><div><h2 id="price-products-title">Precios de productos</h2><p>Define cuánto cobrar en cada tipo de pedido.</p><span class="price-tax-label">IVA incluido · CLP</span></div></div><div class="admin-list-toolbar price-table-tools">${adminSearch({label:'Buscar producto',placeholder:'Nombre, categoría o precio',input:'data-price-search',output:`<output data-price-results aria-live="polite">${total} productos</output>`})}${adminFilters('price-filter-options',`${priceOverviewMarkup(counts)}<button type="button" data-price-reset hidden>Limpiar filtros</button>`)}</div>`;
}

export function matchesPriceFilter(row,query,filter='all'){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 return (!query.trim()||normalize(row.searchable).includes(normalize(query).trim()))&&
  (filter==='all'||(filter==='missing-base'?row.missingBase:row.state===filter));
}

export function wirePriceFilters(root,prepared,children){
 const search=root.querySelector('[data-price-search]'),empty=root.querySelector('[data-price-search-empty]'),tbody=root.querySelector('.price-publication-table tbody'),output=root.querySelector('[data-price-results]'),reset=root.querySelector('[data-price-reset]');
 let selected='all';
 const filter=()=>{
  if(!tbody)return;
  const visibleIds=new Set();
  tbody.querySelectorAll('[data-price-row]').forEach(row=>{
   const matches=matchesPriceFilter({searchable:row.dataset.priceSearchable,state:row.dataset.priceState,missingBase:row.dataset.priceMissingBase==='true'},search?.value||'',selected);
   row.hidden=!matches;if(matches)visibleIds.add(row.dataset.priceRow);
  });
  const categoryVisible=id=>prepared.some(entry=>String(entry.product.category_id)===String(id)&&visibleIds.has(String(entry.product.id)));
  tbody.querySelectorAll('[data-price-subcategory]').forEach(row=>{row.hidden=!categoryVisible(row.dataset.priceSubcategory)});
  tbody.querySelectorAll('[data-price-theme]').forEach(row=>{row.hidden=!children.some(child=>String(child.parent_category_id)===row.dataset.priceTheme&&categoryVisible(child.id))});
  if(empty)empty.hidden=visibleIds.size>0;
  if(output)output.textContent=`${visibleIds.size} de ${prepared.length} productos`;
  if(reset)reset.hidden=selected==='all'&&!search?.value;
  updateAdminFilterCount(root,'price-filter-options',Number(selected!=='all'));
  root.querySelectorAll('[data-price-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.priceFilter===selected)));
 };
 root.querySelectorAll('[data-price-filter]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.priceFilter;filter()}));
 search?.addEventListener('input',filter);
 reset?.addEventListener('click',()=>{selected='all';search.value='';filter();search.focus()});
 root.querySelector('[data-price-empty-reset]')?.addEventListener('click',()=>reset.click());
 filter();
}

// Keep the saved values separate from the draft; a failed request must not
// turn an unsaved amount into a published one or discard the user's edits.
export function wirePriceSettingForm(form,{keys,read,write,publishedLabel}){
 if(!form)return;
 const button=form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),inputs=keys.map(key=>form.elements[key]),label=button.textContent;
 let saved=null,busy=false;
 const retry=document.createElement('button');retry.type='button';retry.className='admin-secondary';retry.textContent='Reintentar carga';retry.hidden=true;status.after(retry);
 const values=()=>Object.fromEntries(inputs.map(input=>[input.name,Number(input.value)]));
 const valid=()=>inputs.every(input=>input.value!==''&&input.validity.valid&&Number.isSafeInteger(Number(input.value)));
 const changed=()=>saved&&keys.some(key=>values()[key]!==saved[key]);
 const setBusy=value=>{busy=value;form.setAttribute('aria-busy',String(value));inputs.forEach(input=>{input.disabled=value||!saved});button.disabled=value||!saved||!valid()||!changed()};
 const sync=()=>{
  if(busy||!saved)return;
  button.disabled=!valid()||!changed();
  status.textContent=!valid()?'Ingresa montos enteros entre $0 y $1.000.000.':changed()?'Hay cambios sin guardar.':publishedLabel(saved);
 };
 const load=async()=>{
  if(busy)return;setBusy(true);retry.hidden=true;status.textContent='Cargando valores…';
  try{
   const {data,error}=await read();if(!form.isConnected)return;if(error)throw error;
   if(!data||keys.some(key=>data[key]===null||data[key]===undefined||!Number.isSafeInteger(Number(data[key]))||Number(data[key])<0||Number(data[key])>1000000))throw new Error('No se recibió un precio válido.');
   saved=Object.fromEntries(keys.map(key=>[key,Number(data[key])]));inputs.forEach(input=>{input.value=saved[input.name]});status.textContent=publishedLabel(saved);
  }catch{status.textContent='No pudimos cargar los precios. Vuelve a intentarlo.';retry.hidden=false}
  finally{setBusy(false)}
 };
 form.addEventListener('input',sync);retry.addEventListener('click',load);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!saved)return;
  if(!valid()){sync();inputs.find(input=>!input.validity.valid||input.value==='')?.focus();return}
  if(!changed())return;
  const current=values();setBusy(true);button.textContent='Guardando…';status.textContent='Publicando precios…';
  try{
   const {data,error}=await write(current);if(!form.isConnected)return;if(error)throw error;
   if(!data||keys.some(key=>data[key]===null||data[key]===undefined||!Number.isSafeInteger(Number(data[key]))||Number(data[key])<0||Number(data[key])>1000000))throw new Error('No se recibió confirmación del precio.');
   saved=Object.fromEntries(keys.map(key=>[key,Number(data[key])]));inputs.forEach(input=>{input.value=saved[input.name]});status.textContent=publishedLabel(saved);
  }catch{status.textContent='No pudimos guardar. Tus cambios siguen aquí; vuelve a intentarlo.'}
  finally{button.textContent=label;setBusy(false)}
 };
 void load();
}
