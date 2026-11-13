const productForCategory={
  poleras:['poleras','Unisex'],
  'polera-mujer-basica':['poleras','Mujer'],
  'poleras-oversize':['poleras','Oversize'],
  'poleras-ninos':['poleras','Niños'],
  bodys:['bodys','Body bebé'],
  'tote-bag':['totebags','Tote bag']
};

const sizeFromName=(name,category)=>{
  const value=String(name||'').trim();
  if(category==='tote-bag')return /\bmediana\b/i.test(value)?'M':/\bgrande\b/i.test(value)?'L':value;
  if(category==='poleras-ninos')return value;
  if(category==='bodys')return value;
  return ({pequeña:'S',pequena:'S',mediana:'M',grande:'L','extra grande':'XL',extragrande:'XL'})[value.toLocaleLowerCase('es-CL')]||value;
};

export function productSizeRows({supplierProducts=[],supplierCategories=[],supplierVariantLinks=[],variants=[]}={}){
  const categories=new Map(supplierCategories.map(category=>[String(category.id),category.slug]));
  const variantsById=new Map(variants.map(variant=>[String(variant.id),variant]));
  const linksBySupplier=new Map();
  for(const link of supplierVariantLinks){
    const key=String(link.supplier_product_id),variant=variantsById.get(String(link.product_variant_id));
    if(variant){if(!linksBySupplier.has(key))linksBySupplier.set(key,[]);linksBySupplier.get(key).push(variant)}
  }
  return supplierProducts.flatMap(supplier=>{
    const category=categories.get(String(supplier.category_id)),mapping=productForCategory[category];
    if(!mapping||supplier.kind==='supply'||supplier.kind==='dtf')return [];
    const linked=linksBySupplier.get(String(supplier.id))||[];
    return [{productSlug:mapping[0],model:mapping[1],size:sizeFromName(supplier.name,category),supplier,linked,published:Boolean(supplier.active&&supplier.confirmed_price_clp>0&&supplier.price_confirmed_at&&linked.some(variant=>variant.active))}];
  }).sort((a,b)=>a.productSlug.localeCompare(b.productSlug,'es')||a.model.localeCompare(b.model,'es')||Number(a.supplier.sort_order||0)-Number(b.supplier.sort_order||0)||a.size.localeCompare(b.size,'es'));
}
