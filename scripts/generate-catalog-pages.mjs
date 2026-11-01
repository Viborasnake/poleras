import {designWithProductMockup,designProductMockups} from '../src/catalog-product-mockups.js';
import {designProductArtworks} from '../src/catalog-product-artworks.js';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collections as fallbackCollections, catalogDesigns as fallbackDesigns, artworkUrl, catalogMockupHoverPhoto, catalogMockupPhoto, compareCatalogPriority, normalizeAllowedColors, normalizeSampleColor } from '../src/catalog.js';
import { catalogCollectionPath, catalogDesignPath, catalogProductPath } from '../src/catalog-routes.js';
import { escapeHtml, pageSeo, renderCatalogPage, structuredData } from '../src/catalog-page-render.js';

const projectRoot=resolve(import.meta.dirname,'..'),distRoot=resolve(projectRoot,'dist');
const env={...loadEnv(process.env.NODE_ENV||'production',projectRoot,''),...process.env};
const SUPABASE_URL=env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
const SUPABASE_KEY=env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS';
const deploymentHost=env.VERCEL_PROJECT_PRODUCTION_URL||env.VERCEL_URL||'';
const origin=(env.VITE_SITE_URL||env.SITE_URL||(deploymentHost?`https://${deploymentHost}`:'http://localhost:4173')).replace(/\/$/,'');
const basePrices={};
const useFallbackCatalog=env.CATALOG_SEO_ALLOW_FALLBACK==='true'||env.VERCEL_ENV!=='production';

function fallbackCatalog(){
  return [{slug:'poleras',name:'Poleras',collections:fallbackCollections.map(collection=>({
    id:collection.id,slug:collection.id,name:collection.label,featured:Boolean(collection.featured),sortOrder:999,
    designs:fallbackDesigns.filter(design=>design.collection===collection.id).map(design=>({...design,artworkPath:artworkUrl(design),featuredPhoto:catalogMockupPhoto(design.id,design.featuredPhoto),featuredPhotoHover:catalogMockupHoverPhoto(design.id,design.featuredPhotoHover),sampleColor:normalizeSampleColor(design.sampleColor),allowedColors:normalizeAllowedColors(design.allowedColors),acceptsCustomerImage:Boolean(design.acceptsCustomerImage),featured:Boolean(design.featured)})),
  })).sort(compareCatalogPriority)}];
}

async function remoteCatalog(){
  const client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const [productsResult,categoriesResult,collectionsResult,designsResult,pricesResult]=await Promise.all([
    client.from('catalog_product_types').select('id,slug,name,sort_order').eq('active',true).order('sort_order'),
    client.from('catalog_categories').select('id').eq('active',true),
    client.from('catalog_collections').select('id,product_type_id,category_id,slug,name,is_featured,is_new_collection,sort_order').eq('active',true).order('sort_order'),
    client.from('catalog_designs').select('id,collection_id,slug,name,caption,artwork_path,product_artworks,product_mockups,mockup_path,mockup_hover_path,mockup_focus_x,mockup_focus_y,mockup_hover_focus_x,mockup_hover_focus_y,sample_color,allowed_colors,accepts_customer_image,customer_photo_subject,is_featured').eq('active',true).order('id'),
    client.from('product_variants').select('price_clp,product_models!inner(code)').eq('active',true),
  ]);
  for(const result of [productsResult,categoriesResult,collectionsResult,designsResult,pricesResult])if(result.error)throw result.error;
  if(!productsResult.data?.length)throw new Error('Supabase no devolvió productos públicos activos.');
  for(const [slug,code] of [['poleras','basic'],['totebags','tote'],['bodys','body']]){
    const activePrices=(pricesResult.data||[]).filter(item=>item.product_models?.code===code).map(item=>item.price_clp).filter(Number.isFinite);
    if(activePrices.length)basePrices[slug]=Math.min(...activePrices);
  }
  const activeCategoryIds=new Set((categoriesResult.data||[]).map(category=>category.id));
  return productsResult.data.map(product=>({id:product.id,slug:product.slug,name:product.name,collections:(collectionsResult.data||[]).filter(collection=>activeCategoryIds.has(collection.category_id)&&(collection.product_type_id===product.id||(designsResult.data||[]).some(design=>design.collection_id===collection.id&&design.product_artworks?.[product.slug]))).map(collection=>({
    id:collection.id,slug:collection.slug,name:collection.name,featured:Boolean(collection.is_featured),isNewCollection:Boolean(collection.is_new_collection),sortOrder:collection.sort_order,
    designs:(designsResult.data||[]).filter(design=>design.collection_id===collection.id&&designProductArtworks(design,productsResult.data.find(item=>item.id===collection.product_type_id)?.slug)[product.slug]).map(design=>({id:design.slug,name:design.name,caption:design.caption||'',artworkPath:designProductArtworks(design,productsResult.data.find(item=>item.id===collection.product_type_id)?.slug)[product.slug],featuredPhoto:designWithProductMockup({productMockups:designProductMockups(design)},product.slug).featuredPhoto,featuredPhotoHover:designWithProductMockup({productMockups:designProductMockups(design)},product.slug).featuredPhotoHover,sampleColor:normalizeSampleColor(design.sample_color),allowedColors:normalizeAllowedColors(design.allowed_colors),acceptsCustomerImage:Boolean(design.accepts_customer_image),featured:Boolean(design.is_featured),collection:collection.slug})).sort(compareCatalogPriority),
  })).sort(compareCatalogPriority)}));
}

let products;
try{products=await remoteCatalog();console.log(`Catálogo SEO: ${products.length} producto(s) cargado(s) desde Supabase.`)}
catch(error){
  if(!useFallbackCatalog)throw new Error(`No se pudo generar el catálogo SEO desde Supabase: ${error.message}`);
  products=fallbackCatalog();
  console.warn(`Catálogo SEO: se usará el respaldo local (${error.message}).`);
}

const template=await readFile(resolve(distRoot,'catalog-page.html'),'utf8'),pages=[];
for(const product of products){
  const basePrice=basePrices[product.slug]??null;
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
