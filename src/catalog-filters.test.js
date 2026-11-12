import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogFiltersMarkup,catalogProductToggleMarkup} from './catalog-filters.js';

test('el selector superior conserva Colecciones y Diseños y el filtro de producto queda debajo',()=>{
 const html=catalogFiltersMarkup({category:'anime',product:'bodys',categories:[{id:'anime',label:'Anime'}],products:[{slug:'poleras',name:'Poleras'},{slug:'bodys',name:'Bodys'},{slug:'totebags',name:'Totebags'}]});
 assert.match(html,/data-catalog-view="collections"/);
 assert.match(html,/data-catalog-view="designs"/);
 assert.doesNotMatch(html,/data-catalog-view="products"/);
 assert.match(html,/catalog-product-group/);
 assert.match(html,/id="catalog-product-label">Producto/);
 assert.match(html,/role="group" aria-labelledby="catalog-product-label"/);
 assert.match(html,/data-catalog-product="all" aria-pressed="false"/);
 assert.match(html,/data-catalog-product="poleras" aria-pressed="false"/);
 assert.match(html,/data-catalog-product="bodys" aria-pressed="true"/);
 assert.match(html,/data-catalog-product="totebags" aria-pressed="false"/);
 assert.ok(html.indexOf('catalog-product-group')>html.indexOf('catalog-theme-filter'));
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
