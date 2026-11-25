import {CATALOG_VIDEO_ACCEPT,CATALOG_VIDEO_SECONDS,CATALOG_VIDEO_SOURCE_MB} from './video-optimization.js';
import {catalogFileField} from './admin-catalog-dialog.js';
import {designProductMockups} from './catalog-product-mockups.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const mockupInputName=slug=>`mockup_${slug}`;
export const mockupVideoInputName=slug=>`mockup_video_${slug}`;
export function productMockupFields(products){
 return `<fieldset class="admin-mockup-files"><legend>Mockups por producto <small>Opcionales</small></legend><p>Añade una foto de portada y un video opcional por producto. PNG, JPG o WebP de hasta 25 MB. Para mayor nitidez, usa 1.500 × 1.000 px o más.</p>${products.map(product=>{
 const slug=escape(product.slug),name=escape(product.name),input=mockupInputName(slug),video=mockupVideoInputName(slug);
 return `<section class="admin-product-mockup" data-mockup-product="${slug}">
  <h3>${name}${product.active===false?' · Oculto en tienda':''}</h3>
  <div class="admin-catalog-upload">
   ${catalogFileField({name:input,label:`Mockup de ${product.name}`,output:'Sin mockup'})}
   <div class="design-file-preview admin-mockup-preview" data-preview="${input}" hidden><img alt="Vista previa del mockup de ${name}"></div>
  </div>
  <label class="admin-check" hidden><input type="checkbox" name="clear_${input}"><span>Quitar mockup guardado</span></label>
 <div class="admin-mockup-video">
  <label class="admin-file"><span>Video de ${name} (opcional)</span><input type="file" name="${video}" accept="${CATALOG_VIDEO_ACCEPT}">
   <small>MP4, MOV o WebM de hasta ${CATALOG_VIDEO_SECONDS} segundos y ${CATALOG_VIDEO_SOURCE_MB} MB. Al guardar se optimiza a MP4 sin audio.</small>
   <output data-mockup-video-name aria-live="polite">Sin video cargado.</output>
  </label>
  <video controls muted playsinline preload="metadata" aria-label="Vista previa del video de ${name}" hidden></video>
  <label class="admin-check" data-remove-mockup-video hidden><input type="checkbox" name="clear_${video}"><span>Quitar el video de ${name}</span></label>
 </div>
 </section>`;
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
   ...(values.get(`clear_${mockupVideoInputName(product.slug)}`)==='on'?{videoPath:''}:{}),
  };
 }
 return draft;
}
