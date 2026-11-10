import test from 'node:test';
import assert from 'node:assert/strict';
import {DETAIL_BLOCK_ORDER,preserveStudioView,replaceStudioControl} from './studio-sequence.js';

test('detalle conserva el orden comercial solicitado',()=>{
 assert.deepEqual(DETAIL_BLOCK_ORDER,['product-family-block','model-block','size-block','color-block','print-placement-block']);
});

test('preserva scroll y foco sin forzar desplazamiento global',()=>{
 let scroll=-1,focused=null;
 const result=preserveStudioView({scrollTop:143,activeKey:'M',find:key=>({key}),focus:element=>{focused=element.key},setScroll:value=>{scroll=value}});
 assert.equal(scroll,143);assert.equal(focused,'M');assert.deepEqual(result,{scrollTop:143,activeKey:'M'});
});

test('añadir mantiene el encabezado en el lugar del botón aunque colapse una ubicación anterior',()=>{
 const scroller={scrollTop:900};let updated=false,focused=false;
 const replacement={getBoundingClientRect:()=>{assert.equal(updated,true);return {top:80}},focus:options=>{assert.deepEqual(options,{preventScroll:true});focused=true}};
 replaceStudioControl({control:{getBoundingClientRect:()=>({top:390})},scroller,update:()=>{updated=true},findReplacement:()=>replacement});
 assert.equal(scroller.scrollTop,590);assert.equal(focused,true);
});

test('compensa también el reinicio de scroll durante el render sin tocar scrolls externos',()=>{
 const scroller={scrollTop:400};let options;
 replaceStudioControl({control:{getBoundingClientRect:()=>({top:300})},scroller,update:()=>{scroller.scrollTop=0},findReplacement:()=>({getBoundingClientRect:()=>({top:700}),focus:value=>{options=value}})});
 assert.equal(scroller.scrollTop,400);assert.deepEqual(options,{preventScroll:true});
});
