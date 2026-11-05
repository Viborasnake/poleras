import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteShareUrl, shareLink } from './share.js';

test('share URLs resolve relative catalog paths against the public origin',()=>{
  assert.equal(absoluteShareUrl('/productos/poleras/papa/','https://droska.frontbook.cl'),'https://droska.frontbook.cl/productos/poleras/papa/');
});

test('shareLink copies the canonical URL when native sharing is unavailable',async()=>{
  let copied='';
  const result=await shareLink({url:'/productos/poleras/papa/modo-leyenda/',origin:'https://droska.frontbook.cl',title:'Modo leyenda',text:'Mira este diseño',navigatorObject:{},clipboard:{writeText:async value=>{copied=value}}});
  assert.equal(result,'copied');
  assert.equal(copied,'https://droska.frontbook.cl/productos/poleras/papa/modo-leyenda/');
});

test('shareLink reports cancelled native sharing without copying unexpectedly',async()=>{
  let copied=false;
  const result=await shareLink({url:'https://droska.frontbook.cl/productos/poleras/papa/',navigatorObject:{share:async()=>{const error=new Error('cancelled');error.name='AbortError';throw error}},clipboard:{}});
  assert.equal(result,'cancelled');
  assert.equal(copied,false);
});

test('shareLink prefers native sharing when both APIs are available',async()=>{
  let shared=false,copied=false;
  const result=await shareLink({url:'/productos/poleras/',origin:'https://droska.frontbook.cl',navigatorObject:{share:async()=>{shared=true}},clipboard:{writeText:async()=>{copied=true}}});
  assert.equal(result,'shared');assert.equal(shared,true);assert.equal(copied,false);
});
