import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogCollectionPath, catalogDesignPath, catalogProductPath, parseCatalogPath } from './catalog-routes.js';

test('catalog routes are stable, nested and human-readable',()=>{
  assert.equal(catalogProductPath('poleras'),'/productos/poleras/');
  assert.equal(catalogCollectionPath('poleras','sailor-moon'),'/productos/poleras/sailor-moon/');
  assert.equal(catalogDesignPath('poleras','sailor-moon','guardiana-celestial'),'/productos/poleras/sailor-moon/guardiana-celestial/');
});

test('catalog route parser distinguishes product, collection and design pages',()=>{
  assert.deepEqual(parseCatalogPath('/productos/poleras/'),{productSlug:'poleras',collectionSlug:'',designSlug:'',kind:'product'});
  assert.deepEqual(parseCatalogPath('/productos/poleras/papa/'),{productSlug:'poleras',collectionSlug:'papa',designSlug:'',kind:'collection'});
  assert.deepEqual(parseCatalogPath('/productos/poleras/papa/modo-leyenda/'),{productSlug:'poleras',collectionSlug:'papa',designSlug:'modo-leyenda',kind:'design'});
  assert.equal(parseCatalogPath('/otra-ruta/'),null);
});
