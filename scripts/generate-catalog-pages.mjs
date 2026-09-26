import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collections as fallbackCollections, catalogDesigns as fallbackDesigns, artworkUrl, normalizeSampleColor } from '../src/catalog.js';
import { catalogCollectionPath, catalogDesignPath, catalogProductPath } from '../src/catalog-routes.js';
import { escapeHtml, pageSeo, renderCatalogPage, structuredData } from '../src/catalog-page-render.js';

const projectRoot=resolve(import.meta.dirname,'..'),distRoot=resolve(projectRoot,'dist');
const env={...loadEnv(process.env.NODE_ENV||'production',projectRoot,''),...process.env};
const SUPABASE_URL=env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
const SUPABASE_KEY=env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS';
const deploymentHost=env.VERCEL_PROJECT_PRODUCTION_URL||env.VERCEL_URL||'';
const origin=(env.VITE_SITE_URL||env.SITE_URL||(deploymentHost?`https://${deploymentHost}`:'http://localhost:4173')).replace(/\/$/,'');
let basePrice=14990;

function fallbackCatalog(){
  return [{slug:'poleras',name:'Poleras',collections:fallbackCollections.map(collection=>({
    id:collection.id,slug:collection.id,name:collection.label,sortOrder:999,
    designs:fallbackDesigns.filter(design=>design.collection===collection.id).map(design=>({...design,artworkPath:artworkUrl(design),sampleColor:normalizeSampleColor(design.sampleColor)})),
  }))}];
}

async function remoteCatalog(){
  const client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const [productsResult,collectionsResult,designsResult,pricesResult]=await Promise.all([
    client.from('catalog_product_types').select('id,slug,name,sort_order').eq('active',true).order('sort_order'),
    client.from('catalog_collections').select('id,product_type_id,slug,name,sort_order').eq('active',true).order('sort_order'),
    client.from('catalog_designs').select('id,collection_id,slug,name,caption,artwork_path,sample_color').eq('active',true).order('id'),
    client.from('product_variants').select('price_clp,product_models!inner(code)').eq('active',true).eq('product_models.code','basic'),
  ]);
  for(const result of [productsResult,collectionsResult,designsResult,pricesResult])if(result.error)throw result.error;
  if(!productsResult.data?.length)throw new Error('Supabase no devolvió productos públicos activos.');
  const activePrices=(pricesResult.data||[]).map(item=>item.price_clp).filter(Number.isFinite);
  if(activePrices.length)basePrice=Math.min(...activePrices);
  return productsResult.data.map(product=>({id:product.id,slug:product.slug,name:product.name,collections:(collectionsResult.data||[]).filter(collection=>collection.product_type_id===product.id).map(collection=>({
    id:collection.id,slug:collection.slug,name:collection.name,sortOrder:collection.sort_order,
    designs:(designsResult.data||[]).filter(design=>design.collection_id===collection.id).map(design=>({id:design.slug,name:design.name,caption:design.caption||'',artworkPath:design.artwork_path||'',sampleColor:normalizeSampleColor(design.sample_color),collection:collection.slug})),
  }))}));
}

let products;
try{products=await remoteCatalog();console.log(`Catálogo SEO: ${products.length} producto(s) cargado(s) desde Supabase.`)}
catch(error){products=fallbackCatalog();console.warn(`Catálogo SEO: se usará el respaldo local (${error.message}).`)}

const template=await readFile(resolve(distRoot,'catalog-page.html'),'utf8'),pages=[];
for(const product of products){
  const collections=product.collections.map(collection=>({...collection,designCount:collection.designs.length,cover:collection.designs[0]||null}));
  pages.push({path:catalogProductPath(product.slug),data:{kind:'product',product:{slug:product.slug,name:product.name},collections,basePrice}});
  for(const collection of product.collections){
    const productData={slug:product.slug,name:product.name},collectionData={slug:collection.slug,name:collection.name};
    pages.push({path:catalogCollectionPath(product.slug,collection.slug),data:{kind:'collection',product:productData,collection:collectionData,designs:collection.designs,basePrice}});
    for(const design of collection.designs)pages.push({path:catalogDesignPath(product.slug,collection.slug,design.id),data:{kind:'design',product:productData,collection:collectionData,design,related:collection.designs.filter(item=>item.id!==design.id),basePrice}});
  }
}

const safeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const imageMeta=image=>/^https?:\/\//i.test(image||'')?`<meta property="og:image" content="${escapeHtml(image)}">\n    <meta name="twitter:image" content="${escapeHtml(image)}">`:'';
const footerLinks=products.flatMap(product=>product.collections.map(collection=>`<a href="${catalogCollectionPath(product.slug,collection.slug)}">${escapeHtml(collection.name)}</a>`)).join('');
function fillTemplate(data){
  const seo=pageSeo(data,origin);
  return template.replaceAll('__SEO_TITLE__',escapeHtml(seo.title)).replaceAll('__SEO_DESCRIPTION__',escapeHtml(seo.description)).replaceAll('__SEO_CANONICAL__',escapeHtml(seo.canonical)).replace('<!--__SEO_IMAGE_META__-->',imageMeta(seo.image)).replace('__SEO_JSON_LD__',safeJson(structuredData(data,seo))).replace('<!--__CATALOG_PAGE_MARKUP__-->',renderCatalogPage(data)).replace('__CATALOG_PAGE_DATA__',safeJson(data)).replace('<!--__CATALOG_FOOTER_LINKS__-->',footerLinks);
}
for(const page of pages){const directory=resolve(distRoot,page.path.replace(/^\//,''));await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'index.html'),fillTemplate(page.data),'utf8')}
const urls=pages.map(page=>`  <url><loc>${escapeHtml(`${origin}${page.path}`)}</loc></url>`).join('\n');
await writeFile(resolve(distRoot,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,'utf8');
await rm(resolve(distRoot,'catalog-page.html'));
console.log(`Catálogo SEO: ${pages.length} páginas y sitemap generados para ${origin}.`);
