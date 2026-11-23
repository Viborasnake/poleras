import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogVideoDimensions,catalogVideoFileError,CATALOG_VIDEO_SOURCE_MB} from './video-optimization.js';
import {isCatalogMp4,isCatalogVideoPath,MAX_CATALOG_VIDEO_BYTES} from '../supabase/functions/_shared/catalog-video.js';

test('bounds video output without enlarging small clips and preserves orientation',()=>{
 assert.deepEqual(catalogVideoDimensions(3840,2160),{width:1920,height:1080});
 assert.deepEqual(catalogVideoDimensions(1080,1920),{width:1080,height:1920});
 assert.deepEqual(catalogVideoDimensions(640,360),{width:640,height:360});
 assert.equal(catalogVideoFileError({name:'CLIP.MOV',size:4096}),'');
 assert.match(catalogVideoFileError({name:'CLIP.JPG',size:4096}),/MP4, MOV o WebM/);
 assert.match(catalogVideoFileError({name:'CLIP.mp4',size:CATALOG_VIDEO_SOURCE_MB*1024**2+1}),/supera/);
});

test('catalog video uploads use a dedicated MP4 path and the ISO media signature',()=>{
 assert.ok(isCatalogVideoPath('retro/bird-video-poleras-v1.mp4'));
 for(const path of ['retro/bird-mockup-poleras-v1.mp4','../bird-video-poleras.mp4','retro/bird-video-poleras.webm'])assert.equal(isCatalogVideoPath(path),false);
 const buffer=new Uint8Array(32);
 buffer.set([0,0,0,24,102,116,121,112]);
 assert.ok(isCatalogMp4(buffer.buffer));
 buffer[4]=0;
 assert.equal(isCatalogMp4(buffer.buffer),false);
 assert.equal(MAX_CATALOG_VIDEO_BYTES,5*1024**2);
});
