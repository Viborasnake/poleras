import {bodyMonthSize} from '../supabase/functions/_shared/variant-selection.js';
export {bodyMonthSize};

const categoryModels={poleras:'basic','polera-mujer-basica':'woman','poleras-oversize':'over','poleras-ninos':'kid',bodys:'body','tote-bag':'tote'};
const namedSizes={pequeña:'S',pequena:'S',mediana:'M',grande:'L','extra grande':'XL',extragrande:'XL','extra extra grande':'XXL','extraextragrande':'XXL',xxl:'XXL','2xl':'XXL'};

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
 const name=String(product?.name||'').trim();
 const category=String(categorySlug||'').toLocaleLowerCase('es-CL');
 const tote=category==='tote-bag';
 const modelCode=categoryModels[category];
 if(!modelCode)return [];
 const body=category==='bodys';
 const age=name.match(/^(\d+)\s*años?$/i)?.[1];
 const namedSize=namedSizes[name.toLocaleLowerCase('es-CL')]||'';
 const toteSize=/\bmediana\b/i.test(name)?'M':/\bgrande\b/i.test(name)?'L':'';
 const toteColor=/\bnegr[ao]\b/i.test(name)?'#202124':/\b(crud[ao]|beige|natural)\b/i.test(name)?'#d9c7a4':'';
 const size=tote?toteSize:body?bodyMonthSize(name):age?`${age} años`:namedSize;
 if(!size||(tote&&!toteColor))return [];
 return (variants||[]).filter(variant=>{
  const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models;
  const variantSize=body?bodyMonthSize(variant.size):variant.size;
  return variant.active&&model?.active!==false&&model?.code===modelCode&&variantSize===size&&(!tote||String(variant.color_hex||'').toLowerCase()===toteColor);
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
