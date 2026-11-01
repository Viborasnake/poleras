import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogFiltersMarkup,catalogProductToggleMarkup} from './catalog-filters.js';

test('el selector superior conserva solo Colecciones y Diseños',()=>{
 const html=catalogFiltersMarkup({categories:[{id:'anime',label:'Anime'}]});
 assert.match(html,/data-catalog-view="collections"/);
 assert.match(html,/data-catalog-view="designs"/);
 assert.doesNotMatch(html,/data-catalog-view="products"/);
 assert.doesNotMatch(html,/catalog-product-filter/);
});

test('el controlador de producto es segmentado, accesible y selecciona por card',()=>{
 const html=catalogProductToggleMarkup({
  cardKey:'design:sam-luna',selected:'totebags',
  products:[{slug:'poleras',name:'Poleras'},{slug:'totebags',name:'Totebags'}],
 });
 assert.match(html,/role="group"/);
 assert.match(html,/data-card-key="design:sam-luna"/);
 assert.match(html,/data-card-product="poleras"[^>]*aria-pressed="false"/);
 assert.match(html,/data-card-product="totebags"[^>]*aria-pressed="true"/);
 assert.match(html,/Ver mockup de Totebags/);
});
