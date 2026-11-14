import test from 'node:test';
import assert from 'node:assert/strict';
import {productSizeRows} from './admin-product-sizes.js';

test('groups product sizes with their assigned suppliers and published variants',()=>{
 const rows=productSizeRows({
  productTypes:[{id:1,slug:'poleras',name:'Poleras'},{id:2,slug:'totebags',name:'Totebags'}],
  productSizes:[
   {id:10,product_type_id:1,model_code:'kid',size_code:'4 años',label:'4 años'},
   {id:11,product_type_id:1,model_code:'basic',size_code:'XXL',label:'XXL'},
   {id:12,product_type_id:2,model_code:'tote',size_code:'M',label:'M'}
  ],
  supplierProducts:[
   {id:8,catalog_product_size_id:12,name:'Cruda Mediana',active:true,confirmed_price_clp:10990,price_confirmed_at:'2026-11-13'},
   {id:38,catalog_product_size_id:12,name:'Negra Mediana',active:true,confirmed_price_clp:null},
   {id:42,catalog_product_size_id:10,name:'4 años',active:true,confirmed_price_clp:9990,price_confirmed_at:'2026-11-13'},
   {id:40,catalog_product_size_id:11,name:'Extra Extra Grande',active:true,confirmed_price_clp:null},
   {id:50,catalog_product_size_id:null,name:'Caja',active:true}
  ],
  variants:[{id:100,active:true,size:'M'},{id:101,active:true,size:'L'},{id:102,active:true,size:'4 años'}],
  supplierVariantLinks:[{supplier_product_id:8,product_variant_id:100},{supplier_product_id:42,product_variant_id:102}]
 });
 assert.deepEqual(rows.map(row=>[row.productSlug,row.model,row.size,row.published]),[
  ['poleras','Niños','4 años',true],
  ['poleras','Unisex','XXL',false],
  ['totebags','Tote bag','M',true]
 ]);
 assert.deepEqual(rows.find(row=>row.size==='M').suppliers.map(supplier=>supplier.id),[8,38]);
 assert.equal(rows.some(row=>row.size==='L'),false);
});
