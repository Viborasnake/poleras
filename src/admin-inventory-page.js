import {adminSearch,adminActions,adminFilters} from './admin-ui.js';
import {inventoryFilterIcon,inventoryRangeKeys} from './admin-inventory-filters.js';

export function inventoryPageMarkup({state,field,sortOptions,editor,shared=false,localBackup=false}){
 const options=`
   <h2 class="inventory-filter-title">Filtrar lotes</h2>
   <div class="inventory-filter-content">
   <div class="inventory-filter-grid">
      ${['product_type_id','model_code','brand','color','size','location','stock','notesQuery'].map(field).join('')}
   </div>
   <details class="inventory-filter-ranges">
    <summary>Precio, cantidad y fechas <span data-inventory-range-count></span></summary>
    <div class="inventory-ranges-grid">${inventoryRangeKeys.map(field).join('')}</div>
   </details>
   <fieldset class="inventory-filter-view">
    <legend>Vista de la tabla</legend>
    <div>
     <label class="admin-filter-field">Agrupar por<select id="inventory-group-by"><option value="product" ${state.groupBy==='product'?'selected':''}>Producto</option><option value="model" ${state.groupBy==='model'?'selected':''}>Producto y modelo</option><option value="none" ${state.groupBy==='none'?'selected':''}>Sin agrupar</option></select></label>
     <label class="admin-filter-field">Ordenar por<select id="inventory-sort">${sortOptions.map(([value,label])=>`<option value="${value}" ${value===state.sort?'selected':''}>${label}</option>`).join('')}</select></label>
    </div>
   </fieldset>
   </div>
   <div class="inventory-filter-actions">
    <button type="button" id="inventory-clear">Limpiar filtros</button>
    <button type="button" class="admin-primary" popovertarget="inventory-filter-options" popovertargetaction="hide">Ver lotes</button>
   </div>`;
 return `<div class="inventory-page">
  <div class="admin-page-heading inventory-heading"><div><span class="admin-eyebrow">PRODUCTOS</span><h1>Inventario</h1><p>Stock, precios y ubicaciones de tus productos.</p></div><div class="admin-page-heading-actions"><button type="button" class="admin-primary" id="new-inventory-item">＋ Agregar lote</button>${adminActions({id:'inventory-tools',items:`<button type="button" id="inventory-export">Exportar CSV</button><button class="admin-secondary" type="button" id="inventory-backup">Descargar respaldo</button>${localBackup?'<button type="button" id="inventory-local-backup">Descargar copia de este navegador</button>':''}<button type="button" id="inventory-restore">Restaurar respaldo</button>`})}</div></div>
  <div class="inventory-local-bar"><span><i aria-hidden="true"></i>${shared?'Inventario compartido entre dispositivos':'Guardado en este navegador'}</span><input type="file" accept="application/json,.json" id="inventory-import" hidden></div>
  <p id="inventory-status" class="inventory-feedback" role="status" aria-live="polite"></p>
  <section class="inventory-metrics" aria-label="Resumen de todo el inventario"></section>
  <section class="admin-panel inventory-panel" aria-label="Lotes del inventario">
   <div class="admin-list-toolbar">${adminSearch({label:'Buscar lote',placeholder:'Producto, talla, marca, color o ubicación',input:'id="admin-search-input"',output:'<output id="inventory-count" aria-live="polite"></output>'})}${adminFilters('inventory-filter-options',options,{surfaceClass:'inventory-filter-surface inventory-filter-main',width:530,preferredHeight:420,icon:inventoryFilterIcon})}</div>
   <div id="inventory-results"></div>
  </section></div>${editor}`;
}
