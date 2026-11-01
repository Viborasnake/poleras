import test from 'node:test';
import assert from 'node:assert/strict';
import {fallbackCatalogProducts,storefrontProductItems} from './product-navigation.js';

test('public product menu follows the active admin list and exposes published products',()=>{
  const items=storefrontProductItems([
    {slug:'vasos-termicos',name:'Vasos térmicos',menu_description:'Bebidas',active:true,sort_order:50},
    {slug:'imanes',name:'Imanes',active:false,sort_order:20},
    {slug:'poleras',name:'Poleras',menu_description:'Poleras personalizadas',active:true,sort_order:10},
  ]);
  assert.deepEqual(items.map(item=>item.slug),['poleras','vasos-termicos']);
  assert.equal(items[0].description,'Poleras personalizadas');
  assert.equal(items[0].purchasable,true);
  assert.equal(items[1].purchasable,false);
  assert.equal(items[1].explorable,false);
});

test('a published tote bag shares the catalog and checkout',()=>{
  const [tote]=storefrontProductItems([
    {slug:'totebags',name:'Totebags',menu_description:'Tu idea para llevar',active:true,sort_order:40},
  ],new Set(['totebags']));
  assert.equal(tote.purchasable,true);
  assert.equal(tote.explorable,true);
});

test('Bodys enters the product menu only when its catalog product is active',()=>{
  const products=[{slug:'bodys',name:'Bodys',active:false,sort_order:15}];
  assert.deepEqual(storefrontProductItems(products),[]);
  const [body]=storefrontProductItems([{...products[0],active:true}]);
  assert.equal(body.purchasable,true);
  assert.equal(body.explorable,true);
});

test('fallback menu has the same five products registered by the migration',()=>{
  assert.deepEqual(storefrontProductItems(fallbackCatalogProducts).map(item=>item.slug),[
    'poleras','imanes','afiches','totebags','vasos-termicos',
  ]);
});
