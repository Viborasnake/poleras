import test from 'node:test';
import assert from 'node:assert/strict';
import {cartPriceBreakdown} from './cart-pricing.js';

test('corrige un diseño de catálogo tal cual guardado antes de quitar el ajuste técnico',()=>{
 const result=cartPriceBreakdown({catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:false,qualityReview:true,price:20980,quantity:1},15990);
 assert.deepEqual(result,{base:15990,printSides:'front',print:5990,qualityReview:false,review:0,unit:21980,line:21980});
});

test('conserva y detalla el ajuste técnico de un producto realmente personalizado',()=>{
 const result=cartPriceBreakdown({qualityReview:true,price:19980,quantity:1},14990);
 assert.deepEqual(result,{base:14990,printSides:'front',print:5990,qualityReview:true,review:4990,unit:25970,line:25970});
});

test('usa el precio de revisión configurado',()=>{
 const result=cartPriceBreakdown({qualityReview:true,quantity:1},14990,2500);
 assert.deepEqual(result,{base:14990,printSides:'front',print:5990,qualityReview:true,review:2500,unit:23480,line:23480});
});

test('detalla la segunda impresión y el total de línea por cantidad',()=>{
 const result=cartPriceBreakdown({qualityReview:false,printSides:'both',price:18980,quantity:2},14990);
 assert.deepEqual(result,{base:14990,printSides:'both',print:11980,qualityReview:false,review:0,unit:26970,line:53940});
});
