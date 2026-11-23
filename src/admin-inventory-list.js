import {adminActions} from './admin-ui.js';
import {inventoryColumns,inventoryColumnFilter} from './admin-inventory-filters.js';
import {PRODUCT_COLORS} from './product-colors.js';
import {inventoryGroups,inventoryProductType,inventoryModelLabel,inventoryProduct,inventoryText} from './inventory.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const date=value=>new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const colorHexes=new Map(PRODUCT_COLORS.map(color=>[inventoryText(color.name),color.hex]));
function inventoryColorSwatch(value){
 const color=inventoryText(value);
 const hex=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color)?color:colorHexes.get(color==='verde oliva'?'verde olivo':color);
 return `<span class="inventory-color"><span class="inventory-color-dot"${hex?` style="--inventory-color:${hex}"`:''} aria-hidden="true"></span>${safe(value)}</span>`;
}
export function inventoryListMarkup(rows,state,products,field){
 return inventoryGroups(rows,state.groupBy,products).map(group=>{
  const titleId=`inventory-group-${group.code}`;
  const headers=inventoryColumns.map(column=>`<th scope="col">
   <span class="inventory-column-mobile-title" data-admin-column-label>${column.label}</span>
   ${inventoryColumnFilter(column,group,state,field)}
  </th>`).join('');
  const lots=group.items.map(row=>{
   const isShirt=inventoryProduct(row,products)?.slug==='poleras';
   const colorAndSize=`${safe(row.color)}, ${safe(row.size)}`;
   const lotLabel=`${safe(row.name)}, ${colorAndSize}`;
   return `<tr>
    <td><div><strong>${safe(row.name)}</strong><small>${safe(row.brand)} · ${safe(inventoryProductType(row,products))}${isShirt?` · ${safe(inventoryModelLabel(row))}`:''}</small></div></td>
    <td>${inventoryColorSwatch(row.color)}<small>${row.size?`Talla ${safe(row.size)}`:'Sin talla registrada'}</small></td>
    <td>${money(row.price)}</td>
    <td><strong>${row.quantity}</strong> <span class="inventory-stock">${row.quantity?'unidades':'· Sin stock'}</span></td>
    <td><time datetime="${row.date}">${date(row.date)}</time></td>
    <td>${safe(row.location)}${row.notes?`<small class="inventory-notes">${safe(row.notes)}</small>`:''}</td>
    <td><div class="row-actions">
      <button type="button" class="admin-secondary" data-edit-inventory="${safe(row.id)}" aria-label="Editar ${lotLabel}">Editar</button>
      ${adminActions({id:`inventory-actions-${encodeURIComponent(row.id)}`,name:`Más acciones para ${row.name}, ${row.color}, ${row.size}`,items:`<button type="button" class="admin-danger-link" data-delete-inventory="${safe(row.id)}" aria-label="Eliminar ${lotLabel}">Eliminar</button>`})}
    </div></td>
   </tr>`;
  }).join('');
  return `<section class="inventory-product-group" aria-labelledby="${titleId}">
   <header class="inventory-group-heading">
    <div><h3 id="${titleId}">${safe(group.name)}</h3><p>${group.items.length} ${group.items.length===1?'lote':'lotes'} · ${group.units} unidades</p></div>
    <span>Valor registrado <strong>${money(group.value)}</strong></span>
   </header>
   <div class="admin-table-wrap" aria-labelledby="${titleId}">
    <table class="admin-table inventory-table">
     <caption class="inventory-sr-only">${safe(group.name)}. Inventario de prendas. Precio unitario en pesos chilenos.</caption>
     <thead><tr>${headers}<th scope="col">Acciones</th></tr></thead><tbody>${lots}</tbody>
    </table>
   </div>
  </section>`;
 }).join('');
}
