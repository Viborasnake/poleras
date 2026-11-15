import {designProductMockups} from './catalog-product-mockups.js';

// A gallery item is a photograph of an application, never a product selection.
export function studioGalleryItems(design, products=[]){
 if(!design)return [];
 const photos=designProductMockups(design);
 const activeProducts=products.filter(product=>product.active!==false).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
 const seen=new Set();
 return activeProducts.flatMap(product=>{
  const {slug}=product,entry=photos[slug];
  if(!entry)return [];
  return [{src:entry.path,hover:false},{src:entry.hoverPath,hover:true}].filter(({src})=>{
   if(!src||seen.has(src))return false;
   seen.add(src);
   return true;
  }).map(({src,hover})=>({src,label:product.name,productSlug:slug,focusX:hover?entry.hoverFocusX:entry.focusX,focusY:hover?entry.hoverFocusY:entry.focusY}));
 });
}
