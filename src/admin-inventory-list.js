import {adminActions} from './admin-ui.js';
import {PRODUCT_COLORS} from './product-colors.js';
import {inventoryGroups,inventoryProductType,inventoryModelLabel,inventoryProduct,inventoryText} from './inventory.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const date=value=>new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const colorHexes=new Map(PRODUCT_COLORS.map(color=>[inventoryText(color.name),color.hex]));
const columnLabels=['Producto / marca','Color / talla','Precio unitario','Cantidad','Ingreso','Ubicación / notas','Acciones'];
function inventoryColorSwatch(value){
 const color=inventoryText(value);
 const hex=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(color)?color:colorHexes.get(color==='verde oliva'?'verde olivo':color);
 return `<span class="inventory-color"><span class="inventory-color-dot"${hex?` style="--inventory-color:${hex}"`:''} aria-hidden="true"></span>${safe(value)}</span>`;
}
export function inventoryListMarkup(rows,groupBy,products){
 const headers=columnLabels.map(label=>`<th scope="col">${label}</th>`).join('');
 return inventoryGroups(rows,groupBy,products).map(group=>{
  const titleId=`inventory-group-${group.code}`;
  const lots=group.items.map(row=>{
   const isShirt=inventoryProduct(row,products)?.slug==='poleras';
   const colorAndSize=`${safe(row.color)}, ${safe(row.size)}`;
   const lotLabel=`${safe(row.name)}, ${colorAndSize}`;
   const stockLabel=safe([row.name,row.brand,row.color,row.size&&`talla ${row.size}`].filter(Boolean).join(', '));
   return `<tr>
    <td><div><strong>${safe(row.name)}</strong><small>${safe(row.brand)} · ${safe(inventoryProductType(row,products))}${isShirt?` · ${safe(inventoryModelLabel(row))}`:''}</small></div></td>
    <td>${inventoryColorSwatch(row.color)}<small>${row.size?`Talla ${safe(row.size)}`:'Sin talla registrada'}</small></td>
    <td>${money(row.price)}</td>
    <td><div class="ds-quantity inventory-stock-stepper" role="group" aria-label="Stock de ${stockLabel}">
     <button type="button" data-stock-id="${safe(row.id)}" data-stock-change="-1" aria-label="Bajar stock de ${stockLabel} en una unidad" title="Bajar stock en una unidad"${row.quantity===0?' disabled':''}>−</button>
     <strong>${row.quantity}<span class="inventory-sr-only"> ${row.quantity===1?'unidad':'unidades'}</span></strong>
     <button type="button" data-stock-id="${safe(row.id)}" data-stock-change="1" aria-label="Subir stock de ${stockLabel} en una unidad" title="Subir stock en una unidad">+</button>
    </div>${row.quantity===0?'<small>Sin stock</small>':''}</td>
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
    <div><h3 id="${titleId}">${safe(group.name)}</h3><p>${group.items.length} ${group.items.length===1?'lote':'lotes'} · ${group.units} ${group.units===1?'unidad':'unidades'}</p></div>
    <span>Valor registrado <strong>${money(group.value)}</strong></span>
   </header>
   <div class="admin-table-wrap" aria-labelledby="${titleId}">
    <table class="admin-table inventory-table">
     <caption class="inventory-sr-only">${safe(group.name)}. Inventario de prendas. Precio unitario en pesos chilenos.</caption>
     <thead><tr>${headers}</tr></thead><tbody>${lots}</tbody>
    </table>
   </div>
  </section>`;
 }).join('');
}
