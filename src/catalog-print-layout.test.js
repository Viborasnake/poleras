import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogPrintLayoutFor,normalizeCatalogPrintLayout} from './catalog-print-layout.js';

test('each product keeps its own print framing and missing products use the original framing',()=>{
 const design={printLayouts:{poleras:{size:.76,x:-.12,y:.21},bodys:{size:.9,x:0,y:.08}}};
 assert.deepEqual(catalogPrintLayoutFor(design,'poleras'),{size:.76,x:-.12,y:.21});
 assert.deepEqual(catalogPrintLayoutFor(design,'bodys'),{size:.9,x:0,y:.08});
 assert.deepEqual(catalogPrintLayoutFor(design,'totebags'),{size:1,x:0,y:0});
});

test('stored layout values are bounded before reaching the viewer',()=>{
 assert.deepEqual(normalizeCatalogPrintLayout({size:99,x:-8,y:'invalid'}),{size:1.15,x:-.3,y:0});
});
