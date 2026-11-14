import {PRINT_EXTRAS_CLP,QUALITY_ADJUSTMENT_CLP,orderTotal} from './print-check.js';
import {effectiveQualityReview} from './quality-review.js';
import {isCatalogPrintIncluded} from '../supabase/functions/_shared/catalog-personalization.js';
import {normalizePrintConfiguration,printConfigurationCount} from '../supabase/functions/_shared/print-configuration.js';

function normalizedPrintSides(item={}){
 if(['front','back','both'].includes(item.printSides))return item.printSides;
 if(/^Espalda$/i.test(item.sides||''))return 'back';
 if(String(item.sides||'').includes('+'))return 'both';
 return 'front';
}

export function cartPriceBreakdown(item={},currentBase=null,reviewFee=QUALITY_ADJUSTMENT_CLP,printPrices=null){
 const qualityReviewFee=Number.isSafeInteger(reviewFee)&&reviewFee>=0?reviewFee:QUALITY_ADJUSTMENT_CLP;
 const printSides=normalizedPrintSides(item);
 const printCount=printConfigurationCount(item.printConfiguration,printSides);
 const previousPrintExtra=Math.max(0,printCount-1)*PRINT_EXTRAS_CLP.both;
 const previousReview=Boolean(item.qualityReview)?qualityReviewFee:0;
 const storedBase=Math.max(0,Number(item.basePrice)||Number(item.price||0)-previousPrintExtra-previousReview);
 const base=Number.isSafeInteger(currentBase)&&currentBase>=0?currentBase:storedBase;
 const qualityReview=effectiveQualityReview(item);
 const pricing=orderTotal(base,printSides,qualityReview?qualityReviewFee:0,printCount,item.modelCode==='tote'||/tote/i.test(item.kind||'')?null:normalizePrintConfiguration(item.printConfiguration,printSides),printPrices,isCatalogPrintIncluded(item,printSides,printCount));
 return {
  base,
  printSides,
  print:pricing.print,
  qualityReview,
  review:qualityReview?qualityReviewFee:0,
  unit:pricing.total,
  line:pricing.total*Math.max(1,Number(item.quantity)||1),
 };
}
