import test from 'node:test';
import assert from 'node:assert/strict';
import { collections, catalogDesigns, filterCatalog, artworkSvg, artworkUrl, designCountLabel, catalogFromRows, collectionsWithDesigns, normalizeAllowedColors, normalizeSampleColor, compareCatalogPriority, catalogAssetUrl } from './catalog.js';

test('catalog assets can move to R2 without changing stored Supabase paths',()=>{
 const source='https://dgndcklmmnnxyqfmnckh.supabase.co/storage/v1/object/public/catalog-designs/aves-chilenas/arte.png';
 assert.equal(catalogAssetUrl(source,'https://images.example.cl/'), 'https://images.example.cl/aves-chilenas/arte.png');
 assert.equal(catalogAssetUrl('https://example.test/other.png','https://images.example.cl'), 'https://example.test/other.png');
});

test('R2 artwork uses the same-origin image proxy required by the 3D viewer',()=>{
 const source='https://images.frontbook.cl/navidad/grinch.webp';
 assert.equal(artworkUrl({artworkPath:source}),`/api/catalog-image?url=${encodeURIComponent(source)}`);
});

test('featured catalog items share one stable priority comparator',()=>{
  const items=[{id:'later',featured:false,created_at:'2026-01-02'},{id:'featured-old',featured:true,created_at:'2025-01-01'},{id:'featured-new',featured:true,created_at:'2026-01-01'}];
  assert.deepEqual(items.sort(compareCatalogPriority).map(item=>item.id),['featured-new','featured-old','later']);
});

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

test('empty collections are excluded from the public catalog',()=>{
  const visible=collectionsWithDesigns([
    {id:'with-design',productSlug:'poleras'},
    {id:'empty',productSlug:'poleras'},
  ],[
    {id:'design',collection:'with-design',active:true,productArtworks:{poleras:'https://example.test/design.png'}},
  ]);
  assert.deepEqual(visible.map(collection=>collection.id),['with-design']);
});

test('Supabase rows become the same catalog model and preserve empty collections',()=>{
  const result=catalogFromRows([
    {id:10,slug:'papa',name:'Para Papá',active:true,is_featured:true,is_new_collection:true,sort_order:1},
    {id:11,slug:'mascota',name:'Mascota',active:true,sort_order:2},
  ],[
    {id:20,collection_id:10,slug:'papa-leyenda',name:'Modo leyenda',caption:'Actualizada',artwork_path:'local:papa-leyenda',product_artworks:{poleras:'local:papa-leyenda',totebags:'https://example.test/tote.png'},sample_color:'#202124',allowed_colors:['#202124','#FFFFFF'],allowed_product_colors:{poleras:['#202124'],totebags:['#D9C7A4']},accepts_customer_image:true,customer_photo_subject:'people',is_featured:true,active:true},
  ]);
  assert.deepEqual(result.collections.map(item=>item.id),['papa','mascota']);
  assert.equal(result.collections[0].featured,true);
  assert.equal(result.collections[0].isNewCollection,true);
  assert.equal(result.designs.length,1);
  assert.equal(result.designs[0].collection,'papa');
  assert.equal(result.designs[0].motif,'rays');
  assert.equal(result.designs[0].sampleColor,'#202124');
  assert.deepEqual(result.designs[0].allowedColors,['#202124','#ffffff']);
  assert.deepEqual(result.designs[0].allowedProductColors,{poleras:['#202124'],totebags:['#d9c7a4']});
  assert.equal(result.designs[0].acceptsCustomerImage,true);
  assert.equal(result.designs[0].customerPhotoSubject,'people');
  assert.equal(result.designs[0].featured,true);
  assert.equal(filterCatalog('mascota',result.designs).length,0);
});

test('the newest published design is first so a collection cover follows the latest upload',()=>{
  const result=catalogFromRows([{id:10,slug:'papa',name:'Para Papá',active:true,sort_order:1}],[
    {id:20,collection_id:10,slug:'papa-leyenda',name:'Anterior',caption:'',artwork_path:'local:papa-leyenda',sample_color:'#202124',active:true,created_at:'2026-10-01T10:00:00Z'},
    {id:21,collection_id:10,slug:'papa-ruta',name:'Reciente',caption:'',artwork_path:'local:papa-ruta',sample_color:'#ffffff',active:true,created_at:'2026-10-07T10:00:00Z'},
  ]);
  assert.deepEqual(result.designs.map(item=>item.name),['Reciente','Anterior']);
  assert.equal(result.designs[0].createdAt,'2026-10-07T10:00:00Z');
  assert.equal(result.designs[0].customerPhotoSubject,'pets');
});

test('categories group collections and hide collections from inactive categories',()=>{
  const result=catalogFromRows([
    {id:1,category_id:10,slug:'juegos',name:'Juegos',sort_order:2},
    {id:2,category_id:20,slug:'bosques',name:'Bosques',sort_order:1},
  ],[
    {id:3,collection_id:1,slug:'juegos-player',name:'Player one',active:true},
    {id:4,collection_id:2,slug:'bosque',name:'Bosque',active:true},
  ],[{id:10,slug:'videojuegos',name:'Videojuegos',sort_order:10}]);
  assert.deepEqual(result.categories.map(item=>item.id),['videojuegos']);
  assert.deepEqual(result.collections.map(item=>[item.id,item.category]),[['juegos','videojuegos']]);
  assert.deepEqual(result.designs.map(item=>item.id),['juegos-player']);
});

test('editorial photos remain attached to the matching uploaded designs',()=>{
  const result=catalogFromRows([{id:7,slug:'death-stranding',name:'Death Stranding',active:true,sort_order:1},{id:9,slug:'metal-gear',name:'Metal Gear',active:true,sort_order:2}],[
    {id:18,collection_id:7,slug:'cliff-unger',name:'Cliff Unger',caption:'',artwork_path:'https://example.test/cliff.png',sample_color:'#202124',active:true,created_at:'2026-10-07T03:35:50Z'},
    {id:19,collection_id:9,slug:'meryl-cyberpunk',name:'Meryl Cyberpunk',caption:'',artwork_path:'https://example.test/meryl.png',sample_color:'#202124',active:true,created_at:'2026-10-07T03:40:27Z'},
  ]);
  assert.equal(result.designs.find(item=>item.id==='cliff-unger').featuredPhoto,'/death-stranding-main.webp');
  assert.equal(result.designs.find(item=>item.id==='meryl-cyberpunk').featuredPhoto,'/resident-evil-claire.webp');
});

test('a mockup uploaded in administration overrides the legacy editorial photo',()=>{
 const result=catalogFromRows([{id:7,slug:'death-stranding',name:'Death Stranding',active:true,sort_order:1}],[
  {id:18,collection_id:7,slug:'cliff-unger',name:'Cliff Unger',caption:'',artwork_path:'https://example.test/cliff.png',mockup_path:'https://example.test/cliff-mockup.webp',mockup_focus_x:31,mockup_focus_y:42,mockup_hover_path:'https://example.test/cliff-hover.webp',mockup_hover_focus_x:63,mockup_hover_focus_y:74,personalization_arrow_x:58,personalization_arrow_y:64,sample_color:'#202124',active:true},
 ]);
 assert.equal(result.designs[0].featuredPhoto,'https://example.test/cliff-mockup.webp');
 assert.equal(result.designs[0].featuredPhotoHover,'https://example.test/cliff-hover.webp');
 assert.deepEqual(result.designs[0].mockupFocus,{x:31,y:42});
 assert.deepEqual(result.designs[0].mockupHoverFocus,{x:63,y:74});
 assert.deepEqual(result.designs[0].personalizationArrow,{x:58,y:64});
});

test('sample color accepts valid variant hex and falls back for invalid values',()=>{
  assert.equal(normalizeSampleColor('#202124'),'#202124');
  assert.equal(normalizeSampleColor('#FFFFFF'),'#ffffff');
  assert.equal(normalizeSampleColor('#123456'),'#123456');
  assert.equal(normalizeSampleColor('invalid'),'#ffffff');
});

test('allowed design colors preserve legacy absence and normalize explicit lists',()=>{
  assert.equal(normalizeAllowedColors(null),null);
  assert.equal(normalizeAllowedColors(undefined),null);
  assert.deepEqual(normalizeAllowedColors(['#FFFFFF','#ffffff','#202124','invalid',null]),['#ffffff','#202124']);
  assert.deepEqual(normalizeAllowedColors([]),[]);
  assert.deepEqual(normalizeAllowedColors('not-an-array'),[]);
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

test('product-specific artwork never falls back to another product',async()=>{
 const {designForProduct,designProductArtworks,modelProductSlug,validateProductArtworks}=await import('./catalog-product-artworks.js');
 const rows=catalogFromRows([{id:1,slug:'aves',name:'Aves',catalog_product_types:{slug:'poleras'}}],[{id:2,collection_id:1,slug:'turca',name:'Turca',artwork_path:'https://example.test/shirt.png',product_artworks:{poleras:'https://example.test/shirt.png',totebags:'https://example.test/tote.png'}}]);
 const design=rows.designs[0];
 assert.equal(artworkUrl(designForProduct(design,'poleras')),'https://example.test/shirt.png');
 assert.equal(artworkUrl(designForProduct(design,'totebags')),'https://example.test/tote.png');
 assert.equal(designForProduct(design,'afiches'),null);
 assert.deepEqual(designProductArtworks({artwork_path:'old.png'},'totebags'),{totebags:'old.png'});
 assert.deepEqual(designProductArtworks({artwork_path:'old.png',product_artworks:{}}),{});
 assert.match(validateProductArtworks([],{},{}),/al menos un producto/);
 const products=[{slug:'poleras',name:'Poleras'},{slug:'totebags',name:'Totebags'}];
 assert.match(validateProductArtworks(products,{poleras:'old.png'},{}),/Totebags/);
 assert.equal(validateProductArtworks(products,{poleras:'old.png'},{totebags:{size:50}}),'');
 assert.equal(designForProduct(catalogDesigns[0],'totebags'),null);
 assert.equal(modelProductSlug('body'),'bodys');
});
