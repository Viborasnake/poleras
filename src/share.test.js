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
