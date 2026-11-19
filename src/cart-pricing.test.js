import test from 'node:test';
import assert from 'node:assert/strict';
import {cartPriceBreakdown,cartUsesPersonalizationBase,cartVariantBasePrice} from './cart-pricing.js';

test('corrige un diseño de catálogo tal cual guardado antes de quitar el ajuste técnico',()=>{
 const result=cartPriceBreakdown({catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:false,qualityReview:true,price:20980,quantity:1},15990);
 assert.deepEqual(result,{base:15990,printSides:'front',print:0,qualityReview:false,review:0,unit:15990,line:15990});
});

test('el estampado principal de una colección está incluido también al personalizarla',()=>{
 const configuration={front:{placement:'chest_left',size:'pocket'}};
 const prices={front_large_clp:5990,front_pocket_clp:2990,back_large_clp:5990,arm_clp:2990};
 const catalog=cartPriceBreakdown({catalogDesignSlug:'personas',catalogDesignCustomerImage:false,printConfiguration:configuration,quantity:1},13990,4990,prices);
 const personalized=cartPriceBreakdown({catalogDesignSlug:'personas',catalogDesignCustomerImage:true,printConfiguration:configuration,quantity:1},13990,4990,prices);
 assert.equal(catalog.print,0);
 assert.equal(catalog.unit,13990);
 assert.equal(personalized.print,0);
 assert.equal(personalized.unit,13990);
});

test('una configuración adicional no obtiene la exención del diseño publicado',()=>{
 const item={catalogDesignSlug:'personas',catalogDesignCustomerImage:false,printSides:'both',printConfiguration:{prints:[{side:'front',placement:'center',size:'large'},{side:'back',placement:'center',size:'large'}]},quantity:1};
 const result=cartPriceBreakdown(item,13990);
 assert.equal(result.print,11980);
 assert.equal(result.unit,25970);
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

test('separa el precio base de personalización del precio de catálogo',()=>{
 const variant={priceClp:19990,personalizationBasePriceClp:14990};
 assert.equal(cartUsesPersonalizationBase({catalogDesignSlug:'turbo-man',purchaseType:'catalog'}),false);
 assert.equal(cartUsesPersonalizationBase({catalogDesignSlug:'turbo-man',purchaseType:'personalized'}),false);
 assert.equal(cartUsesPersonalizationBase({catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:true}),true);
 assert.equal(cartVariantBasePrice(variant,{catalogDesignSlug:'turbo-man',purchaseType:'personalized'}),19990);
 assert.equal(cartVariantBasePrice(variant,{catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:true}),14990);
 assert.equal(cartVariantBasePrice(variant,{catalogDesignSlug:'turbo-man',purchaseType:'catalog'}),19990);
});
