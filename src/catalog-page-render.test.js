import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSeo, renderCatalogPage, structuredData } from './catalog-page-render.js';

const data={kind:'design',product:{slug:'poleras',name:'Poleras'},collection:{slug:'sailor-moon',name:'Sailor Moon'},design:{id:'guardiana',name:'Guardiana <Celestial>',caption:'Magenta & estelar',artworkPath:'https://example.com/a.png',sampleColor:'#202124'},basePrice:14990,related:[]};

test('design page markup escapes catalog content and links back to the existing studio',()=>{
  const html=renderCatalogPage(data);
  assert.match(html,/Guardiana &lt;Celestial&gt;/);
  assert.match(html,/\?design=guardiana#catalogo/);
  assert.match(html,/seo-trust/);
  assert.match(html,/seo-process/);
  assert.match(html,/seo-faq/);
  assert.match(html,/seo-final-cta/);
  assert.match(html,/seo-shirt-stage--large is-loading/);
  assert.match(html,/Preparando vista 3D/);
  assert.doesNotMatch(html,/Guardiana <Celestial>/);
});

test('collection pages are useful landings and keep their indexable design cards',()=>{
  const html=renderCatalogPage({...data,kind:'collection',design:undefined,designs:[data.design]});
  assert.match(html,/Colección Sailor Moon: poleras a tu pinta/);
  assert.match(html,/id="disenos"/);
  assert.match(html,/La colección Sailor Moon/);
  assert.match(html,/Personalizar diseño/);
});

test('design SEO has a canonical URL and Product structured data',()=>{
  const seo=pageSeo(data,'https://droska.cl/');
  assert.equal(seo.canonical,'https://droska.cl/productos/poleras/sailor-moon/guardiana/');
  const json=structuredData(data,seo);
  assert.equal(json['@type'],'Product');
  assert.equal(json.offers.price,'14990');
  assert.equal(json.offers.priceCurrency,'CLP');
});
