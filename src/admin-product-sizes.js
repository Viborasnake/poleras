export const PRODUCT_SIZE_MODELS={
 poleras:[['basic','Unisex'],['woman','Mujer'],['over','Oversize'],['kid','Niños']],
 bodys:[['body','Body bebé']],
 totebags:[['tote','Tote bag']]
};
export const SUPPLIER_SIZE_FAMILIES={
 poleras:['poleras','basic'],'polera-mujer-basica':['poleras','woman'],
 'poleras-oversize':['poleras','over'],'poleras-ninos':['poleras','kid'],
 bodys:['bodys','body'],'tote-bag':['totebags','tote']
};

export function productSizeRows({productSizes=[],productTypes=[],supplierProducts=[],supplierVariantLinks=[],variants=[]}={}){
 const products=new Map(productTypes.map(product=>[String(product.id),product]));
 const variantsById=new Map(variants.map(variant=>[String(variant.id),variant]));
 const activeLinks=new Set(supplierVariantLinks.filter(link=>variantsById.get(String(link.product_variant_id))?.active).map(link=>String(link.supplier_product_id)));
 return productSizes.map(size=>{
  const product=products.get(String(size.product_type_id));
  const suppliers=supplierProducts.filter(supplier=>String(supplier.catalog_product_size_id)===String(size.id));
  return {id:size.id,productSlug:product?.slug||'',productName:product?.name||'Producto',modelCode:size.model_code,
   model:PRODUCT_SIZE_MODELS[product?.slug]?.find(([code])=>code===size.model_code)?.[1]||'General',
   size:size.size_code,label:size.label,sortOrder:size.sort_order,suppliers,
   published:suppliers.some(supplier=>supplier.active&&supplier.confirmed_price_clp>0&&supplier.price_confirmed_at&&activeLinks.has(String(supplier.id)))};
 }).sort((a,b)=>a.productName.localeCompare(b.productName,'es')||a.model.localeCompare(b.model,'es')||Number(a.sortOrder)-Number(b.sortOrder)||a.size.localeCompare(b.size,'es'));
}
