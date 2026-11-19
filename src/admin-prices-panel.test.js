import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesPriceFilter} from './admin-prices-panel.js';

test('la búsqueda de precios combina texto sin tildes con el estado elegido',()=>{
 const row={searchable:'Polera básica · catálogo $15.990',state:'published',missingBase:true};
 assert.equal(matchesPriceFilter(row,'BASICA','published'),true);
 assert.equal(matchesPriceFilter(row,'BASICA','review'),false);
 assert.equal(matchesPriceFilter(row,'15.990','missing-base'),true);
 assert.equal(matchesPriceFilter(row,'oversize','missing-base'),false);
 assert.equal(matchesPriceFilter({...row,missingBase:false},'','missing-base'),false);
 assert.equal(matchesPriceFilter(row,'  ','all'),true);
});
