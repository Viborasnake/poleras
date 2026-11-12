import {productFamilyIcon} from './product-family-icons.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const check='<span class="catalog-selected-mark" aria-hidden="true">✓</span>';
const family=slug=>({poleras:'men',bodys:'body',totebags:'tote'})[slug];

export function catalogProductToggleMarkup({products=[],selected='',cardKey=''}){
 if(!products.length)return '';
 return `<div class="catalog-product-badges" role="group" aria-label="Ver este diseño en otro producto">${products.map(product=>`<button type="button" class="catalog-product-badge" data-card-product="${escape(product.slug)}" data-card-key="${escape(cardKey)}" data-tooltip="${escape(product.name)}" aria-pressed="${selected===product.slug}" aria-label="Ver mockup de ${escape(product.name)}">${productFamilyIcon(family(product.slug))}</button>`).join('')}</div>`;
}

export function catalogFiltersMarkup({view='collections',mode='collections',category='all',product='all',columns=3,categories=[],products=[],prefix='catalog'}){
 return `<div class="ds-catalog-filters catalog-view-controls">
 <div class="catalog-functional-filters">
 <div class="catalog-view-switcher" role="group" aria-label="Ver por">
 ${[['collections','Colecciones'],['designs','Diseños']].map(([key,label])=>`<button type="button" data-catalog-view="${key}" aria-pressed="${(mode||view)===key}">${(mode||view)===key?check:''}${label}</button>`).join('')}
 </div>
 <button type="button" class="catalog-layout-toggle" data-catalog-grid-columns="${columns===3?4:3}" aria-label="Cambiar a cuadrícula de ${columns===3?4:3} columnas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg><span>${columns===3?'4 columnas':'3 columnas'}</span></button>
 <div class="catalog-category-group catalog-theme-filter"><span class="catalog-filter-label" id="${prefix}-category-label">Temática</span><div class="catalog-category-filters" role="group" aria-labelledby="${prefix}-category-label"><button type="button" class="ds-filter-pill" data-category="all" aria-pressed="${category==='all'}">${check}Todas</button>${categories.map(item=>`<button type="button" class="ds-filter-pill" data-category="${escape(item.id)}" aria-pressed="${category===item.id}">${check}${escape(item.label)}</button>`).join('')}</div></div>
 </div>
 <div class="catalog-product-group"><span class="catalog-filter-label" id="${prefix}-product-label">Producto</span><div class="catalog-product-filters" role="group" aria-labelledby="${prefix}-product-label"><button type="button" class="ds-filter-pill" data-catalog-product="all" aria-pressed="${product==='all'}">${check}Todos</button>${products.map(item=>`<button type="button" class="ds-filter-pill" data-catalog-product="${escape(item.slug)}" aria-pressed="${product===item.slug}"${item.disabled?' disabled':''}>${check}${productFamilyIcon(family(item.slug))}${escape(item.name)}</button>`).join('')}</div></div>
 </div>`;
}
