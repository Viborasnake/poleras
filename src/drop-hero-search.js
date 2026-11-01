import {selectSearchEntries,readRecentDesigns,rememberRecentDesign} from './search-discovery.js';
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const glass='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
export function mountDropHeroSearch(host,{getEntries,getTopics,getProducts,isAvailable,getPreview,onChoose,onCollection,onCreate,onRetry}){
  const shortcut=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘ K':'Ctrl K';
  host.innerHTML=`<div class="drop-hero-search"><span class="drop-search-kicker">ENCUENTRA ESE «ES MUY TÚ»</span><button type="button" class="drop-discovery-trigger" aria-haspopup="dialog" aria-controls="drop-discovery">${glass}<span>Busca diseños, temas o ideas…</span><kbd>${shortcut}</kbd><i aria-hidden="true">${arrow}</i></button></div>`;
  const trigger=host.querySelector('button'),dialog=document.createElement('dialog');
  dialog.id='drop-discovery';dialog.className='drop-discovery';dialog.setAttribute('aria-labelledby','drop-discovery-title');
  dialog.innerHTML=`<div class="drop-discovery-shell"><div class="drop-discovery-top"><div><span class="drop-search-kicker">EL UNIVERSO DROSKA</span><h2 id="drop-discovery-title">Encuentra tu próxima favorita.</h2></div><div class="drop-discovery-dismiss"><kbd aria-hidden="true">Esc</kbd><button type="button" class="drop-discovery-close ds-icon-button close-button" aria-label="Cerrar buscador" title="Cerrar buscador (Esc)"><span aria-hidden="true"></span></button></div></div><div class="drop-discovery-controls"><form role="search" aria-label="Buscar en el catálogo"><label class="drop-search-sr" for="drop-discovery-query">Busca diseños, temas o ideas</label><div class="drop-discovery-field">${glass}<input id="drop-discovery-query" type="search" placeholder="Busca diseños, temas o ideas…" autocomplete="off" enterkeyhint="search"><button type="button" data-search-clear aria-label="Limpiar búsqueda" hidden>×</button><button type="submit" aria-label="Buscar diseños">${arrow}</button></div></form><div class="drop-discovery-tabs" role="group" aria-label="Explorar catálogo">${[['explore','✦ Explorar'],['all','Todos los diseños'],['featured','Destacados'],['new','Novedades'],['recent','Vistos recientemente'],['custom','Personalizables']].map(([id,label])=>`<button type="button" class="ds-filter-pill" data-search-view="${id}" aria-pressed="${id==='explore'}">${label}</button>`).join('')}</div><div class="drop-discovery-filters"><div class="drop-discovery-topics" role="group" aria-label="Temáticas"></div><label class="drop-discovery-product">Producto<span class="drop-discovery-select"><select class="ds-field" aria-label="Filtrar por producto"></select><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></span></label></div></div><div class="drop-discovery-content"></div><div class="drop-discovery-bottom"><span>¿No existe todavía? Hagámoslo a tu pinta.</span><button type="button" data-search-create>Trae tu diseño ↗</button></div><span class="drop-search-sr" role="status" aria-live="polite" data-search-status></span></div>`;
  document.body.append(dialog);
  const input=dialog.querySelector('input'),content=dialog.querySelector('.drop-discovery-content'),productSelect=dialog.querySelector('select'),status=dialog.querySelector('[data-search-status]');
  let view='explore',topic='all',limit=24,recent=readRecentDesigns();
  const state=()=>({query:input.value.trim(),product:productSelect.value||'all',topic,view,recentIds:recent});
  const close=()=>dialog.close();
  function refreshFilters(){
    const products=getProducts(),previous=productSelect.value||'all';
    productSelect.innerHTML='<option value="all">Todos los productos</option>'+products.map(product=>`<option value="${safe(product.slug)}">${safe(product.name)}</option>`).join('');
    productSelect.value=products.some(product=>product.slug===previous)?previous:'all';
    const topics=getTopics();if(!topics.some(item=>item.id===topic))topic='all';
    dialog.querySelector('.drop-discovery-topics').innerHTML=[{id:'all',label:'Todos los temas'},...topics].map(item=>`<button type="button" class="ds-filter-pill" data-search-topic="${safe(item.id)}" aria-pressed="${item.id===topic}">${safe(item.label)}</button>`).join('')+'<button type="button" class="ds-filter-pill" data-search-gift>Regalos</button>';
  }
  function card({design,collection}){
    const photo=getPreview(design,collection,productSelect.value);
    return `<button type="button" class="drop-discovery-card" data-discovery-design="${safe(design.id)}"><span class="drop-discovery-photo">${photo?`<img src="${safe(photo)}" alt="" loading="lazy" decoding="async">`:'<span class="drop-discovery-placeholder" aria-hidden="true">✦</span>'}${design.featured?'<span class="drop-discovery-tag">✦ Destacado</span>':''}${design.acceptsCustomerImage?'<span class="drop-discovery-custom">Personalizable</span>':''}</span><span class="drop-discovery-card-copy"><small>${safe(collection.label)}</small><strong>${safe(design.name)}</strong>${arrow}</span></button>`;
  }
  const section=(title,entries,next='')=>entries.length?`<section class="drop-discovery-section"><div class="drop-discovery-section-head"><h3>${title}</h3>${next?`<button type="button" data-search-view="${next}">Ver todos ${arrow}</button>`:''}</div><div class="drop-discovery-grid">${entries.map(card).join('')}</div></section>`:'';
  function render(){
    if(!dialog.open)return;
    const entries=getEntries(),selection=state(),matches=isAvailable()?selectSearchEntries(entries,selection):[];
    dialog.querySelector('[data-search-clear]').hidden=!input.value;
    dialog.querySelectorAll('[data-search-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.searchView===view)));
    dialog.querySelectorAll('[data-search-topic]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.searchTopic===topic)));
    const browsing=view==='explore'&&!selection.query,heading=selection.query?`Resultados para «${safe(selection.query)}»`:({all:'Todos los diseños',featured:'Diseños destacados',new:'Recién llegados',recent:'Vistos recientemente',custom:'Diseños personalizables',explore:'Explora a tu pinta'})[view];
    status.textContent=isAvailable()?`${matches.length} diseños disponibles${selection.query?' para '+selection.query:''}`:'El catálogo no está disponible en este momento.';
    if(!isAvailable()){content.innerHTML='<div class="drop-discovery-empty"><h3>No pudimos cargar el catálogo.</h3><p>Intenta nuevamente en un momento.</p><button type="button" data-search-retry>Reintentar</button></div>';return}
    const seen=selectSearchEntries(entries,{...selection,query:'',view:'recent',recentIds:recent}).slice(0,6);
    const collections=[...new Map(matches.map(entry=>[entry.collection.id,entry])).values()];
    const collectionStrip=collections.length?`<section class="drop-discovery-collections"><h3>Explora colecciones</h3><div>${collections.map(entry=>`<button type="button" data-discovery-collection="${safe(entry.collection.id)}"><strong>${safe(entry.collection.label)}</strong><span>${matches.filter(item=>item.collection.id===entry.collection.id).length} diseños ${arrow}</span></button>`).join('')}</div></section>`:'';
    if(browsing&&matches.length){
      const featured=matches.filter(entry=>entry.design.featured||entry.collection.featured).slice(0,6);
      const newest=selectSearchEntries(entries,{...selection,view:'new'}).slice(0,6);
      content.innerHTML=section('Vistos recientemente',seen,'recent')+section(featured.length?'Destacados para ti':'Diseños por descubrir',featured.length?featured:matches.slice(0,6),'featured')+collectionStrip+section('Recién llegados',newest,'new');
    }else{
      content.innerHTML=`<div class="drop-discovery-section-head"><h3>${heading}</h3><span>${matches.length} diseño${matches.length===1?'':'s'}</span></div>`+(matches.length?`<div class="drop-discovery-grid">${matches.slice(0,limit).map(card).join('')}</div>${matches.length>limit?'<button type="button" class="drop-discovery-more" data-search-more>Mostrar más diseños</button>':''}`:`<div class="drop-discovery-empty"><h3>${view==='recent'?'Tu próxima favorita te espera.':'No encontramos diseños con esa combinación.'}</h3><p>${view==='recent'?'Aquí aparecerán los diseños que abras desde el buscador en este navegador.':'Prueba otro tema, cambia el producto o trae tu propio diseño.'}</p><button type="button" data-search-reset>Explorar todos</button></div>`);
    }
    if(view==='recent'&&recent.length)content.insertAdjacentHTML('afterbegin','<button type="button" class="drop-discovery-forget" data-search-forget>Borrar vistos recientemente</button>');
  }
  function open(query=''){
    if(document.querySelector('dialog[open]')&&!dialog.open)return;
    input.value=query;view='explore';topic='all';limit=24;recent=readRecentDesigns();refreshFilters();
    if(!dialog.open)dialog.showModal();document.body.classList.add('drop-search-open');render();input.focus();
  }
  trigger.addEventListener('click',()=>open());dialog.querySelector('.drop-discovery-close').addEventListener('click',close);
  dialog.addEventListener('close',()=>document.body.classList.remove('drop-search-open'));
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();view='all';limit=24;render()});
  input.addEventListener('input',()=>{limit=24;render()});productSelect.addEventListener('change',()=>{limit=24;render()});
  dialog.addEventListener('click',event=>{
    const designButton=event.target.closest('[data-discovery-design]');
    if(designButton){const entry=getEntries().find(entry=>String(entry.design.id)===designButton.dataset.discoveryDesign);if(entry){recent=rememberRecentDesign(recent,entry.design.id);const product=productSelect.value;close();onChoose(entry.design,entry.collection,product==='all'?'':product)}return}
    const collectionButton=event.target.closest('[data-discovery-collection]');if(collectionButton){const product=productSelect.value;close();onCollection(collectionButton.dataset.discoveryCollection,product==='all'?'':product);return}
    const tab=event.target.closest('[data-search-view]');if(tab){view=tab.dataset.searchView;limit=24;render();dialog.querySelector(`.drop-discovery-tabs [data-search-view="${view}"]`)?.focus();return}
    const category=event.target.closest('[data-search-topic]');if(category){topic=category.dataset.searchTopic;limit=24;render();return}
    if(event.target.closest('[data-search-gift]')){input.value='Regalos';view='all';topic='all';limit=24;render();input.focus()}
    if(event.target.closest('[data-search-clear]')){input.value='';input.focus();render()}
    if(event.target.closest('[data-search-more]')){limit+=24;render()}
    if(event.target.closest('[data-search-create]')){close();onCreate()}
    if(event.target.closest('[data-search-reset]')){input.value='';topic='all';view='all';productSelect.value='all';render()}
    if(event.target.closest('[data-search-forget]')){recent=[];try{localStorage.removeItem('droska-recent-designs')}catch{}render()}
    if(event.target.closest('[data-search-retry]')){onRetry?.()}
  });
  dialog.addEventListener('keydown',event=>{if(event.target===input&&event.key==='ArrowDown'){event.preventDefault();content.querySelector('button')?.focus()}});
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(dialog.open){input.focus()}else open()}});
  return {open,refresh(){if(dialog.open){refreshFilters();render()}}};
}
