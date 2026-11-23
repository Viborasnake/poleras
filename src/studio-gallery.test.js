import test from 'node:test';
import assert from 'node:assert/strict';
import {studioGalleryItems} from './studio-gallery.js';

test('gallery uses available design photographs across active products without choosing a product',()=>{
 const design={productMockups:{bodys:{path:'/body.webp'},totebags:{path:'/bag.webp'},poleras:{path:'/shirt.webp',hoverPath:'/shirt-detail.webp',focusX:35},tazones:{path:'/hidden.webp'}}};
 const products=[{slug:'bodys',name:'Body bebé',sort_order:20},{slug:'totebags',name:'Tote bag',sort_order:30},{slug:'poleras',name:'Polera',sort_order:10},{slug:'tazones',name:'Tazón',active:false}];
 assert.deepEqual(studioGalleryItems(design,products).map(({src,label})=>[src,label]),[['/shirt.webp','Polera'],['/shirt-detail.webp','Polera'],['/body.webp','Body bebé'],['/bag.webp','Tote bag']]);
 assert.equal(studioGalleryItems(design,products)[0].focusX,35);
 assert.equal(studioGalleryItems(null,products).length,0);
});

test('the gallery associates a configured video with its product’s main photo',()=>{
 const clip='https://images.frontbook.cl/retro/bird-video-poleras-v1.mp4';
 const design={productMockups:{poleras:{path:'/polera.webp',hoverPath:'/espalda.webp',videoPath:clip},totebags:{path:'/tote.webp'}}};
 const gallery=studioGalleryItems(design,[{slug:'poleras',name:'Poleras'},{slug:'totebags',name:'Totebags'}]);
 assert.deepEqual(gallery.map(item=>[item.src,item.videoPath]),[
  ['/polera.webp',clip],['/espalda.webp',undefined],['/tote.webp',undefined],
 ]);
});
