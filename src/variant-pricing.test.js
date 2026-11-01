import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumEligibleVariantPrice} from './variant-pricing.js';
import {normalizeVariantRows} from '../supabase/functions/_shared/variant-selection.js';

const variants=[
 {id:1,modelCode:'basic',size:'M',color:'#fff000',priceClp:14990},
 {id:2,modelCode:'over',size:'M',color:'#fff000',priceClp:21990},
 {id:3,modelCode:'kid',size:'4 años',color:'#fff000',priceClp:8990},
 {id:4,modelCode:'body',size:'0-3 meses',color:'#fff000',priceClp:11990},
];
test('minimum spans eligible models and respects design colors',()=>{
 const normalized=normalizeVariantRows(variants.map(row=>({id:row.id,model_code:row.modelCode,size:row.size,color_hex:row.color,price_clp:row.priceClp,active:true,product_models:{code:row.modelCode,active:true}})));
 assert.equal(minimumEligibleVariantPrice(normalized,['basic','over']),14990);
 assert.equal(minimumEligibleVariantPrice(normalized,['kids']),8990);
 assert.equal(minimumEligibleVariantPrice(normalized,['body']),11990);
 assert.equal(minimumEligibleVariantPrice(normalized,['basic'],{allowed_colors:['#202124']}),null);
 const withInactive=normalizeVariantRows([{id:5,model_code:'basic',size:'M',color_hex:'#fff000',price_clp:1000,active:false,product_models:{code:'basic',active:true}},...variants.map(row=>({id:row.id,model_code:row.modelCode,size:row.size,color_hex:row.color,price_clp:row.priceClp,active:true,product_models:{code:row.modelCode,active:true}}))]);
 assert.equal(minimumEligibleVariantPrice(withInactive,['basic']),14990);
});
