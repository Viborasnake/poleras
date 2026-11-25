import {catalogChargeablePrints,POLERA_PRINT_LOCATIONS} from '../supabase/functions/_shared/catalog-polera-prints.js';
import {printPrice} from '../supabase/functions/_shared/print-pricing.js';

export function catalogPrintLabel(print){
 const location=Object.values(POLERA_PRINT_LOCATIONS).find(entry=>entry.side===print.side&&entry.placement===print.placement);
 return location?.label||(print.side==='back'?'Espalda':'Frente');
}

export function catalogPrintViews(prints){
 return prints.flatMap(print=>{
  if(print.placement==='sleeve_both')return ['sleeve_left','sleeve_right'].map(placement=>({
   ...print,placement,key:`${print.id}:${placement}`,label:catalogPrintLabel({...print,placement}),
  }));
  return [{...print,key:print.id,label:catalogPrintLabel(print)}];
 });
}

export function catalogPrintPriceRows(configuration,prices){
 const [primary]=configuration.prints;
 const included={label:primary.placement==='sleeve_both'?'Primer brazo':catalogPrintLabel(primary),amount:null};
 const {prints}=catalogChargeablePrints(configuration);
 return [included,...prints.map(print=>({
  label:print.id===primary.id?'Segundo brazo':catalogPrintLabel(print),
  amount:printPrice({prints:[print]},print.side,prices),
 }))];
}
