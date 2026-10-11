import './design-system.css';
import './style.css';
import './accessibility.css';
import { createClient } from '@supabase/supabase-js';
import { authErrorMessage } from './auth-messages.js';
import { PRINT_POLICY, PRINT_EXTRAS_CLP, QUALITY_ADJUSTMENT_CLP, checkResolution, orderTotal } from './print-check.js';
import { quoteShipping } from './shipping.js';
import { collections as fallbackCollections, catalogDesigns as fallbackCatalogDesigns, filterCatalog, artworkUrl, designCountLabel, loadCatalog, normalizeSampleColor } from './catalog.js';
import { catalogCollectionPath, catalogProductPath } from './catalog-routes.js';
import { orderSteps, orderProgressIndex, orderStatusLabel } from './order-status.js';
import { communes, provinces } from '@clregions/data/array';
import { uploadPrivateDesign } from './design-storage.js';
const icons={arrow:'↗',spark:'✳',close:'×'};
const CUSTOMER_DETAILS_KEY='droska-customer-details';
const DRAFT_KEY='droska-shirt-draft';
const SAVED_DETAILS_TTL=15*24*60*60*1000;
const DESIGN_DATABASE='droska-designs';
const DESIGN_STORE='uploads';
const CART_DESIGN_STORE='cart-uploads';
// El archivo de muestra solo se abre al entrar al estudio; mantenemos una
// versión WebP para que ese primer mockup no agregue una descarga pesada.
const DEFAULT_SAMPLE_IMAGE='/laika.webp';
const USER_ARTWORK_SCALE=1.6;
const CATALOG_ARTWORK_SCALE=1.7;
function loadSavedData(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');if(!value||typeof value!=='object'||typeof value.expiresAt!=='number'||value.expiresAt<=Date.now()){localStorage.removeItem(key);return {}}return value}catch{return {}}}
function saveForFifteenDays(key,value){try{localStorage.setItem(key,JSON.stringify({...value,expiresAt:Date.now()+SAVED_DETAILS_TTL}))}catch{}}
function openDesignDatabase(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('Almacenamiento de archivos no disponible'));const request=indexedDB.open(DESIGN_DATABASE,2);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DESIGN_STORE))request.result.createObjectStore(DESIGN_STORE,{keyPath:'side'});if(!request.result.objectStoreNames.contains(CART_DESIGN_STORE))request.result.createObjectStore(CART_DESIGN_STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveDesignFile(side,file){const database=await openDesignDatabase();await new Promise((resolve,reject)=>{const transaction=database.transaction(DESIGN_STORE,'readwrite');transaction.objectStore(DESIGN_STORE).put({side,file,expiresAt:Date.now()+SAVED_DETAILS_TTL});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});database.close()}
async function removeSavedDesignFile(side){const database=await openDesignDatabase();await new Promise((resolve,reject)=>{const transaction=database.transaction(DESIGN_STORE,'readwrite');transaction.objectStore(DESIGN_STORE).delete(side);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});database.close()}
async function savedDesignFiles(){const database=await openDesignDatabase();const files=await new Promise((resolve,reject)=>{const request=database.transaction(DESIGN_STORE).objectStore(DESIGN_STORE).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});database.close();return files}
async function saveCartDesignFiles(id,front,back){const database=await openDesignDatabase();try{await new Promise((resolve,reject)=>{const transaction=database.transaction(CART_DESIGN_STORE,'readwrite');transaction.objectStore(CART_DESIGN_STORE).put({id,front,back});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)})}finally{database.close()}}
async function cartDesignFiles(id){
 try{const database=await openDesignDatabase();try{return await new Promise((resolve,reject)=>{const request=database.transaction(CART_DESIGN_STORE).objectStore(CART_DESIGN_STORE).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{database.close()}}
 catch{return cartDesignMemory.get(id)||null}
}
async function removeCartDesignFiles(id){
 cartDesignMemory.delete(id);
 try{const database=await openDesignDatabase();try{await new Promise((resolve,reject)=>{const transaction=database.transaction(CART_DESIGN_STORE,'readwrite');transaction.objectStore(CART_DESIGN_STORE).delete(id);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)})}finally{database.close()}}
 catch{}
}
const savedCustomerDetails=loadSavedData(CUSTOMER_DETAILS_KEY);
const savedDraftDetails=loadSavedData(DRAFT_KEY);
const savedFullName=savedCustomerDetails.name||'';
const savedNameParts=savedFullName.trim().split(/\s+/).filter(Boolean);
const state={mode:'choose',kind:'basic',size:'M',color:'#ffffff',image:DEFAULT_SAMPLE_IMAGE,images:{front:'',back:''},files:{front:'',back:''},uploadFiles:{front:null,back:null},cloudSaved:{front:false,back:false},references:[],uploaded:false,isDefault:true,file:'',catalogDesign:null,catalogDesignSlug:null,step:1,assessment:null,assessments:{front:null,back:null},printSide:'front',printSides:['front'],printScale:1,checking:false,checkingSide:'',artworkTone:'',qualityAccepted:false,qualityReview:false,customIdea:'',customName:'',customEmail:'',customPhone:'',customSubmitted:false,creativeRequestId:crypto.randomUUID(),creativeOrderId:null,email:savedCustomerDetails.email||savedDraftDetails.email||'',firstName:savedCustomerDetails.firstName||savedDraftDetails.firstName||savedNameParts[0]||'',lastName:savedCustomerDetails.lastName||savedDraftDetails.lastName||savedNameParts.slice(1).join(' '),name:savedFullName,phone:savedCustomerDetails.phone||savedDraftDetails.phone||'',region:savedCustomerDetails.region||savedDraftDetails.region||'',address:savedCustomerDetails.address||savedDraftDetails.address||'',addressExtra:savedCustomerDetails.addressExtra||savedDraftDetails.addressExtra||'',commune:savedCustomerDetails.commune||savedDraftDetails.commune||'',deliveryNotes:savedCustomerDetails.deliveryNotes||savedDraftDetails.deliveryNotes||'',fulfillment:'delivery',shippingQuote:null,couponCode:'',couponDiscount:0,couponLabel:'',editingContact:false,checkoutReady:false,checkoutAsGuest:false,checkoutDraftId:null,cartItemId:null};
let checkoutScrollSnapshot=null;
function syncFullName(){state.name=[state.firstName,state.lastName].filter(Boolean).join(' ')}
function storeCustomerDetails(){syncFullName();saveForFifteenDays(CUSTOMER_DETAILS_KEY,{email:state.email,firstName:state.firstName,lastName:state.lastName,name:state.name,phone:state.phone,region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,deliveryNotes:state.deliveryNotes})}
const garmentSizes=['XS','S','M','L','XL','XXL'];
const products={basic:{name:'Básica',price:14990,sizes:[]},over:{name:'Over',price:21990,sizes:[]},kids:{name:'Kid',price:8990,sizes:[]}};
const chileRegions=['Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso','Metropolitana de Santiago','O’Higgins','Maule','Ñuble','Biobío','La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes'];
const chileRegionIds={'Arica y Parinacota':'15','Tarapacá':'01','Antofagasta':'02','Atacama':'03','Coquimbo':'04','Valparaíso':'05','Metropolitana de Santiago':'13','O’Higgins':'06','Maule':'07','Ñuble':'16','Biobío':'08','La Araucanía':'09','Los Ríos':'14','Los Lagos':'10','Aysén':'11','Magallanes':'12'};
const samePlace=(a,b)=>String(a).localeCompare(String(b),'es',{sensitivity:'base'})===0;
function communesForRegion(regionName){const matchedRegion=chileRegions.find(region=>samePlace(region,regionName));const regionId=chileRegionIds[matchedRegion];if(!regionId)return communes.map(commune=>commune.name);const provinceIds=new Set(provinces.filter(province=>province.regionId===regionId).map(province=>province.id));return communes.filter(commune=>provinceIds.has(commune.provinceId)).map(commune=>commune.name)}
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const fixedChileHolidays=new Set(['01-01','05-01','05-21','06-21','06-29','07-16','08-15','09-18','09-19','10-12','10-31','11-01','12-08','12-25']);
function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(year,month-1,day)}
function isChileHoliday(date){const key=`${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;if(fixedChileHolidays.has(key))return true;const easter=easterSunday(date.getFullYear()),difference=Math.round((new Date(date.getFullYear(),date.getMonth(),date.getDate())-easter)/86400000);return difference===-2||difference===-1}
function addBusinessDays(start,days){const date=new Date(start.getFullYear(),start.getMonth(),start.getDate());let remaining=days;while(remaining>0){date.setDate(date.getDate()+1);const weekday=date.getDay();if(weekday!==0&&weekday!==6&&!isChileHoliday(date))remaining--}return date}
const estimatedDate=()=>addBusinessDays(new Date(),state.fulfillment==='delivery'?7:5);
function canQuoteCurrentShipping(){if(state.fulfillment==='pickup')return true;const region=chileRegions.find(item=>samePlace(item,state.region.trim())),commune=region&&communesForRegion(region).find(item=>samePlace(item,state.commune.trim()));return Boolean(region&&commune&&state.address.trim())}
function recalculateShippingQuote(){if(!canQuoteCurrentShipping()){state.shippingQuote=null;return false}state.shippingQuote=quoteShipping(state.fulfillment,state.region,cart.reduce((sum,item)=>sum+item.quantity,0));return true}
function invalidateShippingQuote(){state.shippingQuote=null;const next=document.querySelector('#next');if(state.step===3&&next)next.textContent='Recalcular despacho'}
const estimatedDateLabel=()=>new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'long'}).format(estimatedDate());
// Safari/iOS puede presentar ciertos símbolos Unicode como emoji. Usamos
// equivalentes ASCII para los iconos decorativos y de acción.
function normalizeTextSymbols(root=document){
 const replacements={'↗':'>','↙':'<','↔':'<>','→':'>','←':'<','↑':'^','↓':'v','✳':'*','✷':'*','✧':'*','✕':'x','×':'x','＋':'+','⤵':'v'};
 const pattern=/↗|↙|↔|→|←|↑|↓|✳|✷|✧|✕|×|＋|⤵/g;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(node=>{node.nodeValue=node.nodeValue.replace(pattern,symbol=>replacements[symbol])});
}
document.querySelector('#app').innerHTML=`
<div class="announcement"><span class="announcement-message">De tu cabeza a tu polera. Así de simple.<svg class="announcement-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 14.3 9.7 22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z"/></svg></span><span class="announcement-origin">Hecho a tu pinta, en <img class="chile-flag" src="/chile-flag.webp" alt=""> Chile.</span></div>
<header><a class="logo" href="#" aria-label="Polerama inicio">polerama<span>✳</span></a><nav><details class="product-nav"><summary>Productos<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="product-nav-panel"><a href="#catalogo"><span><b>Poleras</b><em>Diseños listos y personalizados</em></span><small>Explorar <i aria-hidden="true">→</i></small></a><span class="product-nav-soon" aria-disabled="true"><span><b>Imanes</b><em>Para pegar tus mejores ideas</em></span><small>Próximamente</small></span><span class="product-nav-soon" aria-disabled="true"><span><b>Afiches</b><em>Arte para tus espacios</em></span><small>Próximamente</small></span><span class="product-nav-soon" aria-disabled="true"><span><b>Totebags</b><em>Tu idea para llevar</em></span><small>Próximamente</small></span><span class="product-nav-soon" aria-disabled="true"><span><b>Vasos térmicos</b><em>Para acompañarte todo el día</em></span><small>Próximamente</small></span></div></details></nav><button class="nav-cta ds-cta ds-cta--sm" data-start="ready">Crear mi polera ↗</button></header>
<main><section class="hero"><div class="hero-copy"><span class="eyebrow"><i></i> PARA IDEAS QUE NO CABEN EN UN CATÁLOGO</span><h1>Tu idea<br>favorita,<br><span>puesta.</span><svg class="hero-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0l9 33 27-20-19 28 33 9-33 9 19 28-27-20-9 33-9-33-28 20 20-28L0 50l33-9-20-28 28 20Z" fill="#dfff6b" stroke="#242720" stroke-width="2"/></svg></h1><p>Tu mascota, ese recuerdo, una idea muy tuya.<br>Lo convertimos en la polera que solo tú tienes.</p><button class="button dark" data-start="ready">Dale forma a tu idea <span>↗</span></button><div class="hero-note"><span class="mini-faces">☺ ☻ ☺</span><span>Diseñada por ti. Creada contigo.</span></div></div>
<div class="hero-art"><div class="art-grid"></div><span class="art-label">EL LIENZO ERES TÚ</span><div class="bubble">Esta puede ser tu mascota <span aria-hidden="true"><svg viewBox="0 0 70 90" role="img"><path d="M8 8 C50 12, 65 32, 57 55 C52 69, 43 76, 31 78" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M19 64 L30 79 L43 66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><img class="hero-static-image" src="/hero-customization.webp" width="1280" height="1280" alt="Foto de un perro convertida en un diseño sobre una polera personalizada" fetchpriority="high" decoding="async"><button class="hero-personalize" data-start="ready">＋ Agrega tu diseño</button><div class="floating-chip pink">ÚNICA.<br>COMO TÚ. <span>✷</span></div><div class="floating-chip cream"><span>✧</span> Cero poleras aburridas.</div><div class="art-bottom"><span>FOTO A POLERA · HECHA A TU PINTA</span><span>↙ HECHA A TU PINTA</span></div></div></section>
<div class="ticker"><span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳ <span>TU POLERA</span> ✳ <span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳</div>
<section id="caminos" class="section"><div class="section-heading"><div><span class="eyebrow">PRIMER PASO · ELIGE TU CAMINO</span><h2>¿Qué tienes en mente?</h2></div><p>Tres caminos para llegar<br>a tu polera favorita.</p></div><div class="paths"><button class="path lilac" data-start="ready"><span class="path-top">01 / TENGO DISEÑO <span>↗</span></span><div class="path-art upload-art"><div>↑<small>SUBE TU DISEÑO</small></div><svg class="brand-mark mark-lilac" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 60 33 88 12 70 42 100 50 69 58 86 88 57 67 49 100 40 66 12 86 30 57 0 49 33 40 15 12 43 33Z"/></svg></div><h3>Lo veo en 3D.</h3><p>Sube tu archivo. Si cumple el control técnico, lo visualizas sobre la polera.</p><span class="text-link">Tengo diseño <span>↗</span></span></button><button class="path lime" data-start="improve"><span class="path-top">02 / TE LO REVISO <span>↗</span></span><div class="path-art improve-art"><span>✳</span><b>✳</b><small>PREVIO ABONO</small></div><h3>Te lo reviso.</h3><p>Si necesita trabajo para imprimir, lo revisamos previo abono. Ese pago se descuenta de tu polera.</p><span class="text-link">Te lo reviso ↗</span></button><button class="path pink" data-start="custom"><span class="path-top">03 / MI IDEA <span>↗</span></span><div class="path-art custom-art"><span>¿y si…?</span><svg class="brand-mark mark-four" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 61 39 96 50 61 61 50 96 39 61 4 50 39 39Z"/></svg></div><h3>Mi idea, desde cero.</h3><p>Cuéntanos qué imaginas. Creamos una propuesta contigo, con cuota previa acreditable.</p><span class="text-link">Mi idea <span>↗</span></span></button></div></section>
<section class="how section" id="como"><div><span class="eyebrow">DEL “¿Y SI…?” AL “¡ES MÍA!”</span><h2>Así nace tu<br>próxima favorita.</h2><p>Un proceso simple.<br>Un resultado muy tuyo.</p><a class="text-link" href="#caminos">Vamos a crear ↗</a></div><ol><li><span>01</span><div><h3>Tú pones la idea.</h3><p>Sube tu archivo o cuéntanos qué imaginas. Elige tu polera, talla y color.</p></div></li><li><span>02</span><div><h3>La hacemos realidad.</h3><p>Si tu archivo necesita mejoras, pagas una cuota de revisión que se descuenta de tu polera. Los diseños desde cero se cotizan.</p></div></li><li><span>03</span><div><h3>La ves. Te enamoras. La apruebas.</h3><p>“Tengo diseño” permite ver en 3D los archivos que cumplen el control técnico. En trabajos creativos revisas la propuesta del taller antes de aprobar.</p></div></li><li><span>04</span><div><h3>De nuestra mesa a tu clóset.</h3><p>Con tu aprobación y pago completo, pasa a impresión. Coordinamos la entrega contigo.</p></div></li></ol></section>
<section class="closing"><svg class="brand-mark mark-asterisk" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5v90M5 50h90M18 18l64 64M82 18 18 82"/></svg><h2>Si lo imaginas,<br>te queda bien.</h2><button class="button dark" data-start="custom">Hagamos esa polera ↗</button><p>Sin catálogo. Sin límites a tu idea. Con mucha personalidad.</p></section>
<section class="faq section"><div class="faq-intro"><span class="eyebrow">ANTES DE EMPEZAR</span><h2>Antes de darle al botón.</h2><p>Todo lo necesario para pasar de tu idea a una polera lista para usar.</p><div class="faq-facts"><span>Archivos hasta 50 MB</span><span>Frente o espalda</span><span>Despachos en Chile</span></div><a class="faq-contact" href="https://wa.me/56965217926" target="_blank" rel="noopener">¿Te quedó una duda?<strong>Hablemos por WhatsApp →</strong></a></div><div class="faq-list">${[['¿Puedo subir mi propio diseño o uno hecho con IA?','Sí. Aceptamos JPG, PNG y WEBP de hasta 50 MB. Comprobamos formato, tamaño y resolución para un estampado de hasta 28 × 40 cm, en frente o espalda. Si la resolución no alcanza, te avisaremos antes de avanzar.'],['¿Y si todavía no tengo un diseño?','Elige “Mi idea”, cuéntanos qué imaginas y adjunta una referencia si quieres. El taller prepara una propuesta contigo.'],['¿Puedo revisar mi polera antes de imprimir?','Sí. Verás tu diseño sobre la polera antes de confirmar. El estampado ocupa una sola cara: frente o espalda.'],['¿Cuánto demora mi pedido?','El plazo depende de la revisión, aprobación, producción y despacho. Te confirmaremos una fecha estimada antes de pagar.']].map(([q,a])=>`<details><summary>${q}<span>+</span></summary><p>${a}</p></details>`).join('')}</div></section></main>
<footer>
  <div class="footer-brand"><a class="logo" href="#">polerama<span>✳</span></a><p>Ideas que se llevan puestas.<br>Diseñadas contigo, hechas en Chile.</p></div>
  <nav class="footer-catalog" aria-label="Catálogo indexable"></nav>
  <div class="footer-contact"><span>¿TIENES UNA IDEA?</span><strong>Hagámosla polera.</strong><a class="whatsapp-link" href="https://wa.me/56965217926" target="_blank" rel="noreferrer">Escríbeme por WhatsApp <span aria-hidden="true">↗</span></a></div>
  <div class="footer-bottom"><span>Hecho con personalidad en Chile. © ${new Date().getFullYear()}</span><a class="footer-how-link" href="#caminos">Cómo funciona <span aria-hidden="true">↗</span></a></div>
</footer>
<dialog id="studio"><div class="dialog-header"><a class="logo" href="#">polerama<span>✳</span></a><span>TU ESTUDIO CREATIVO</span><button class="icon-btn close-button" data-close aria-label="Cerrar estudio"><span aria-hidden="true"></span></button></div><div class="studio-body"><div class="preview"><div id="reference-panel"></div><div id="live-preview" hidden><span class="eyebrow">UNA VISTA A TU PRÓXIMA FAVORITA</span><div id="viewer"><div class="shirt preview-fallback"><div class="shirt-neck"></div><img alt="Tu diseño sobre la polera" hidden/></div></div></div><section id="checkout-cart-preview" class="checkout-cart-preview" hidden></section></div><div class="studio-controls"><div class="steps" aria-label="Progreso del diseño"></div><form id="design-form"><div id="step-content"></div><div class="form-navigation"><button type="button" id="back" class="small-button">Volver</button><button type="submit" class="button dark" id="next">Siguiente</button></div><p class="checkout-progress" id="checkout-progress" role="status" aria-live="polite" hidden></p></form></div></div></dialog>
<dialog id="size-guide-modal" aria-labelledby="size-guide-title"><div class="size-guide-header"><div><span class="eyebrow">GUÍA DE TALLAS</span><h2 id="size-guide-title">Encuentra tu medida.</h2></div><button type="button" class="icon-btn close-button" data-size-close aria-label="Cerrar guía de tallas"><span aria-hidden="true"></span></button></div><div class="size-guide-body"><div class="measure-visual"><svg viewBox="0 0 420 390" role="img" aria-labelledby="measure-title measure-desc"><title id="measure-title">Medición del ancho de una polera</title><desc id="measure-desc">La polera se mide en línea recta desde una axila hasta la otra.</desc><path class="measure-shirt" d="M133 55 174 34c9 21 63 21 72 0l41 21 75 60-45 63-34-24v195H137V154l-34 24-45-63 75-60Z"/><path class="measure-neck" d="M174 34c5 35 67 35 72 0"/><path class="measure-line" d="M137 158H283"/><path class="measure-arrow" d="m137 158 16-11m-16 11 16 11m130-11-16-11m16 11-16 11"/><circle cx="137" cy="158" r="6"/><circle cx="283" cy="158" r="6"/><text x="210" y="138" text-anchor="middle">AXILA A AXILA</text><text class="measure-a" x="210" y="190" text-anchor="middle">A</text></svg><div class="measure-caption"><strong>Medida A · Ancho</strong><span>Siempre en línea recta, sin estirar la tela.</span></div></div><div class="measure-info"><ol class="measure-steps"><li><b>1</b><span>Busca una polera que te quede como te gusta.</span></li><li><b>2</b><span>Extiéndela plana sobre una mesa.</span></li><li><b>3</b><span>Mide de axila a axila y compara el resultado.</span></li></ol><div class="visual-size-table"><div class="size-table-head"><span>Talla</span><span>Ancho A</span></div>${[['XS','44 cm'],['S','48 cm'],['M','52 cm'],['L','56 cm'],['XL','60 cm'],['XXL','64 cm']].map(([size,width])=>`<button type="button" data-guide-size="${size}"><strong>${size}</strong><span>${width}</span></button>`).join('')}</div><p class="measure-note">Las medidas son aproximadas y pueden variar hasta 1–2 cm. Si quedas entre dos tallas, elige la mayor para un calce más suelto.</p></div></div></dialog>
<dialog id="space"><div class="dialog-header"><h2>Tu espacio creativo</h2><button data-close class="icon-btn close-button" aria-label="Cerrar"><span aria-hidden="true"></span></button></div><div class="space-content"><span class="eyebrow">TUS IDEAS VIVEN AQUÍ</span><p>Desde aquí puedes seguir tus pedidos, revisar propuestas y volver a tu estudio creativo.</p><div id="saved-request"></div><button class="button dark" id="space-create">Abrir el estudio ↗</button></div></dialog>
<dialog id="payment-modal" class="mp-payment-modal" aria-labelledby="payment-title"><div id="payment-content"></div></dialog><div id="toast" role="status"></div>`;
function openDialog(dialog){
 if(!dialog||dialog.open)return;
 dialog.tabIndex=-1;
 dialog.showModal();
 dialog.focus({preventScroll:true});
 document.body.classList.add('locked');
}
const dialogFocusObserver=new MutationObserver(records=>{
 records.forEach(({target})=>{
  if(target instanceof HTMLDialogElement&&target.open){
   target.tabIndex=-1;
   target.focus({preventScroll:true});
  }
 });
});
dialogFocusObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

document.title='droska — SHIRT';document.querySelectorAll('.logo').forEach(el=>{el.innerHTML='droska<span>SHIRT</span>';el.setAttribute('aria-label','droska SHIRT inicio')});const favicon=document.querySelector('link[rel="icon"]');if(favicon)favicon.href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%23f955a5'/%3E%3Ctext x='10' y='47' font-size='42' font-family='Arial' font-weight='bold'%3Ed%3C/text%3E%3C/svg%3E";
function applyDesignSystemClasses(root=document){
 root.querySelectorAll('.button.dark').forEach(control=>control.classList.add('ds-cta'));
 root.querySelectorAll('.small-button').forEach(control=>control.classList.add('ds-secondary-button','ds-cta--sm'));
 root.querySelectorAll('.icon-btn.close-button').forEach(control=>control.classList.add('ds-icon-button'));
 root.querySelectorAll('.size-guide-trigger').forEach(control=>control.classList.add('ds-guide-button'));
 root.querySelectorAll('.product-options button,.sizes button,.fulfillment-choice').forEach(control=>control.classList.add('ds-choice-button'));
 root.querySelectorAll('.colors button').forEach(control=>control.classList.add('ds-swatch-button'));
 root.querySelectorAll('.quantity').forEach(control=>control.classList.add('ds-quantity'));
 root.querySelectorAll('.field input,.field textarea,.checkout-email-confirm input,.fulfillment-contact input').forEach(control=>control.classList.add('ds-field'));
}
applyDesignSystemClasses();
// Cuenta y carro de demostración: se guardan solo en este navegador hasta conectar el backend.
const CART_KEY='droska-cart-demo';
const LOCAL_DEMO_ORDERS_KEY='droska-local-demo-orders';
const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
const AUTH_REDIRECT_URL=(import.meta.env.VITE_SITE_URL||window.location.origin).replace(/\/$/,'');
const AUTH_ACCOUNT_REDIRECT=`${AUTH_REDIRECT_URL}/?panel=account`;
const supabase=createClient(SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS');
// El catálogo publicado sustituye estos datos al iniciar. El respaldo local
// evita que el home muestre una grilla vacía mientras llega Supabase.
let collections=[...fallbackCollections];
let catalogDesigns=[...fallbackCatalogDesigns];
async function loadProductPrices(){
 try{
  const [variantsResult,linksResult]=await Promise.all([
   supabase.from('product_variants').select('id,size,price_clp,product_models!inner(code)').eq('active',true),
   supabase.from('supplier_product_variants').select('product_variant_id'),
  ]);
  if(variantsResult.error)throw variantsResult.error;
  if(linksResult.error)throw linksResult.error;
  const linkedVariantIds=new Set((linksResult.data||[]).map(link=>String(link.product_variant_id)));
  const data=(variantsResult.data||[]).filter(variant=>linkedVariantIds.has(String(variant.id)));
  if(!data.length)throw new Error('No hay tallas vinculadas a insumos.');
  const prices=new Map();
  const sizes=new Map();
  for(const variant of data){const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models,code=model?.code==='kid'?'kids':model?.code;if(!products[code])continue;prices.set(code,Math.min(prices.get(code)??Infinity,variant.price_clp));if(!sizes.has(code))sizes.set(code,new Set());sizes.get(code).add(variant.size)}
  for(const [code,price] of prices)products[code].price=price;
  for(const [code,available] of sizes)products[code].sizes=garmentSizes.filter(size=>available.has(size)).concat([...available].filter(size=>!garmentSizes.includes(size)).sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true})));
  if(!products[state.kind].sizes.includes(state.size))state.size=products[state.kind].sizes[0]||'';
  renderCatalog();if(studio.open)renderStep();
 }catch(error){console.warn('No pudimos cargar las tallas disponibles desde Insumos:',error)}
}
const readLocal=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let account=null,cart=readLocal(CART_KEY,[]),cartExpanded=false,resumeIdeaAfterAuth=false,resumeCheckoutAfterAuth=false;
const saveLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const header=document.querySelector('header');
const productNav=header?.querySelector('.product-nav');
productNav?.querySelector('a')?.addEventListener('click',()=>productNav.removeAttribute('open'));
document.addEventListener('pointerdown',event=>{if(productNav?.open&&!productNav.contains(event.target))productNav.removeAttribute('open')});
const accountButton=document.createElement('button');accountButton.type='button';accountButton.className='account-trigger';accountButton.setAttribute('aria-label','Abrir acceso de cuenta');
const cartButton=document.createElement('button');cartButton.type='button';cartButton.className='cart-trigger ds-cart-button';cartButton.setAttribute('aria-label','Abrir carro de compras');
header?.insertBefore(accountButton,header.querySelector('.nav-cta'));header?.insertBefore(cartButton,header.querySelector('.nav-cta'));
header?.querySelector('.nav-cta')?.remove();
document.body.insertAdjacentHTML('beforeend',`<dialog id="account-modal" class="commerce-modal"><div class="commerce-head"><div><span class="eyebrow">TU ESPACIO</span><h2 id="account-title">Bienvenida a droska.</h2></div><button type="button" class="commerce-close close-button ds-icon-button" data-commerce-close aria-label="Cerrar"><span aria-hidden="true"></span></button></div><div id="account-content"></div></dialog><dialog id="cart-modal" class="commerce-modal cart-drawer"><div class="commerce-head"><div><span class="eyebrow">TU PEDIDO</span><h2>Carro de compras</h2></div><button type="button" class="commerce-close close-button ds-icon-button" data-commerce-close aria-label="Cerrar"><span aria-hidden="true"></span></button></div><div id="cart-content"></div></dialog>`);
const accountModal=document.querySelector('#account-modal'),cartModal=document.querySelector('#cart-modal'),paymentModal=document.querySelector('#payment-modal');
let checkoutOpening=false,paymentSubmitting=false,preparedCheckoutUrl='',preparedCheckoutTotal=0;
paymentModal.addEventListener('cancel',event=>{if(paymentSubmitting)event.preventDefault()});
document.querySelector('#studio').addEventListener('cancel',event=>{if(checkoutOpening)event.preventDefault()});
let accountOrdersChannel=null;
const safe=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function expiredConfirmationLink(){
 const params=new URLSearchParams(location.search);
 const hash=location.hash.startsWith('#')?location.hash.slice(1):'';
 const hashParams=new URLSearchParams(hash);
 const errorCode=params.get('error_code')||hashParams.get('error_code');
 const description=`${params.get('error_description')||''} ${hashParams.get('error_description')||''}`.toLowerCase();
 return errorCode==='otp_expired'||description.includes('otp_expired')||description.includes('email link is invalid or has expired');
}
function clearExpiredConfirmationLink(){
 const cleanUrl=new URL(location.href);
 ['error','error_code','error_description','error_reason'].forEach(key=>{cleanUrl.searchParams.delete(key)});
 const hashParams=new URLSearchParams(cleanUrl.hash.startsWith('#')?cleanUrl.hash.slice(1):'');
 ['error','error_code','error_description','error_reason'].forEach(key=>hashParams.delete(key));
 cleanUrl.hash=hashParams.toString()?`#${hashParams}`:'';
 history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}
function updateCommerceNav(){const itemCount=cart.reduce((sum,item)=>sum+item.quantity,0);accountButton.innerHTML=account?`<span class="account-initial">${safe(account.name).slice(0,1).toUpperCase()}</span><span>Hola, ${safe(account.name.split(' ')[0])}</span>`:'<span class="account-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></span><span>Ingresar</span>';cartButton.innerHTML=`<svg class="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-1 14H5L4 5Zm4 0a4 4 0 0 1 8 0"/></svg><b>${itemCount}</b>`;cartButton.classList.toggle('has-items',itemCount>0)}
function accountFromUser(user){return user&&!user.is_anonymous?{id:user.id,name:user.user_metadata?.full_name||user.email?.split('@')[0]||'Creativa',email:user.email||''}:null}
const accountDate=value=>new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
function accountDashboardShell(active){return `<div class="account-welcome"><span class="account-initial large">${safe(account.name).slice(0,1).toUpperCase()}</span><div><strong>${safe(account.name)}</strong><small>${safe(account.email)}</small></div></div><nav class="account-sections" aria-label="Secciones de mi cuenta"><button type="button" class="${active==='orders'?'active':''}" data-account-section="orders" ${active==='orders'?'aria-current="page"':''}>Mis pedidos</button><button type="button" class="${active==='data'?'active':''}" data-account-section="data" ${active==='data'?'aria-current="page"':''}>Mis datos</button></nav><div class="account-panel" id="account-panel" aria-live="polite"><div class="account-loading"><span></span>Cargando…</div></div><button type="button" class="account-logout" id="logout-account">Cerrar sesión</button>`}
function bindAccountDashboard(){document.querySelectorAll('[data-account-section]').forEach(button=>button.onclick=()=>renderAccountDashboard(button.dataset.accountSection));document.querySelector('#logout-account').onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)return toast(error.message,'error');account=null;updateCommerceNav();renderAccount();toast('Sesión cerrada.')}}
async function accountOrders(){
 let {data,error}=await supabase.from('orders').select('id,source,request_type,request_details,quote_message,quoted_total_clp,status,total_clp,shipping_clp,created_at,shipping_address,payment_confirmed_at,payment_instructions,payment_transfer_notice_at,archived_at,payments(provider,status),order_items(id,name_snapshot,quantity,line_total_clp),order_status_history(id,status,note,created_at)').eq('user_id',account.id).order('created_at',{ascending:false});
 if(error){const fallback=await supabase.from('orders').select('id,source,request_type,request_details,quote_message,quoted_total_clp,status,total_clp,shipping_clp,created_at,shipping_address,payment_confirmed_at,payment_instructions,payments(provider,status),order_items(id,name_snapshot,quantity,line_total_clp),order_status_history(id,status,note,created_at)').eq('user_id',account.id).order('created_at',{ascending:false});data=fallback.data;error=fallback.error;(data||[]).forEach(order=>{order.payment_transfer_notice_supported=false})}else{(data||[]).forEach(order=>{order.payment_transfer_notice_supported=true})}
 const local=readLocal(LOCAL_DEMO_ORDERS_KEY,[]).filter(order=>String(order.shipping_address?.customer?.email||'').toLowerCase()===account.email.toLowerCase());
 if(error&&local.length===0)throw error;
 const visibleOrders=[...(data||[])].map(order=>{const paid=Boolean(order.payment_confirmed_at)||(order.payments||[]).some(payment=>payment.status==='approved');const blockedUntilPayment=!paid&&['in_production','ready','ready_for_pickup','shipped','delivered'].includes(order.status);return blockedUntilPayment?{...order,status:'paid',payment_pending_confirmation:true,order_status_history:(order.order_status_history||[]).filter(item=>['draft','submitted','quoted','awaiting_deposit','deposit_paid','paid'].includes(item.status))}:order});
 return [...local,...visibleOrders].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
async function claimOrdersToAccount(){if(!account)return;try{const {data,error}=await supabase.functions.invoke('claim-orders');if(error||data?.error)throw error||new Error(data.error)}catch(error){console.error('No pudimos asociar los pedidos existentes',error);toast('No pudimos asociar tus solicitudes anteriores. Reintenta al abrir tu cuenta.','error')}}
function orderDestination(order){const address=order.shipping_address||{};if(address.fulfillment==='pickup')return 'Retiro coordinado';return [address.address,address.commune,address.region].filter(Boolean).join(', ')||'Dirección por confirmar'}
function accountOrderPaymentMarkup(order){if(order.archived_at)return '';const transfer=order.payment_instructions?.transfer||{},hasTransfer=Object.values(transfer).some(Boolean),paymentLink=order.payment_instructions?.mercado_pago_url,notice=order.payment_transfer_notice_at,noticeSupported=order.payment_transfer_notice_supported===true,transferPayment=(order.payments||[]).find(payment=>payment.provider==='transferencia_bancaria'),paymentConfirmed=Boolean(order.payment_confirmed_at)||transferPayment?.status==='approved';if(!hasTransfer&&!paymentLink)return '';return `<section class="account-order-payment" data-account-order-payment="${safe(order.id)}" aria-label="Datos de pago"><div class="account-order-payment-head"><span>Datos de pago</span><strong>${money(order.total_clp)}</strong></div><p>${paymentConfirmed?'Tu pago fue confirmado. Ya podemos preparar tu pedido.':'Debes pagar este monto para que podamos preparar tu pedido.'}</p>${hasTransfer?`<dl>${transfer.holder?`<div><dt>Titular</dt><dd>${safe(transfer.holder)}</dd></div>`:''}${transfer.bank?`<div><dt>Banco</dt><dd>${safe(transfer.bank)}</dd></div>`:''}${transfer.account_type||transfer.account_number?`<div><dt>Cuenta</dt><dd>${safe(`${transfer.account_type||''} ${transfer.account_number||''}`.trim())}</dd></div>`:''}${transfer.rut?`<div><dt>RUT</dt><dd>${safe(transfer.rut)}</dd></div>`:''}${transfer.email?`<div><dt>Email</dt><dd>${safe(transfer.email)}</dd></div>`:''}</dl>${noticeSupported&&!paymentConfirmed?`<div class="account-order-payment-action">${notice?`<span class="account-order-payment-notice">Aviso enviado. Estamos verificando tu transferencia.</span>`:`<button type="button" class="account-order-payment-link" data-notify-payment-transfer="${safe(order.id)}">Avisar que ya pagué</button>`}</div>`:''}`:''}${paymentLink?`<a class="account-order-payment-link" href="${safe(paymentLink)}" target="_blank" rel="noreferrer">Pagar online</a>`:''}</section>`}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-notify-payment-transfer]');if(!button)return;event.preventDefault();const orderId=button.dataset.notifyPaymentTransfer;button.disabled=true;button.textContent='Enviando aviso…';const {data,error}=await supabase.functions.invoke('notify-payment-transfer',{body:{orderId}});if(error||data?.error){button.disabled=false;button.textContent='Avisar que ya pagué';toast(data?.error||error?.message||'No pudimos enviar el aviso.','error');return}toast('Avisamos a la tienda que ya realizaste la transferencia.');renderAccountOrders()});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-pay-creative]');if(!button)return;button.disabled=true;button.textContent='Preparando pago…';const {data,error}=await supabase.functions.invoke('create-creative-payment',{body:{orderId:Number(button.dataset.payCreative)}});if(error||data?.error||!data?.initPoint){button.disabled=false;button.textContent='Aceptar y pagar cotización';toast(data?.error||error?.message||'No pudimos iniciar el pago. Intenta nuevamente.','error');return}window.location.assign(data.initPoint)});
function orderStepper(order){if(order.archived_at)return '<div class="account-order-archived-note">Pedido archivado · solo lectura</div>';const steps=orderSteps(order),current=orderProgressIndex(order.status,order);return `<ol class="order-progress${order.status==='cancelled'?' is-cancelled':''}" style="--order-step-count:${steps.length}" aria-label="Avance del pedido">${steps.map((step,index)=>`<li class="${index<current?'complete':index===current?'current':''}"><span aria-hidden="true">${index<current?'✓':String(index+1).padStart(2,'0')}</span><strong>${safe(step.label)}</strong></li>`).join('')}</ol>${accountOrderPaymentMarkup(order)}`}
function stopAccountOrdersWatch(){if(accountOrdersChannel){supabase.removeChannel(accountOrdersChannel);accountOrdersChannel=null}}
function watchAccountOrders(){stopAccountOrdersWatch();if(!account)return;accountOrdersChannel=supabase.channel(`account-orders-${account.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`user_id=eq.${account.id}`},()=>{if(accountModal.open&&document.querySelector('[data-account-section="orders"].active'))renderAccountOrders()}).subscribe()}
async function renderAccountOrders(){
 const panel=document.querySelector('#account-panel');
 try{const orders=await accountOrders();if(!panel)return;if(!orders.length){panel.innerHTML='<section class="account-empty"><span class="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg></span><strong>Aún no tienes pedidos.</strong><p>Cuando completes una compra podrás seguir su estado desde aquí.</p><button type="button" class="button dark" id="account-start-order">Explorar diseños</button></section>';document.querySelector('#account-start-order').onclick=()=>{accountModal.close();location.hash='catalogo'};watchAccountOrders();return}
 panel.innerHTML=`<div class="account-orders-head"><span>Tus pedidos se actualizan automáticamente.</span><button type="button" id="account-refresh-orders">Actualizar</button></div><div class="account-orders">${orders.map(order=>`<article class="account-order${order.archived_at?' is-archived':''}"><div><span>Pedido #${safe(order.id)}</span><strong>${order.request_type==='creative'&&order.status==='submitted'?'Por cotizar':money(order.total_clp)}</strong></div><div><span class="account-order-status">${order.archived_at?'Archivado':safe(orderStatusLabel(order.status))}</span><time datetime="${safe(order.created_at)}">${safe(accountDate(order.created_at))}</time></div>${order.request_type==='creative'&&['submitted','quoted','awaiting_deposit'].includes(order.status)?`<section class="account-creative-quote"><strong>${order.status==='quoted'?'Tu propuesta está lista':order.status==='awaiting_deposit'?'Pago pendiente':'Estamos revisando tu idea'}</strong><p>${safe(['quoted','awaiting_deposit'].includes(order.status)?order.quote_message||'Revisa la cotización.':order.request_details||'Te contactaremos con una propuesta.')}</p>${['quoted','awaiting_deposit'].includes(order.status)&&!order.archived_at?`<button type="button" class="button dark" data-pay-creative="${safe(order.id)}">${order.status==='quoted'?'Aceptar y pagar':'Continuar pago'} ${money(order.quoted_total_clp)}</button><small>Confirma que el detalle incluya la entrega acordada antes de pagar.</small>`:''}</section>`:orderStepper(order)}<p>${order.request_type==='creative'?'Solicitud de diseño personalizado':safe(orderDestination(order))}</p><details><summary>Ver detalle e historial <b>+</b></summary><div>${(order.order_items||[]).map(item=>`<span><span><strong>${safe(item.name_snapshot)}</strong><small>${item.quantity} ${item.quantity===1?'unidad':'unidades'}</small></span><b>${money(item.line_total_clp)}</b></span>`).join('')||'<small>Sin productos asociados.</small>'}</div>${(order.order_status_history||[]).length?`<ul class="account-order-history">${[...order.order_status_history].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(item=>`<li><span>${safe(orderStatusLabel(item.status))}</span><time datetime="${safe(item.created_at)}">${safe(accountDate(item.created_at))}</time></li>`).join('')}</ul>`:''}</details></article>`).join('')}</div>`;document.querySelector('#account-refresh-orders').onclick=renderAccountOrders;watchAccountOrders()}
 catch(error){console.error(error);if(panel){panel.innerHTML='<section class="account-empty error"><strong>No pudimos cargar tus pedidos.</strong><p>Revisa tu conexión y vuelve a intentarlo.</p><button type="button" class="button dark" id="retry-account-orders">Reintentar</button></section>';panel.querySelector('#retry-account-orders').onclick=renderAccountOrders}}
}
async function accountProfile(){
 const fields='id,full_name,phone,region,commune,address,address_extra,delivery_notes';
 let {data,error}=await supabase.from('profiles').select(fields).eq('id',account.id).maybeSingle();
 if(error){const fallback=await supabase.from('profiles').select('id,full_name,phone').eq('id',account.id).maybeSingle();data=fallback.data;error=fallback.error}
 if(error)throw error;
 const {data:{user}}=await supabase.auth.getUser();const saved=user?.user_metadata?.customer_profile||{};
 return {full_name:data?.full_name||account.name,phone:data?.phone||saved.phone||state.phone,region:data?.region||saved.region||state.region,commune:data?.commune||saved.commune||state.commune,address:data?.address||saved.address||state.address,address_extra:data?.address_extra||saved.address_extra||state.addressExtra,delivery_notes:data?.delivery_notes||saved.delivery_notes||state.deliveryNotes};
}
async function renderAccountData(){
 const panel=document.querySelector('#account-panel');
 try{const profile=await accountProfile();if(!panel)return;panel.innerHTML=`<form class="account-data-form" id="account-data-form"><fieldset><legend>Información</legend><label>Nombre completo<input class="ds-field" name="full_name" autocomplete="name" required value="${safe(profile.full_name)}"></label><label>Email<input class="ds-field" type="email" value="${safe(account.email)}" readonly aria-describedby="account-email-note"><small id="account-email-note">El email se administra desde tu acceso.</small></label><label>Teléfono${phoneFieldHtml('account-phone',profile.phone,'phone')}</label></fieldset><fieldset><legend>Dirección de despacho</legend><label>Región${regionFilterHtml(profile.region,'account-region')}</label><label>Comuna<input class="ds-field" name="commune" autocomplete="address-level2" value="${safe(profile.commune)}"></label><label>Dirección<input class="ds-field" name="address" autocomplete="street-address" value="${safe(profile.address)}"></label><label>Depto., casa u oficina <span>Opcional</span><input class="ds-field" name="address_extra" autocomplete="address-line2" value="${safe(profile.address_extra)}"></label><label>Indicaciones <span>Opcional</span><textarea class="ds-field" name="delivery_notes">${safe(profile.delivery_notes)}</textarea></label></fieldset><button class="button dark commerce-wide" type="submit">Guardar mis datos</button></form>`;
 const phone=panel.querySelector('#account-phone');if(phone)phone.oninput=()=>{phone.value=formatChilePhoneLocal(phone.value)};setupRegionFilter(panel.querySelector('#account-region'));panel.querySelector('#account-data-form').onsubmit=saveAccountData}
 catch(error){console.error(error);if(panel)panel.innerHTML='<section class="account-empty error"><strong>No pudimos cargar tus datos.</strong><p>Intenta nuevamente en unos minutos.</p></section>'}
}
async function saveAccountData(event){
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),values=new FormData(form),payload={full_name:String(values.get('full_name')).trim(),phone:fullChilePhone(values.get('phone')),region:String(values.get('region')).trim(),commune:String(values.get('commune')).trim(),address:String(values.get('address')).trim(),address_extra:String(values.get('address_extra')).trim(),delivery_notes:String(values.get('delivery_notes')).trim(),updated_at:new Date().toISOString()};button.disabled=true;button.textContent='Guardando…';
 let {error}=await supabase.from('profiles').update(payload).eq('id',account.id).select('id').maybeSingle();
 if(error)({error}=await supabase.from('profiles').update({full_name:payload.full_name,phone:payload.phone,updated_at:payload.updated_at}).eq('id',account.id).select('id').maybeSingle());
 const {error:metadataError}=await supabase.auth.updateUser({data:{full_name:payload.full_name,customer_profile:{phone:payload.phone,region:payload.region,commune:payload.commune,address:payload.address,address_extra:payload.address_extra,delivery_notes:payload.delivery_notes}}});button.disabled=false;button.textContent='Guardar mis datos';if(error||metadataError)return toast('No pudimos guardar tus datos. Intenta nuevamente.','error');
 account.name=payload.full_name||account.name;const parts=payload.full_name.split(/\s+/).filter(Boolean);Object.assign(state,{firstName:parts[0]||'',lastName:parts.slice(1).join(' '),name:payload.full_name,phone:payload.phone,region:payload.region,commune:payload.commune,address:payload.address,addressExtra:payload.address_extra,deliveryNotes:payload.delivery_notes});storeCustomerDetails();updateCommerceNav();toast('Tus datos quedaron guardados.');renderAccountDashboard('data')
}
function renderAccountDashboard(section='orders'){document.querySelector('#account-title').textContent=`Hola, ${account.name.split(' ')[0]}.`;document.querySelector('#account-content').innerHTML=accountDashboardShell(section);bindAccountDashboard();if(section==='data'){stopAccountOrdersWatch();renderAccountData()}else renderAccountOrders()}
function renderAccount(mode='login',pendingEmail=''){
 if(mode==='forgot'){document.querySelector('#account-title').textContent='Recupera tu contraseña.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Te enviaremos un enlace seguro para crear una contraseña nueva.</p><form id="password-recovery-form" class="account-form"><label>Email<input class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(pendingEmail||state.email)}"></label><button class="button dark commerce-wide ds-cta" type="submit">Enviar enlace</button></form><button type="button" class="commerce-switch" id="account-switch">Volver a iniciar sesión</button><small class="commerce-note">Por seguridad, el enlace tendrá una vigencia limitada.</small>`;document.querySelector('#account-switch').onclick=()=>renderAccount('login');document.querySelector('#password-recovery-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,email=String(new FormData(form).get('email')).trim(),submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Enviando…';const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${AUTH_REDIRECT_URL}/?panel=account`});submit.disabled=false;submit.textContent='Enviar enlace';if(error)return toast(authErrorMessage(error),'error');state.email=state.email||email;document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Si existe una cuenta para <strong>${safe(email)}</strong>, recibirás un enlace para cambiar tu contraseña.</p><button type="button" class="button dark commerce-wide ds-cta" id="recovery-back">Volver a ingresar</button>`;document.querySelector('#recovery-back').onclick=()=>renderAccount('login',email)};return}
 if(mode==='update-password'){document.querySelector('#account-title').textContent='Crea una contraseña nueva.';document.querySelector('#account-content').innerHTML='<p class="commerce-copy">Elige una contraseña de al menos 6 caracteres.</p><form id="password-update-form" class="account-form"><label>Nueva contraseña<input class="ds-field" name="password" required type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label><button class="button dark commerce-wide ds-cta" type="submit">Guardar contraseña</button></form>';document.querySelector('#password-update-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,password=String(new FormData(form).get('password')),submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Guardando…';const {error}=await supabase.auth.updateUser({password});submit.disabled=false;submit.textContent='Guardar contraseña';if(error)return toast(error.message);toast('Contraseña actualizada.');accountModal.close();};return}
 if(account){renderAccountDashboard(mode==='data'?'data':'orders');return}
 if(mode==='expired'){
  document.querySelector('#account-title').textContent='Tu enlace venció.';
  document.querySelector('#account-content').innerHTML=`<section class="account-confirmation account-expired" aria-labelledby="expired-confirmation-title"><span class="account-confirmation-icon" aria-hidden="true">!</span><h3 id="expired-confirmation-title">No necesitas crear otra cuenta.</h3><p>El enlace de confirmación caducó por seguridad. Escribe el correo con el que te registraste y te enviaremos uno nuevo.</p><form id="expired-confirmation-form" class="account-form"><label for="expired-confirmation-email">Email<input id="expired-confirmation-email" class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(pendingEmail||state.email)}"></label><button type="submit" class="button dark commerce-wide ds-cta">Enviar nuevo enlace</button></form><small>Si no lo encuentras, revisa también tu carpeta de spam.</small></section><button type="button" class="commerce-switch" id="account-switch">Volver a iniciar sesión</button>`;
  document.querySelector('#account-switch').onclick=()=>renderAccount('login',pendingEmail);
  document.querySelector('#expired-confirmation-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,email=String(new FormData(form).get('email')).trim(),button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Enviando…';const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:AUTH_ACCOUNT_REDIRECT}});button.disabled=false;button.textContent='Enviar nuevo enlace';if(error)return toast(authErrorMessage(error),'error');state.email=email;storeCustomerDetails();document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Te enviamos un nuevo enlace de confirmación a <strong>${safe(email)}</strong>. No necesitas registrarte otra vez.</p><button type="button" class="button dark commerce-wide ds-cta" id="expired-back">Volver a ingresar</button>`;document.querySelector('#expired-back').onclick=()=>renderAccount('login',email)};
  return;
 }
 if(mode==='confirm'){document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<section class="account-confirmation" aria-label="Confirmación de cuenta"><span class="account-confirmation-icon" aria-hidden="true">✓</span><p>Para activar tu cuenta, abre el enlace que enviamos a:</p><strong class="account-confirmation-email">${safe(pendingEmail)}</strong><small>El enlace vence por seguridad. Revisa también tu carpeta de spam.</small></section><div class="account-confirmation-actions"><button type="button" class="button dark commerce-wide ds-cta" id="resend-confirmation">Reenviar enlace</button><button type="button" class="commerce-switch" id="account-switch">Ya confirmé mi cuenta · Ingresar</button></div>`;document.querySelector('#account-switch').onclick=()=>renderAccount('login');document.querySelector('#resend-confirmation').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.textContent='Enviando…';const {error}=await supabase.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:AUTH_ACCOUNT_REDIRECT}});button.disabled=false;button.textContent='Reenviar enlace';if(error)return toast(authErrorMessage(error),'error');toast('Te enviamos un nuevo enlace de confirmación.');return};return}
 const isRegister=mode==='register',suggestedName=[state.firstName,state.lastName].filter(Boolean).join(' ');document.querySelector('#account-title').textContent=isRegister?'Crea tu cuenta.':'Qué bueno verte.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">${isRegister?'Tus datos de contacto y despacho quedarán precargados para tu próxima compra.':'Ingresa para recuperar tus datos y avanzar más rápido.'}</p><form id="account-form" class="account-form">${isRegister?`<label>Nombre completo<input class="ds-field" name="name" required autocomplete="name" placeholder="Cómo te llamas" value="${safe(suggestedName)}"></label>`:''}<label>Email<input class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(state.email)}"></label><label>Contraseña<input class="ds-field" name="password" required type="password" minlength="6" autocomplete="${isRegister?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"></label>${isRegister?'':'<button type="button" class="account-forgot" id="account-forgot">Olvidé mi contraseña</button>'}<button class="button dark commerce-wide ds-cta" type="submit">${isRegister?'Crear mi cuenta':'Ingresar'}</button></form><button type="button" class="commerce-switch" id="account-switch">${isRegister?'Ya tengo cuenta · Ingresar':'¿Primera vez por aquí? · Crear cuenta'}</button>`;
 document.querySelector('#account-switch').onclick=()=>renderAccount(isRegister?'login':'register');
 document.querySelector('#account-forgot')?.addEventListener('click',()=>renderAccount('forgot',document.querySelector('#account-form [name="email"]')?.value));
 document.querySelector('#account-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form),email=String(data.get('email')).trim(),password=String(data.get('password')),name=isRegister?String(data.get('name')).trim():'';const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Un momento…';const customerProfile={phone:state.phone,region:state.region,commune:state.commune,address:state.address,address_extra:state.addressExtra,delivery_notes:state.deliveryNotes};const result=isRegister?await supabase.auth.signUp({email,password,options:{data:{full_name:name,customer_profile:customerProfile},emailRedirectTo:AUTH_ACCOUNT_REDIRECT}}):await supabase.auth.signInWithPassword({email,password});submit.disabled=false;submit.textContent=isRegister?'Crear mi cuenta':'Ingresar';if(result.error){console.error('Supabase Auth error',result.error);return toast(authErrorMessage(result.error),'error')}state.email=state.email||email;if(isRegister&&name)state.firstName=state.firstName||name.split(' ')[0];if(!result.data.session){renderAccount('confirm',email);return}account=accountFromUser(result.data.user);state.checkoutAsGuest=false;await claimOrdersToAccount();await hydrateCheckoutFromProfile();updateCommerceNav();accountModal.close();toast(`Listo, ${account.name.split(' ')[0]}. Tu sesión está activa.`);if(resumeCheckoutAfterAuth){resumeCheckoutAfterAuth=false;beginCheckout();return}if(studio.open&&state.step===3)renderStep();if(resumeIdeaAfterAuth){resumeIdeaAfterAuth=false;openStudio('ready')}};
}
function closeCartDrawer(next){cartModal.classList.add('is-closing');window.setTimeout(()=>{cartModal.classList.remove('is-closing');cartModal.close();next?.()},260)}
cartModal.addEventListener('cancel',event=>{event.preventDefault();closeCartDrawer()});
function cartTotal(){return cart.reduce((sum,item)=>sum+item.price*item.quantity,0)}
async function hydrateCheckoutFromProfile(){if(!account)return;try{const profile=await accountProfile(),parts=String(profile.full_name||account.name).split(/\s+/).filter(Boolean);Object.assign(state,{firstName:parts[0]||state.firstName,lastName:parts.slice(1).join(' ')||state.lastName,email:account.email||state.email,phone:profile.phone||state.phone,region:profile.region||state.region,commune:profile.commune||state.commune,address:profile.address||state.address,addressExtra:profile.address_extra||state.addressExtra,deliveryNotes:profile.delivery_notes||state.deliveryNotes});storeCustomerDetails()}catch(error){console.error(error)}}
async function beginCheckout(asGuest=false){state.mode='ready';state.checkoutDraftId=null;state.checkoutAsGuest=!account&&asGuest;if(account)await hydrateCheckoutFromProfile();state.editingContact=!(state.firstName&&state.lastName&&state.email&&state.phone);state.shippingQuote=null;recalculateShippingQuote();state.step=3;if(!studio.open)openDialog(studio);renderStep();faceSelectedSide()}
function catalogPreviewForCart(slug){const design=catalogDesigns.find(item=>item.id===slug);return design?artworkUrl(design):''}
async function cartPreviewPng(file,fallback=''){if(!(file instanceof Blob))return fallback;const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas'),limit=320,scale=Math.min(limit/image.naturalWidth,limit/image.naturalHeight,1);canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png')}catch{return fallback}finally{URL.revokeObjectURL(url)}}
async function cartPreviewFile(preview,side){
 if(!preview||String(preview).startsWith('blob:'))return null;
 try{
  const response=await fetch(preview);if(!response.ok)return null;
  const blob=await response.blob();
  if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||!blob.size)return null;
  const extension=blob.type==='image/jpeg'?'jpg':blob.type.split('/')[1];
  return new File([blob],`droska-${side}.${extension}`,{type:blob.type});
 }catch{return null}
}
let addingCurrentToCart=false;
const cartDesignMemory=new Map();
async function addCurrentToCart(){
 if(addingCurrentToCart)return;
 addingCurrentToCart=true;
 try{
  const product=products[state.kind],pricing=orderTotal(product.price,printChoice(),state.qualityReview?QUALITY_ADJUSTMENT_CLP:0),id=state.cartItemId||`shirt-${Date.now()}`,catalogPreview=catalogPreviewForCart(state.catalogDesignSlug),fallback=state.images.front||state.images[state.printSide]||'',designPreview=catalogPreview||await cartPreviewPng(state.uploadFiles.front||state.uploadFiles[state.printSide],fallback),item={id,kind:product.name,modelCode:state.kind,size:state.size,sides:printSidesLabel(),printSides:printChoice(),color:state.color,catalogDesignSlug:state.catalogDesignSlug,qualityReview:state.qualityReview,designPreview,initial:state.files[state.printSide]?.slice(0,1).toUpperCase()||'*',price:pricing.total,quantity:1},existing=cart.findIndex(entry=>entry.id===id);
  let storageWarning=false;
  if(!item.catalogDesignSlug){
   const front=item.printSides==='back'?null:state.uploadFiles.front,back=item.printSides==='front'?null:state.uploadFiles.back;
   if((item.printSides!=='back'&&!(front instanceof Blob))||(item.printSides!=='front'&&!(back instanceof Blob)))throw new Error('Falta el archivo original del diseño. Vuelve a cargarlo antes de añadir la polera.');
   cartDesignMemory.set(id,{front,back});
   try{await saveCartDesignFiles(id,front,back)}catch(error){storageWarning=true;console.warn('No pudimos persistir el original del diseño; queda disponible durante esta sesión.',error)}
  }else{cartDesignMemory.delete(id);await removeCartDesignFiles(id).catch(()=>{})}
  if(existing>=0)cart[existing]={...cart[existing],...item};else cart.push(item);
  state.cartItemId=id;saveLocal(CART_KEY,cart);updateCommerceNav();persistDraft();studio.close();renderCart();openDialog(cartModal);
  toast(storageWarning?'Tu polera quedó en el carro. Mantén esta pestaña abierta para continuar la compra.':existing>=0?'Actualizamos tu polera en el carro.':'Tu polera quedó añadida al carro.');
 }catch(error){toast(error.message||'No pudimos guardar el diseño para el pedido.','error')}finally{addingCurrentToCart=false}
}
function showCartAccessGate(target){document.querySelector('#cart-checkout')?.setAttribute('hidden','');target.querySelector('.cart-access-gate')?.remove();target.querySelector('#cart-keep-shopping')?.remove();target.insertAdjacentHTML('beforeend','<section class="cart-access-gate" aria-labelledby="cart-access-title"><div><span class="eyebrow">ANTES DE PAGAR</span><h3 id="cart-access-title">Crea tu cuenta para continuar.</h3><p>Guarda tus pedidos y avanza más rápido en tu próxima compra.</p></div><button type="button" class="button dark ds-cta" id="cart-register">Crear cuenta</button><button type="button" class="cart-access-secondary" id="cart-login">Ya tengo cuenta · Iniciar sesión</button><button type="button" class="cart-access-guest" id="cart-guest">Continuar como invitado</button></section><button type="button" class="cart-keep-shopping" id="cart-keep-shopping">← Seguir comprando</button>');const openAccount=mode=>{resumeCheckoutAfterAuth=mode!=='forgot';closeCartDrawer(()=>{renderAccount(mode);accountModal.showModal()})};document.querySelector('#cart-login').onclick=()=>openAccount('login');document.querySelector('#cart-register').onclick=()=>openAccount('register');document.querySelector('#cart-keep-shopping').onclick=()=>closeCartDrawer();document.querySelector('#cart-guest').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.textContent='Preparando compra…';const {data:{session}}=await supabase.auth.getSession();if(!session){const {error}=await supabase.auth.signInAnonymously();if(error&&!import.meta.env.DEV){button.disabled=false;button.textContent='Continuar como invitado';return toast('No pudimos iniciar la compra como invitado. Intenta nuevamente.')}}closeCartDrawer(()=>beginCheckout(true))}}
function renderCart(){const target=document.querySelector('#cart-content');queueMicrotask(()=>{if(!account&&cart.length&&target.isConnected)showCartAccessGate(target)});if(!cart.length){target.innerHTML='<div class="cart-empty"><span>✳</span><h3>Aún no hay poleras aquí.</h3><p>Elige un diseño del catálogo o crea una polera desde cero.</p><div class="cart-empty-actions"><button type="button" class="button dark commerce-wide ds-cta" id="cart-choose">Elegir una polera <span aria-hidden="true">→</span></button><button type="button" class="cart-empty-create" id="cart-start">Crear mi polera</button></div></div>';document.querySelector('#cart-choose').onclick=()=>closeCartDrawer(()=>{location.hash='catalogo'});document.querySelector('#cart-start').onclick=()=>closeCartDrawer(()=>openStudio('ready'));return}const visibleItems=cartExpanded?cart:cart.slice(0,2),hiddenItems=Math.max(0,cart.length-visibleItems.length),itemLabel=cart.reduce((sum,item)=>sum+item.quantity,0)===1?'polera':'poleras';target.innerHTML=`<div class="cart-overview"><strong>${cart.reduce((sum,item)=>sum+item.quantity,0)} ${itemLabel} en tu pedido</strong><span>Resumen antes de pagar</span></div><div class="cart-list cart-list--compact">${visibleItems.map(item=>`<article class="cart-item cart-item--compact"><div class="cart-art" style="--cart-color:${safe(item.color)}">${item.designPreview?`<img src="${safe(item.designPreview)}" alt="Diseño elegido">`:`<span>${safe(item.initial)}</span>`}</div><div class="cart-item-copy"><strong>Polera ${safe(item.kind)}</strong><small>Talla ${safe(item.size)} · ${safe(item.sides)}</small><button type="button" data-cart-remove="${safe(item.id)}">Quitar</button></div><div class="cart-price"><strong>${money(item.price*item.quantity)}</strong><div class="quantity"><button type="button" data-cart-quantity="${safe(item.id)}" data-change="-1" aria-label="Reducir cantidad">−</button><span>${item.quantity}</span><button type="button" data-cart-quantity="${safe(item.id)}" data-change="1" aria-label="Aumentar cantidad">+</button></div></div></article>`).join('')}</div>${hiddenItems?`<button type="button" class="cart-show-more" id="cart-show-more">Ver ${hiddenItems} diseño${hiddenItems===1?'':'s'} más <span aria-hidden="true">↓</span></button>`:''}${cartExpanded&&cart.length>2?'<button type="button" class="cart-show-more" id="cart-show-less">Mostrar resumen</button>':''}<div class="cart-total"><span>Subtotal</span><strong>${money(cartTotal())}</strong><small>El despacho se calcula en el checkout.</small></div><button type="button" class="button dark commerce-wide ds-cta" id="cart-checkout">Continuar compra <span>→</span></button><button type="button" class="cart-keep-shopping" id="cart-keep-shopping">← Seguir comprando</button>`;target.querySelectorAll('.cart-art').forEach((art,index)=>{const preview=catalogPreviewForCart(visibleItems[index]?.catalogDesignSlug);if(preview)art.innerHTML=`<img src="${safe(preview)}" alt="Diseño elegido">`});target.querySelectorAll('[data-cart-remove]').forEach(button=>button.onclick=()=>{cart=cart.filter(item=>item.id!==button.dataset.cartRemove);if(cart.length<=2)cartExpanded=false;saveLocal(CART_KEY,cart);updateCommerceNav();renderCart()});target.querySelectorAll('[data-cart-quantity]').forEach(button=>button.onclick=()=>{const item=cart.find(entry=>entry.id===button.dataset.cartQuantity);if(!item)return;item.quantity+=Number(button.dataset.change);if(item.quantity<1)cart=cart.filter(entry=>entry!==item);if(cart.length<=2)cartExpanded=false;saveLocal(CART_KEY,cart);updateCommerceNav();renderCart()});target.querySelector('#cart-show-more')?.addEventListener('click',()=>{cartExpanded=true;renderCart()});target.querySelector('#cart-show-less')?.addEventListener('click',()=>{cartExpanded=false;renderCart()});document.querySelector('#cart-keep-shopping').onclick=()=>closeCartDrawer();document.querySelector('#cart-checkout').onclick=()=>account?closeCartDrawer(()=>beginCheckout(false)):showCartAccessGate(target)}
document.querySelector('#cart-content').addEventListener('click',event=>{const id=event.target.closest('[data-cart-remove],[data-cart-quantity]')?.dataset.cartRemove||event.target.closest('[data-cart-quantity]')?.dataset.cartQuantity;if(id&&!cart.some(item=>item.id===id))removeCartDesignFiles(id).catch(()=>{})});
async function checkoutItems(withArtwork=true){const items=[];for(const item of cart){const artwork=withArtwork?await paymentArtworkFor(item,(await supabase.auth.getUser()).data.user?.id):{frontDesignPath:null,backDesignPath:null};items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides:item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front'),quantity:item.quantity,qualityReview:Boolean(item.qualityReview),catalogDesignSlug:item.catalogDesignSlug||null,...artwork})}return items}
async function createCheckoutDraft(){
 const {data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw new Error('Inicia sesión o continúa como invitado antes de pagar.');
 const items=await checkoutItems(true);
 const payload={paymentMethod:'draft',draftOrderId:state.checkoutDraftId,items,couponCode:state.couponCode||null,fulfillment:state.fulfillment,shippingQuoteClp:state.shippingQuote?.amount??null,customer:{firstName:state.firstName,lastName:state.lastName,email:state.email,phone:state.phone},shippingAddress:state.fulfillment==='delivery'?{region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,notes:state.deliveryNotes}:null};
 const {data,error}=await supabase.functions.invoke('create-payment-preference',{body:payload});if(error||!data?.orderId)throw new Error(data?.error||await paymentFunctionError(error,'No pudimos registrar tu pedido en el admin.'));state.checkoutDraftId=data.orderId;return data;
}
function setCheckoutButtonLoading(button,loading,label){
 if(!button)return;
 button.disabled=loading;
 button.classList.toggle('is-loading',loading);
 if(loading)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
 button.textContent=label;
 if(loading){const spinner=document.createElement('span');spinner.className='payment-spinner';spinner.setAttribute('aria-hidden','true');button.prepend(spinner)}
}
async function paymentFunctionError(error,fallback){
 try{const body=await error?.context?.json();if(typeof body?.error==='string'&&body.error.trim())return body.error}catch{}
 return fallback;
}
function setPaymentLoading(loading,label,description=''){
 paymentSubmitting=loading;
 const target=document.querySelector('#payment-content'),button=target?.querySelector('#continue-to-payment'),status=target?.querySelector('#payment-wait-status');
 setCheckoutButtonLoading(button,loading,label);
 target?.querySelectorAll('[name="payment-method"]').forEach(input=>{input.disabled=loading||input.dataset.available==='false'});
 const close=target?.querySelector('.mp-payment-close');if(close)close.disabled=loading;
 if(status){status.hidden=!loading;status.textContent=loading?description:''}
}
async function openPaymentConfirmation(){
 if(checkoutOpening)return;
 checkoutOpening=true;
 const next=document.querySelector('#next'),originalLabel=next?.textContent||'Ir a pagar';
 const progress=document.querySelector('#checkout-progress');if(progress){progress.hidden=false;progress.textContent='Estamos preparando tu pedido. Espera un momento.'}
 const content=document.querySelector('#step-content'),back=document.querySelector('#back'),close=studio.querySelector('.dialog-header [data-close]');
 if(content)content.inert=true;
 if(back)back.disabled=true;
 if(close)close.disabled=true;
 setCheckoutButtonLoading(next,true,'Preparando tu pedido…');
 try{await createCheckoutDraft()}catch(error){toast(error.message||'No pudimos registrar tu pedido.','error');return}finally{checkoutOpening=false;setCheckoutButtonLoading(next,false,originalLabel);if(progress){progress.textContent='';progress.hidden=true}if(content)content.inert=false;if(back)back.disabled=false;if(close)close.disabled=false}
 const target=document.querySelector('#payment-content'),shipping=state.shippingQuote?.amount||0,total=cartTotal()+shipping-state.couponDiscount,items=cart.reduce((sum,item)=>sum+item.quantity,0);
 studio.close();
 preparedCheckoutUrl='';preparedCheckoutTotal=0;
 target.innerHTML=`<div class="mp-payment-head"><img class="mp-payment-logo" src="/mercado-pago-logo.svg" alt="Mercado Pago"><button type="button" class="close-button mp-payment-close ds-icon-button" aria-label="Cerrar confirmación de pago"><span aria-hidden="true"></span></button></div><div class="mp-payment-body"><span class="eyebrow">ELIGE CÓMO PAGAR</span><h2 id="payment-title">Revisa tu pedido.</h2><p class="mp-payment-lead">El despacho ya fue calculado. Confirmaremos el importe con los precios vigentes antes de crear tu pedido.</p><div class="mp-payment-summary"><span>${items} ${items===1?'producto':'productos'}<small>Despacho ${money(shipping)}</small></span><strong>${money(total)}</strong></div><div class="payment-methods" role="radiogroup" aria-label="Medio de pago"><label class="payment-method is-selected"><input type="radio" name="payment-method" value="mercado_pago" checked><span><strong>Mercado Pago</strong><small>Tarjetas, transferencia y otros medios disponibles en Checkout Pro.</small></span></label><label class="payment-method"><input type="radio" name="payment-method" value="transfer" data-available="false" disabled><span><strong>Transferencia bancaria</strong><small data-transfer-availability>Comprobando disponibilidad…</small></span></label></div><p class="mp-payment-error" role="alert" hidden></p><button type="button" class="button mp-payment-button" id="continue-to-payment">Continuar a Mercado Pago</button><p class="mp-payment-wait" id="payment-wait-status" role="status" aria-live="polite" hidden></p><small class="mp-payment-legal">El pedido solo pasará a producción cuando confirmemos el pago.</small></div>`;
 openDialog(paymentModal);
 target.querySelector('.mp-payment-close').onclick=()=>paymentModal.close();
 const transferInput=target.querySelector('[name="payment-method"][value="transfer"]'),transferHelp=target.querySelector('[data-transfer-availability]');
 supabase.functions.invoke('create-payment-preference',{method:'GET'}).then(({data,error})=>{
  if(!paymentModal.open||!transferInput?.isConnected)return;
  const available=!error&&data?.bankTransferAvailable===true;
  transferInput.dataset.available=String(available);
  transferInput.disabled=!available||paymentSubmitting;
  transferHelp.textContent=available?'Ingresa el pedido y te enviaremos los datos para transferir. Quedará pendiente de confirmación.':error?'No pudimos comprobar esta opción. Usa Mercado Pago por ahora.':'No disponible por ahora. Puedes pagar con Mercado Pago.';
 }).catch(()=>{if(transferInput?.isConnected)transferHelp.textContent='No pudimos comprobar esta opción. Usa Mercado Pago por ahora.'});
 const submit=target.querySelector('#continue-to-payment'),methods=[...target.querySelectorAll('[name="payment-method"]')];const syncMethod=()=>{if(paymentSubmitting)return;const selected=target.querySelector('[name="payment-method"]:checked')?.value==='transfer';target.querySelectorAll('.payment-method').forEach(method=>method.classList.toggle('is-selected',method.querySelector('input')?.checked));submit.textContent=selected?'Solicitar pago por transferencia':preparedCheckoutUrl?`Confirmar ${money(preparedCheckoutTotal)} e ir a Mercado Pago`:'Continuar a Mercado Pago'};methods.forEach(method=>method.onchange=syncMethod);submit.onclick=()=>{if(paymentSubmitting)return;if(target.querySelector('[name="payment-method"]:checked')?.value==='transfer')return submitTransferOrder();if(preparedCheckoutUrl){setPaymentLoading(true,'Abriendo Mercado Pago…','Te estamos llevando al sitio seguro de pago.');window.location.assign(preparedCheckoutUrl);return}return openMercadoPagoCheckout()};
}
accountButton.onclick=()=>{renderAccount();accountModal.showModal()};cartButton.onclick=()=>{renderCart();cartModal.showModal()};document.querySelectorAll('[data-commerce-close]').forEach(button=>button.onclick=()=>button.closest('#cart-modal')?closeCartDrawer():button.closest('dialog').close());accountModal.addEventListener('close',()=>{stopAccountOrdersWatch();if(!account)resumeCheckoutAfterAuth=false});updateCommerceNav();supabase.auth.getUser().then(({data})=>{account=accountFromUser(data.user);updateCommerceNav()});supabase.auth.onAuthStateChange((event,session)=>{const nextAccount=accountFromUser(session?.user);if(account?.id!==nextAccount?.id)state.cloudSaved={front:false,back:false};account=nextAccount;updateCommerceNav();if(event==='PASSWORD_RECOVERY'){renderAccount('update-password');if(!accountModal.open)accountModal.showModal()}});
const requestedCommercePanel=new URLSearchParams(location.search).get('panel');if(requestedCommercePanel==='account'||requestedCommercePanel==='cart'){const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('panel');history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);queueMicrotask(()=>requestedCommercePanel==='account'?accountButton.click():cartButton.click())}
if(expiredConfirmationLink()){clearExpiredConfirmationLink();queueMicrotask(()=>{renderAccount('expired',state.email);accountModal.showModal()})}
document.querySelectorAll('.garment-meta > span').forEach(el=>el.textContent='Elige en el estudio');
document.querySelector('.price-note')?.remove();
document.querySelector('.how')?.remove();
const extraFaqs=[
 ['¿Hacen despachos a regiones?','Coordinamos la entrega dentro de Chile. El costo y plazo de despacho se informan junto con la cotización.'],
 ['¿Qué medios de pago aceptan?','Puedes pagar de forma segura con Mercado Pago. El total, incluido el despacho cuando corresponda, siempre se muestra antes de confirmar tu pedido.']
];
const faqList=document.querySelector('.faq-list');extraFaqs.forEach(([question,answer])=>{if(!faqList)return;const item=document.createElement('details');const summary=document.createElement('summary');summary.textContent=question;const toggle=document.createElement('span');toggle.textContent='+';summary.append(toggle);const copy=document.createElement('p');copy.textContent=answer;item.append(summary,copy);faqList.append(item)});faqList?.querySelectorAll('details').forEach(item=>item.addEventListener('toggle',()=>{if(!item.open)return;faqList.querySelectorAll('details[open]').forEach(other=>{if(other!==item)other.open=false})}));
const ticker=document.querySelector('.ticker');if(ticker){const items=[...ticker.childNodes].map(node=>node.cloneNode(true));const track=document.createElement('div');track.className='ticker-track';track.append(...items,...items.map(node=>node.cloneNode(true)));ticker.replaceChildren(track)}
const designPath=document.querySelector('.path[data-start="ready"]');if(designPath){const title=designPath.querySelector('h3');const copy=designPath.querySelector('p');if(title)title.innerHTML='Sube, mira,<br>decide.';if(copy)copy.textContent='Comprueba cómo se ve tu diseño sobre la polera antes de elegir.';const flow=document.createElement('div');flow.className='design-flow';flow.innerHTML='<span><b>01</b> Sube</span><i>→</i><span><b>02</b> Mira en 3D</span><i>→</i><span><b>03</b> Elige</span>';copy?.after(flow);const link=designPath.querySelector('.text-link');if(link)link.innerHTML='Subir mi diseño <span>↗</span>';designPath.remove()}
const whatsappFloat=document.createElement('a');whatsappFloat.className='whatsapp-float';whatsappFloat.href='https://wa.me/56965217926';whatsappFloat.target='_blank';whatsappFloat.rel='noreferrer';whatsappFloat.setAttribute('aria-label','Abrir chat de ayuda');whatsappFloat.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.7-.8L4 20l1.5-3.7A7.2 7.2 0 0 1 4 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z"/><circle cx="8.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="15.5" cy="12" r=".8"/></svg><span>¿Dudas?</span>';document.body.append(whatsappFloat);
const footerCatalog=document.querySelector('.footer-catalog');
function renderFooterCatalog(){
 footerCatalog.replaceChildren();
 const title=document.createElement('strong');title.textContent='Catálogo';footerCatalog.append(title);
 const productLink=document.createElement('a');productLink.href=catalogProductPath('poleras');productLink.textContent='Poleras';footerCatalog.append(productLink);
 collections.forEach(collection=>{const link=document.createElement('a');link.href=catalogCollectionPath('poleras',collection.id);link.textContent=collection.label;footerCatalog.append(link)});
}
const spaceContent=document.querySelector('#space .space-content');if(spaceContent){const avatar=document.createElement('div');avatar.className='space-avatar';avatar.innerHTML='<img src="/cris.png" alt="Avatar de Cristian"><div><span class="eyebrow">TU ESTUDIO TOLSKA</span><strong>Cristian</strong></div>';spaceContent.prepend(avatar)}
const humanStory=document.createElement('section');humanStory.className='human-story section';humanStory.innerHTML='<div class="human-story-avatar"><div class="human-story-avatar-circle"><img class="avatar-body-layer" src="/cris.png" alt="Cristian, fundador de droska SHIRT"></div><img class="avatar-head-layer" src="/cris.png" alt="" aria-hidden="true"></div><div><span class="eyebrow">DETRÁS DE CADA POLERA</span><h2>Hola, soy Cristian.</h2><p class="human-story-lead">No es una fábrica. Es una mesa en mi casa.</p><p>Empecé droska SHIRT para estar más cerca de Benja, mi hijo. Cada pedido se trabaja uno a uno, con tiempo y cariño. Gracias por ayudarnos a seguir eligiendo estar juntos.</p></div>';document.querySelector('.closing')?.before(humanStory);
const storyParagraphs=[...humanStory.querySelectorAll('p')];if(storyParagraphs.length>1){const unified=storyParagraphs.map(p=>p.textContent.trim()).join(' ');storyParagraphs[0].textContent=unified;storyParagraphs.slice(1).forEach(p=>p.remove())}
const closingSection=document.querySelector('.closing');if(closingSection){const storyGroup=document.createElement('section');storyGroup.className='human-closing';storyGroup.hidden=true;humanStory.before(storyGroup);storyGroup.append(humanStory,closingSection)}
const heroMessage=document.querySelector('.hero-copy>p');if(heroMessage)heroMessage.innerHTML='Tu mascota, ese recuerdo, una idea muy tuya.<br>Lo convertimos en la polera que solo tú tienes.<br><strong>También puedes enviarnos tu diseño generado con IA.</strong>';
const heroEyebrow=document.querySelector('.hero-copy>.eyebrow');if(heroEyebrow)heroEyebrow.innerHTML='<i></i> DEL PROMPT A TU POLERA';const heroTitle=document.querySelector('.hero-copy h1');if(heroTitle){heroTitle.classList.add('hero-gpt');heroTitle.setAttribute('aria-label','Trae tu diseño de GPT, foto, dibujo o idea a una polera.');heroTitle.innerHTML='Trae tu<br><span class="hero-variable-wrap"><span id="hero-variable-word" aria-hidden="true">diseño de GPT</span></span><br><span class="hero-tail">a una <em>polera.</em></span><svg class="hero-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 59 34 86 14 69 41 100 50 69 59 86 86 59 66 50 100 41 66 14 86 31 59 0 50 31 41 14 14 41 34Z" fill="#dfff6b" stroke="#242720" stroke-width="3" stroke-linejoin="round"/></svg>';const words=['diseño de GPT','foto','dibujo','idea'];const word=heroTitle.querySelector('#hero-variable-word');let wordIndex=0;const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;window.setInterval(()=>{wordIndex=(wordIndex+1)%words.length;if(reducedMotion){word.textContent=words[wordIndex];return}word.classList.add('is-leaving');window.setTimeout(()=>{word.textContent=words[wordIndex];word.classList.remove('is-leaving');word.classList.add('is-entering');window.setTimeout(()=>word.classList.remove('is-entering'),420)},190)},2700)}if(heroMessage)heroMessage.innerHTML='Acá lo ajustamos para que se vea bien, se imprima mejor<br>y quede realmente a tu pinta.';const heroCta=document.querySelector('.hero-copy [data-start="ready"]');if(heroCta)heroCta.innerHTML='Traer mi diseño <span>↗</span>';
const heroCopy=document.querySelector('.hero-copy');const heroArt=document.querySelector('.hero-art');if(heroCopy&&heroTitle&&heroMessage&&heroCta&&heroArt){const catalogTitle=document.createElement('h1');catalogTitle.className='hero-gpt hero-catalog-title';catalogTitle.hidden=true;catalogTitle.innerHTML='Encuentra<br>tu próxima<br><span>favorita.</span>';heroTitle.after(catalogTitle);const pager=document.createElement('div');pager.className='hero-slider-controls';pager.setAttribute('aria-label','Slides destacados');pager.innerHTML='<span aria-live="polite">01 / 02</span><button type="button" class="is-active" aria-label="Ver slide 1: crear con mi diseño">01</button><button type="button" aria-label="Ver slide 2: explorar el catálogo">02</button>';heroCopy.append(pager);const pagerButtons=[...pager.querySelectorAll('button')];const artLabel=heroArt.querySelector('.art-label');const bubble=heroArt.querySelector('.bubble');const pinkChip=heroArt.querySelector('.floating-chip.pink');const artBottom=heroArt.querySelector('.art-bottom span:last-child');const setHeroSlide=index=>{const catalog=index===1;heroTitle.hidden=catalog;catalogTitle.hidden=!catalog;heroEyebrow.innerHTML=catalog?'<i></i> DISEÑOS LISTOS PARA ELEGIR':'<i></i> DEL PROMPT A TU POLERA';heroMessage.innerHTML=catalog?'Explora diseños originales, míralos sobre la polera<br>y elige el que más se parece a ti.':'Acá lo ajustamos para que se vea bien, se imprima mejor<br>y quede realmente a tu pinta.';heroCta.innerHTML=catalog?'Explorar catálogo <span>↓</span>':'Traer mi diseño <span>↗</span>';heroCta.onclick=catalog?()=>document.querySelector('#catalogo')?.scrollIntoView({behavior:'smooth'}):()=>beginIdea();if(artLabel)artLabel.textContent=catalog?'DISEÑOS LISTOS PARA LLEVAR':'EL LIENZO ERES TÚ';if(bubble)bubble.innerHTML=catalog?'Elige una portada <span aria-hidden="true">↙</span>':'Esta puede ser tu mascota <span aria-hidden="true"><svg viewBox="0 0 70 90" role="img"><path d="M8 8 C50 12, 65 32, 57 55 C52 69, 43 76, 31 78" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M19 64 L30 79 L43 66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';if(pinkChip)pinkChip.innerHTML=catalog?'ELIGE.<br>PERSONALIZA. <span>✷</span>':'ÚNICA.<br>COMO TÚ. <span>✷</span>';if(artBottom)artBottom.textContent=catalog?'COLECCIONES PARA EXPLORAR':'↙ HECHA A TU PINTA';pager.querySelector('span').textContent=`0${index+1} / 02`;pagerButtons.forEach((button,buttonIndex)=>{button.classList.toggle('is-active',buttonIndex===index);button.setAttribute('aria-pressed',String(buttonIndex===index))})};pagerButtons.forEach((button,index)=>button.addEventListener('click',()=>setHeroSlide(index)));setHeroSlide(0)}
const heroCatalogStage=document.querySelector('.hero-art');
if(heroCatalogStage){
 const heroRoot=heroCatalogStage.closest('.hero');
 const samples=document.createElement('div');samples.className='hero-catalog-samples';samples.setAttribute('aria-label','Tres diseños destacados del catálogo');samples.setAttribute('role','list');heroCatalogStage.append(samples);
 const editorialDecor=document.createElement('div');editorialDecor.className='hero-editorial-decor';editorialDecor.setAttribute('aria-hidden','true');editorialDecor.innerHTML='<div class="hero-editorial-rail hero-editorial-rail--left"><span>DISEÑA</span><i></i><b>TU ESTILO <em>—</em> DISEÑOS <em>—</em> POLERAS</b></div><div class="hero-editorial-top"><span>DISEÑOS LISTOS<br>PARA LLEVAR</span><i></i></div><div class="hero-editorial-rail hero-editorial-rail--right"><span class="hero-editorial-star">✦</span><b>COLECCIONES<br>PARA EXPLORAR</b><i></i></div></div>';
 heroCatalogStage.closest('.hero')?.append(editorialDecor);
 const setEditorialCopy=catalog=>{const top=editorialDecor.querySelector('.hero-editorial-top span'),right=editorialDecor.querySelector('.hero-editorial-rail--right b');if(top)top.innerHTML=catalog?'DISEÑOS LISTOS<br>PARA LLEVAR':'EL LIENZO<br>ERES TÚ';if(right)right.innerHTML=catalog?'COLECCIONES<br>PARA EXPLORAR':'HECHA<br>A TU PINTA'};
 heroRoot?.classList.add('is-creative-slide');
 setEditorialCopy(false);
 const heroSlideControls=[...document.querySelectorAll('.hero-slider-controls button')];
 heroSlideControls[0]?.addEventListener('click',()=>{heroCatalogStage.classList.remove('is-catalog-slide');heroRoot?.classList.remove('is-catalog-slide');heroRoot?.classList.add('is-creative-slide');setEditorialCopy(false)});
 heroSlideControls[1]?.addEventListener('click',()=>{heroCatalogStage.classList.add('is-catalog-slide');heroRoot?.classList.remove('is-creative-slide');heroRoot?.classList.add('is-catalog-slide');setEditorialCopy(true)});
}
const heroSlider=document.querySelector('.hero-slider-controls');
if(heroSlider){
 const slideButtons=[...heroSlider.querySelectorAll('button')];
 const heroRoot=heroSlider.closest('.hero');
 const autoplayToggle=document.createElement('button');
 autoplayToggle.type='button';autoplayToggle.className='hero-slider-toggle';autoplayToggle.setAttribute('aria-label','Pausar rotación automática');autoplayToggle.setAttribute('aria-pressed','false');autoplayToggle.title='Pausar rotación automática';autoplayToggle.innerHTML='<span aria-hidden="true">Ⅱ</span>';
 heroSlider.append(autoplayToggle);
 let autoplayTimer=null,autoplayPaused=false;
 const currentSlide=()=>Math.max(0,slideButtons.findIndex(button=>button.classList.contains('is-active')));
 const stopAutoplay=()=>{if(autoplayTimer){window.clearTimeout(autoplayTimer);autoplayTimer=null}};
 const scheduleAutoplay=()=>{stopAutoplay();if(autoplayPaused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;autoplayTimer=window.setTimeout(()=>{slideButtons[(currentSlide()+1)%slideButtons.length]?.click();scheduleAutoplay()},6000)};
 const pauseAutoplay=()=>{autoplayPaused=true;stopAutoplay();autoplayToggle.setAttribute('aria-pressed','true');autoplayToggle.setAttribute('aria-label','Reanudar rotación automática');autoplayToggle.title='Reanudar rotación automática';autoplayToggle.innerHTML='<span aria-hidden="true">▶</span>'};
 const resumeAutoplay=()=>{autoplayPaused=false;autoplayToggle.setAttribute('aria-pressed','false');autoplayToggle.setAttribute('aria-label','Pausar rotación automática');autoplayToggle.title='Pausar rotación automática';autoplayToggle.innerHTML='<span aria-hidden="true">Ⅱ</span>';scheduleAutoplay()};
 slideButtons.forEach(button=>button.addEventListener('click',scheduleAutoplay));
 autoplayToggle.addEventListener('click',()=>autoplayPaused?resumeAutoplay():pauseAutoplay());
 heroRoot?.addEventListener('pointerenter',stopAutoplay);
 heroRoot?.addEventListener('pointerleave',scheduleAutoplay);
 heroRoot?.addEventListener('focusin',stopAutoplay);
 heroRoot?.addEventListener('focusout',event=>{if(!heroRoot.contains(event.relatedTarget))scheduleAutoplay()});
 document.addEventListener('visibilitychange',()=>document.hidden?stopAutoplay():scheduleAutoplay());
 scheduleAutoplay();
}
const studio=document.querySelector('#studio');let viewer,viewerPromise;const uploadVersions={front:0,back:0};
document.querySelector('#viewer').addEventListener('preview-error',()=>toast('No pudimos mostrar ese estampado. Prueba reemplazando el archivo.'));
const colorDock=document.createElement('div');colorDock.className='color-dock';colorDock.innerHTML='<span>COLOR</span>'+[['#ffffff','Blanco'],['#202124','Negro'],['#e8e0cf','Blanco vintage'],['#8daec3','Azul zen']].map(([c,n])=>`<button type="button" aria-label="${n}" title="${n}" data-color="${c}" style="--swatch:${c}"></button>`).join('');
const sizeDock=document.createElement('div');sizeDock.className='size-dock';sizeDock.innerHTML='<span>TAMAÑO</span><input id="print-scale" type="range" min="0.55" max="1.70" step="0.01" value="1" aria-label="Tamaño del estampado" title="Tamaño calculado automáticamente"><output id="print-scale-value">100%</output>';
const maxPrintScale=()=>state.catalogDesign?CATALOG_ARTWORK_SCALE:state.isDefault?1:USER_ARTWORK_SCALE;
const syncScaleControl=()=>{const input=sizeDock.querySelector('input');const max=maxPrintScale();input.max=max.toFixed(2);state.printScale=Math.min(state.printScale,max);input.value=state.printScale;sizeDock.querySelector('output').textContent=Math.round(state.printScale*100)+'%';input.title=`Tamaño solicitado: ${Math.round(state.printScale*100)}% · el visor lo ajusta si excede la polera · estampado hasta 28 × 40 cm`};
sizeDock.querySelector('input').oninput=e=>{state.printScale=Math.min(Number(e.target.value),maxPrintScale());syncScaleControl();viewer?.update(previewState())};
document.querySelector('.path[data-start="improve"]')?.remove();
const pathsIntro=document.querySelector('#caminos .section-heading p');if(pathsIntro)pathsIntro.innerHTML='Un camino para llegar<br>a tu polera favorita.';const ideaPath=document.querySelector('.path[data-start="custom"] .path-top');if(ideaPath&&ideaPath.firstChild)ideaPath.firstChild.textContent='01 / MI IDEA ';
const ideaCard=document.querySelector('.path[data-start="custom"]');if(ideaCard){const ideaCopy=ideaCard.querySelector('p');if(ideaCopy)ideaCopy.outerHTML='<div class="path-stepper"><div><b>01</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6M4 20l3-7L17 3l4 4L11 17l-7 3Zm2-6 4 4M5 5h3M6.5 3.5v3M18 14h3M19.5 12.5v3"/></svg></i><span>Trae tu idea.<small>Una foto, un dibujo o un diseño hecho con IA.</small></span></div><div><b>02</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg></i><span>Sube tu archivo al estudio.</span></div><div><b>03</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 20l1.8-4A8 8 0 1 1 21 11Z"/></svg></i><span>Lo afinamos contigo.</span></div></div>';ideaCard.querySelector('.path-art')?.insertAdjacentHTML('beforeend','<img class="custom-doodles" src="/idea-collage.png" alt=""><img class="custom-shirt-image" src="/idea-shirt.png" alt="Ejemplo de polera personalizada">')}
const ideaLink=document.querySelector('.path[data-start="custom"] .text-link');if(ideaLink)ideaLink.innerHTML='Empezar mi idea <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const primaryCtaMarkup='Empezar mi idea <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
document.querySelector('.hero-personalize')?.remove();
const primaryCtas=[...document.querySelectorAll('.nav-cta[data-start],.hero-copy [data-start],.closing [data-start]')];
primaryCtas.forEach(cta=>{cta.classList.add('primary-idea-cta');cta.dataset.start='ready';cta.innerHTML=primaryCtaMarkup});
ideaLink?.classList.add('primary-idea-cta');
function previewState(){const isSample=!state.images?.[state.printSide]&&state.isDefault;const sideImage=state.images?.[state.printSide]||(isSample?DEFAULT_SAMPLE_IMAGE:'');const sideAssessment=state.assessments?.[state.printSide]||state.assessment;return {...state,image:state.mode==='ready'&&sideImage?sideImage:'',assessment:sideAssessment}}
function syncPreview(){
 const checkoutPreview=document.querySelector('#checkout-cart-preview');
 if(state.step===3){document.querySelector('#reference-panel').hidden=true;document.querySelector('#live-preview').hidden=true;renderCheckoutCartPreview();checkoutPreview.hidden=false;return}
 if(checkoutPreview)checkoutPreview.hidden=true;
 const sideImage=state.images?.[state.printSide]||'';
 const catalogPreviewReady=Boolean(state.catalogDesign&&sideImage&&state.assessments?.[state.printSide]?.qualifies);
 const showSample=Boolean(state.isDefault&&!state.catalogDesign&&!sideImage);
 const isForging=!sideImage&&!showSample&&!catalogPreviewReady,showMockup=Boolean(sideImage||showSample),renderState=isForging?{...state,image:'',assessment:null,isDefault:false}:previewState();
 const livePreview=document.querySelector('#live-preview');livePreview.hidden=!(isForging||showMockup);livePreview.classList.toggle('is-forging',isForging);
 const liveEyebrow=livePreview.querySelector(':scope > .eyebrow');if(liveEyebrow){liveEyebrow.hidden=false;liveEyebrow.textContent=catalogPreviewReady?'TU DISEÑO ELEGIDO, EN LA POLERA':'UNA VISTA A TU PRÓXIMA FAVORITA'}
 let effects=livePreview.querySelector('.forge-3d-effects');
 if(!effects){const particles=Array.from({length:34},(_,index)=>`<i style="--i:${index};--x:${5+(index*37)%90}%;--y:${8+(index*53)%84}%;--s:${3+(index%5)*1.4}px;--drift:${-34+(index*29)%68}px;--duration:${2.6+(index%6)*.28}s"></i>`).join('');livePreview.insertAdjacentHTML('beforeend',`<div class="forge-3d-effects" aria-hidden="true"><div class="forge-3d-halo"></div><div class="forge-3d-scan"></div><div class="forge-3d-particles">${particles}</div><div class="forge-3d-status"><span></span><div><strong></strong><small></small></div></div></div>`);effects=livePreview.querySelector('.forge-3d-effects')}
 effects.hidden=!isForging;if(isForging){effects.querySelector('strong').textContent=sideImage?'Afinando tu mockup…':'Tu próxima polera empieza acá.';effects.querySelector('small').textContent=sideImage?'Te mostraremos una vista previa al terminar la revisión.':'Sube tu diseño y míralo tomar forma en este lienzo.'}
 const panel=document.querySelector('#reference-panel');panel.hidden=true;panel.replaceChildren();
    viewer?.update(renderState);
 const fallback=document.querySelector('.preview-fallback img');if(fallback){fallback.hidden=!renderState.image;if(!fallback.hidden)fallback.src=renderState.image}
 if((isForging||showMockup)&&studio.open){if(!viewerPromise)viewerPromise=import('./garment.js').then(async m=>{viewer=await m.createViewer(document.querySelector('#viewer'),renderState,{cameraDistance:4.9});return viewer}).catch(()=>{viewerPromise=null;toast('El visor 3D no está disponible en este navegador.','error')});
 viewerPromise?.then(()=>{viewer?.update(renderState);viewer?.resize()})}
}
function renderCheckoutCartPreview(){const target=document.querySelector('#checkout-cart-preview');if(!target)return;const items=cart.slice(0,2),itemCount=cart.reduce((sum,item)=>sum+item.quantity,0),designCount=cart.length,shipping=state.shippingQuote?.amount,hasQuote=Boolean(state.shippingQuote),total=cartTotal()+(shipping||0)-state.couponDiscount,couponSummary=state.couponDiscount?`−${money(state.couponDiscount)}`:'Disponible';target.innerHTML=`<span class="eyebrow">TU PEDIDO · ${designCount} ${designCount===1?'DISEÑO':'DISEÑOS'} · ${itemCount} ${itemCount===1?'POLERA':'POLERAS'}</span><h3>Resumen del pedido</h3><div class="checkout-cart-preview-list">${items.map((item,index)=>{const image=catalogPreviewForCart(item.catalogDesignSlug)||item.designPreview;return `<article><div class="checkout-cart-preview-art" style="--cart-color:${safe(item.color)}">${image?`<img src="${safe(image)}" alt="Diseño ${index+1} de tu pedido">`:`<span>${safe(item.initial)}</span>`}</div><div><strong>Polera ${safe(item.kind)}</strong><small>Talla ${safe(item.size)} · ${safe(item.sides)} · ${item.quantity} ${item.quantity===1?'unidad':'unidades'}</small><b>${money(item.price*item.quantity)}</b></div></article>`}).join('')}</div>${cart.length>2?`<p>+ ${cart.length-2} diseño${cart.length-2===1?'':'s'} más en tu pedido</p>`:''}<div class="checkout-cart-preview-total"><table><tbody><tr><th scope="row">Subtotal de productos</th><td>${money(cartTotal())}</td></tr><tr><th scope="row">Despacho</th><td>${hasQuote?(shipping?money(shipping):'Gratis'):'Por calcular'}</td></tr><tr class="checkout-cart-preview-coupon"><th scope="row">Cupón de descuento</th><td>${couponSummary}</td></tr>${hasQuote?`<tr class="checkout-cart-preview-grand-total"><th scope="row">Total</th><td>${money(total)}</td></tr>`:''}</tbody></table></div>`}
function openStudio(mode='choose',kind){state.mode=mode;state.cartItemId=null;state.checkoutAsGuest=false;if(kind){state.kind=kind;state.size=products[kind].sizes[0]}state.step=1;studio.showModal();document.body.classList.add('locked');renderStep()}
function resetIdea(){
 [...Object.values(state.images),...state.references.map(reference=>reference.url)].forEach(url=>{if(url?.startsWith('blob:'))URL.revokeObjectURL(url)});
 Object.assign(state,{mode:'choose',kind:'basic',size:'M',color:'#ffffff',image:DEFAULT_SAMPLE_IMAGE,images:{front:'',back:''},files:{front:'',back:''},uploadFiles:{front:null,back:null},cloudSaved:{front:false,back:false},references:[],creativeRequestId:crypto.randomUUID(),creativeOrderId:null,uploaded:false,isDefault:true,file:'',catalogDesign:null,catalogDesignSlug:null,assessment:null,assessments:{front:null,back:null},printSide:'front',printSides:['front'],printScale:1,checking:false,checkingSide:'',artworkTone:'',qualityAccepted:false,qualityReview:false,customIdea:'',customName:'',customEmail:'',customPhone:'',customSubmitted:false});
}
function beginIdea(){resetIdea();openStudio('choose')}
document.querySelectorAll('[data-start]').forEach(button=>button.onclick=()=>beginIdea());
const catalogSection=document.createElement('section');
catalogSection.id='catalogo';
catalogSection.className='section ready-catalog';
catalogSection.setAttribute('aria-labelledby','catalog-title');
catalogSection.innerHTML=`<div class="section-heading catalog-heading"><div><span class="eyebrow">DISEÑOS LISTOS PARA ELEGIR</span><h2 id="catalog-title">Elige una colección.</h2></div><p>Elige una portada.<br>Después eliges diseño, modelo y talla.</p></div><p class="catalog-count" aria-live="polite"></p><div class="catalog-actions"></div><div class="catalog-grid"></div>`;
document.querySelector('#caminos').before(catalogSection);
const trustStrip=document.createElement('section');
trustStrip.className='trust-strip';
trustStrip.setAttribute('aria-label','Beneficios de comprar en droska SHIRT');
trustStrip.innerHTML=`<ul><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 8C23 9 12 17 10 34c12 2 23-5 29-26Z"/><path d="M8 41c7-11 14-18 25-25"/></svg><span><strong>Diseños originales</strong><small>Creaciones exclusivas Droska.</small></span></li><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12h23v22H6zM29 21h7l6 7v6H29z"/><circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/></svg><span><strong>Despachos a todo Chile</strong><small>Rápido y seguro.</small></span></li><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5c5 4 10 6 16 7v11c0 10-6 17-16 21C14 40 8 33 8 23V12c6-1 11-3 16-7Z"/><path d="m17 24 5 5 10-11"/></svg><span><strong>Compra segura</strong><small>Tus datos siempre protegidos.</small></span></li></ul>`;
catalogSection.before(trustStrip);
const catalogDialog=document.createElement('dialog');
catalogDialog.className='catalog-dialog';
catalogDialog.setAttribute('aria-labelledby','catalog-dialog-title');
catalogDialog.innerHTML=`<div class="catalog-dialog-shell"><header class="catalog-dialog-head"><div><span class="eyebrow">DISEÑOS DE LA COLECCIÓN</span><h2 id="catalog-dialog-title"></h2><p class="catalog-dialog-count"></p></div><button type="button" class="catalog-dialog-close ds-icon-button close-button" data-close aria-label="Cerrar colección"><span aria-hidden="true"></span></button></header><div class="catalog-dialog-body"><div class="catalog-dialog-grid"></div><p class="catalog-dialog-note">Elige un diseño para abrirlo en el estudio. Después podrás seleccionar modelo, talla y ubicación del estampado.</p></div></div>`;
document.body.append(catalogDialog);
document.querySelector('.closing p').textContent='Parte con un diseño del catálogo o crea el tuyo desde cero. A tu pinta.';
let catalogAvailable=false;
function renderCatalog(){
  catalogSection.querySelector('#catalog-title').textContent='Elige una colección.';
  catalogSection.querySelector('.catalog-count').textContent=catalogAvailable?`${collections.length} colecciones para explorar`:'Mostrando ejemplos. El catálogo publicado no está disponible para comprar en este momento.';
  catalogSection.querySelector('.catalog-actions').replaceChildren();
  const grid=catalogSection.querySelector('.catalog-grid');
  grid.innerHTML=collections.map((item,index)=>{const designs=filterCatalog(item.id,catalogDesigns),cover=designs[0],count=designs.length,countText=designCountLabel(count),preview=cover?` data-preview-id="${cover.id}"`:'';const coverVisual=cover?.featuredPhoto?`<img class="catalog-3d catalog-featured-photo" src="${cover.featuredPhoto}" alt="Portada de la colección ${item.label}">${cover.featuredPhotoHover?`<img class="catalog-3d catalog-featured-photo-hover" src="${cover.featuredPhotoHover}" alt="" aria-hidden="true">`:''}`:cover?`<div class="catalog-viewer-loading" role="status"><i aria-hidden="true"></i><strong>Preparando vista 3D</strong><small>Un momento…</small></div><img class="catalog-3d" alt="Portada de la colección ${item.label}" hidden>`:`<div class="catalog-empty-cover" aria-hidden="true"><span>+</span><small>PRIMER DISEÑO</small></div>`;return `<article class="catalog-card catalog-collection-card"${preview}><div class="catalog-visual catalog-visual--${cover?.surface||'pink'} catalog-theme-${index%4}"${cover&&!cover.featuredPhoto?' aria-busy="true"':''}><span class="catalog-card-collection">COLECCIÓN</span><span class="collection-count-pill"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4 10 2h4l2 2 4 2-2 5-2-1v10H8V10l-2 1-2-5 4-2Z"/></svg>${countText}</span>${coverVisual}<button type="button" class="catalog-round-arrow" data-open-collection="${item.id}" aria-label="Ver colección ${item.label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7h8v8"/></svg></button></div><div class="catalog-card-info"><div><h3>${item.label}</h3><p>${cover?'Diseños listos para llevar.':'Colección lista para recibir diseños.'}</p></div></div><button type="button" class="catalog-choose ds-cta" data-open-collection="${item.id}" aria-label="Ver colección ${item.label}, ${countText}">Ver colección <span aria-hidden="true">→</span></button></article>`}).join('');
  renderFooterCatalog();
  collections.forEach(item=>{const cover=filterCatalog(item.id,catalogDesigns)[0];if(cover&&!cover.featuredPhoto)showCatalogMockup(cover.id)});
}
function openCatalogCollection(collectionId){
 const collection=collections.find(item=>item.id===collectionId);if(!collection)return;
 const designs=filterCatalog(collectionId,catalogDesigns);
 catalogDialog.querySelector('#catalog-dialog-title').textContent=collection.label;
 catalogDialog.querySelector('.catalog-dialog-count').textContent=`${designCountLabel(designs.length)} en esta colección`;
 catalogDialog.querySelector('.catalog-dialog-grid').innerHTML=designs.length?designs.map((design,index)=>{const visual=design.featuredPhoto?`<img class="catalog-3d catalog-featured-photo" src="${design.featuredPhoto}" alt="Foto principal del diseño ${design.name}">${design.featuredPhotoHover?`<img class="catalog-3d catalog-featured-photo-hover" src="${design.featuredPhotoHover}" alt="" aria-hidden="true">`:''}`:`<div class="catalog-viewer-loading" role="status"><i aria-hidden="true"></i><strong>Preparando vista 3D</strong><small>Un momento…</small></div><img class="catalog-3d" alt="Polera 3D con el diseño ${design.name} aplicado" hidden>`;return `<article class="catalog-card catalog-design-card" data-design-id="${design.id}" data-preview-id="${design.id}"><div class="catalog-visual catalog-visual--${design.surface} catalog-theme-${index%4}"${design.featuredPhoto?'':' aria-busy="true"'}><span class="catalog-design-kicker"><span aria-hidden="true">✦</span> Diseño original</span><span class="catalog-design-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>${visual}</div><div class="catalog-card-info"><div><span class="catalog-design-collection">${collection.label}</span><h3>${design.name}</h3><p>${design.caption}</p></div><span class="catalog-price">Desde ${money(products.basic.price)}</span></div><button type="button" class="catalog-choose ds-cta" data-design="${design.id}" aria-label="Personalizar diseño ${design.name}">Personalizar este diseño <span aria-hidden="true">→</span></button></article>`}).join(''):`<div class="catalog-empty-collection"><span aria-hidden="true">+</span><h3>Esta colección aún no tiene diseños.</h3><p>Cuando agregues el primero desde el panel, aparecerá aquí automáticamente.</p></div>`;
 catalogDialog.showModal();document.body.classList.add('locked');
 designs.forEach(design=>{if(!design.featuredPhoto)showCatalogMockup(design.id)});
}
const catalogMockups=new Map();
function renderHeroCatalogSamples(){
 const target=document.querySelector('.hero-catalog-samples');if(!target)return;
 const picks=catalogDesigns.filter(design=>design.active!==false).slice(0,3);
 target.innerHTML=picks.map(design=>{const image=design.featuredPhoto||catalogMockups.get(design.id);return `<figure class="hero-catalog-sample" role="listitem">${image?`<img src="${image}" alt="${design.featuredPhoto?'Foto principal':'Polera de colección'}: ${safe(design.name)}">`:`<span class="hero-catalog-sample-loader" role="status"><i aria-hidden="true"></i><span>Preparando diseño</span></span>`}</figure>`}).join('');
}
function showCatalogMockup(id){
 const design=catalogDesigns.find(item=>item.id===id);if(design?.featuredPhoto){renderHeroCatalogSamples();return}
 const image=catalogMockups.get(id);if(!image)return;
 const cards=[...document.querySelectorAll('.catalog-card')].filter(item=>item.dataset.previewId===id);
 for(const card of cards){const visual=card.querySelector('.catalog-visual'),mockup=visual.querySelector('.catalog-3d');mockup.src=image;mockup.hidden=false;visual.classList.add('is-3d');visual.removeAttribute('aria-busy');visual.querySelector('.catalog-viewer-loading')?.remove()}
 renderHeroCatalogSamples();
}
function loadCatalogArtwork(design){
 const artwork=new Image();const source=artworkUrl(design);if(/^https?:/i.test(source))artwork.crossOrigin='anonymous';artwork.src=source;return artwork.decode().then(()=>artwork);
}
function drawContainedArtwork(context,image,width,height){
 context.clearRect(0,0,width,height);const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
}
async function prepareCatalogMockups(){
 let viewport,viewer;
 try{
  const {createViewer}=await import('./garment.js');
  viewport=document.createElement('div');viewport.className='catalog-render-viewport';viewport.setAttribute('aria-hidden','true');document.body.append(viewport);
  const preview={kind:'basic',color:'#ffffff',image:'',printSide:'front',printScale:1.4,assessment:null,catalogPreview:true};
  viewer=await createViewer(viewport,preview,{cameraDistance:5.15});
  for(const design of catalogDesigns){
   const artwork=await loadCatalogArtwork(design);
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2160;
   drawContainedArtwork(canvas.getContext('2d'),artwork,canvas.width,canvas.height);
   await viewer.update({...preview,color:normalizeSampleColor(design.sampleColor),image:canvas.toDataURL('image/png')});
   catalogMockups.set(design.id,viewer.snapshot());
   showCatalogMockup(design.id);
  }
 }catch(error){console.warn('Se conserva la vista alternativa del catálogo:',error)}
 finally{viewer?.dispose();viewport?.remove()}
}
let catalogRenderStarted=false,catalogMockupPromise=null,catalogMockupRerun=false;
function requestCatalogMockups(){
 if(!catalogRenderStarted)return;
 if(catalogMockupPromise){catalogMockupRerun=true;return catalogMockupPromise}
 catalogMockupPromise=prepareCatalogMockups().finally(()=>{catalogMockupPromise=null;if(catalogMockupRerun){catalogMockupRerun=false;requestCatalogMockups()}});
 return catalogMockupPromise;
}
renderCatalog();
renderHeroCatalogSamples();
let catalogRefreshPending=null;
async function refreshCatalog(){
 if(catalogRefreshPending)return catalogRefreshPending;
 catalogRefreshPending=(async()=>{
  const result=await loadCatalog(supabase);
  if(result.source==='fallback'){
   console.warn('No se pudo cargar el catálogo publicado:',result.error);
   catalogAvailable=false;renderCatalog();
   return;
  }
  const wasAvailable=catalogAvailable;catalogAvailable=true;
  const before=JSON.stringify([collections,catalogDesigns]);
  const after=JSON.stringify([result.collections,result.designs]);
  collections=result.collections;catalogDesigns=result.designs;
  if(before!==after||!wasAvailable){renderCatalog();renderHeroCatalogSamples();if(catalogRenderStarted)requestCatalogMockups()}
 })().finally(()=>{catalogRefreshPending=null});
 return catalogRefreshPending;
}
refreshCatalog().finally(()=>{
  // Las fotos editoriales aparecen de inmediato; las restantes se preparan una
  // vez que el catálogo remoto ya está disponible, sin dejar loaders permanentes.
  catalogRenderStarted=true;
  requestCatalogMockups();
});
const catalogChannel=supabase.channel('droska-public-catalog')
 .on('postgres_changes',{event:'*',schema:'public',table:'catalog_product_types'},refreshCatalog)
 .on('postgres_changes',{event:'*',schema:'public',table:'catalog_collections'},refreshCatalog)
 .on('postgres_changes',{event:'*',schema:'public',table:'catalog_designs'},refreshCatalog)
 .subscribe();
window.addEventListener('focus',refreshCatalog);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCatalog()});
window.addEventListener('beforeunload',()=>supabase.removeChannel(catalogChannel),{once:true});
loadProductPrices();
const touchCatalogZoom=window.matchMedia('(hover: none) and (pointer: coarse)');
function toggleCatalogZoom(event){
  if(!touchCatalogZoom.matches)return false;
  const preview=event.target.closest('.catalog-3d,.catalog-shirt');if(!preview)return false;
  const visual=preview.closest('.catalog-visual');if(!visual)return false;
  event.preventDefault();event.stopPropagation();
  document.querySelectorAll('.catalog-visual.is-zoomed').forEach(item=>{if(item!==visual)item.classList.remove('is-zoomed')});
  visual.classList.toggle('is-zoomed');
  return true;
}
catalogSection.querySelector('.catalog-grid').addEventListener('click',async event=>{
  if(toggleCatalogZoom(event))return;
  const collectionButton=event.target.closest('[data-open-collection]');if(collectionButton)openCatalogCollection(collectionButton.dataset.openCollection);
});
async function chooseCatalogDesign(button){
  if(!button||button.disabled)return;
  if(!catalogAvailable){toast('El catálogo publicado no está disponible. Vuelve a intentarlo más tarde.','error');return}
  const design=catalogDesigns.find(item=>item.id===button.dataset.design);if(!design)return;
  button.disabled=true;button.textContent='Preparando diseño…';
  try{
    const image=await loadCatalogArtwork(design);
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=2880;
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas no disponible');
    drawContainedArtwork(context,image,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('No se pudo preparar el diseño');
    state.catalogDesign=design.name;state.catalogDesignSlug=design.id;state.kind='basic';state.size='M';state.color=normalizeSampleColor(design.sampleColor);state.printScale=CATALOG_ARTWORK_SCALE;state.printSides=['front'];
    const loaded=await upload(new File([blob],`droska-${design.id}.png`,{type:'image/png'}),'front',true);
    if(!loaded)throw new Error('No se pudo cargar el diseño');
    state.assessment=null;state.assessments.front=null;state.printScale=CATALOG_ARTWORK_SCALE;
    catalogDialog.close();
    openStudio('ready');
  }catch{toast('No pudimos abrir este diseño. Vuelve a intentarlo.')}finally{button.disabled=false;button.innerHTML='Elegir diseño <span aria-hidden="true">→</span>'}
}
let requestedDesignOpened=false;
async function openRequestedCatalogDesign(){
  const designSlug=new URLSearchParams(location.search).get('design');
  if(!designSlug||requestedDesignOpened||!catalogDesigns.some(item=>item.id===designSlug))return;
  requestedDesignOpened=true;
  const trigger=document.createElement('button');trigger.dataset.design=designSlug;
  await chooseCatalogDesign(trigger);
  const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('design');history.replaceState({},'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}
refreshCatalog().then(openRequestedCatalogDesign);
catalogDialog.querySelector('.catalog-dialog-grid').addEventListener('click',event=>{if(!toggleCatalogZoom(event))chooseCatalogDesign(event.target.closest('[data-design]'))});
catalogDialog.addEventListener('click',event=>{if(event.target===catalogDialog)catalogDialog.close()});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>{button.closest('dialog').close();document.body.classList.remove('locked')});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>document.body.classList.remove('locked')));
document.querySelector('#space-create').onclick=()=>{document.querySelector('#space').close();openStudio()};
const sideNames={front:'Frente',back:'Espalda'};
const includedSides=()=>state.printSides;
const hasTwoSides=()=>includedSides().length===2;
const printChoice=()=>hasTwoSides()?'both':state.printSides[0];
const printSidesLabel=()=>includedSides().map(side=>sideNames[side]).join(' + ');
const hasRequiredFiles=()=>includedSides().every(side=>Boolean(state.images[side]));
const failingSides=()=>includedSides().filter(side=>state.assessments[side]&&!state.assessments[side].qualifies);
function activateSide(side){if(!includedSides().includes(side))return;state.printSide=side;state.image=state.images[side]||'';state.assessment=state.assessments[side]||null;state.isDefault=!state.images.front&&!state.images.back}
function faceSelectedSide(){viewer?.face(state.printSide);viewerPromise?.then(()=>viewer?.face(state.printSide))}
function moveCatalogDesignTo(side){
 const source=state.images.front?'front':'back';
 if(source===side)return;
 state.images[side]=state.images[source];state.files[side]=state.files[source];state.uploadFiles[side]=state.uploadFiles[source];state.cloudSaved[side]=state.cloudSaved[source];state.assessments[side]=state.assessments[source];
 state.images[source]='';state.files[source]='';state.uploadFiles[source]=null;state.cloudSaved[source]=false;state.assessments[source]=null;
}
function setPrintSides(value){
 if(state.catalogDesign&&value==='both')return;
 if(state.catalogDesign)moveCatalogDesignTo(value);
 state.printSides=value==='both'?['front','back']:[value];if(!state.printSides.includes(state.printSide))activateSide(state.printSides[0]);else activateSide(value);
 state.qualityAccepted=false;state.qualityReview=false
}
function removeSide(side){const previous=state.images[side];if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);state.images[side]='';state.files[side]='';state.uploadFiles[side]=null;state.cloudSaved[side]=false;state.assessments[side]=null;if(side==='front'){state.catalogDesign=null;state.catalogDesignSlug=null}state.qualityAccepted=false;state.qualityReview=false;state.uploaded=hasRequiredFiles();activateSide(includedSides()[0]);removeSavedDesignFile(side).catch(()=>{})}
function artworkTone(image){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,48,48);
 const pixels=context.getImageData(0,0,48,48).data;let visible=0,light=0,luminance=0;
 for(let index=0;index<pixels.length;index+=4){
  if(pixels[index+3]<48)continue;
  const value=.2126*pixels[index]+.7152*pixels[index+1]+.0722*pixels[index+2];visible++;luminance+=value;if(value>175)light++;
 }
 return visible&&((light/visible)>.22||luminance/visible>150)?'light':'dark';
}
function printSidesHtml(){
 const selected=hasTwoSides()?'both':state.printSide;
 const choices=state.catalogDesign?[['front','Frente','Incluido'],['back','Espalda','Incluido']]:[['front','Solo frente','Incluido'],['back','Solo espalda','Incluido'],['both','Ambos',`+${money(PRINT_EXTRAS_CLP.both)}`]];
 return `<fieldset class="print-side-picker ${state.catalogDesign?'catalog-position-only':''}"><legend>¿Dónde va tu diseño?</legend><div class="print-choice-cards">${choices.map(([value,label,price])=>`<button type="button" data-print-sides="${value}" class="print-choice ${selected===value?'selected':''}" aria-pressed="${selected===value}"><strong>${label}</strong><span>${price}</span></button>`).join('')}</div>${state.catalogDesign?'<p class="print-side-help">El diseño de colección está listo. Elige en qué lado estamparlo.</p>':''}</fieldset>`;
}
function uploadCardHtml(side){
 const image=state.images[side];const assessment=state.assessments[side];const checking=state.checking&&state.checkingSide===side;
 const readyLabel=side==='front'?'Frente listo':'Espalda lista';
 const action=checking?'Revisando archivo…':image?`${readyLabel} · Cambiar`:`Cargar ${side==='front'?'frente':'espalda'}`;
 const detail=checking?'Comprobando formato y resolución':image?(assessment?.qualifies?'Archivo cargado':'Archivo cargado · revisaremos su calidad'):'JPG, PNG o WEBP · máx. 50 MB';
 return `<div class="upload-card ${image?'uploaded':''}" data-upload-card="${side}"><label class="dropzone upload-zone" data-drop-side="${side}"><input id="file-${side}" data-file-side="${side}" type="file" accept="image/png,image/jpeg,image/webp"/><span>${image?'<img src="'+image+'" alt="Miniatura del diseño para '+sideNames[side].toLowerCase()+'">':'<svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>'}</span><strong>${action}</strong><small>${detail}</small></label>${image?`<label class="upload-file-name"><span>Nombre del archivo</span><input type="text" data-file-name-side="${side}" value="${escapeText(state.files[side])}" maxlength="120" spellcheck="false" aria-describedby="file-name-help-${side}"><small id="file-name-help-${side}">Puedes cambiarlo sin alterar la imagen.</small></label><button type="button" class="small-button" data-remove-side="${side}">Quitar archivo</button>`:''}</div>`;
}
function fulfillmentPickerHtml(){const deliveryPrice=state.shippingQuote&&state.fulfillment==='delivery'?money(state.shippingQuote.amount):'Por calcular';return `<fieldset class="fulfillment-picker"><legend>¿Cómo quieres recibirla?</legend><div class="fulfillment-options"><button type="button" data-fulfillment="delivery" class="fulfillment-choice ${state.fulfillment==='delivery'?'selected':''}" aria-pressed="${state.fulfillment==='delivery'}"><span class="fulfillment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg></span><span><strong>Despacho</strong><small>Calculamos el valor con tu dirección</small></span><b>${deliveryPrice}</b></button><button type="button" data-fulfillment="pickup" class="fulfillment-choice ${state.fulfillment==='pickup'?'selected':''}" aria-pressed="${state.fulfillment==='pickup'}"><span class="fulfillment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg></span><span><strong>Retiro</strong><small>Coordinamos contigo el punto y horario</small></span><b>Gratis</b></button></div></fieldset>`}
const escapeText=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatChilePhoneLocal=value=>{let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('569')&&digits.length>=11)digits=digits.slice(3);else if(digits.startsWith('56')&&digits.length>=10)digits=digits.slice(2).replace(/^9/,'');else if(digits.startsWith('9')&&digits.length===9)digits=digits.slice(1);else if(digits.length>8)digits=digits.slice(-8);return digits.slice(0,8).replace(/^(\d{4})(\d+)/,'$1 $2')};
const fullChilePhone=value=>{const local=formatChilePhoneLocal(value);return local?`+56 9 ${local}`:''};
const phoneFieldHtml=(id,value,name='')=>`<div class="phone-input"><span class="phone-prefix" aria-hidden="true">🇨🇱 <b>+56 9</b></span><input id="${id}"${name?` name="${name}"`:''} type="tel" required autocomplete="tel" inputmode="numeric" pattern="[0-9]{4} [0-9]{4}" maxlength="9" placeholder="1234 5678" value="${escapeText(formatChilePhoneLocal(value))}"></div>`;
const searchFilterHtml=(value,id,name,autocomplete,placeholder,required=false)=>`<div class="region-filter"><input id="${id}" class="ds-field" name="${name}"${required?' required':''} autocomplete="${autocomplete}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" placeholder="${placeholder}" value="${escapeText(value)}"><div id="${id}-options" class="region-filter-options" role="listbox" hidden></div></div>`;
function setupSearchFilter(input,getItems,onChange,emptyLabel){if(!input)return;const options=input.parentElement.querySelector('.region-filter-options');let active=-1;const render=()=>{const query=input.value.trim().toLocaleLowerCase('es-CL'),items=getItems(),matches=items.filter(item=>item.toLocaleLowerCase('es-CL').includes(query));options.innerHTML=matches.length?matches.map((item,index)=>`<button type="button" role="option" aria-selected="${index===active}" data-value="${escapeText(item)}">${escapeText(item)}</button>`).join(''):`<p>${emptyLabel}</p>`;options.hidden=false;input.setAttribute('aria-expanded','true')};const notify=(committed=false)=>onChange?.(input.value,committed);const choose=value=>{input.value=value;options.hidden=true;input.setAttribute('aria-expanded','false');active=-1;notify(true)};input.onfocus=render;input.oninput=()=>{active=-1;notify(false);render()};input.onkeydown=event=>{const items=[...options.querySelectorAll('[role=option]')];if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(event.key==='ArrowDown'?1:-1)));render()}else if(event.key==='Enter'&&active>=0&&items[active]){event.preventDefault();choose(items[active].dataset.value)}else if(event.key==='Escape'){options.hidden=true;input.setAttribute('aria-expanded','false')}};options.onmousedown=event=>{const option=event.target.closest('[data-value]');if(option){event.preventDefault();choose(option.dataset.value)}};input.addEventListener('blur',()=>setTimeout(()=>{options.hidden=true;input.setAttribute('aria-expanded','false')},120))}
const setupRegionFilter=(input,onChange)=>setupSearchFilter(input,()=>chileRegions,onChange,'No encontramos una región.');
const MAX_IDEA_REFERENCES=5;
function customReferencesHtml(){
 const items=state.references.map((reference,index)=>`<div class="reference-thumb"><img src="${reference.url}" alt="Referencia ${index+1}"><span title="${escapeText(reference.name)}">${escapeText(reference.name)}</span><button type="button" data-remove-reference="${index}" aria-label="Quitar ${escapeText(reference.name)}">×</button></div>`).join('');
 const full=state.references.length>=MAX_IDEA_REFERENCES;
 return `<div class="custom-references"><div class="custom-references-heading"><strong>Fotos de referencia <span>Opcional</span></strong><small>Mascotas, familiares, personas, objetos o estilos que quieras considerar.</small></div><label class="reference-dropzone ${full?'is-full':''}"><input id="reference-files" type="file" accept="image/png,image/jpeg,image/webp" multiple ${full?'disabled':''}><span>＋</span><strong>${full?'Límite de fotos alcanzado':'Adjuntar fotos'}</strong><small>${state.references.length} de ${MAX_IDEA_REFERENCES} fotos · JPG, PNG o WEBP · máx. 50 MB cada una${full?' · Quita una para agregar otra':''}</small></label>${items?`<div class="reference-thumbs">${items}</div>`:''}</div>`;
}
function fulfillmentDetailsHtml(){
 const date=estimatedDateLabel();
 const contact=state.editingContact?`<div class="fulfillment-contact editing"><label><small>Nombre</small><input id="summary-first-name" required autocomplete="given-name" placeholder="Nombre" value="${escapeText(state.firstName)}"></label><label><small>Apellido</small><input id="summary-last-name" required autocomplete="family-name" placeholder="Apellido" value="${escapeText(state.lastName)}"></label><label><small>Email</small><input id="summary-email" type="email" required autocomplete="email" placeholder="tu@email.com" value="${escapeText(state.email)}"></label><label><small>Teléfono</small>${phoneFieldHtml('summary-phone',state.phone)}</label><button type="button" class="contact-edit-button done" id="finish-contact-edit">Listo</button></div>`:`<div class="fulfillment-contact-summary"><div><span><small>Nombre</small><strong>${escapeText(state.firstName)}</strong></span><span><small>Apellido</small><strong>${escapeText(state.lastName)}</strong></span><span><small>Email</small><strong>${escapeText(state.email)}</strong></span><span><small>Teléfono</small><strong>${escapeText(state.phone)}</strong></span></div><button type="button" class="contact-edit-button" id="edit-contact">Editar</button></div>`;
 if(state.fulfillment==='pickup')return `<section class="fulfillment-details pickup-details">${contact}<span class="eyebrow">RETIRO</span><strong>Retiro coordinado en Providencia</strong><p>Te enviaremos por email la dirección exacta y el horario disponible.</p><div class="estimated-date"><span>Disponible desde</span><b>${date}</b></div></section>`;
 return `<section class="fulfillment-details delivery-details">${contact}<div class="delivery-fields"><label class="field">Región${searchFilterHtml(state.region,'delivery-region','region','address-level1','Busca tu región',true)}</label><label class="field">Comuna${searchFilterHtml(state.commune,'delivery-commune','commune','address-level2','Busca tu comuna',true)}</label><label class="field">Dirección<input id="delivery-address" required autocomplete="street-address" placeholder="Calle y número" value="${escapeText(state.address)}"></label><label class="field"><span class="field-label">Depto., casa u oficina <em>Opcional</em></span><input id="delivery-address-extra" autocomplete="address-line2" placeholder="Ej. Depto. 304" value="${escapeText(state.addressExtra)}"></label><label class="field"><span class="field-label">Indicaciones de entrega <em>Opcional</em></span><input id="delivery-notes" placeholder="Ej. Llamar al llegar" value="${escapeText(state.deliveryNotes)}"></label></div><div class="estimated-date"><span>Entrega estimada</span><b>${date}</b></div><small>Si la fecha cae en fin de semana o feriado, se mueve al siguiente día hábil.</small></section>`;
}
function checkoutAccessHtml(){
 if(account)return `<section class="checkout-access signed-in"><span class="account-initial">${safe(account.name).slice(0,1).toUpperCase()}</span><div><strong>Comprando como ${safe(account.name.split(' ')[0])}</strong><small>${safe(account.email)}</small></div></section>`;
 return `<section class="checkout-access guest-checkout"><span aria-hidden="true">✓</span><div><strong>Compra como invitado</strong><small>Solo pediremos los datos necesarios para entregar este pedido.</small></div></section>`;
}
async function applyCheckoutCoupon(){const input=document.querySelector('#checkout-coupon'),status=document.querySelector('#checkout-coupon-status'),button=document.querySelector('#apply-coupon'),code=input?.value.trim().toUpperCase();if(!code)return input?.focus();button.disabled=true;button.textContent='Validando…';const {data,error}=await supabase.functions.invoke('validate-coupon',{body:{code,subtotal:cartTotal()}});button.disabled=false;button.textContent='Aplicar';if(error||data?.error){state.couponCode='';state.couponDiscount=0;state.couponLabel='';status.textContent=data?.error||'No pudimos validar el cupón.';status.dataset.tone='error';return}state.couponCode=data.code;state.couponDiscount=Number(data.discountClp||0);state.couponLabel=data.label;renderStep();toast(`Cupón ${data.code} aplicado.`)}
function renderStep(){
 studio.classList.toggle('is-checkout-step',state.step===3);
 studio.classList.toggle('is-entry-choice',state.mode==='choose');
 studio.classList.toggle('is-request-mode',state.mode==='custom');
 colorDock.hidden=Boolean(state.catalogDesign);sizeDock.hidden=Boolean(state.catalogDesign);
 const stepContent=document.querySelector('#step-content');
 const next=document.querySelector('#next');
 const back=document.querySelector('#back');
 if(state.mode==='choose'){
  document.querySelector('.steps').innerHTML='';
  next.hidden=true;back.hidden=true;colorDock.hidden=true;sizeDock.hidden=true;
  stepContent.innerHTML=`<span class="eyebrow">ANTES DE PARTIR</span><h2>¿Qué tienes hoy?</h2><p class="studio-choice-intro">Elige la ruta que mejor describe tu punto de partida.</p><div class="studio-choice-grid"><button type="button" class="studio-choice-card studio-choice-card--design" data-studio-choice="ready"><span class="studio-choice-number">01</span><span class="studio-choice-icon" aria-hidden="true">↑</span><strong>Tengo un diseño</strong><small>Ya tengo un archivo listo para estampar y quiero verlo sobre la polera.</small><span class="studio-choice-link">Cargar mi diseño <span aria-hidden="true">→</span></span></button><button type="button" class="studio-choice-card studio-choice-card--idea" data-studio-choice="custom"><span class="studio-choice-number">02</span><span class="studio-choice-icon" aria-hidden="true">✳</span><strong>Tengo una idea</strong><small>No tengo un diseño listo. Quiero que el equipo de Droska lo cree conmigo.</small><span class="studio-choice-link">Contar mi idea <span aria-hidden="true">→</span></span></button></div><p class="studio-choice-note">Si eliges “Tengo una idea”, primero revisaremos tu solicitud. La polera y el precio se definen después de la propuesta.</p>`;
  applyDesignSystemClasses(stepContent);
  stepContent.querySelectorAll('[data-studio-choice]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.studioChoice;renderStep()});
  syncPreview();
  return;
 }
 if(state.mode==='custom'){
  document.querySelector('.steps').innerHTML='';
  next.hidden=true;back.hidden=true;colorDock.hidden=true;sizeDock.hidden=true;
  stepContent.innerHTML=state.customSubmitted?`<span class="eyebrow">SOLICITUD RECIBIDA</span><h2>Tu idea ya está en camino.</h2><p>Solicitud #${safe(state.creativeOrderId)}</p><p class="custom-request-lead">Revisaremos lo que nos contaste y te contactaremos con una propuesta de diseño, precio y plazo. Crea una cuenta con el mismo correo para seguirla en Mis pedidos.</p><div class="custom-request-success"><strong>¿Quieres acelerar la conversación?</strong><span>También puedes enviarnos el detalle directamente por WhatsApp.</span><button type="button" class="button dark ds-cta" id="custom-whatsapp">Enviar por WhatsApp <span aria-hidden="true">→</span></button></div>`:`<button type="button" class="studio-back-choice" data-studio-choice="choose">← Cambiar ruta</button><span class="eyebrow">RUTA 2 · TU IDEA</span><h2>Cuéntanos qué imaginas.</h2><p class="custom-request-lead">No necesitas tener un diseño listo. Con tu idea y algunas referencias, preparamos una propuesta contigo.</p><label class="field">¿Qué te gustaría crear?<textarea id="custom-idea" required minlength="10" maxlength="4000" placeholder="Ej. Una polera para mi banda, con un dibujo de una serpiente y la frase…">${escapeText(state.customIdea)}</textarea></label>${customReferencesHtml()}<div class="custom-request-contact"><label class="field">Tu nombre<input id="custom-name" required autocomplete="name" placeholder="Cómo te llamas" value="${escapeText(state.customName)}"></label><label class="field">Tu email<input id="custom-email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${escapeText(state.customEmail)}"></label><label class="field">Tu teléfono<input id="custom-phone" required type="tel" autocomplete="tel" placeholder="+56 9 1234 5678" value="${escapeText(state.customPhone)}"></label></div><button type="button" class="button dark ds-cta custom-submit" id="custom-submit">Enviar mi idea <span aria-hidden="true">→</span></button><p class="studio-choice-note">Todavía no estás comprando. Primero te enviaremos una propuesta y cotización.</p>`;
  applyDesignSystemClasses(stepContent);
  stepContent.querySelector('[data-studio-choice]')?.addEventListener('click',()=>{state.mode='choose';renderStep()});
  for(const [id,key] of [['custom-idea','customIdea'],['custom-name','customName'],['custom-email','customEmail'],['custom-phone','customPhone']])stepContent.querySelector('#'+id)?.addEventListener('input',event=>{state[key]=event.target.value});
  stepContent.querySelector('#reference-files')?.addEventListener('change',event=>addReferenceFiles(event.target.files));
  stepContent.querySelectorAll('[data-remove-reference]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.removeReference),reference=state.references.splice(index,1)[0];if(reference?.url?.startsWith('blob:'))URL.revokeObjectURL(reference.url);renderStep()});
  stepContent.querySelector('#custom-submit')?.addEventListener('click',async event=>{const fields=['custom-idea','custom-name','custom-email','custom-phone'].map(id=>document.querySelector(`#${id}`));for(const field of fields)if(!field.checkValidity())return field.reportValidity();const button=event.currentTarget;state.customIdea=fields[0].value.trim();state.customName=fields[1].value.trim();state.customEmail=fields[2].value.trim();state.customPhone=fields[3].value.trim();const signature=JSON.stringify([state.customIdea,state.customEmail.toLowerCase(),state.customPhone,state.references.map(reference=>reference.name)]);try{const attempt=JSON.parse(localStorage.getItem('droska-creative-attempt')||'null');state.creativeRequestId=attempt?.signature===signature&&attempt?.id||crypto.randomUUID();localStorage.setItem('droska-creative-attempt',JSON.stringify({signature,id:state.creativeRequestId}))}catch{}button.disabled=true;button.textContent='Enviando…';try{let {data:{session}}=await supabase.auth.getSession();if(!session){const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session}if(!session)throw new Error('No pudimos iniciar la sesión de solicitud.');const references=[];for(const reference of state.references){if(reference.path&&reference.userId!==session.user.id){reference.path=null}if(!reference.path){button.textContent='Subiendo referencias…';reference.path=await uploadPrivateDesign(supabase,SUPABASE_URL,session.user.id,'reference',reference.file);reference.userId=session.user.id}references.push({name:reference.name,path:reference.path})}button.textContent='Enviando idea…';const {data,error}=await supabase.functions.invoke('create-design-request',{body:{requestId:state.creativeRequestId,idea:state.customIdea,customer:{firstName:state.customName,email:state.customEmail,phone:state.customPhone},references}});if(error||data?.error)throw new Error(data?.error||error?.message||'No pudimos enviar tu idea.');state.creativeOrderId=data.orderId;state.customSubmitted=true;try{localStorage.removeItem('droska-creative-attempt')}catch{}renderStep()}catch(error){button.disabled=false;button.innerHTML='Enviar mi idea <span aria-hidden="true">→</span>';toast(error.message||'No pudimos enviar tu idea.','error')}});
  stepContent.querySelector('#custom-whatsapp')?.addEventListener('click',()=>{const message=`Hola, soy ${state.customName}. Quiero diseñar una polera. Mi idea es: ${state.customIdea}`;window.open(`https://wa.me/56965217926?text=${encodeURIComponent(message)}`,'_blank','noopener')});
  return;
 }
 const labels=['Detalles','Resumen','Datos y pago'];
 const railProgress=((state.step-1)/labels.length)*100,railEdge=50/labels.length;
 document.querySelector('.steps').innerHTML=`<div class="steps-rail" style="--step-count:${labels.length};--rail-progress:${railProgress.toFixed(2)}%;--rail-edge:${railEdge.toFixed(2)}%"><i aria-hidden="true"></i>${labels.map((label,index)=>`<span class="${index+1===state.step?'active':''} ${index+1<state.step?'done':''}" aria-label="Paso ${index+1} de ${labels.length}: ${label}" ${index+1===state.step?'aria-current="step"':''}><b aria-hidden="true">${index+1<state.step?'✓':String(index+1).padStart(2,'0')}</b><small>${label}</small></span>`).join('')}</div>`;
 const p=products[state.kind],choice=printChoice(),pricing=orderTotal(p.price,choice,state.qualityReview?QUALITY_ADJUSTMENT_CLP:0);
 next.hidden=false;next.disabled=state.checking;back.hidden=state.step===1;
 const ctas=['Ver resumen','Añadir al carro','Confirmar pedido'];next.textContent=ctas[state.step-1];
 let html='';
 if(state.step===1)html=`<span class="eyebrow">PASO 1 · DETALLES</span><h2>Elige tu polera.</h2>${state.catalogDesign?`<p class="catalog-studio-choice">Diseño elegido: <strong>${escapeText(state.catalogDesign)}</strong>. El diseño y su color están definidos por la colección.</p>`:''}<section class="detail-block model-block"><div class="detail-heading"><strong>Modelo</strong><small>Precio base</small></div><div class="product-options">${Object.entries(products).map(([id,item])=>`<button type="button" class="${state.kind===id?'selected':''}" data-product="${id}"><strong>${item.name}</strong><span class="model-price">${money(item.price)}</span></button>`).join('')}</div></section><div class="details-grid">${state.catalogDesign?`<section class="detail-block color-block catalog-color-locked"><div class="detail-heading"><strong>Color de la colección</strong><small>Definido</small></div><div class="locked-color"><i style="--swatch:${state.color}" aria-hidden="true"></i><span>No se puede cambiar para este diseño.</span></div></section>`:`<section class="detail-block color-block"><div class="detail-heading"><strong>Color</strong><small>Elige uno</small></div><div class="colors">${[['#ffffff','Blanco'],['#202124','Negro'],['#e8e0cf','Blanco vintage'],['#8daec3','Azul zen']].map(([color,name])=>`<button type="button" aria-label="${name}" title="${name}" data-color="${color}" style="--swatch:${color}" class="${state.color===color?'chosen':''}"></button>`).join('')}</div></section>`}<section class="detail-block size-block"><div class="detail-heading"><strong>Talla</strong><button type="button" class="size-guide-trigger" id="open-size-guide"><span class="size-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16 16 4l4 4L8 20H4v-4Z"/><path d="m13 7 4 4M10 10l2 2M7 13l2 2"/></svg></span><span class="size-guide-label">Guía de tallas</span><i aria-hidden="true">›</i></button></div><div class="sizes">${p.sizes.map(size=>`<button type="button" data-size="${size}" class="${state.size===size?'selected':''}">${size}</button>`).join('')}</div></section></div><section class="detail-block print-placement-block"><div class="detail-heading"><strong>Diseño y ubicación</strong><small>Elige dónde estampar</small></div>${printSidesHtml()}${state.catalogDesign?`<div class="catalog-design-locked"><img src="${state.images[state.printSide]}" style="--sample-color:${state.color}" alt="${escapeText(state.catalogDesign)}"><div><strong>${escapeText(state.catalogDesign)}</strong><span>Diseño de colección bloqueado</span></div></div>`:`<div class="upload-grid ${hasTwoSides()?'two-sides':''}">${includedSides().map(uploadCardHtml).join('')}</div><p class="field-note">Puedes cambiar el archivo o añadir una pieza para la espalda si elegiste ambos lados.</p>`}</section>`;
 if(state.step===1&&!state.catalogDesign&&failingSides().length){const names=failingSides().map(side=>sideNames[side].toLowerCase()).join(' y ');html+=`<aside class="quality-inline-notice" role="status"><strong>Revisión técnica incluida</strong><p>El archivo de ${names} podría verse pixelado al imprimir. Lo revisaremos antes de producirlo; el ajuste se verá desglosado en el resumen.</p><span>+${money(QUALITY_ADJUSTMENT_CLP)}</span></aside>`}
 if(state.step===2)html=`<span class="eyebrow">PASO 2 · RESUMEN</span><h2>Tu idea, lista para pedir.</h2>${hasTwoSides()?`<div class="mockup-sides">${includedSides().map(side=>`<button type="button" data-view-side="${side}" class="${state.printSide===side?'selected':''}">${sideNames[side]}</button>`).join('')}</div>`:''}<p class="mockup-note">Gira la polera y revisa todos los detalles antes de añadirla al carro.</p>${state.qualityReview?`<div class="review-chip">Revisión del equipo incluida · ${money(QUALITY_ADJUSTMENT_CLP)}</div>`:''}<div class="order-summary"><div><span>Polera ${p.name} · talla ${state.size}</span><strong>${money(pricing.base)}</strong></div><div><span>Diseño ${printSidesLabel()}</span><strong>${pricing.print?`+${money(pricing.print)}`:'Incluido'}</strong></div>${state.qualityReview?`<div><span>Ajuste técnico del archivo</span><strong>+${money(QUALITY_ADJUSTMENT_CLP)}</strong></div>`:''}<div><span>Extras</span><strong>${money(0)}</strong></div><div class="total"><span>Total</span><strong>${money(pricing.total)}</strong></div></div>`;
 if(state.step===3){const shipping=state.shippingQuote?.amount||0,subtotal=cartTotal(),total=subtotal+shipping-state.couponDiscount,hasQuote=Boolean(state.shippingQuote);html=`<span class="eyebrow">PASO 3 · DATOS Y PAGO</span><div class="checkout-title-row"><h2>Completa tu pedido.</h2><button type="button" class="checkout-edit-order" id="edit-order">← Editar mi polera</button></div>${checkoutAccessHtml()}${fulfillmentPickerHtml()}${fulfillmentDetailsHtml()}${hasQuote?`<section class="shipping-quote" aria-live="polite"><span class="shipping-quote-icon" aria-hidden="true">✓</span><div><strong>${state.shippingQuote.label} calculado</strong><small>${state.fulfillment==='delivery'?`${state.commune}, ${state.region}`:'Coordinaremos el punto y horario contigo.'}</small></div><b>${shipping?money(shipping):'Gratis'}</b></section>`:`<p class="shipping-calculation-note">Completa los datos y calcula el despacho antes de pasar al pago.</p>`}<div class="notice">Serás redirigido a Mercado Pago para completar el pago de forma segura.</div>`;next.textContent=hasQuote?`Ir a pagar · ${money(total)}`:'Calcular despacho';}
 document.querySelector('#step-content').innerHTML=html;
 if(state.step===3)renderCheckoutCartPreview();
 if(state.step===3){const notice=document.querySelector('#step-content .notice');if(notice)notice.insertAdjacentHTML('beforebegin',`<section class="checkout-coupon"><label for="checkout-coupon">Cupón de descuento</label><div><input id="checkout-coupon" value="${safe(state.couponCode)}" placeholder="Ingresa tu código"><button type="button" id="apply-coupon">Aplicar</button></div><small id="checkout-coupon-status" ${state.couponLabel?'data-tone="success"':''}>${safe(state.couponLabel||'El descuento se validará antes del pago.')}</small></section>`)}
 applyDesignSystemClasses(document.querySelector('#step-content'));
 ['summary-email','summary-first-name','summary-last-name','summary-phone'].forEach(id=>{const input=document.querySelector(`#${id}`);if(!input)return;if(!input.placeholder)input.placeholder='tu@email.com';const wrapper=document.createElement('div');wrapper.className='clearable-input';input.before(wrapper);wrapper.append(input);const clear=document.createElement('button');clear.type='button';clear.className='clear-input';clear.setAttribute('aria-label',`Borrar ${id.includes('phone')?'teléfono':id.includes('last-name')?'apellido':id.includes('name')?'nombre':'email'}`);clear.innerHTML='<span aria-hidden="true"></span>';clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()};wrapper.append(clear)});
 document.querySelectorAll('[data-print-sides]').forEach(b=>b.onclick=()=>{setPrintSides(b.dataset.printSides);renderStep();faceSelectedSide()});
 document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{state.kind=b.dataset.product;if(!products[state.kind].sizes.includes(state.size))state.size=products[state.kind].sizes[0]||'';renderStep()});
 document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{state.size=b.dataset.size;renderStep()});
 document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;renderStep()});
 const guide=document.querySelector('#size-guide-modal');const openGuide=document.querySelector('#open-size-guide');if(openGuide)openGuide.onclick=()=>guide.showModal();
 guide.querySelectorAll('[data-size-close]').forEach(button=>button.onclick=()=>guide.close());
 guide.querySelectorAll('[data-guide-size]').forEach(button=>button.onclick=()=>{state.size=button.dataset.guideSize;guide.close();renderStep();toast(`Talla ${state.size} seleccionada.`)});
 document.querySelectorAll('[data-view-side]').forEach(b=>b.onclick=()=>{activateSide(b.dataset.viewSide);renderStep();faceSelectedSide()});
 document.querySelectorAll('[data-remove-side]').forEach(b=>b.onclick=()=>{removeSide(b.dataset.removeSide);renderStep();toast('Archivo eliminado.')});
 document.querySelectorAll('[data-file-side]').forEach(file=>{const side=file.dataset.fileSide;file.onchange=()=>upload(file.files[0],side);const drop=file.closest('.dropzone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');upload(e.dataTransfer.files[0],side)}})
 const clearShippingQuote=invalidateShippingQuote;
 const refreshShippingQuote=()=>{recalculateShippingQuote();checkoutScrollSnapshot={scroller:studio.querySelector('.studio-controls'),top:studio.querySelector('.studio-controls')?.scrollTop||0};renderStep()};
 const address=document.querySelector('#delivery-address');if(address){address.oninput=()=>{clearShippingQuote();state.address=address.value;storeCustomerDetails()};address.onchange=refreshShippingQuote}
 const commune=document.querySelector('#delivery-commune');setupSearchFilter(commune,()=>communesForRegion(document.querySelector('#delivery-region')?.value||state.region),(value,committed)=>{clearShippingQuote();commune.setCustomValidity('');state.commune=value;storeCustomerDetails();if(committed)refreshShippingQuote()},'No encontramos una comuna en esta región.');
 const region=document.querySelector('#delivery-region');setupRegionFilter(region,(value,committed)=>{clearShippingQuote();region.setCustomValidity('');state.region=value;const allowed=communesForRegion(value);if(commune&&commune.value&&!allowed.some(item=>samePlace(item,commune.value))){commune.value='';state.commune=''}storeCustomerDetails();if(committed)refreshShippingQuote()});
 const addressExtra=document.querySelector('#delivery-address-extra');if(addressExtra)addressExtra.oninput=()=>{state.addressExtra=addressExtra.value;storeCustomerDetails()};
 const deliveryNotes=document.querySelector('#delivery-notes');if(deliveryNotes)deliveryNotes.oninput=()=>{state.deliveryNotes=deliveryNotes.value;storeCustomerDetails()};
 const summaryFirstName=document.querySelector('#summary-first-name');if(summaryFirstName)summaryFirstName.oninput=()=>{state.firstName=summaryFirstName.value;storeCustomerDetails()};
 const summaryLastName=document.querySelector('#summary-last-name');if(summaryLastName)summaryLastName.oninput=()=>{state.lastName=summaryLastName.value;storeCustomerDetails()};
 const summaryEmail=document.querySelector('#summary-email');if(summaryEmail)summaryEmail.oninput=()=>{state.email=summaryEmail.value.trim();storeCustomerDetails()};
 const summaryPhone=document.querySelector('#summary-phone');if(summaryPhone)summaryPhone.oninput=()=>{summaryPhone.value=formatChilePhoneLocal(summaryPhone.value);state.phone=fullChilePhone(summaryPhone.value);storeCustomerDetails()};
 const editContact=document.querySelector('#edit-contact');if(editContact)editContact.onclick=()=>{state.editingContact=true;renderStep()};
 const finishContactEdit=document.querySelector('#finish-contact-edit');if(finishContactEdit)finishContactEdit.onclick=()=>{const fields=[document.querySelector('#summary-first-name'),document.querySelector('#summary-last-name'),document.querySelector('#summary-email'),document.querySelector('#summary-phone')];for(const field of fields)if(!field?.checkValidity())return field?.reportValidity();state.firstName=fields[0].value.trim();state.lastName=fields[1].value.trim();state.email=fields[2].value.trim();state.phone=fullChilePhone(fields[3].value);storeCustomerDetails();state.editingContact=false;renderStep()};
 const checkoutEmail=document.querySelector('#checkout-email');if(checkoutEmail)checkoutEmail.oninput=()=>{state.email=checkoutEmail.value.trim();storeCustomerDetails()};
 const editOrder=document.querySelector('#edit-order');if(editOrder)editOrder.onclick=()=>{state.checkoutDraftId=null;state.shippingQuote=null;state.checkoutReady=false;state.step=1;renderStep();faceSelectedSide()};
 const applyCoupon=document.querySelector('#apply-coupon');if(applyCoupon)applyCoupon.onclick=applyCheckoutCoupon;
 document.querySelectorAll('[data-fulfillment]').forEach(button=>button.onclick=()=>{state.fulfillment=button.dataset.fulfillment;state.shippingQuote=null;recalculateShippingQuote();persistDraft();renderStep()});
 syncScaleControl();syncPreview();
 if(checkoutScrollSnapshot){const {scroller,top}=checkoutScrollSnapshot;checkoutScrollSnapshot=null;requestAnimationFrame(()=>{if(scroller)scroller.scrollTop=top;const quote=document.querySelector('.shipping-quote');quote?.classList.add('is-new');quote?.scrollIntoView({block:'nearest'});setTimeout(()=>quote?.classList.remove('is-new'),1400)})}
 normalizeTextSymbols(document.querySelector('#step-content')||document);
}
async function addReferenceFiles(fileList){
 const incoming=[...(fileList||[])];if(!incoming.length)return;
 if(state.references.length>=MAX_IDEA_REFERENCES)return toast(`Puedes adjuntar hasta ${MAX_IDEA_REFERENCES} fotos de referencia.`);
 let added=0;
 for(const file of incoming){
  if(state.references.length>=MAX_IDEA_REFERENCES)break;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>PRINT_POLICY.maxBytes)continue;
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode();if(state.references.length>=MAX_IDEA_REFERENCES){URL.revokeObjectURL(url);break}state.references.push({name:file.name,url,file,path:null});added++}catch{URL.revokeObjectURL(url)}
 }
 renderStep();
 if(!added)return toast('Elige fotos JPG, PNG o WEBP legibles de hasta 50 MB.');
 if(added<incoming.length)toast(`Adjuntamos ${added} foto${added===1?'':'s'}. El máximo es ${MAX_IDEA_REFERENCES}; algunas fotos no eran compatibles o no se pudieron leer.`);
 else toast(`${added} foto${added===1?' adjunta':'s adjuntas'} como referencia opcional.`);
}
async function upload(file,side=state.printSide,fromCatalog=false){
 if(!file)return false;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Formato no compatible. Elige JPG, PNG o WEBP.');return false}
 if(file.size>PRINT_POLICY.maxBytes){toast('El archivo supera los 50 MB. Reduce su peso y vuelve a subirlo.');return false}
 const token=++uploadVersions[side],url=URL.createObjectURL(file);state.checking=true;state.checkingSide=side;activateSide(side);renderStep();viewer?.face(side);
 try{
  const img=new Image();img.src=url;await img.decode();if(token!==uploadVersions[side]){URL.revokeObjectURL(url);return false}
  const previous=state.images[side];if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
  state.images[side]=url;state.files[side]=file.name;state.uploadFiles[side]=file;state.cloudSaved[side]=false;if(side==='front'&&!fromCatalog){state.catalogDesign=null;state.catalogDesignSlug=null}activateSide(side);state.uploaded=hasRequiredFiles();state.file=file.name;state.artworkTone=artworkTone(img);state.assessment=checkResolution(img.naturalWidth,img.naturalHeight);state.assessments[side]=state.assessment;if(!fromCatalog)state.printScale=USER_ARTWORK_SCALE;state.checking=false;state.checkingSide='';state.qualityAccepted=false;state.qualityReview=false;saveDesignFile(side,file).catch(()=>toast('El diseño se cargó, pero este navegador no pudo guardarlo para después.'));renderStep();faceSelectedSide();toast(state.assessment.qualifies?'Diseño cargado y mockup actualizado.':'Diseño cargado y mockup actualizado. Incluiremos revisión técnica.');return true
 }catch{URL.revokeObjectURL(url);if(token===uploadVersions[side]){state.checking=false;state.checkingSide='';renderStep();toast('El archivo no se pudo leer. Prueba con otra imagen.')}return false}}
function renamedFileName(value,originalName){
 const typed=String(value||'').trim().replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ');
 const original=String(originalName||'diseno.png');
 const extension=original.match(/\.[a-z0-9]{2,5}$/i)?.[0]||'';
 const base=typed.replace(/\.[a-z0-9]{2,5}$/i,'').trim();
 return `${(base||'Diseño').slice(0,115)}${extension}`;
}
async function renameUploadedFile(side,value){
 const file=state.uploadFiles[side];if(!(file instanceof Blob))return;
 const nextName=renamedFileName(value,file.name||state.files[side]);
 if(nextName===state.files[side])return;
 const renamed=new File([file],nextName,{type:file.type,lastModified:file.lastModified});
 state.files[side]=nextName;state.uploadFiles[side]=renamed;state.file=nextName;
 saveDesignFile(side,renamed).catch(()=>toast('El nombre cambió, pero no pudimos guardar el archivo para después.'));
 persistDraft();
}
async function restoreSavedDesigns(){try{const saved=await savedDesignFiles();for(const item of saved){if(item.expiresAt<=Date.now()){removeSavedDesignFile(item.side).catch(()=>{});continue}if(!['front','back'].includes(item.side)||!(item.file instanceof Blob))continue;const url=URL.createObjectURL(item.file);const image=new Image();image.src=url;try{await image.decode()}catch{URL.revokeObjectURL(url);removeSavedDesignFile(item.side).catch(()=>{});continue}state.images[item.side]=url;state.files[item.side]=item.file.name||'Diseño guardado';state.uploadFiles[item.side]=item.file;state.assessments[item.side]=checkResolution(image.naturalWidth,image.naturalHeight);state.artworkTone=artworkTone(image)}state.uploaded=hasRequiredFiles();activateSide(includedSides()[0]);syncPreview();if(studio.open)renderStep()}catch{}}
function persistDraft(){syncFullName();try{saveForFifteenDays(DRAFT_KEY,{kind:state.kind,size:state.size,color:state.color,printSides:state.printSides,qualityReview:state.qualityReview,fulfillment:state.fulfillment,date:new Date().toISOString()})}catch{toast('No pudimos guardar el avance en este navegador.')}}
document.querySelector('#back').onclick=()=>{state.step=Math.max(1,state.step-1);renderStep()};
document.querySelector('#design-form').onsubmit=e=>{
 e.preventDefault();if(state.checking||checkoutOpening)return;
 if(state.step===1){if(!state.catalogDesign&&!state.images.front)return toast('Sube tu diseño para continuar.');if(!hasRequiredFiles()){const missing=includedSides().filter(side=>!state.images[side]).map(side=>sideNames[side].toLowerCase()).join(' y ');return toast(`Carga el archivo de ${missing} para continuar.`)}state.qualityAccepted=true;state.qualityReview=Boolean(failingSides().length);state.step=2;activateSide(includedSides()[0]);return renderStep()}
 if(state.step===2){addCurrentToCart();return}
 const summaryFirstName=document.querySelector('#summary-first-name'),summaryLastName=document.querySelector('#summary-last-name'),summaryEmail=document.querySelector('#summary-email'),summaryPhone=document.querySelector('#summary-phone');
 if(state.editingContact){for(const field of [summaryFirstName,summaryLastName,summaryEmail,summaryPhone])if(!field?.checkValidity())return field?.reportValidity();state.firstName=summaryFirstName.value.trim();state.lastName=summaryLastName.value.trim();state.email=summaryEmail.value.trim();state.phone=fullChilePhone(summaryPhone.value)}
 if(!state.firstName||!state.lastName||!state.email||!state.phone){state.editingContact=true;renderStep();return document.querySelector('#summary-first-name')?.focus()}
 if(state.fulfillment==='delivery'){const fields=['delivery-region','delivery-address','delivery-commune'].map(id=>document.querySelector(`#${id}`));for(const field of fields)if(!field?.checkValidity())return field?.reportValidity();const matchedRegion=chileRegions.find(region=>samePlace(region,fields[0].value.trim()));if(!matchedRegion){fields[0].setCustomValidity('Selecciona una región de la lista.');return fields[0].reportValidity()}const matchedCommune=communesForRegion(matchedRegion).find(commune=>samePlace(commune,fields[2].value.trim()));if(!matchedCommune){fields[2].setCustomValidity('Selecciona una comuna de la lista.');return fields[2].reportValidity()}state.region=matchedRegion;state.address=fields[1].value.trim();state.commune=matchedCommune;state.addressExtra=document.querySelector('#delivery-address-extra')?.value.trim()||'';state.deliveryNotes=document.querySelector('#delivery-notes')?.value.trim()||''}
 storeCustomerDetails();state.editingContact=false;state.checkoutReady=true;persistDraft();if(!state.shippingQuote){const scroller=studio.querySelector('.studio-controls');checkoutScrollSnapshot={scroller,top:scroller?.scrollTop||0};state.shippingQuote=quoteShipping(state.fulfillment,state.region,cart.reduce((sum,item)=>sum+item.quantity,0));renderStep();return}openPaymentConfirmation()
};
async function paymentArtworkFor(item,userId){
 if(item.catalogDesignSlug)return {frontDesignPath:null,backDesignPath:null};
 const sides=item.printSides==='both'?['front','back']:[item.printSides];
 let originals=await cartDesignFiles(item.id);
 if(!originals&&sides.length===1){
  const preview=await cartPreviewFile(item.designPreview,sides[0]);
  if(preview)originals={[sides[0]]:preview};
 }
 if(!originals)throw new Error('Falta el diseño de una polera del carro. Vuelve al estudio y añádela nuevamente antes de pagar.');
 const paths={frontDesignPath:null,backDesignPath:null};
 for(const side of sides){
  const file=originals[side];
  if(!(file instanceof Blob))throw new Error(`Falta el archivo original del ${side==='front'?'frente':'reverso'}. Vuelve a añadir la polera.`);
  paths[side==='front'?'frontDesignPath':'backDesignPath']=await uploadPrivateDesign(supabase,SUPABASE_URL,userId,side,file);
 }
 return paths;
}
async function openMercadoPagoCheckout(){
 if(paymentSubmitting)return;
 const errorNode=document.querySelector('#payment-content .mp-payment-error');
 setPaymentLoading(true,'Guardando diseños…','Estamos guardando tus diseños. Espera aquí mientras preparamos el pago.');
 if(errorNode)errorNode.hidden=true;
 try{
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)throw new Error('Inicia sesión o continúa como invitado antes de pagar.');
  const items=[];
  for(const item of cart){
   const artwork=await paymentArtworkFor(item,user.id);
   items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides:item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front'),quantity:item.quantity,qualityReview:Boolean(item.qualityReview),catalogDesignSlug:item.catalogDesignSlug||null,...artwork});
  }
  setPaymentLoading(true,'Preparando Mercado Pago…','Estamos creando el enlace seguro de pago. No necesitas pulsar de nuevo.');
  const payload={draftOrderId:state.checkoutDraftId,items,couponCode:state.couponCode||null,fulfillment:state.fulfillment,shippingQuoteClp:state.shippingQuote?.amount??null,customer:{firstName:state.firstName,lastName:state.lastName,email:state.email,phone:state.phone},shippingAddress:state.fulfillment==='delivery'?{region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,notes:state.deliveryNotes}:null};
  const {data,error}=await supabase.functions.invoke('create-payment-preference',{body:payload});
  if(error||!data?.initPoint)throw new Error(data?.error||await paymentFunctionError(error,'No pudimos iniciar el pago con Mercado Pago. Intenta nuevamente.'));
  persistDraft();
  const confirmedTotal=cartTotal()+(state.shippingQuote?.amount||0)-state.couponDiscount;
  if(Number.isInteger(data.totalClp)&&data.totalClp!==confirmedTotal){
   const amount=document.querySelector('#payment-content .mp-payment-summary strong');
   if(amount)amount.textContent=money(data.totalClp);
   if(errorNode){errorNode.textContent=`El total actualizado es ${money(data.totalClp)}. Confirma este importe para continuar.`;errorNode.hidden=false}
   preparedCheckoutUrl=data.initPoint;preparedCheckoutTotal=data.totalClp;
   setPaymentLoading(false,`Confirmar ${money(data.totalClp)} e ir a Mercado Pago`);
   return;
  }
  setPaymentLoading(true,'Abriendo Mercado Pago…','Te estamos llevando al sitio seguro de pago.');
  window.location.assign(data.initPoint);
 }catch(error){
  state.checkoutDraftId=null;
  preparedCheckoutUrl='';preparedCheckoutTotal=0;
  setPaymentLoading(false,'Continuar a Mercado Pago');
  if(errorNode){errorNode.textContent=error.message||'No pudimos guardar los diseños para el pedido.';errorNode.hidden=false}
 }
}
async function submitTransferOrder(){
 if(paymentSubmitting)return;
 const errorNode=document.querySelector('#payment-content .mp-payment-error');
 setPaymentLoading(true,'Guardando pedido…','Estamos registrando tu pedido y preparando los datos de transferencia.');
 if(errorNode)errorNode.hidden=true;
 try{
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)throw new Error('Inicia sesión o continúa como invitado antes de solicitar el pago.');
  const items=[];
  for(const item of cart){const artwork=await paymentArtworkFor(item,user.id);items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides:item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front'),quantity:item.quantity,qualityReview:Boolean(item.qualityReview),catalogDesignSlug:item.catalogDesignSlug||null,...artwork})}
  const payload={paymentMethod:'transfer',draftOrderId:state.checkoutDraftId,items,couponCode:state.couponCode||null,fulfillment:state.fulfillment,shippingQuoteClp:state.shippingQuote?.amount??null,customer:{firstName:state.firstName,lastName:state.lastName,email:state.email,phone:state.phone},shippingAddress:state.fulfillment==='delivery'?{region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,notes:state.deliveryNotes}:null};
  const {data,error}=await supabase.functions.invoke('create-payment-preference',{body:payload});
  if(error||!data?.orderId)throw new Error(data?.error||await paymentFunctionError(error,'No pudimos ingresar el pedido por transferencia. Intenta nuevamente.'));
  const submittedCart=[...cart];cart=[];state.cartItemId=null;state.checkoutDraftId=null;saveLocal(CART_KEY,cart);updateCommerceNav();for(const item of submittedCart)removeCartDesignFiles(item.id).catch(()=>{});
  const transfer=data.paymentInstructions?.transfer||{},account=[transfer.holder&&`<div><span>Titular</span><strong>${safe(transfer.holder)}</strong></div>`,transfer.bank&&`<div><span>Banco</span><strong>${safe(transfer.bank)}</strong></div>`,(transfer.account_type||transfer.account_number)&&`<div><span>Cuenta</span><strong>${safe(`${transfer.account_type||''} ${transfer.account_number||''}`.trim())}</strong></div>`,transfer.rut&&`<div><span>RUT</span><strong>${safe(transfer.rut)}</strong></div>`,transfer.email&&`<div><span>Email</span><strong>${safe(transfer.email)}</strong></div>`].filter(Boolean).join('');const emailNote=data.email?.sent?'También enviamos estos datos a tu correo.':'Guarda estos datos para hacer la transferencia. Podrás verlos nuevamente en Mis pedidos al iniciar sesión.';const target=document.querySelector('#payment-content');setPaymentLoading(false,'Solicitar pago por transferencia');target.innerHTML=`<div class="mp-success"><div class="mp-success-icon" aria-hidden="true">✓</div><span class="eyebrow">PEDIDO RECIBIDO</span><h2>Completa tu transferencia.</h2><p>Tu pedido #${data.orderId} quedó ingresado y pendiente de confirmación.</p><dl class="account-order-payment">${account}</dl><p>${emailNote}</p><button type="button" class="button dark" id="transfer-done">Entendido</button><small>El pedido no pasa a producción hasta confirmar el abono.</small></div>`;target.querySelector('#transfer-done').onclick=()=>paymentModal.close();persistDraft();
 }catch(error){setPaymentLoading(false,'Solicitar pago por transferencia');if(errorNode){errorNode.textContent=error.message||'No pudimos ingresar el pedido por transferencia.';errorNode.hidden=false}}
}
async function showMercadoPagoReturn(){
 const params=new URLSearchParams(location.search),status=params.get('mp_status');
 if(!status)return;
 const orderId=params.get('order_id');
 const cleanUrl=new URL(location.href);['mp_status','order_id','payment_id','status','external_reference','preference_id'].forEach(key=>cleanUrl.searchParams.delete(key));history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
 if(status==='failure'){state.checkoutDraftId=null;persistDraft()}
 if(/^\d+$/.test(orderId||'')){
  const {data:order}=await supabase.from('orders').select('status,request_type').eq('id',Number(orderId)).maybeSingle();
  if(order?.status==='paid'){
   if(order.request_type==='creative'){toast(`Pago confirmado · Solicitud #${orderId}. Puedes seguirla en Mis pedidos.`);return}
   for(const item of cart)removeCartDesignFiles(item.id).catch(()=>{});
   cart=[];state.cartItemId=null;state.checkoutDraftId=null;saveLocal(CART_KEY,cart);updateCommerceNav();
   toast(`Pago confirmado · Pedido #${orderId}. Ya puedes seguir su avance en Mis pedidos.`);
   return;
  }
 }
 const messages={success:['Pago recibido','Mercado Pago recibió tu pago. Estamos confirmando el pedido y lo verás en tu cuenta en unos segundos.','info'],pending:['Pago pendiente','El pago quedó pendiente de confirmación. Te avisaremos cuando Mercado Pago nos entregue el resultado.','info'],failure:['Pago no completado','No se completó el pago. Tu carro sigue disponible para intentarlo nuevamente.','error']};
 const [title,message,tone]=messages[status]||messages.pending;toast(`${title}${orderId?` · Pedido #${orderId}`:''}. ${message}`,tone);
}
function showSaved(){}
let toastTimer;function toast(message,tone='info'){const raw=String(message||''),looksTechnical=/invalid|credentials|email not confirmed|already registered|password should|rate limit|auth/i.test(raw),localized=looksTechnical?authErrorMessage(raw):raw;const el=document.querySelector('#toast');(document.querySelector('dialog[open]')||document.body).append(el);el.dataset.tone=tone;el.setAttribute('role',tone==='error'?'alert':'status');el.innerHTML=`<span aria-hidden="true">${tone==='error'?'!':'✓'}</span><p>${safe(localized)}</p>`;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500)}
showMercadoPagoReturn();
normalizeTextSymbols();
restoreSavedDesigns();

// Las poleras acompañan levemente el scroll para dar profundidad sin distraer.
const reduceShirtMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let shirtMotionFrame=0;
function updateShirtMotion(){
 shirtMotionFrame=0;
 if(reduceShirtMotion.matches)return;
 const viewportHeight=window.innerHeight||1;
 document.querySelectorAll('.custom-shirt-image').forEach((element,index)=>{
  const box=element.getBoundingClientRect();
  const distance=(box.top+box.height/2-viewportHeight/2)/viewportHeight;
  const direction=index%2===0?1:-1;
  const turn=Math.max(-.22,Math.min(.22,distance*.34*direction));
  element.style.setProperty('--shirt-turn',`${(turn*57.2958).toFixed(2)}deg`);
 });
}
function requestShirtMotion(){
 if(!shirtMotionFrame)shirtMotionFrame=requestAnimationFrame(updateShirtMotion);
}
window.addEventListener('scroll',requestShirtMotion,{passive:true});
window.addEventListener('resize',requestShirtMotion,{passive:true});
reduceShirtMotion.addEventListener?.('change',requestShirtMotion);
requestShirtMotion();

const revealSite=async()=>{
 const preloader=document.querySelector('#site-preloader');
 const app=document.querySelector('#app');
 if(!preloader){app?.removeAttribute('aria-busy');return}
 const started=performance.now();
 const pageLoaded=document.readyState==='complete'?Promise.resolve():new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
 const fontsLoaded=document.fonts?.ready||Promise.resolve();
 await Promise.race([Promise.allSettled([pageLoaded,fontsLoaded]),new Promise(resolve=>setTimeout(resolve,3500))]);
 const remaining=Math.max(0,520-(performance.now()-started));
 if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
 requestAnimationFrame(()=>{
  preloader.classList.add('is-leaving');
  document.body.classList.remove('is-preloading');
  app?.setAttribute('aria-busy','false');
  setTimeout(()=>preloader.remove(),380);
 });
};
revealSite();
supabase.auth.onAuthStateChange((event,session)=>{if(event!=='SIGNED_IN'||!session?.user||session.user.is_anonymous)return;setTimeout(async()=>{account=accountFromUser(session.user);await claimOrdersToAccount();updateCommerceNav();if(new URLSearchParams(location.search).get('panel')==='account'&&!accountModal.open){renderAccountDashboard('orders');accountModal.showModal()}},0)});
supabase.auth.getSession().then(async({data})=>{if(!data.session?.user||data.session.user.is_anonymous)return;account=accountFromUser(data.session.user);await claimOrdersToAccount();updateCommerceNav()});

// El fondo editorial acompaña el estado del segundo slide, incluido autoplay y teclado.
const homeHero=document.querySelector('.hero');
document.querySelectorAll('.hero-slider-controls button:not(.hero-slider-toggle)').forEach((control,index)=>{
 control.addEventListener('click',()=>homeHero?.classList.toggle('is-catalog-slide',index===1));
});

const THEME_STORAGE_KEY='droska-theme';
const themeColor=document.querySelector('meta[name="theme-color"]');
const setTheme=(theme,{persist=true}={})=>{
 const dark=theme==='dark';
 document.body.classList.toggle('theme-dark',dark);
 themeColor?.setAttribute('content',dark?'#262920':'#f9f7f2');
 if(persist)try{localStorage.setItem(THEME_STORAGE_KEY,dark?'dark':'light')}catch{}
};
let savedTheme='dark';
try{const storedTheme=localStorage.getItem(THEME_STORAGE_KEY);if(storedTheme==='dark'||storedTheme==='light')savedTheme=storedTheme}catch{}
setTheme(savedTheme,{persist:false});
