import {designWithProductMockup,designAppliesToProduct} from './catalog-product-mockups.js';
import {designForProduct} from './catalog-product-artworks.js';
import './design-system.css';
import './accessibility.css';
import './dialog-motion.js';
import './catalog-page.css';
import { createClient } from '@supabase/supabase-js';
import { fetchStoreSettings, applyStoreSettings } from './store-settings.js';
import { collectionsWithDesigns, loadCatalog } from './catalog.js';
import { parseCatalogPath } from './catalog-routes.js';
import { pageSeo, renderCatalogPage } from './catalog-page-render.js';
import { shareLink } from './share.js';

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
const SUPABASE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS';
const root=document.querySelector('#catalog-page');
const catalogClient=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

const seoTheme=localStorage.getItem('droska-theme')==='light'?'light':'dark';
document.documentElement.classList.toggle('theme-dark',seoTheme==='dark');
document.body.classList.toggle('theme-dark',seoTheme==='dark');
document.querySelector('meta[name="theme-color"]')?.setAttribute('content',seoTheme==='dark'?'#000000':'#f9f7f2');

async function hydrateFooter(){
  document.querySelector('[data-current-year]').textContent=String(new Date().getFullYear());
  const footerCatalog=document.querySelector('.footer-catalog');
  try{
    const catalog=await loadCatalog(catalogClient);
    const title=document.createElement('strong');title.textContent='Catálogo';
    const productLink=document.createElement('a');productLink.href='/productos/poleras/';productLink.textContent='Poleras';
    footerCatalog.replaceChildren(title,productLink);
    collectionsWithDesigns(catalog.collections,catalog.designs).forEach(collection=>{const link=document.createElement('a');link.href=`/productos/${encodeURIComponent(collection.productSlug||'poleras')}/${encodeURIComponent(collection.id)}/`;link.textContent=collection.label;footerCatalog.append(link)});
  }catch(error){console.warn('Se mantienen los enlaces indexables del pie:',error)}
}

function embeddedData(){
  const source=document.querySelector('#catalog-page-data')?.textContent?.trim();
  if(!source||source.startsWith('__'))return null;
  try{return JSON.parse(source)}catch{return null}
}

function buildPageData(route,catalog){
  if(!route)return null;
  const sourceProduct=catalog.productTypes.find(item=>item.slug===route.productSlug&&item.active!==false);if(!sourceProduct)return null;
  const product={slug:sourceProduct.slug,name:sourceProduct.name},basePrice=null;
  const mappedCollections=collectionsWithDesigns(catalog.collections,catalog.designs).filter(collection=>catalog.designs.some(design=>design.collection===collection.id&&designAppliesToProduct(design,route.productSlug))).map(collection=>{
    const designs=catalog.designs.filter(design=>design.collection===collection.id).map(design=>designForProduct(design,route.productSlug)).filter(Boolean).map(design=>designWithProductMockup(design,route.productSlug));
    return {slug:collection.id,name:collection.label,featured:Boolean(collection.featured),designCount:designs.length,cover:designs[0]||null};
  });
  if(route.kind==='product')return {kind:'product',product,collections:mappedCollections,basePrice};
  const sourceCollection=catalog.collections.find(collection=>collection.id===route.collectionSlug&&mappedCollections.some(item=>item.slug===collection.id));
  if(!sourceCollection)return null;
  const collection={slug:sourceCollection.id,name:sourceCollection.label};
  const designs=catalog.designs.filter(design=>design.collection===sourceCollection.id).map(design=>designForProduct(design,route.productSlug)).filter(Boolean).map(design=>designWithProductMockup(design,route.productSlug));
  if(route.kind==='collection')return {kind:'collection',product,collection,designs,basePrice};
  const design=designs.find(item=>item.id===route.designSlug);
  if(!design)return null;
  return {kind:'design',product,collection,design,related:designs.filter(item=>item.id!==design.id),basePrice};
}

async function loadLivePage(){
  const data=buildPageData(parseCatalogPath(location.pathname),await loadCatalog(catalogClient));
  if(!data){root.innerHTML='<div class="seo-empty"><h1>Página no encontrada.</h1><p>Este producto o diseño no está publicado.</p><a class="ds-cta" href="/productos/poleras/">Volver al catálogo</a></div>';return null}
  root.innerHTML=renderCatalogPage(data);
  return data;
}

function syncMetadata(data){
  if(!data)return;
  const seo=pageSeo(data,location.origin);document.title=seo.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content',seo.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',seo.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content',seo.description);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content',seo.canonical);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href',seo.canonical);
}

let data=embeddedData();
if(!data)data=await loadLivePage();
syncMetadata(data);
void hydrateFooter();
fetchStoreSettings(catalogClient).then(settings=>applyStoreSettings(settings)).catch(error=>console.warn('No pudimos actualizar la información de la tienda:',error));
const touchCardZoom=window.matchMedia('(hover: none), (pointer: coarse)');
root.addEventListener('click',event=>{
  const shareButton=event.target.closest('[data-share-url]');
  if(shareButton){event.preventDefault();shareLink({url:shareButton.dataset.shareUrl,title:shareButton.dataset.shareTitle,text:shareButton.dataset.shareText}).then(result=>{
    if(result==='copied')showShareFeedback(shareButton,'Link copiado');
    else if(result==='failed')showShareFeedback(shareButton,'No pudimos copiar el link');
  });return}
  if(!touchCardZoom.matches)return;
  const preview=event.target.closest('.seo-mockup-photo,.seo-shirt');if(!preview)return;
  const visual=preview.closest('.seo-card-visual');if(!visual)return;
  event.preventDefault();event.stopPropagation();
  root.querySelectorAll('.seo-card-visual.is-zoomed').forEach(item=>{if(item!==visual)item.classList.remove('is-zoomed')});
  visual.classList.toggle('is-zoomed');
});
function showShareFeedback(button,message){
  const label=button.querySelector('span:last-child');
  if(!label)return;
  const original=label.textContent;label.textContent=message;window.setTimeout(()=>{if(label.isConnected)label.textContent=original},2200);
}
document.querySelectorAll('.seo-faq-list details').forEach(item=>item.addEventListener('toggle',()=>{if(!item.open)return;item.parentElement.querySelectorAll('details[open]').forEach(other=>{if(other!==item)other.open=false})}));
