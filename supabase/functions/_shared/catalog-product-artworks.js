// Missing legacy mappings belong only to their collection product.
export function designProductArtworks(design, collectionProduct='poleras') {
  const explicit=design?.productArtworks ?? design?.product_artworks;
  if(explicit!=null) return Object.fromEntries(Object.entries(explicit).filter(([,path])=>typeof path==='string'&&path.trim()));
  const path=design?.artworkPath || design?.artwork_path || (design?.lines ? `local:${design.id}` : '');
  return path ? {[collectionProduct]:path} : {};
}
export const modelProductSlug=kind=>kind==='tote'?'totebags':kind==='body'?'bodys':'poleras';
export function designForProduct(design,slug) {
  const path=designProductArtworks(design)[slug];
  return path ? {...design,artworkPath:path} : null;
}
export function validateProductArtworks(selected,existing,files) {
  if(!selected.length) return 'Selecciona al menos un producto para este diseño.';
  for(const product of selected) if(!existing[product.slug]&&!files[product.slug]?.size) return `Sube el archivo del diseño para ${product.name}.`;
  return '';
}
