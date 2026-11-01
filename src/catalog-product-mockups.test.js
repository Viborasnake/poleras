import test from 'node:test';
import assert from 'node:assert/strict';
import {designProductMockups,designWithProductMockup,catalogProductDesigns,catalogProductOptions} from './catalog-product-mockups.js';
import {productMockupDraft,productMockupFields} from './admin-product-mockups.js';
const design={id:'bird',active:true,productArtworks:{poleras:'/shirt-art.webp',totebags:'/tote-art.webp',bodys:'/body-art.webp'},mockup_path:'/shirt.webp',mockup_hover_path:'/tote.webp',mockup_focus_x:20,mockup_hover_focus_x:80};
test('historical uploads retain shirt and tote identity and separate crops',()=>{
 const shirt=designWithProductMockup(design,'poleras'),tote=designWithProductMockup(design,'totebags');
 assert.equal(shirt.featuredPhoto,'/shirt.webp');assert.equal(shirt.featuredPhotoHover,'');assert.equal(shirt.mockupFocus.x,20);
 assert.equal(tote.featuredPhoto,'/tote.webp');assert.equal(tote.featuredPhotoHover,'');assert.equal(tote.mockupFocus.x,80);assert.equal(tote.artworkPath,'/tote-art.webp');
});
test('missing body and future product photos never reuse a shirt',()=>{
 for(const slug of ['bodys','vasos-termicos']){
  const preview=designWithProductMockup(design,slug);assert.equal(preview.featuredPhoto,'');assert.equal(preview.featuredPhotoHover,'');assert.equal(preview.previewProductSlug,slug);
 }
});
test('explicit maps override historical photos and same-product hover stays scoped',()=>{
 const mapped={...design,productMockups:{poleras:{path:'/new-shirt.webp',hoverPath:'/shirt-back.webp',focusX:150},'vasos-termicos':{path:'/cup.webp'}}};
 assert.equal(designWithProductMockup(mapped,'poleras').featuredPhotoHover,'/shirt-back.webp');
 assert.equal(designWithProductMockup(mapped,'poleras').mockupFocus.x,100);
 assert.equal(designWithProductMockup(mapped,'totebags').featuredPhoto,'');
 assert.equal(designWithProductMockup(mapped,'vasos-termicos').featuredPhoto,'/cup.webp');
 assert.equal(designWithProductMockup({...design,productMockups:{}},'poleras').featuredPhoto,'');
});
test('product filters follow linked designs and hide inactive future products',()=>{
 const onlyShirt={id:'shirt-only',productArtworks:{poleras:'/art.webp'}},inactive={...design,id:'inactive',active:false};
 assert.deepEqual(catalogProductDesigns([design,onlyShirt,inactive],'totebags').map(x=>x.id),['bird']);
 const products=[{slug:'poleras',active:true},{slug:'totebags',active:true},{slug:'vasos-termicos',active:false}];
 const future={id:'cup',productArtworks:{'vasos-termicos':'/art.webp'}};
 assert.deepEqual(catalogProductOptions(products,[design,future]).map(x=>x.slug),['poleras','totebags']);
 assert.deepEqual(catalogProductOptions(products.map(p=>({...p,active:true})),[design,future]).map(x=>x.slug),['poleras','totebags','vasos-termicos']);
});
test('admin edits preserve other product images and unknown future entries',()=>{
 const current={product_mockups:{...designProductMockups(design),bodys:{path:'/baby.webp'},'vasos-termicos':{path:'/cup.webp'}}};
 const values=new Map([['clear_mockup_bodys','on'],['mockup_poleras_focus_x','35']]);
 const updated=productMockupDraft(current,[{slug:'poleras'},{slug:'bodys'}],values);
 assert.equal(updated.poleras.path,'/shirt.webp');assert.equal(updated.poleras.focusX,35);
 assert.equal(updated.totebags.path,'/tote.webp');assert.equal(updated.bodys.path,'');assert.equal(updated['vasos-termicos'].path,'/cup.webp');
 assert.equal(current.product_mockups.bodys.path,'/baby.webp');
});
test('admin mockup slots come from product configuration, including future products',()=>{
 const html=productMockupFields([{slug:'bodys',name:'Bodys'},{slug:'vasos-termicos',name:'Vasos térmicos',active:false}]);
 assert.match(html,/name="mockup_bodys"/);assert.match(html,/name="mockup_vasos-termicos"/);assert.match(html,/Oculto en tienda/);
});

test('Todos never shows a hidden product mockup, even if that was the first photo',()=>{
 const preview=designWithProductMockup(design,'all','poleras',['totebags','bodys']);
 assert.equal(preview.previewProductSlug,'totebags');assert.equal(preview.featuredPhoto,'/tote.webp');
 const bodyOnly=designWithProductMockup(design,'all','poleras',['bodys']);
 assert.equal(bodyOnly.previewProductSlug,'bodys');assert.equal(bodyOnly.featuredPhoto,'');
 assert.deepEqual(catalogProductOptions([{slug:'bodys',active:false}], [design]),[]);
});

test('personalized designs require an admin product link even when a mockup exists',()=>{
 const pet={id:'pet',acceptsCustomerImage:true,productArtworks:{poleras:'/art.webp'},productMockups:{totebags:{path:'/tote.webp'}}};
 assert.deepEqual(catalogProductDesigns([pet],'totebags'),[]);
 assert.deepEqual(catalogProductDesigns([pet],'poleras').map(x=>x.id),['pet']);
});
