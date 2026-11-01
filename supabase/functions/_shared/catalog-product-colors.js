const HEX_COLOR=/^#[0-9a-f]{6}$/;

export const PRODUCT_SLUG_BY_MODEL={
  basic:'poleras',
  woman:'poleras',
  over:'poleras',
  kid:'poleras',
  body:'bodys',
  tote:'totebags',
};

export function normalizeColorList(value){
  if(!Array.isArray(value))return null;
  return [...new Set(value.map(color=>String(color||'').toLowerCase()).filter(color=>HEX_COLOR.test(color)))];
}

export function normalizeAllowedProductColors(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  return Object.fromEntries(Object.entries(value).flatMap(([slug,colors])=>{
    const normalized=normalizeColorList(colors);
    return normalized?[[String(slug),normalized]]:[];
  }));
}

export function designProductColorMap(design,productSlugs=[]){
  const explicit=normalizeAllowedProductColors(design?.allowed_product_colors??design?.allowedProductColors);
  if(explicit)return explicit;
  const legacy=normalizeColorList(design?.allowed_colors??design?.allowedColors);
  if(!legacy)return {};
  return Object.fromEntries(productSlugs.map(slug=>[slug,[...legacy]]));
}

export function allowedColorsForModel(design,modelCode){
  const productSlug=PRODUCT_SLUG_BY_MODEL[String(modelCode||'')];
  const explicit=normalizeAllowedProductColors(design?.allowed_product_colors??design?.allowedProductColors);
  if(productSlug&&explicit&&Object.prototype.hasOwnProperty.call(explicit,productSlug))return explicit[productSlug];
  return null;
}
