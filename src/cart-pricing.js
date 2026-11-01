import {PRINT_EXTRAS_CLP,QUALITY_ADJUSTMENT_CLP,orderTotal} from './print-check.js';
import {effectiveQualityReview} from './quality-review.js';

function normalizedPrintSides(item={}){
 if(['front','back','both'].includes(item.printSides))return item.printSides;
 if(/^Espalda$/i.test(item.sides||''))return 'back';
 if(String(item.sides||'').includes('+'))return 'both';
 return 'front';
}

export function cartPriceBreakdown(item={},currentBase=null){
 const printSides=normalizedPrintSides(item);
 const previousPrintExtra=PRINT_EXTRAS_CLP[printSides]||0;
 const previousReview=Boolean(item.qualityReview)?QUALITY_ADJUSTMENT_CLP:0;
 const storedBase=Math.max(0,Number(item.basePrice)||Number(item.price||0)-previousPrintExtra-previousReview);
 const base=Number.isSafeInteger(currentBase)&&currentBase>=0?currentBase:storedBase;
 const qualityReview=effectiveQualityReview(item);
 const pricing=orderTotal(base,printSides,qualityReview?QUALITY_ADJUSTMENT_CLP:0);
 return {
  base,
  printSides,
  print:pricing.print,
  qualityReview,
  review:qualityReview?QUALITY_ADJUSTMENT_CLP:0,
  unit:pricing.total,
  line:pricing.total*Math.max(1,Number(item.quantity)||1),
 };
}
