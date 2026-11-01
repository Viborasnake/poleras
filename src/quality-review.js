export function isUnmodifiedCatalogItem(item={}){
 return Boolean(item.catalogDesignSlug)&&!Boolean(item.catalogDesignCustomerImage);
}

export function effectiveQualityReview(item={}){
 return !isUnmodifiedCatalogItem(item)&&Boolean(item.qualityReview);
}
