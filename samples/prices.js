import '../src/design-system.css';
import '../src/admin.css';
import '../src/admin-dark.css';
import '../src/admin-prices.css';
import {wirePriceFilters,wirePriceSettingForm} from '../src/admin-prices-panel.js';
import {markup,prepared,children} from './price-fixture.js';

const root=document.querySelector('#fixture');
document.documentElement.classList.toggle('admin-theme-dark',new URL(location.href).searchParams.get('theme')!=='light');
root.innerHTML=`<div class="admin-layout"><aside class="admin-sidebar"><a class="admin-brand" href="/samples/prices.html">droska<span> SHIRT</span></a><nav aria-label="Administración de muestra"><a href="#">Resumen</a><a href="#">Productos</a><a href="#">Categorías</a><a href="#">Colecciones</a><a href="#">Diseños</a><a href="#">Insumos</a><a href="#" class="active" aria-current="page">Precios</a><a href="#">Inventario</a><a href="#">Pedidos</a><a href="#">Configuración</a></nav></aside><div class="admin-workspace"><header class="admin-topbar"><span>Vista de prueba · datos ficticios</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="admin-secondary" id="sample-theme">Cambiar tema de muestra</button><button type="button" class="admin-secondary" id="sample-error">Simular error al guardar</button><button type="button" class="admin-secondary" id="sample-tests">Evaluar interacciones</button></div></header><main class="admin-main">${markup}<pre id="sample-results" role="status" style="white-space:pre-wrap"></pre></main></div></div>`;
wirePriceFilters(root,prepared,children);
const prices={quality_review_fee_clp:2990,front_large_clp:2990,front_pocket_clp:1990,back_large_clp:3990,arm_clp:1990};
let fail=false;
const wait=()=>new Promise(resolve=>setTimeout(resolve,350));
for(const [id,keys] of [['admin-review-price-form',['quality_review_fee_clp']],['admin-print-prices-form',['front_large_clp','front_pocket_clp','back_large_clp','arm_clp']]]){
 wirePriceSettingForm(root.querySelector(`#${id}`),{
  keys,read:async()=>{await wait();return {data:prices}},
  write:async values=>{await wait();if(fail)return {error:new Error('Error de prueba')};Object.assign(prices,values);return {data:prices}},
  publishedLabel:values=>keys.length===1?`Publicado: $${values.quality_review_fee_clp.toLocaleString('es-CL')} por producto.`:'Precios publicados.',
 });
}
root.querySelector('#sample-theme').onclick=()=>document.documentElement.classList.toggle('admin-theme-dark');
root.querySelector('#sample-error').onclick=event=>{fail=!fail;event.currentTarget.textContent=fail?'Error simulado activo':'Simular error al guardar'};
// Use the real product dialog and fields; publishing is confined to this fixture.
const dialog=root.querySelector('#price-edit-dialog'),form=dialog.querySelector('form');
root.querySelectorAll('[data-price-edit]').forEach(button=>button.onclick=()=>{const entry=prepared.find(entry=>String(entry.product.id)===button.dataset.priceEdit);form.querySelector('[data-price-title]').textContent=entry.product.name;form.querySelector('[data-price-description]').textContent='Datos ficticios. El guardado de esta muestra no publica en la tienda.';form.elements.price.value=entry.product.confirmed_price_clp||16560;form.elements.personalization_base_price.value=entry.product.personalization_base_price_clp||'';form.querySelector('[data-price-gain]').textContent='+$8.637';form.querySelector('[data-price-gain-detail]').textContent='Margen de ejemplo';dialog.showModal();form.elements.price.focus()});
dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
form.onsubmit=event=>{event.preventDefault();dialog.close()};
root.querySelector('#price-variant-dialog')?.remove();

root.querySelector('#sample-tests').onclick=async event=>{
 const trigger=event.currentTarget;trigger.disabled=true;
 if(root.querySelector('#admin-review-price-form').getAttribute('aria-busy')==='true')await wait();
 const results=[],assert=(value,message)=>{if(!value)throw new Error(message)},visible=()=>[...root.querySelectorAll('[data-price-row]')].filter(row=>!row.hidden),search=root.querySelector('[data-price-search]');
 const check=async(name,run)=>{try{await run();results.push(`PASA · ${name}`)}catch(error){results.push(`FALLA · ${name}: ${error.message}`)}};
 const reset=()=>root.querySelector('[data-price-reset]').click();
 const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}))};
 await check('Filtro de pendientes combinado con búsqueda sin tildes',()=>{reset();root.querySelector('[data-price-filter="review"]').click();input(search,'POLERA');assert(visible().length===1,'Resultados incorrectos');assert(visible()[0].textContent.includes('oversize'),'No encontró el pendiente')});
 await check('Oculta grupos sin resultados y recupera la lista',()=>{input(search,'zzzz');assert(!root.querySelector('[data-price-search-empty]').hidden,'Falta vacío');assert([...root.querySelectorAll('[data-price-theme]')].every(row=>row.hidden),'Grupos vacíos visibles');reset();assert(visible().length===6,'No limpió filtros')});
 await check('Sin base personalizada filtra solo las prendas que faltan',()=>{root.querySelector('[data-price-filter="missing-base"]').click();assert(visible().length===4,'Contador incorrecto');assert(visible().every(row=>row.dataset.priceMissingBase==='true'),'Filtró otra fila');reset()});
 await check('Carga fallida bloquea edición y permite reintentar',async()=>{
  const holder=document.createElement('div');holder.hidden=true;holder.innerHTML='<form><input name="amount" type="number" min="0" max="1000000" step="1" required disabled><p class="admin-form-status" role="status"></p><button type="submit" disabled>Guardar</button></form>';root.querySelector('.admin-prices-page').append(holder);
  const testForm=holder.querySelector('form');let attempts=0;
  wirePriceSettingForm(testForm,{keys:['amount'],read:async()=>{await wait();return ++attempts===1?{error:new Error('Prueba')}:{data:{amount:2990}}},write:async values=>({data:values}),publishedLabel:()=> 'Publicado.'});
  assert(testForm.elements.amount.disabled,'Se pudo editar durante carga');await wait();await wait();
  const retry=testForm.querySelector('.admin-secondary');assert(testForm.elements.amount.disabled&&!retry.hidden,'No conservó bloqueo tras error');retry.click();await wait();await wait();assert(!testForm.elements.amount.disabled&&testForm.elements.amount.value==='2990'&&retry.hidden,'No recuperó los datos');holder.remove();
 });
 const services=root.querySelector('.price-services');services.open=true;
 const review=root.querySelector('#admin-review-price-form'),field=review.elements.quality_review_fee_clp,save=review.querySelector('[type="submit"]');
 await check('Campo vacío no publica cero; $0 explícito sí se permite',()=>{input(field,'');assert(save.disabled,'Aceptó vacío');input(field,'0');assert(!save.disabled,'No permitió cero')});
 await check('Plegar ajustes conserva los cambios sin guardar',()=>{input(field,'3290');services.open=false;services.open=true;assert(field.value==='3290'&&!save.disabled,'Perdió borrador')});
 await check('Guardado bloquea cambios y envíos duplicados',async()=>{fail=false;save.click();assert(field.disabled&&save.disabled,'No bloqueó controles');review.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await wait();await wait();assert(!field.disabled&&save.disabled&&prices.quality_review_fee_clp===3290,'No confirmó el valor')});
 await check('Error de guardado conserva el borrador para reintentar',async()=>{fail=true;input(field,'3490');save.click();await wait();await wait();assert(field.value==='3490'&&!save.disabled,'Perdió cambios');assert(review.querySelector('[role="status"]').textContent.includes('No pudimos guardar'),'Falta error');fail=false;save.click();await wait();await wait();assert(prices.quality_review_fee_clp===3490&&save.disabled,'No reintentó')});
 services.open=false;reset();root.querySelector('#sample-results').textContent=results.join('\n');trigger.disabled=false;
};
