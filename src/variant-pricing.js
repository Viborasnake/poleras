import {allowedVariantRows,canonicalModelCode} from '../supabase/functions/_shared/variant-selection.js';

export function minimumEligibleVariantPrice(variants=[],modelCodes=[],design=null){
 const codes=new Set(modelCodes.map(canonicalModelCode));
 const eligible=modelCodes.flatMap(code=>allowedVariantRows(variants,code,null,design)).filter(row=>codes.has(row.modelCode));
 const prices=eligible.map(row=>row.priceClp).filter(Number.isInteger).filter(price=>price>=0);
 return prices.length?Math.min(...prices):null;
}
