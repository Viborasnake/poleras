import {isUnmodifiedCatalogItem} from '../supabase/functions/_shared/catalog-personalization.js';
export {isUnmodifiedCatalogItem};

export function effectiveQualityReview(item={}){
 return !isUnmodifiedCatalogItem(item)&&Boolean(item.qualityReview);
}
