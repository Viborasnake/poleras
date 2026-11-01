import {designProductMockups} from './catalog-product-mockups.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const mockupInputName=slug=>`mockup_${slug}`;
export function productMockupFields(products){
 return `<fieldset class="admin-mockup-files"><legend>Mockups por producto <small>Opcionales</small></legend><p>Una foto de portada para cada producto. El filtro de la tienda muestra la foto correspondiente. Si falta, la tienda indica «Mockup pendiente».</p>${products.map(product=>{
 const slug=escape(product.slug),name=escape(product.name),input=mockupInputName(slug);
 return `<section class="admin-product-mockup" data-mockup-product="${slug}"><h3>${name}${product.active===false?' · Oculto en tienda':''}</h3><label class="admin-file"><span>Mockup de ${name}</span><input name="${input}" type="file" accept="image/png,image/jpeg,image/webp"><small>Foto de ${name}. PNG, JPG o WebP; hasta 25 MB. Para máxima nitidez se recomienda 1.500 × 1.000 px o más; no es un requisito. Se optimiza hasta 2.400 px y 900 KB.</small><output data-mockup-name="${input}">Sin mockup cargado.</output></label><label class="admin-check"><input type="checkbox" name="clear_${input}"><span>Quitar la foto de ${name}</span></label><div class="design-file-preview admin-mockup-preview" data-preview="${input}" hidden><img alt="Vista previa del mockup de ${name}"></div></section>`;
 }).join('')}</fieldset>`;
}
export function productMockupDraft(current,products,values){
 const draft=designProductMockups(current||{});
 for(const product of products){
  const name=mockupInputName(product.slug),previous=draft[product.slug]||{};
  draft[product.slug]={...previous,
   path:values.get(`clear_${name}`)==='on'?'':previous.path||'',
   focusX:Number(values.get(`${name}_focus_x`)??previous.focusX??50),
   focusY:Number(values.get(`${name}_focus_y`)??previous.focusY??50),
  };
 }
 return draft;
}
