export const catalogProductPath=productSlug=>`/productos/${encodeURIComponent(productSlug)}/`;

export const catalogCollectionPath=(productSlug,collectionSlug)=>
  `${catalogProductPath(productSlug)}${encodeURIComponent(collectionSlug)}/`;

export const catalogDesignPath=(productSlug,collectionSlug,designSlug)=>
  `${catalogCollectionPath(productSlug,collectionSlug)}${encodeURIComponent(designSlug)}/`;

export function parseCatalogPath(pathname){
  const segments=String(pathname||'').split('/').filter(Boolean).map(segment=>decodeURIComponent(segment));
  if(segments[0]!=='productos'||segments.length<2||segments.length>4)return null;
  return {
    productSlug:segments[1],
    collectionSlug:segments[2]||'',
    designSlug:segments[3]||'',
    kind:segments.length===2?'product':segments.length===3?'collection':'design',
  };
}
