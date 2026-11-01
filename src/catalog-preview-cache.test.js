import test from 'node:test';
import assert from 'node:assert/strict';
import {previewKey, needsGeneratedPreview} from './catalog-preview-cache.js';

test('editorial and inactive designs do not request generated artwork previews',()=>{
  const cache=new Map();
  assert.equal(needsGeneratedPreview({id:1,featuredPhoto:'/mockup.webp'},'key',cache),false);
  assert.equal(needsGeneratedPreview({id:1,active:false},'key',cache),false);
  assert.equal(needsGeneratedPreview({id:1},'key',cache),true);
});

test('refresh reuses previews but artwork, color and product changes invalidate them',()=>{
  const design={id:1,sampleColor:'#ffffff'};
  const key=previewKey(design,'poleras','/original.png');
  const cache=new Map([[design.id,key]]);
  assert.equal(needsGeneratedPreview(design,key,cache),false);
  for(const changed of [previewKey(design,'poleras','/new.png'),previewKey({...design,sampleColor:'#000000'},'poleras','/original.png'),previewKey(design,'totebags','/original.png')]){
    assert.equal(needsGeneratedPreview(design,changed,cache),true);
  }
});
