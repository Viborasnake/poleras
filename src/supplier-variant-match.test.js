import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyMonthSize,compatibleSupplierVariants,linkedSupplierVariants,supplierVariantsForPrice} from './supplier-variant-match.js';

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

test('tote supplier matches only its active color and size',()=>{
 const variants=[
  {id:1,size:'M',color_hex:'#D9C7A4',active:true,product_models:{code:'tote',active:true}},
  {id:2,size:'M',color_hex:'#202124',active:true,product_models:{code:'tote',active:true}},
  {id:3,size:'L',color_hex:'#202124',active:true,product_models:{code:'tote',active:true}},
  {id:4,size:'M',color_hex:'#202124',active:true,product_models:{code:'basic',active:true}},
 ];
 assert.deepEqual(compatibleSupplierVariants({name:'Negra Mediana',model_code:null},variants,'tote-bag').map(row=>row.id),[2]);
 assert.deepEqual(compatibleSupplierVariants({name:'Cruda Mediana',model_code:'tote'},variants,'tote-bag').map(row=>row.id),[1]);
 assert.deepEqual(compatibleSupplierVariants({name:'Tote sin talla',model_code:null},variants,'tote-bag'),[]);
});

test('unisex XXL without links never falls back to every active variant',()=>{
 const variants=[
  {id:1,size:'M',active:true,product_models:{code:'basic',active:true}},
  {id:2,size:'XXL',active:false,product_models:{code:'basic',active:true}},
  {id:3,size:'M',active:true,product_models:{code:'kid',active:true}},
  {id:4,size:'XXL',active:true,product_models:{code:'over',active:true}}
 ];
 const product={id:40,name:'Extra Extra Grande',model_code:null};
 assert.deepEqual(compatibleSupplierVariants(product,variants,'poleras'),[]);
 assert.deepEqual(supplierVariantsForPrice(product,variants,[],'poleras'),[]);
 assert.deepEqual(compatibleSupplierVariants({name:'Mediana'},variants,'poleras').map(row=>row.id),[1]);
});

test('published XXL uses only its model and size, even if stored links are wrong',()=>{
 const variants=[
  {id:1,size:'XXL',active:true,product_models:{code:'basic',active:true}},
  {id:2,size:'M',active:true,product_models:{code:'basic',active:true}},
  {id:3,size:'XXL',active:true,product_models:{code:'over',active:true}}
 ];
 const product={id:40,name:'Extra Extra Grande'};
 const links=[{supplier_product_id:40,product_variant_id:1},{supplier_product_id:40,product_variant_id:2},{supplier_product_id:40,product_variant_id:3}];
 assert.deepEqual(supplierVariantsForPrice(product,variants,links,'poleras').map(row=>row.id),[1]);
});

test('unknown clothing sizes have no inferred variants',()=>{
 const variants=[{id:1,size:'M',active:true,product_models:{code:'basic',active:true}}];
 assert.deepEqual(compatibleSupplierVariants({name:'Talla inventada'},variants,'poleras'),[]);
 assert.deepEqual(compatibleSupplierVariants({name:'Talla inventada'},variants,'otra-categoria'),[]);
});
