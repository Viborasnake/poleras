import {allowedColorsForModel} from './catalog-product-colors.js';

export const canonicalModelCode=code=>code==='kids'?'kid':String(code||'');
// La compra depende de una variante activa con talla y precio publicado.
// El visor propio ya se entrega desde src/body-geometry.js.
export const bodyCommerceReady=true;
export const normalizeVariantColor=color=>/^#[0-9a-f]{6}$/i.test(String(color||''))?String(color).toLowerCase():null;
export function bodyMonthSize(value){
 const match=String(value||'').trim().match(/^(\d+)\s*[-–]\s*(\d+)(?:\s*mes(?:es)?)?$/i);
 if(!match)return null;
 const start=Number(match[1]),end=Number(match[2]);
 return Number.isInteger(start)&&Number.isInteger(end)&&start<end?`${start}-${end} meses`:null;
}

export function normalizeVariantRows(rows=[]){
  return rows.flatMap(row=>{
    const model=Array.isArray(row.product_models)?row.product_models[0]:row.product_models;
    const color=normalizeVariantColor(row.color_hex);
    if(!model?.active||row.active===false||!color||!row.size||!Number.isInteger(row.price_clp)||row.price_clp<0)return [];
    return [{id:row.id,sku:row.sku,modelCode:canonicalModelCode(model.code),size:row.size,color,colorName:row.color_name||color,priceClp:row.price_clp}];
  });
}

export function allowedVariantRows(variants,modelCode,size,design=null){
  const code=canonicalModelCode(modelCode);
  const productColors=allowedColorsForModel(design,code);
  if(productColors)return variants.filter(variant=>variant.modelCode===code&&(!size||variant.size===size)&&productColors.includes(variant.color));
  const acceptsCustomerImage=Boolean(design?.accepts_customer_image??design?.acceptsCustomerImage);
  const allowed=acceptsCustomerImage?null:(design?.allowed_colors??design?.allowedColors);
  // The sample color is editorial metadata. Legacy designs without an
  // explicit color list use the live variants for each product.
  // Los registros históricos conservan el comportamiento previo. Los diseños
  // nuevos usan allowed_product_colors, incluida la selección de totebags.
  const colors=code==='tote'?null:(design&&Array.isArray(allowed)?allowed.map(normalizeVariantColor).filter(Boolean):null);
  return variants.filter(variant=>variant.modelCode===code&&(!size||variant.size===size)&&(!colors||colors.includes(variant.color)));
}

export function resolveExactVariant(variants,modelCode,size,color,design=null){
  const normalizedColor=normalizeVariantColor(color);
  if(!normalizedColor)return {error:'color'};
  const matching=allowedVariantRows(variants,modelCode,size,design).filter(variant=>variant.color===normalizedColor);
  if(matching.length!==1)return {error:matching.length?'ambiguous':'unavailable'};
  return {variant:matching[0]};
}
