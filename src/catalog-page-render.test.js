import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSeo, renderCatalogPage, structuredData } from './catalog-page-render.js';

const data={kind:'design',product:{slug:'poleras',name:'Poleras'},collection:{slug:'sailor-moon',name:'Sailor Moon'},design:{id:'guardiana',name:'Guardiana <Celestial>',caption:'Magenta & estelar',artworkPath:'https://example.com/a.png',featuredPhoto:'https://example.com/mockup.jpg',featuredPhotoHover:'https://example.com/mockup-hover.jpg',sampleColor:'#202124',featured:true},basePrice:14990,related:[]};

test('design page markup escapes catalog content and links back to the existing studio',()=>{
  const html=renderCatalogPage(data);
  assert.match(html,/Guardiana &lt;Celestial&gt;/);
  assert.match(html,/\?design=guardiana&product=poleras#catalogo/);
  assert.match(html,/seo-trust/);
  assert.match(html,/seo-process/);
  assert.match(html,/seo-faq/);
  assert.match(html,/seo-final-cta/);
  assert.match(html,/seo-shirt-stage--large has-editorial-mockup/);
  assert.match(html,/https:\/\/example\.com\/mockup\.jpg/);
  assert.match(html,/https:\/\/example\.com\/mockup-hover\.jpg/);
  assert.doesNotMatch(html,/vista 3D|Preparando vista 3D/i);
  assert.doesNotMatch(html,/Guardiana <Celestial>/);
});

test('collection pages are useful landings and keep their indexable design cards',()=>{
  const html=renderCatalogPage({...data,kind:'collection',design:undefined,designs:[data.design]});
  assert.match(html,/<h1>Sailor Moon<\/h1>/);
  assert.match(html,/id="disenos"/);
  assert.match(html,/La colección Sailor Moon/);
  assert.match(html,/Personalizar diseño/);
  assert.match(html,/seo-featured-pill/);
  assert.doesNotMatch(html,/seo-landing-hero/);
});

test('collection highlight follows the admin flag, even for Tu Mascota Kaiju',()=>{
  const collection={slug:'tu-mascota-kaiju',name:'Tu Mascota Kaiju',designCount:1,cover:data.design,featured:false};
  const page={kind:'product',product:data.product,collections:[collection],basePrice:14990};
  assert.doesNotMatch(renderCatalogPage(page),/seo-collection-card--featured/);
  assert.match(renderCatalogPage({...page,collections:[{...collection,featured:true}]}),/seo-collection-card--featured/);
});

test('new collection pill follows its independent admin flag',()=>{
  const collection={slug:'nueva',name:'Nueva',designCount:1,cover:data.design,featured:false,isNewCollection:true};
  const html=renderCatalogPage({kind:'product',product:data.product,collections:[collection],basePrice:14990});
  assert.match(html,/seo-new-collection-pill/);
  assert.match(html,/Nueva colección/);
});

test('design SEO has a canonical URL and Product structured data',()=>{
  const seo=pageSeo(data,'https://droska.cl/');
  assert.equal(seo.canonical,'https://droska.cl/productos/poleras/sailor-moon/guardiana/');
  const json=structuredData(data,seo);
  assert.equal(json['@type'],'Product');
  assert.equal(json.offers.price,'14990');
  assert.equal(json.offers.priceCurrency,'CLP');
});

test('tote SEO muestra bolsa, tallas y precio propios sin polera',()=>{
  const tote={...data,product:{slug:'totebags',name:'Totebags'},basePrice:8990};
  const html=renderCatalogPage(tote);
  assert.match(html,/seo-tote-stage/);
  assert.match(html,/tote bag/i);
  assert.match(html,/\$8\.990/);
  assert.match(html,/\$9\.900/);
  assert.doesNotMatch(html,/polera 3D|Precio base de polera/);
});

test('body pages without a mockup show artwork without substituting a shirt',()=>{
  const body={...data,product:{slug:'bodys',name:'Bodys'},design:{...data.design,featuredPhoto:'',featuredPhotoHover:''},basePrice:10990};
  const html=renderCatalogPage(body);
  assert.match(html,/Mockup pendiente/);
  assert.match(html,/body bebé/);
  assert.doesNotMatch(html,/<div class="seo-shirt"|Precio base de polera/);
});
