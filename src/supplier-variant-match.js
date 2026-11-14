import {bodyMonthSize} from '../supabase/functions/_shared/variant-selection.js';
export {bodyMonthSize};

const categoryModels={poleras:'basic','polera-mujer-basica':'woman','poleras-oversize':'over','poleras-ninos':'kid',bodys:'body','tote-bag':'tote'};

export function linkedSupplierVariants(product,variants,links){
 const productId=String(product?.id??'');
 const linkedIds=new Set((links||[])
  .filter(link=>String(link?.supplier_product_id)===productId)
  .map(link=>String(link?.product_variant_id)));
 return linkedIds.size
  ?(variants||[]).filter(variant=>linkedIds.has(String(variant?.id)))
  :[];
}

export function compatibleSupplierVariants(product,variants,categorySlug=''){
 const category=String(categorySlug||'').toLocaleLowerCase('es-CL');
 const modelCode=categoryModels[category];
 if(!modelCode)return [];
 const body=category==='bodys';
 const size=body?bodyMonthSize(product?.commercial_size):product?.commercial_size;
 if(!size)return [];
 return (variants||[]).filter(variant=>{
  const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models;
  const variantSize=body?bodyMonthSize(variant.size):variant.size;
  return variant.active&&model?.active!==false&&model?.code===modelCode&&variantSize===size;
 });
}

export function supplierVariantsForPrice(product,variants,links,categorySlug=''){
 const linked=linkedSupplierVariants(product,variants,links).filter(variant=>variant.active);
 if(!categoryModels[categorySlug])return linked;
 const compatible=compatibleSupplierVariants(product,variants,categorySlug);
 if(!linked.length)return compatible;
 const compatibleIds=new Set(compatible.map(variant=>String(variant.id)));
 return linked.filter(variant=>compatibleIds.has(String(variant.id)));
}
