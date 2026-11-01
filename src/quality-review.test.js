import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveQualityReview} from './quality-review.js';

test('un diseño de catálogo tal cual nunca paga ajuste técnico',()=>{
 assert.equal(effectiveQualityReview({catalogDesignSlug:'turbo-man',catalogDesignCustomerImage:false,qualityReview:true}),false);
});

test('la revisión técnica sigue disponible para archivos del cliente',()=>{
 assert.equal(effectiveQualityReview({qualityReview:true}),true);
 assert.equal(effectiveQualityReview({catalogDesignSlug:'familia',catalogDesignCustomerImage:true,qualityReview:true}),true);
});
