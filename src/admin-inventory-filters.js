import {inventoryText,inventoryModelOptions,inventoryToday} from './inventory.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export const inventoryColumns = [
  {key:'product', label:'Producto / marca', fields:['product_type_id','model_code','brand']},
  {key:'variant', label:'Color / talla', fields:['color','size']},
  {key:'price', label:'Precio unitario', fields:['priceMin','priceMax']},
  {key:'quantity', label:'Cantidad', fields:['stock','quantityMin','quantityMax']},
  {key:'date', label:'Ingreso', fields:['dateFrom','dateTo']},
  {key:'location', label:'Ubicación / notas', fields:['location','notesQuery']},
];

const inputFields = {
  priceMin:['Precio desde','number'], priceMax:['Precio hasta','number'],
  quantityMin:['Unidades desde','number'], quantityMax:['Unidades hasta','number'],
  dateFrom:['Fecha desde','date'], dateTo:['Fecha hasta','date'],
  notesQuery:['Buscar en notas','search'],
};

const selectFields = {
  brand:['Marca','Todas'], color:['Color','Todos'],
  size:['Talla','Todas'], location:['Ubicación','Todas'],
};

export const inventoryRangeKeys = Object.keys(inputFields).filter(key => inputFields[key][1] !== 'search');
export const inventoryFilterKeys = inventoryColumns.flatMap(column => column.fields);
export const inventoryFilterIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16l-6 7v4l-4 2v-6z"/></svg>';

export function buildInventoryFilterField(items, products, state) {
  const options = {
    product_type_id: ['Producto','Todos',[
      ...products.map(product => [String(product.id), product.name + (product.missing ? ' (eliminado)' : '')]),
      ['unclassified','Sin clasificar'],
    ]],
    model_code: ['Modelo de polera','Todos',inventoryModelOptions({slug:'poleras'}).map(model => [model.code,model.name])],
    stock: ['Stock','Todo el stock',[['available','Con unidades'],['empty','Sin unidades']]],
  };
  for (const [key,[label,empty]] of Object.entries(selectFields)) {
    const values = [...new Map(items.filter(row => row[key]).map(row => [inventoryText(row[key]),row[key]])).values()]
      .sort((a,b) => a.localeCompare(b,'es-CL',{numeric:true}));
    const choices = values.map(value => [value,value]);
    if (key === 'size' && items.some(row => !row.size)) choices.push(['__no_size__','Sin talla registrada']);
    options[key] = [label,empty,choices];
  }

  return key => {
    const attrs = `name="${key}" data-inventory-filter="${key}"`;
    if (key in inputFields) {
      const [label,type] = inputFields[key];
      const limits = type === 'number' ? 'min="0" max="999999999" step="1" inputmode="numeric"' : type === 'date' ? `max="${inventoryToday()}"` : 'maxlength="300"';
      const placeholder = type === 'number' ? 'placeholder="Sin límite"' : '';
      return `<label class="admin-filter-field">${label}<input type="${type}" aria-label="${label}" ${attrs} ${limits} ${placeholder} value="${escapeHtml(state[key])}"></label>`;
    }
    const [label,empty,choices] = options[key];
    return `<label class="admin-filter-field">${label}<select aria-label="${label}" ${attrs}><option value="">${empty}</option>${choices.map(([value,text]) => `<option value="${escapeHtml(value)}"${inventoryText(state[key]) === inventoryText(value) ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
  };
}

export function inventoryColumnFilter(column, group, state, field) {
  const id = `inventory-column-${group.code}-${column.key}`;
  const active = column.fields.some(key => state[key] !== '');
  return `<div class="admin-actions admin-filters inventory-column-filter">
    <button type="button" class="inventory-column-trigger" popovertarget="${id}" data-inventory-column="${column.key}" data-inventory-group="${escapeHtml(group.key)}" aria-label="Filtrar por ${column.label}${active ? ' (activo)' : ''}">
      <span>${column.label}</span>${inventoryFilterIcon}${active ? '<span class="inventory-column-active" aria-hidden="true">✓</span>' : ''}
    </button>
    <div class="admin-actions-popover admin-filter-popover inventory-filter-surface inventory-column-popover" id="${id}" popover>
      <form class="inventory-column-form" aria-label="${column.label}" data-inventory-column-form="${column.key}">
        <p class="inventory-filter-title">${column.label}</p>
        <div class="inventory-column-fields">${column.fields.map(field).join('')}</div>
        <div class="inventory-filter-actions">
          <button type="button" data-inventory-clear-column${active ? '' : ' disabled'}>Limpiar</button>
          <button type="submit" class="admin-primary" value="apply">Aplicar</button>
        </div>
      </form>
    </div></div>`;
}
