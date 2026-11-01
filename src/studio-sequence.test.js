import test from 'node:test';
import assert from 'node:assert/strict';
import {DETAIL_BLOCK_ORDER,preserveStudioView} from './studio-sequence.js';

test('detalle conserva el orden comercial solicitado',()=>{
 assert.deepEqual(DETAIL_BLOCK_ORDER,['product-family-block','model-block','size-block','color-block','print-placement-block']);
});

test('preserva scroll y foco sin forzar desplazamiento global',()=>{
 let scroll=-1,focused=null;
 const result=preserveStudioView({scrollTop:143,activeKey:'M',find:key=>({key}),focus:element=>{focused=element.key},setScroll:value=>{scroll=value}});
 assert.equal(scroll,143);assert.equal(focused,'M');assert.deepEqual(result,{scrollTop:143,activeKey:'M'});
});
