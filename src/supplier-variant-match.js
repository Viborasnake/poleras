import {bodyMonthSize} from '../supabase/functions/_shared/variant-selection.js';
export {bodyMonthSize};

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
 const modelCode=tote?'tote':product?.model_code||(/mujer|femen/.test(category)?'woman':/niñ/.test(category)?'kid':/body/.test(category)?'body':/oversize|over/.test(category)?'over':/unisex|adult|básica|basica/.test(category)?'basic':'');
 const body=category==='bodys'||modelCode==='body';
 const age=name.match(/^(\d+)\s*años?$/i)?.[1];
 const namedSize=({pequeña:'S',pequena:'S',mediana:'M',grande:'L','extra grande':'XL',extragrande:'XL'})[name.toLocaleLowerCase('es-CL')]||'';
 const toteSize=/\bmediana\b/i.test(name)?'M':/\bgrande\b/i.test(name)?'L':'';
 const toteColor=/\bnegr[ao]\b/i.test(name)?'#202124':/\b(crud[ao]|beige|natural)\b/i.test(name)?'#d9c7a4':'';
 const size=tote?toteSize:body?bodyMonthSize(name):age?`${age} años`:namedSize;
 if(tote&&(!size||!toteColor))return [];
 if(body&&!size)return [];
 return (variants||[]).filter(variant=>{
  const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models;
  const variantSize=body?bodyMonthSize(variant.size):variant.size;
  return variant.active&&model?.active!==false&&(!modelCode||model?.code===modelCode)&&(!size||variantSize===size)&&(!tote||String(variant.color_hex||'').toLowerCase()===toteColor);
 });
}
