import { catalogCollectionPath, catalogDesignPath, catalogProductPath } from './catalog-routes.js';

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[char]));

export const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value)||0);

const arrow=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;
const shirtIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4 10 2h4l2 2 4 2-2 5-2-1v10H8V10l-2 1-2-5 4-2Z"/></svg>`;

function breadcrumbs(data){
  const crumbs=[`<a href="/">Inicio</a>`,`<a href="${catalogProductPath(data.product.slug)}">${escapeHtml(data.product.name)}</a>`];
  if(data.collection)crumbs.push(data.kind==='collection'
    ?`<span aria-current="page">${escapeHtml(data.collection.name)}</span>`
    :`<a href="${catalogCollectionPath(data.product.slug,data.collection.slug)}">${escapeHtml(data.collection.name)}</a>`);
  if(data.design)crumbs.push(`<span aria-current="page">${escapeHtml(data.design.name)}</span>`);
  return `<nav class="seo-breadcrumbs" aria-label="Migas de pan">${crumbs.join('<span aria-hidden="true">/</span>')}</nav>`;
}

function shirtPreview(design,label,large=false){
  const artwork=escapeHtml(design.artworkPath||'');
  const color=escapeHtml(design.sampleColor||'#ffffff');
  return `<div class="seo-shirt-stage${large?' seo-shirt-stage--large is-loading':''}" style="--sample-color:${color}" data-seo-preview="${escapeHtml(design.id)}"${large?' aria-busy="true"':''}>
    <span class="seo-collection-label">${escapeHtml(label)}</span>
    <div class="seo-shirt" aria-hidden="true"><span></span>${artwork?`<img src="${artwork}" alt="" loading="${large?'eager':'lazy'}">`:''}</div>
    <div class="seo-live-viewer" aria-label="Vista 3D de una polera ${color==='#202124'?'negra':'de muestra'} con el diseño ${escapeHtml(design.name)}" hidden></div>
    ${large?'<div class="seo-viewer-loading" role="status"><span aria-hidden="true"></span><strong>Preparando vista 3D</strong></div>':''}
  </div>`;
}

function designCard(data,design){
  const href=catalogDesignPath(data.product.slug,data.collection.slug,design.id);
  return `<article class="seo-design-card">
    <a class="seo-card-visual" href="${href}" aria-label="Ver ${escapeHtml(design.name)}">${shirtPreview(design,data.collection.name)}<span class="seo-round-arrow">${arrow}</span></a>
    <div class="seo-card-copy"><div><h2><a href="${href}">${escapeHtml(design.name)}</a></h2><p>${escapeHtml(design.caption||'Diseño original Droska listo para personalizar.')}</p></div><strong>Desde ${money(data.basePrice)}</strong></div>
    <a class="ds-cta seo-card-cta" href="/?design=${encodeURIComponent(design.id)}#catalogo">Personalizar diseño <span aria-hidden="true">→</span></a>
  </article>`;
}

function collectionCard(data,collection){
  const href=catalogCollectionPath(data.product.slug,collection.slug);
  const count=collection.designCount||0;
  const countLabel=`${count} ${count===1?'diseño':'diseños'}`;
  const cover=collection.cover;
  return `<article class="seo-design-card seo-collection-card">
    <a class="seo-card-visual" href="${href}" aria-label="Ver colección ${escapeHtml(collection.name)}">${cover?shirtPreview(cover,'COLECCIÓN'):'<div class="seo-empty-cover">Próximamente</div>'}<span class="seo-count-pill">${shirtIcon}${countLabel}</span><span class="seo-round-arrow">${arrow}</span></a>
    <div class="seo-card-copy"><div><h2><a href="${href}">${escapeHtml(collection.name)}</a></h2><p>${count?'Diseños listos para llevar.':'Estamos preparando esta colección.'}</p></div></div>
    <a class="ds-cta seo-card-cta" href="${href}">Ver colección <span aria-hidden="true">→</span></a>
  </article>`;
}

function emptyState(copy){return `<div class="seo-empty"><span aria-hidden="true">+</span><h2>Muy pronto.</h2><p>${escapeHtml(copy)}</p></div>`}

function trustStrip(){return `<section class="seo-trust" aria-label="Beneficios de comprar en droska SHIRT"><article><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 8C23 9 12 17 10 34c12 2 23-5 29-26Z"/><path d="M8 41c7-11 14-18 25-25"/></svg><div><strong>Diseños originales</strong><p>Una selección con personalidad, creada para llevar puesta.</p></div></article><article><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12h23v22H6zM29 21h7l6 7v6H29z"/><circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/></svg><div><strong>Despachos a todo Chile</strong><p>Coordinamos la entrega cuando tu polera esté lista.</p></div></article><article><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5c5 4 10 6 16 7v11c0 10-6 17-16 21C14 40 8 33 8 23V12c6-1 11-3 16-7Z"/><path d="m17 24 5 5 10-11"/></svg><div><strong>Compra acompañada</strong><p>Revisas modelo, talla, color y total antes de confirmar.</p></div></article></section>`}

function processSection(subject){return `<section class="seo-process" aria-labelledby="seo-process-title"><div class="seo-section-heading"><span class="eyebrow">DE LA IDEA A TU CLÓSET</span><h2 id="seo-process-title">Tu ${escapeHtml(subject)}, en tres pasos.</h2><p>La página te ayuda a elegir; el estudio reúne todas las decisiones antes de encargarla.</p></div><ol><li><span>01</span><div><strong>Elige el diseño.</strong><p>Parte con una pieza del catálogo y ábrela directamente en el estudio.</p></div></li><li><span>02</span><div><strong>Hazla tuya.</strong><p>Selecciona modelo, talla, color y revisa la vista 3D sobre la polera.</p></div></li><li><span>03</span><div><strong>Confirma con claridad.</strong><p>Comprueba el resumen y el precio final antes de continuar con el pedido.</p></div></li></ol></section>`}

function faqSection(subject,basePrice){return `<section class="seo-faq" aria-labelledby="seo-faq-title"><div class="seo-section-heading"><span class="eyebrow">ANTES DE ELEGIR</span><h2 id="seo-faq-title">Lo importante, sin letra chica.</h2></div><div class="seo-faq-list"><details><summary>¿Cómo personalizo ${escapeHtml(subject)}?<span>+</span></summary><p>Abre uno de los diseños en el estudio. Allí eliges el modelo de polera, la talla y el color de muestra antes de revisar el resultado.</p></details><details><summary>¿Qué significa “Desde ${money(basePrice)}”?<span>+</span></summary><p>Es el precio base de referencia para la polera Básica. El total puede cambiar según el modelo y las opciones elegidas; siempre lo verás antes de confirmar.</p></details><details><summary>¿La imagen 3D es el resultado final?<span>+</span></summary><p>Es una referencia para apreciar escala, posición y combinación de color. La apariencia puede variar levemente según la tela, la pantalla y el proceso de impresión.</p></details><details><summary>¿Despachan fuera de Santiago?<span>+</span></summary><p>Sí. Coordinamos despachos a todo Chile y comunicamos costo y plazo junto con la confirmación del pedido.</p></details></div></section>`}

function storySection(name){return `<section class="seo-story"><div><span class="eyebrow">HECHA PARA USARSE</span><h2>La colección ${escapeHtml(name)} no se queda en la pantalla.</h2></div><div><p>Elegir una polera temática no debería sentirse como escoger una imagen pegada sobre tela. Cada diseño se prueba en una prenda 3D para que puedas apreciar su proporción y la relación con el color antes de entrar al estudio.</p><p>Después decides el calce, la talla y el tono que mejor acompaña la gráfica. Así la referencia visual se convierte en una elección concreta, revisable y realmente tuya.</p></div></section>`}

function finalCta({title,copy,href,label}){return `<section class="seo-final-cta"><div><span class="eyebrow">A TU PINTA</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><a class="ds-cta ds-cta--lg" href="${href}">${escapeHtml(label)} <span aria-hidden="true">→</span></a></section>`}

function listingHeading(eyebrow,title,copy){return `<div class="seo-section-heading"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>`}

export function renderCatalogPage(data){
  if(data.kind==='product'){
    const featured=data.collections.find(collection=>collection.cover)?.cover;
    return `${breadcrumbs(data)}<section class="seo-landing-hero"><div class="seo-landing-copy"><span class="eyebrow">${escapeHtml(data.product.name)} PERSONALIZADAS</span><h1>Diseños que se llevan puestos.</h1><p>Explora colecciones originales, mira cada diseño sobre una polera 3D y personaliza modelo, talla y color antes de decidir.</p><div class="seo-hero-actions"><a class="ds-cta ds-cta--lg" href="#colecciones">Ver colecciones <span aria-hidden="true">↓</span></a><a class="ds-secondary-button" href="/#caminos">Crear desde mi idea</a></div></div>${featured?`<div class="seo-landing-visual">${shirtPreview(featured,'DROSKA SHIRT',true)}<p>Vista 3D referencial · Puedes girarla</p></div>`:'<div class="seo-empty-cover">Próximamente</div>'}</section>${trustStrip()}<section class="seo-listing-section" id="colecciones">${listingHeading('COLECCIONES PARA EXPLORAR','Encuentra una historia para vestir.','Cada portada reúne diseños relacionados y muestra cuántas opciones activas puedes personalizar.')}${data.collections.length?`<div class="seo-card-grid" aria-label="Colecciones de ${escapeHtml(data.product.name)}">${data.collections.map(collection=>collectionCard(data,collection)).join('')}</div>`:emptyState(`Aún no hay colecciones publicadas en ${data.product.name}.`)}</section>${processSection('polera')}${faqSection('una polera del catálogo',data.basePrice)}${finalCta({title:'¿No encontraste la idea exacta?',copy:'Trae tu imagen, dibujo o diseño de IA y construyamos una polera desde cero.',href:'/#caminos',label:'Empezar mi idea'})}`;
  }
  if(data.kind==='collection'){
    const featured=data.designs[0],count=`${data.designs.length} ${data.designs.length===1?'diseño disponible':'diseños disponibles'}`;
    return `${breadcrumbs(data)}<section class="seo-landing-hero"><div class="seo-landing-copy"><span class="eyebrow">COLECCIÓN · ${escapeHtml(data.product.name)}</span><h1>Colección ${escapeHtml(data.collection.name)}: poleras a tu pinta.</h1><p>${count} para elegir, mirar en 3D y ajustar a tu modelo, talla y color.</p><div class="seo-hero-actions"><a class="ds-cta ds-cta--lg" href="#disenos">Ver diseños <span aria-hidden="true">↓</span></a><a class="ds-secondary-button" href="${catalogProductPath(data.product.slug)}">Todas las colecciones</a></div></div>${featured?`<div class="seo-landing-visual">${shirtPreview(featured,data.collection.name,true)}<p>Vista 3D referencial · Puedes girarla</p></div>`:'<div class="seo-empty-cover">Próximamente</div>'}</section>${trustStrip()}<section class="seo-listing-section" id="disenos">${listingHeading('ELIGE TU DISEÑO',`La colección ${data.collection.name}.`,'Abre una pieza para conocerla mejor o llévala directamente al estudio para personalizarla.')}${data.designs.length?`<div class="seo-card-grid" aria-label="Diseños de ${escapeHtml(data.collection.name)}">${data.designs.map(design=>designCard(data,design)).join('')}</div>`:emptyState('Esta colección todavía no tiene diseños publicados.')}</section>${storySection(data.collection.name)}${processSection('polera')}${faqSection(`un diseño de ${data.collection.name}`,data.basePrice)}${finalCta({title:`Haz tuya la colección ${data.collection.name}.`,copy:'Elige una pieza y revisa cómo combina con tu polera antes de confirmar.',href:featured?`/?design=${encodeURIComponent(featured.id)}#catalogo`:'/#caminos',label:featured?'Personalizar un diseño':'Crear mi idea'})}`;
  }
  const related=data.related||[];
  return `${breadcrumbs(data)}<article class="seo-product-detail seo-landing-hero"><div class="seo-product-visual seo-landing-visual">${shirtPreview(data.design,data.collection.name,true)}<p>Arrastra para girar · Vista 3D referencial</p></div><div class="seo-product-copy seo-landing-copy"><span class="eyebrow">${escapeHtml(data.collection.name)} · DISEÑO ORIGINAL</span><h1>${escapeHtml(data.design.name)}</h1><p class="seo-product-description">${escapeHtml(data.design.caption||'Una creación original Droska lista para llevar puesta.')}</p><div class="seo-product-price"><span>Desde</span><strong>${money(data.basePrice)}</strong><small>Precio base de polera. El total se confirma en el estudio.</small></div><a class="ds-cta ds-cta--lg" href="/?design=${encodeURIComponent(data.design.id)}#catalogo">Personalizar este diseño <span aria-hidden="true">→</span></a><a class="seo-back-link" href="${catalogCollectionPath(data.product.slug,data.collection.slug)}">Ver toda la colección ${escapeHtml(data.collection.name)}</a></div></article>${trustStrip()}${storySection(data.collection.name)}${processSection('polera')}${related.length?`<section class="seo-related">${listingHeading('TAMBIÉN EN ESTA COLECCIÓN','Más diseños para explorar.','Compara otras piezas de la misma colección antes de elegir.') }<div class="seo-card-grid">${related.map(design=>designCard({...data,kind:'collection'},design)).join('')}</div></section>`:''}${faqSection(`el diseño ${data.design.name}`,data.basePrice)}${finalCta({title:`Lleva ${data.design.name} a tu polera.`,copy:'Abre el estudio, elige talla y color, y revisa el resultado en 3D.',href:`/?design=${encodeURIComponent(data.design.id)}#catalogo`,label:'Personalizar este diseño'})}`;
}

export function pageSeo(data,origin){
  const cleanOrigin=String(origin||'').replace(/\/$/,'');
  if(data.kind==='product'){
    const path=catalogProductPath(data.product.slug);
    return {title:`${data.product.name} personalizadas | Droska`,description:`Explora las colecciones de ${data.product.name.toLowerCase()} con diseños originales Droska. Elige una idea y personalízala a tu pinta.`,canonical:`${cleanOrigin}${path}`,image:data.collections.find(item=>item.cover?.artworkPath)?.cover?.artworkPath||''};
  }
  if(data.kind==='collection'){
    const path=catalogCollectionPath(data.product.slug,data.collection.slug);
    return {title:`${data.collection.name}: diseños de ${data.product.name.toLowerCase()} | Droska`,description:`Descubre ${data.designs.length} ${data.designs.length===1?'diseño':'diseños'} de la colección ${data.collection.name} y personaliza tu ${data.product.name.toLowerCase().replace(/s$/,'')}.`,canonical:`${cleanOrigin}${path}`,image:data.designs[0]?.artworkPath||''};
  }
  const path=catalogDesignPath(data.product.slug,data.collection.slug,data.design.id);
  return {title:`${data.design.name} | ${data.collection.name} · Droska`,description:data.design.caption||`Personaliza ${data.design.name}, un diseño original de la colección ${data.collection.name} de Droska.`,canonical:`${cleanOrigin}${path}`,image:data.design.artworkPath||''};
}

export function structuredData(data,seo){
  if(data.kind==='design')return {
    '@context':'https://schema.org','@type':'Product',name:data.design.name,description:seo.description,image:seo.image||undefined,sku:`droska-${data.design.id}`,brand:{'@type':'Brand',name:'Droska'},category:`${data.product.name} > ${data.collection.name}`,url:seo.canonical,offers:{'@type':'Offer',priceCurrency:'CLP',price:String(data.basePrice),availability:'https://schema.org/InStock',url:seo.canonical},
  };
  const items=(data.kind==='product'?data.collections:data.designs).map((item,index)=>({
    '@type':'ListItem',position:index+1,name:item.name,item:data.kind==='product'
      ?`${seo.canonical}${encodeURIComponent(item.slug)}/`
      :`${seo.canonical}${encodeURIComponent(item.id)}/`,
  }));
  return {'@context':'https://schema.org','@type':'CollectionPage',name:data.kind==='product'?data.product.name:data.collection.name,description:seo.description,url:seo.canonical,mainEntity:{'@type':'ItemList',itemListElement:items}};
}
