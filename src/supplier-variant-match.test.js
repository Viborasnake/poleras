import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyMonthSize,compatibleSupplierVariants,linkedSupplierVariants} from './supplier-variant-match.js';

test('saved supplier links remain the source of truth after reloading prices',()=>{
 const product={id:24,name:'Grande'};
 const variants=[
  {id:101,size:'L',price_clp:15990,active:true,product_models:{code:'basic',active:true}},
  {id:202,size:'L',price_clp:21990,active:true,product_models:{code:'over',active:true}},
 ];
 const links=[{supplier_product_id:24,product_variant_id:202}];
 assert.deepEqual(linkedSupplierVariants(product,variants,links).map(row=>row.id),[202]);
});

test('body supplier price is limited to its exact month range',()=>{
 const variants=[
  {id:1,size:'0-3 meses',active:true,product_models:{code:'body',active:true}},
  {id:2,size:'3–6 meses',active:true,product_models:{code:'body',active:true}},
  {id:3,size:'6-12 meses',active:false,product_models:{code:'body',active:true}},
  {id:4,size:'0-3 meses',active:true,product_models:{code:'kid',active:true}},
 ];
 assert.equal(bodyMonthSize('3–6 meses'),'3-6 meses');
 assert.deepEqual(compatibleSupplierVariants({name:'0-3 meses',model_code:'body'},variants,'bodys').map(row=>row.id),[1]);
 assert.deepEqual(compatibleSupplierVariants({name:'3-6 meses'},variants,'bodys').map(row=>row.id),[2]);
 assert.deepEqual(compatibleSupplierVariants({name:'sin talla',model_code:'body'},variants,'bodys'),[]);
 assert.deepEqual(compatibleSupplierVariants({name:'6-12 meses'},variants,'bodys'),[]);
});
