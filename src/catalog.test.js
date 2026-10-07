import test from 'node:test';
import assert from 'node:assert/strict';
import { collections, catalogDesigns, filterCatalog, artworkSvg, artworkUrl, designCountLabel, catalogFromRows, normalizeSampleColor } from './catalog.js';

test('every original catalog design belongs to a visible collection',()=>{
  const ids=new Set(collections.map(collection=>collection.id));
  assert.equal(new Set(catalogDesigns.map(design=>design.id)).size,catalogDesigns.length);
  assert.ok(catalogDesigns.every(design=>ids.has(design.collection)));
  for(const collection of collections)assert.ok(filterCatalog(collection.id).length>0);
});

test('collection filter returns only matching designs',()=>{
  assert.equal(filterCatalog().length,catalogDesigns.length);
  assert.ok(filterCatalog('juegos').every(design=>design.collection==='juegos'));
});

test('Supabase rows become the same catalog model and preserve empty collections',()=>{
  const result=catalogFromRows([
    {id:10,slug:'papa',name:'Para Papá',active:true,sort_order:1},
    {id:11,slug:'mascota',name:'Mascota',active:true,sort_order:2},
  ],[
    {id:20,collection_id:10,slug:'papa-leyenda',name:'Modo leyenda',caption:'Actualizada',artwork_path:'local:papa-leyenda',sample_color:'#202124',active:true},
  ]);
  assert.deepEqual(result.collections.map(item=>item.id),['papa','mascota']);
  assert.equal(result.designs.length,1);
  assert.equal(result.designs[0].collection,'papa');
  assert.equal(result.designs[0].motif,'rays');
  assert.equal(result.designs[0].sampleColor,'#202124');
  assert.equal(filterCatalog('mascota',result.designs).length,0);
});

test('the newest published design is first so a collection cover follows the latest upload',()=>{
  const result=catalogFromRows([{id:10,slug:'papa',name:'Para Papá',active:true,sort_order:1}],[
    {id:20,collection_id:10,slug:'papa-leyenda',name:'Anterior',caption:'',artwork_path:'local:papa-leyenda',sample_color:'#202124',active:true,created_at:'2026-10-01T10:00:00Z'},
    {id:21,collection_id:10,slug:'papa-ruta',name:'Reciente',caption:'',artwork_path:'local:papa-ruta',sample_color:'#ffffff',active:true,created_at:'2026-10-07T10:00:00Z'},
  ]);
  assert.deepEqual(result.designs.map(item=>item.name),['Reciente','Anterior']);
});

test('editorial photos remain attached to the matching uploaded designs',()=>{
  const result=catalogFromRows([{id:7,slug:'death-stranding',name:'Death Stranding',active:true,sort_order:1},{id:9,slug:'metal-gear',name:'Metal Gear',active:true,sort_order:2}],[
    {id:18,collection_id:7,slug:'cliff-unger',name:'Cliff Unger',caption:'',artwork_path:'https://example.test/cliff.png',sample_color:'#202124',active:true,created_at:'2026-10-07T03:35:50Z'},
    {id:19,collection_id:9,slug:'meryl-cyberpunk',name:'Meryl Cyberpunk',caption:'',artwork_path:'https://example.test/meryl.png',sample_color:'#202124',active:true,created_at:'2026-10-07T03:40:27Z'},
  ]);
  assert.equal(result.designs.find(item=>item.id==='cliff-unger').featuredPhoto,'/death-stranding-main.webp');
  assert.equal(result.designs.find(item=>item.id==='meryl-cyberpunk').featuredPhoto,'/resident-evil-claire.webp');
});

test('sample shirt colors accept DS options and fall back safely',()=>{
  assert.equal(normalizeSampleColor('#202124'),'#202124');
  assert.equal(normalizeSampleColor('#FFFFFF'),'#ffffff');
  assert.equal(normalizeSampleColor('#123456'),'#ffffff');
});

test('collection count label follows the real visible content',()=>{
  assert.equal(designCountLabel(filterCatalog('papa').length),'2 diseños');
  assert.equal(designCountLabel(1),'1 diseño');
  assert.equal(designCountLabel(0),'0 diseños');
});

test('each design has a renderable SVG data URL',()=>{
  for(const design of catalogDesigns){
    assert.match(artworkSvg(design),/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(artworkSvg(design),/<\/svg>$/);
    assert.match(artworkUrl(design),/^data:image\/svg\+xml;charset=utf-8,/);
  }
});
