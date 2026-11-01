import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedColorsForModel,designProductColorMap,normalizeAllowedProductColors} from '../supabase/functions/_shared/catalog-product-colors.js';

test('normaliza la selección explícita por producto',()=>{
 assert.deepEqual(normalizeAllowedProductColors({poleras:['#FFFFFF','#ffffff','x'],totebags:['#D9C7A4']}),{poleras:['#ffffff'],totebags:['#d9c7a4']});
 assert.deepEqual(allowedColorsForModel({allowedProductColors:{poleras:['#202124']}},'basic'),['#202124']);
 assert.deepEqual(allowedColorsForModel({allowed_product_colors:{totebags:['#d9c7a4']}},'tote'),['#d9c7a4']);
});

test('los diseños históricos heredan temporalmente su lista plana por producto',()=>{
 assert.deepEqual(designProductColorMap({allowed_colors:['#FFFFFF']},['poleras','totebags']),{poleras:['#ffffff'],totebags:['#ffffff']});
 assert.deepEqual(designProductColorMap({allowed_product_colors:{poleras:['#202124']},allowed_colors:['#ffffff']},['poleras']),{poleras:['#202124']});
});
