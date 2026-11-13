import test from 'node:test';
import assert from 'node:assert/strict';
import {productSizeRows} from './admin-product-sizes.js';

test('lists only sizes backed by a principal insumo for each product',()=>{
 const rows=productSizeRows({
  supplierCategories:[{id:1,slug:'tote-bag'},{id:2,slug:'poleras-ninos'}],
  supplierProducts:[
   {id:8,category_id:1,kind:'garment',name:'Cruda Mediana',active:true,confirmed_price_clp:10990,price_confirmed_at:'2026-11-13'},
   {id:38,category_id:1,kind:'garment',name:'Negra Mediana',active:true,confirmed_price_clp:null},
   {id:42,category_id:2,kind:'garment',name:'4 años',active:true,confirmed_price_clp:9990,price_confirmed_at:'2026-11-13'},
   {id:50,category_id:1,kind:'supply',name:'Caja',active:true}
  ],
  variants:[{id:100,active:true,size:'M'},{id:101,active:true,size:'L'},{id:102,active:true,size:'4 años'}],
  supplierVariantLinks:[{supplier_product_id:8,product_variant_id:100},{supplier_product_id:42,product_variant_id:102}]
 });
 assert.deepEqual(rows.map(row=>[row.productSlug,row.model,row.size,row.published]),[
  ['poleras','Niños','4 años',true],
  ['totebags','Tote bag','M',true],
  ['totebags','Tote bag','M',false]
 ]);
 assert.equal(rows.some(row=>row.size==='L'),false);
});
