import test from 'node:test';
import assert from 'node:assert/strict';
import {cartPriceBreakdown} from './cart-pricing.js';

test('corrige un diseño de catálogo tal cual guardado antes de quitar el ajuste técnico',()=>{
 const result=cartPriceBreakdown({catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:false,qualityReview:true,price:20980,quantity:1},15990);
 assert.deepEqual(result,{base:15990,printSides:'front',print:0,qualityReview:false,review:0,unit:15990,line:15990});
});

test('conserva y detalla el ajuste técnico de un producto realmente personalizado',()=>{
 const result=cartPriceBreakdown({qualityReview:true,price:19980,quantity:1},14990);
 assert.deepEqual(result,{base:14990,printSides:'front',print:0,qualityReview:true,review:4990,unit:19980,line:19980});
});

test('detalla la segunda impresión y el total de línea por cantidad',()=>{
 const result=cartPriceBreakdown({qualityReview:false,printSides:'both',price:18980,quantity:2},14990);
 assert.deepEqual(result,{base:14990,printSides:'both',print:3990,qualityReview:false,review:0,unit:18980,line:37960});
});
