import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVariantRows,allowedVariantRows,resolveExactVariant} from '../supabase/functions/_shared/variant-selection.js';

const rows=[
  {id:1,sku:'WHT',size:'M',color_hex:'#FFFFFF',color_name:'Blanco',price_clp:14990,active:true,product_models:{code:'basic',active:true}},
  {id:2,sku:'BLK',size:'M',color_hex:'#202124',color_name:'Negro',price_clp:16990,active:true,product_models:{code:'basic',active:true}},
  {id:3,sku:'KID',size:'4 años',color_hex:'#FFFFFF',price_clp:8990,active:true,product_models:{code:'kid',active:true}},
  {id:4,sku:'TOTE',size:'M',color_hex:'#d9c7a4',color_name:'Beige',price_clp:8990,active:true,product_models:{code:'tote',active:true}},
  {id:5,sku:'OFF',size:'M',color_hex:'#ff0000',price_clp:1000,active:false,product_models:{code:'basic',active:true}},
  {id:6,sku:'MODEL-OFF',size:'M',color_hex:'#00ff00',price_clp:1000,active:true,product_models:{code:'basic',active:false}},
  {id:7,sku:'BODY-03',size:'0-3 meses',color_hex:'#ffffff',price_clp:11990,active:true,product_models:{code:'body',active:true}},
  {id:8,sku:'BODY-36',size:'3-6 meses',color_hex:'#ffffff',price_clp:12990,active:true,product_models:{code:'body',active:true}},
];
test('resolves price and SKU for the exact color, including uppercase hex and kid alias',()=>{
  const variants=normalizeVariantRows(rows);
  assert.deepEqual(resolveExactVariant(variants,'basic','M','#202124').variant?.sku,'BLK');
  assert.deepEqual(resolveExactVariant(variants,'basic','M','#ffffff').variant?.priceClp,14990);
  assert.deepEqual(resolveExactVariant(variants,'kids','4 años','#FFFFFF').variant?.sku,'KID');
  assert.deepEqual(resolveExactVariant(variants,'tote','M','#d9c7a4').variant?.sku,'TOTE');
});
test('rejects hidden, disallowed, unknown and ambiguous colors',()=>{
  const variants=normalizeVariantRows(rows),design={allowed_colors:['#ffffff']};
  assert.deepEqual(allowedVariantRows(variants,'basic','M',design).map(item=>item.sku),['WHT']);
  assert.equal(resolveExactVariant(variants,'basic','M','#202124',design).error,'unavailable');
  assert.equal(resolveExactVariant(variants,'basic','M','#ff0000').error,'unavailable');
  assert.equal(resolveExactVariant(variants,'basic','M','#zzzzzz').error,'color');
  assert.equal(resolveExactVariant([...variants,variants[0]],'basic','M','#ffffff').error,'ambiguous');
});
test('legacy designs without allowed colors use published variants, not their sample color',()=>{
  const variants=normalizeVariantRows(rows),legacy={sample_color:'#202124',allowed_colors:null};
  assert.deepEqual(allowedVariantRows(variants,'basic','M',legacy).map(item=>item.sku),['WHT','BLK']);
  assert.equal(resolveExactVariant(variants,'basic','M','#ffffff',legacy).variant?.sku,'WHT');
  assert.equal(resolveExactVariant(variants,'tote','M','#d9c7a4',legacy).variant?.sku,'TOTE');
  assert.deepEqual(allowedVariantRows(variants,'basic','M',{allowed_colors:[]}),[]);
});
test('tote pricing uses its own published palette instead of shirt color restrictions',()=>{
 const variants=normalizeVariantRows([{id:1,sku:'TOTE',size:'M',color_hex:'#d9c7a4',price_clp:9900,active:true,product_models:{code:'tote',active:true}}]);
 assert.deepEqual(allowedVariantRows(variants,'tote','M',{allowed_colors:['#202124']}).map(item=>item.sku),['TOTE']);
});
test('product-specific design colors restrict each linked product, including totebags',()=>{
 const variants=normalizeVariantRows(rows),design={allowed_product_colors:{poleras:['#202124'],bodys:['#ffffff'],totebags:['#d9c7a4']}};
 assert.deepEqual(allowedVariantRows(variants,'basic','M',design).map(item=>item.sku),['BLK']);
 assert.deepEqual(allowedVariantRows(variants,'body',null,design).map(item=>item.sku),['BODY-03','BODY-36']);
 assert.deepEqual(allowedVariantRows(variants,'tote','M',design).map(item=>item.sku),['TOTE']);
 assert.equal(resolveExactVariant(variants,'basic','M','#ffffff',design).error,'unavailable');
 assert.equal(resolveExactVariant(variants,'tote','M','#202124',design).error,'unavailable');
});
test('body month ranges retain their own SKU and price',()=>{
 const variants=normalizeVariantRows(rows);
 assert.equal(resolveExactVariant(variants,'body','0-3 meses','#ffffff').variant?.sku,'BODY-03');
 assert.equal(resolveExactVariant(variants,'body','3-6 meses','#ffffff').variant?.priceClp,12990);
 assert.equal(resolveExactVariant(variants,'body','6-12 meses','#ffffff').error,'unavailable');
});
test('customer-image designs use each product published colors',()=>{
 const variants=normalizeVariantRows(rows),personalized={acceptsCustomerImage:true,allowedColors:['#d9c7a4']};
 assert.deepEqual(allowedVariantRows(variants,'body',null,personalized).map(item=>item.sku),['BODY-03','BODY-36']);
 assert.equal(resolveExactVariant(variants,'tote','M','#d9c7a4',personalized).variant?.sku,'TOTE');
});
test('explicit product colors also apply to customer-image designs',()=>{
 const variants=normalizeVariantRows(rows),personalized={acceptsCustomerImage:true,allowedProductColors:{poleras:['#202124'],totebags:['#d9c7a4']}};
 assert.deepEqual(allowedVariantRows(variants,'basic','M',personalized).map(item=>item.sku),['BLK']);
 assert.equal(resolveExactVariant(variants,'tote','M','#d9c7a4',personalized).variant?.sku,'TOTE');
});
