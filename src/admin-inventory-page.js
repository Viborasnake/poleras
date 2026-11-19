import {adminSearch,adminActions} from './admin-ui.js';
import {inventoryModelOptions} from './inventory.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function inventoryPageMarkup({state,products,filter,sortOptions,editor}){
 return `<div class="inventory-page">
  <div class="admin-page-heading inventory-heading"><div><span class="admin-eyebrow">PRODUCTOS</span><h1>Inventario</h1><p>Stock, precios y ubicaciones de tus productos.</p></div><div class="admin-page-heading-actions"><button type="button" class="admin-primary" id="new-inventory-item">＋ Agregar lote</button>${adminActions({id:'inventory-tools',items:`<button type="button" id="inventory-export">Exportar CSV</button><button class="admin-secondary" type="button" id="inventory-backup">Descargar respaldo</button><button type="button" id="inventory-restore">Restaurar respaldo</button>`})}</div></div>
  <div class="inventory-local-bar"><span><i aria-hidden="true"></i>Guardado en este navegador</span><input type="file" accept="application/json,.json" id="inventory-import" hidden></div>
  <p id="inventory-status" class="inventory-feedback" role="status" aria-live="polite"></p>
  <section class="inventory-metrics" aria-label="Resumen de todo el inventario"></section>
  <section class="admin-panel inventory-panel" aria-label="Lotes del inventario">
   <div class="inventory-toolbar admin-list-toolbar">${adminSearch({label:'Buscar lote',placeholder:'Producto, talla, marca, color o ubicación',input:'id="admin-search-input"'})}<div class="inventory-view-controls"><label class="admin-filter-field inventory-sort">Agrupar por<select id="inventory-group-by"><option value="product" ${state.groupBy==='product'?'selected':''}>Producto</option><option value="model" ${state.groupBy==='model'?'selected':''}>Producto y modelo</option><option value="none" ${state.groupBy==='none'?'selected':''}>Sin agrupar</option></select></label><label class="admin-filter-field inventory-sort">Ordenar por<select id="inventory-sort">${sortOptions.map(([value,label])=>`<option value="${value}" ${value===state.sort?'selected':''}>${label}</option>`).join('')}</select></label></div></div>
   <div class="inventory-filters" aria-label="Filtros de inventario">
    <label>Producto<select data-inventory-filter="product_type_id"><option value="">Todos los productos</option>${products.map(product=>`<option value="${safe(product.id)}" ${state.product_type_id===String(product.id)?'selected':''}>${safe(product.name)}${product.missing?' (eliminado)':''}</option>`).join('')}<option value="unclassified" ${state.product_type_id==='unclassified'?'selected':''}>Sin clasificar</option></select></label>
    <label>Modelo de polera<select data-inventory-filter="model_code"><option value="">Todos los modelos</option>${inventoryModelOptions({slug:'poleras'}).map(model=>`<option value="${model.code}" ${state.model_code===model.code?'selected':''}>${safe(model.name)}</option>`).join('')}</select></label>
    ${filter('brand','Marca','Todas las marcas')}${filter('color','Color','Todos los colores')}${filter('location','Ubicación','Todas las ubicaciones')}
    <label>Stock<select data-inventory-filter="stock"><option value="">Todo el stock</option><option value="available" ${state.stock==='available'?'selected':''}>Con unidades</option><option value="empty" ${state.stock==='empty'?'selected':''}>Sin unidades</option></select></label>
   </div>
   <div class="inventory-results-bar"><p id="inventory-count" role="status" aria-live="polite"></p><button type="button" class="inventory-clear" id="inventory-clear">Limpiar filtros</button></div>
   <div id="inventory-results"></div>
  </section></div>${editor}`;
}
