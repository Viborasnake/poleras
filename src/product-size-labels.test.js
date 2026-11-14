import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductSizeCatalog,productSizeLabel,sortProductSizes} from './product-size-labels.js';

test('the storefront uses the visible name and order configured for each Tote Bag size',()=>{
 const catalog=createProductSizeCatalog([
  {model_code:'tote',size_code:'M',label:'Mediana 35 × 40 cm',sort_order:10},
  {model_code:'tote',size_code:'S',label:'Pequeña 30 × 35 cm',sort_order:20},
  {model_code:'tote',size_code:'L',label:'Grande 40 × 45 cm',sort_order:30}
 ]);
 assert.equal(productSizeLabel(catalog,'tote','M'),'Mediana 35 × 40 cm');
 assert.deepEqual(sortProductSizes(catalog,'tote',['L','S','M']),['M','S','L']);
});

test('size names fall back to familiar labels if the public catalog cannot load',()=>{
 const catalog=createProductSizeCatalog([]);
 assert.equal(productSizeLabel(catalog,'tote','S'),'Pequeña');
 assert.equal(productSizeLabel(catalog,'basic','M'),'Mediana');
 assert.equal(productSizeLabel(catalog,'body','12-24 meses'),'12-24 meses');
 assert.deepEqual(sortProductSizes(catalog,'tote',['L','S','M']),['S','M','L']);
});
