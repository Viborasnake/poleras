import './design-system.css';
import './accessibility.css';
import './catalog-page.css';
import { createClient } from '@supabase/supabase-js';
import { artworkUrl, loadCatalog, normalizeSampleColor } from './catalog.js';
import { parseCatalogPath } from './catalog-routes.js';
import { pageSeo, renderCatalogPage } from './catalog-page-render.js';

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
const SUPABASE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS';
const root=document.querySelector('#catalog-page');
const catalogClient=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

async function hydrateHeader(){
  const productNav=document.querySelector('.product-nav');
  productNav?.querySelector('a')?.addEventListener('click',()=>productNav.removeAttribute('open'));
  document.addEventListener('pointerdown',event=>{if(productNav?.open&&!productNav.contains(event.target))productNav.removeAttribute('open')});
  const cartButton=document.querySelector('.cart-trigger'),cartCount=document.querySelector('[data-cart-count]');
  try{
    const cart=JSON.parse(localStorage.getItem('droska-cart-demo'))||[];
    const count=cart.reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
    cartCount.textContent=String(count);cartButton.classList.toggle('has-items',count>0);
  }catch{}
  try{
    const {data}=await catalogClient.auth.getUser(),user=data.user;
    if(!user)return;
    const name=user.user_metadata?.full_name||user.email?.split('@')[0]||'Creativa';
    const firstName=name.split(' ')[0],trigger=document.querySelector('.account-trigger');
    const initial=document.createElement('span');initial.className='account-initial';initial.textContent=firstName.slice(0,1).toUpperCase();
    trigger.querySelector('.account-icon').replaceWith(initial);
    trigger.querySelector('[data-account-label]').textContent=`Hola, ${firstName}`;
  }catch{}
}

async function hydrateFooter(){
  document.querySelector('[data-current-year]').textContent=String(new Date().getFullYear());
  const footerCatalog=document.querySelector('.footer-catalog');
  try{
    const catalog=await loadCatalog(catalogClient);
    const title=document.createElement('strong');title.textContent='Catálogo';
    const productLink=document.createElement('a');productLink.href='/productos/poleras/';productLink.textContent='Poleras';
    footerCatalog.replaceChildren(title,productLink);
    catalog.collections.forEach(collection=>{const link=document.createElement('a');link.href=`/productos/poleras/${encodeURIComponent(collection.id)}/`;link.textContent=collection.label;footerCatalog.append(link)});
  }catch(error){console.warn('Se mantienen los enlaces indexables del pie:',error)}
}

function embeddedData(){
  const source=document.querySelector('#catalog-page-data')?.textContent?.trim();
  if(!source||source.startsWith('__'))return null;
  try{return JSON.parse(source)}catch{return null}
}

function buildPageData(route,catalog){
  if(!route||route.productSlug!=='poleras')return null;
  const product={slug:'poleras',name:'Poleras'},basePrice=14990;
  const mappedCollections=catalog.collections.map(collection=>{
    const designs=catalog.designs.filter(design=>design.collection===collection.id);
    return {slug:collection.id,name:collection.label,designCount:designs.length,cover:designs[0]||null};
  });
  if(route.kind==='product')return {kind:'product',product,collections:mappedCollections,basePrice};
  const sourceCollection=catalog.collections.find(collection=>collection.id===route.collectionSlug);
  if(!sourceCollection)return null;
  const collection={slug:sourceCollection.id,name:sourceCollection.label};
  const designs=catalog.designs.filter(design=>design.collection===sourceCollection.id);
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

function loadArtwork(design){return new Promise((resolve,reject)=>{const image=new Image(),source=artworkUrl(design);if(/^https?:/i.test(source))image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=reject;image.src=source})}

function artworkCanvas(image,width=600,height=720){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;
  context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
  return canvas;
}

function previewDesigns(data){
  if(data?.kind==='product')return data.collections.map(collection=>collection.cover).filter(Boolean);
  if(data?.kind==='collection')return data.designs;
  if(data?.kind==='design')return data.related||[];
  return [];
}

async function enhanceCardPreviews(data){
  const designs=[...new Map(previewDesigns(data).map(design=>[design.id,design])).values()];
  if(!designs.length)return;
  let viewer,viewport;
  try{
    const {createViewer}=await import('./garment.js');
    viewport=document.createElement('div');viewport.className='seo-render-viewport';viewport.setAttribute('aria-hidden','true');document.body.append(viewport);
    const base={kind:'basic',color:'#ffffff',image:'',printSide:'front',printScale:1,assessment:null};
    viewer=await createViewer(viewport,base,{cameraDistance:5.15});
    for(const design of designs){
      const image=await loadArtwork(design);
      await viewer.update({...base,color:normalizeSampleColor(design.sampleColor),image:artworkCanvas(image).toDataURL('image/png')});
      const preview=viewer.snapshot();
      root.querySelectorAll('[data-seo-preview]').forEach(stage=>{
        if(stage.dataset.seoPreview!==design.id||stage.classList.contains('seo-shirt-stage--large'))return;
        const mockup=document.createElement('img');mockup.className='seo-card-3d';mockup.src=preview;mockup.alt=`Polera 3D con el diseño ${design.name} aplicado`;
        stage.append(mockup);stage.classList.add('is-3d');
      });
    }
  }catch(error){console.warn('Se conserva la vista alternativa de las cards:',error)}
  finally{viewer?.dispose();viewport?.remove()}
}

function landingDesign(data){
  if(data?.kind==='design')return data.design;
  if(data?.kind==='collection')return data.designs[0];
  if(data?.kind==='product')return data.collections.find(collection=>collection.cover)?.cover;
  return null;
}

async function enhanceLandingPreview(data){
  const design=landingDesign(data);
  if(!design)return;
  const container=root.querySelector('.seo-live-viewer'),stage=container?.closest('.seo-shirt-stage--large'),fallback=stage?.querySelector('.seo-shirt');
  if(!container)return;
  try{
    const image=await loadArtwork(design),canvas=artworkCanvas(image,1200,1440);
    const {createViewer}=await import('./garment.js');container.hidden=false;
    await createViewer(container,{kind:'basic',color:normalizeSampleColor(design.sampleColor),image:canvas.toDataURL('image/png'),printSide:'front',printScale:1,assessment:null},{hero:true,cameraDistance:5});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    fallback.hidden=true;
    stage.classList.remove('is-loading');stage.classList.add('is-3d-ready');stage.setAttribute('aria-busy','false');
  }catch(error){container.hidden=true;fallback.hidden=false;stage?.classList.remove('is-loading');stage?.classList.add('is-fallback-ready');stage?.setAttribute('aria-busy','false');console.warn('Se conserva la vista alternativa del diseño:',error)}
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
await hydrateHeader();
void hydrateFooter();
await enhanceCardPreviews(data);
await enhanceLandingPreview(data);
const touchCardZoom=window.matchMedia('(hover: none), (pointer: coarse)');
root.addEventListener('click',event=>{
  if(!touchCardZoom.matches)return;
  const preview=event.target.closest('.seo-card-3d,.seo-shirt');if(!preview)return;
  const visual=preview.closest('.seo-card-visual');if(!visual)return;
  event.preventDefault();event.stopPropagation();
  root.querySelectorAll('.seo-card-visual.is-zoomed').forEach(item=>{if(item!==visual)item.classList.remove('is-zoomed')});
  visual.classList.toggle('is-zoomed');
});
document.querySelectorAll('.seo-faq-list details').forEach(item=>item.addEventListener('toggle',()=>{if(!item.open)return;item.parentElement.querySelectorAll('details[open]').forEach(other=>{if(other!==item)other.open=false})}));
