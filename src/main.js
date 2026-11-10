import {studioPreviewState} from './studio-preview.js';
import {mountHomeSnow} from './home-snow.js';
import {mountDropHeroSearch} from './drop-hero-search.js';
import {planDropWall} from './drop-wall-layout.js';
import {catalogFiltersMarkup,catalogProductToggleMarkup} from './catalog-filters.js';
import {catalogProductDesigns,catalogProductOptions,designWithProductMockup,designAppliesToProduct} from './catalog-product-mockups.js';
import {mountAccountDataDisclosure} from './account-data-disclosure.js';
import {designForProduct,designProductArtworks,modelProductSlug} from './catalog-product-artworks.js';
import {normalizeVariantRows,allowedVariantRows,resolveExactVariant,normalizeVariantColor,bodyCommerceReady} from '../supabase/functions/_shared/variant-selection.js';
import {minimumEligibleVariantPrice} from './variant-pricing.js';
import './design-system.css';
import './style.css';
import './accessibility.css';
import './drop-wall.css';
import './dialog-motion.js';
import {supabase,SUPABASE_URL,initialStoreSettings,localSignOutOptions,useDropWall} from './storefront-runtime.js';
import { applyStoreSettings, defaultStoreSettings } from './store-settings.js';
import { authErrorMessage } from './auth-messages.js';
import {authWithCaptcha,requestCaptchaToken,signInAnonymouslyWithCaptcha} from './auth-captcha.js';
import { PRINT_POLICY, PRINT_EXTRAS_CLP, QUALITY_ADJUSTMENT_CLP as DEFAULT_QUALITY_ADJUSTMENT_CLP, checkResolution, orderTotal } from './print-check.js';
import { quoteShipping } from './shipping.js';
import { collections as fallbackCollections, categories as fallbackCategories, catalogDesigns as fallbackCatalogDesigns, filterCatalog, artworkUrl, designCountLabel, loadCatalog, normalizeSampleColor, compareCatalogPriority, collectionsWithDesigns } from './catalog.js';
import { catalogCollectionDialogPath, catalogCollectionPath, catalogDesignDialogPath, catalogDesignPath, catalogProductPath } from './catalog-routes.js';
import { shareLink } from './share.js';
import { createIntroTurn } from './intro-turn.js';
import { DETAIL_BLOCK_ORDER, preserveStudioView, replaceStudioControl, studioDetailIncludesPrintPlacement } from './studio-sequence.js';
import { createDisclosureState, reconcileDisclosure, confirmDisclosure, mountDisclosure, focusDisclosure } from './progressive-disclosure.js';
import {mountIdeaFlow,mountPetFlow,mountWhatsAppFlow,mountCheckoutFlow} from './public-form-flows.js';
import { previewKey, needsGeneratedPreview } from './catalog-preview-cache.js';
import {catalogDesignAllowsBasePurchase,catalogDesignForVariantSelection,normalizeCatalogDesignPurchaseMode} from '../supabase/functions/_shared/catalog-personalization.js';
import {stableRequestId} from './request-attempt.js';
import {effectiveQualityReview} from './quality-review.js';
import {cartPriceBreakdown} from './cart-pricing.js';
import {accountFromUser,accountNavigationState} from './account-navigation.js';
import {PRINT_MAX_LAYERS,PRINT_PLACEMENT_LABEL,PRINT_SIZE_LABEL,PRINT_SIZE_SCALE,defaultPrintSideConfiguration,normalizePrintConfiguration,normalizePrintSideConfiguration,printConfigurationCount,printConfigurationLabel,printSideConfigurationLabel} from '../supabase/functions/_shared/print-configuration.js';

const shareIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5m-7.6 4.9 7.6 4.5"/></svg>`;
import {fallbackCatalogProducts} from './product-navigation.js';
import { orderSteps, orderProgressIndex, orderStatusLabel } from './order-status.js';
import { orderPaymentState, paymentStateLabels } from './payment-state.js';
import { orderTypeLabel } from './order-type.js';
import { communes, provinces } from '@clregions/data/array';
import { uploadPrivateDesign, sharePrivateDesign } from './design-storage.js';
import {buildWhatsAppPurchaseMessage,effectivePurchaseMethod,hasCartPurchase,purchaseMethodLabel,purchaseTypeFor,whatsappPurchaseUrl} from './purchase-methods.js';
import { petPhotoError, petStepHtml, petSubmitLabel, bindPetStep, sendPetRequest } from './pet-personalization.js';
import { CUSTOMER_IMAGE_POLICY, imageFileError, optimizeImage } from './image-optimization.js';
import { productFamilyIcon } from './product-family-icons.js';
const icons={arrow:'↗',spark:'✳',close:'×'};
const CUSTOMER_DETAILS_KEY='droska-customer-details';
const DRAFT_KEY='droska-shirt-draft';
const CATALOG_DRAFT_KEY='droska-catalog-context';
const SAVED_DETAILS_TTL=15*24*60*60*1000;
const DESIGN_DATABASE='droska-designs';
const DESIGN_STORE='uploads';
const CART_DESIGN_STORE='cart-uploads';
// El lienzo inicial no representa un diseño real: solo deja claro dónde
// aparecerá el archivo del cliente. Se mantiene local e independiente de
// `state.images`, para que nunca se trate como un archivo cargado.
const DEFAULT_PLACEHOLDER_IMAGE=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><text x="600" y="600" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" stroke="#171717" stroke-width="26" paint-order="stroke" font-family="Arial, sans-serif" font-size="142" font-weight="700" letter-spacing="-5">Tu diseño</text></svg>')}`;
const USER_ARTWORK_SCALE=1.6;
const CATALOG_ARTWORK_SCALE=1.7;
function loadSavedData(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');if(!value||typeof value!=='object'||typeof value.expiresAt!=='number'||value.expiresAt<=Date.now()){localStorage.removeItem(key);return {}}return value}catch{return {}}}
function saveForFifteenDays(key,value){try{localStorage.setItem(key,JSON.stringify({...value,expiresAt:Date.now()+SAVED_DETAILS_TTL}))}catch{}}
function openDesignDatabase(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('Almacenamiento de archivos no disponible'));const request=indexedDB.open(DESIGN_DATABASE,2);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DESIGN_STORE))request.result.createObjectStore(DESIGN_STORE,{keyPath:'side'});if(!request.result.objectStoreNames.contains(CART_DESIGN_STORE))request.result.createObjectStore(CART_DESIGN_STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveDesignFile(side,file){const database=await openDesignDatabase();await new Promise((resolve,reject)=>{const transaction=database.transaction(DESIGN_STORE,'readwrite');transaction.objectStore(DESIGN_STORE).put({side,file,expiresAt:Date.now()+SAVED_DETAILS_TTL});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});database.close()}
async function removeSavedDesignFile(side){const database=await openDesignDatabase();await new Promise((resolve,reject)=>{const transaction=database.transaction(DESIGN_STORE,'readwrite');transaction.objectStore(DESIGN_STORE).delete(side);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});database.close()}
async function savedDesignFiles(){const database=await openDesignDatabase();const files=await new Promise((resolve,reject)=>{const request=database.transaction(DESIGN_STORE).objectStore(DESIGN_STORE).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});database.close();return files}
async function saveCartDesignFiles(id,front,back,prints={}){const database=await openDesignDatabase();try{await new Promise((resolve,reject)=>{const transaction=database.transaction(CART_DESIGN_STORE,'readwrite');transaction.objectStore(CART_DESIGN_STORE).put({id,front,back,prints});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)})}finally{database.close()}}
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
const savedCatalogContext=loadSavedData(CATALOG_DRAFT_KEY);
const savedFullName=savedCustomerDetails.name||'';
const savedNameParts=savedFullName.trim().split(/\s+/).filter(Boolean);
const state={mode:'choose',kind:['basic','woman','over','kids','body','tote'].includes(savedDraftDetails.kind)?savedDraftDetails.kind:'basic',size:savedDraftDetails.size||'M',color:savedDraftDetails.color||'#ffffff',image:'',images:{front:'',back:''},files:{front:'',back:''},uploadFiles:{front:null,back:null},cloudSaved:{front:false,back:false},additionalPrints:[],activePrintId:null,references:[],uploaded:false,isDefault:true,file:'',catalogDesign:null,catalogDesignSlug:null,step:1,assessment:null,assessments:{front:null,back:null},printSide:'front',printSides:[],printScale:1,printConfigurations:{front:defaultPrintSideConfiguration('front'),back:defaultPrintSideConfiguration('back')},printAdjustmentsOpen:false,checking:false,checkingSide:'',artworkTone:'',qualityAccepted:false,qualityReview:false,customIdea:'',customName:'',customEmail:'',customPhone:'',customSubmitted:false,customChannel:null,creativeRequestId:crypto.randomUUID(),creativeOrderId:null,email:savedCustomerDetails.email||savedDraftDetails.email||'',firstName:savedCustomerDetails.firstName||savedDraftDetails.firstName||savedNameParts[0]||'',lastName:savedCustomerDetails.lastName||savedDraftDetails.lastName||savedNameParts.slice(1).join(' '),name:savedFullName,phone:savedCustomerDetails.phone||savedDraftDetails.phone||'',region:savedCustomerDetails.region||savedDraftDetails.region||'',address:savedCustomerDetails.address||savedDraftDetails.address||'',addressExtra:savedCustomerDetails.addressExtra||savedDraftDetails.addressExtra||'',commune:savedCustomerDetails.commune||savedDraftDetails.commune||'',deliveryNotes:savedCustomerDetails.deliveryNotes||savedDraftDetails.deliveryNotes||'',fulfillment:'delivery',shippingQuote:null,couponCode:'',couponDiscount:0,couponLabel:'',editingContact:false,checkoutReady:false,checkoutAsGuest:false,checkoutDraftId:Number.isSafeInteger(Number(savedDraftDetails.checkoutDraftId))?Number(savedDraftDetails.checkoutDraftId):null,cartItemId:null};
state.catalogDesignCustomerImage=Boolean(savedCatalogContext.catalogDesignCustomerImage);
state.catalogDesignPurchaseMode=savedCatalogContext.catalogDesignPurchaseMode||(state.catalogDesignCustomerImage?'personalized':'base');
state.catalogDesignName=savedCatalogContext.catalogDesignName||null;
state.catalogDesignSlug=savedCatalogContext.catalogDesignSlug||null;
state.variantId=savedDraftDetails.variantId||null;
if(Array.isArray(savedDraftDetails.printSides)){const sides=[...new Set(savedDraftDetails.printSides.filter(side=>['front','back'].includes(side)))];if(sides.length){state.printSides=sides;state.printSide=sides[0]}}
state.printConfigurations={front:normalizePrintSideConfiguration(savedDraftDetails.printConfigurations?.front,'front'),back:normalizePrintSideConfiguration(savedDraftDetails.printConfigurations?.back,'back')};
state.additionalPrints=(Array.isArray(savedDraftDetails.additionalPrints)?savedDraftDetails.additionalPrints:[]).slice(0,PRINT_MAX_LAYERS-1).map((item,index)=>{const side=item?.side==='back'?'back':'front';return {id:/^[a-z0-9-]{1,64}$/i.test(String(item?.id||''))?String(item.id):`extra-${index+1}`,side,configuration:normalizePrintSideConfiguration(item?.configuration,side),image:'',fileName:String(item?.fileName||''),file:null,assessment:null,checking:false}});
state.printScale=Number(state.printConfigurations[state.printSide].scale)||PRINT_SIZE_SCALE[state.printConfigurations[state.printSide].size];
let checkoutScrollSnapshot=null;
function syncFullName(){state.name=[state.firstName,state.lastName].filter(Boolean).join(' ')}
function storeCustomerDetails(){syncFullName();saveForFifteenDays(CUSTOMER_DETAILS_KEY,{email:state.email,firstName:state.firstName,lastName:state.lastName,name:state.name,phone:state.phone,region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,deliveryNotes:state.deliveryNotes})}
const garmentSizes=['S','M','L'];
const garmentSizeOrder=['XS','S','M','L','XL','XXL'];
const adultShirtKinds=new Set(['basic','over','woman']);
const shirtSizeLabels={S:'Pequeña',M:'Mediana',L:'Grande'};
const toteSizeLabels={M:'Mediana',L:'Grande'};
const sizeLabel=(kind,size)=>adultShirtKinds.has(kind)?shirtSizeLabels[size]||size:kind==='tote'?toteSizeLabels[size]||size:size;
const sizeCollator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
function sortAvailableSizes(kind,available){
 const values=[...available];
 if(!adultShirtKinds.has(kind))return values.sort(sizeCollator.compare);
 return values.sort((a,b)=>{
  const aIndex=garmentSizeOrder.indexOf(a),bIndex=garmentSizeOrder.indexOf(b);
  if(aIndex!==-1||bIndex!==-1)return (aIndex===-1?Infinity:aIndex)-(bIndex===-1?Infinity:bIndex);
  return sizeCollator.compare(a,b);
 });
}
const products={basic:{name:'Básica',family:'men',price:14990,sizes:[...garmentSizes]},over:{name:'Oversize',family:'men',price:21990,sizes:[...garmentSizes]},woman:{name:'Básica mujer',family:'women',price:14990,sizes:[...garmentSizes]},kids:{name:'Niños',family:'kids',price:8990,sizes:[]},body:{name:'Body bebé',family:'body',price:null,sizes:[]},tote:{name:'Tote bag',family:'tote',price:8990,prices:{M:8990,L:9900},sizes:['M','L']}};
const productFamilies=[
 {id:'men',name:'Polera unisex',kicker:'Adultos',description:'Básica u oversize'},
 {id:'women',name:'Polera mujer',kicker:'Adultos',description:'Calce femenino'},
 {id:'kids',name:'Polera niños',kicker:'Infantil',description:'Tallas por edad'},
 {id:'body',name:'Body bebé',kicker:'Bebé',description:'Tallas por meses'},
 {id:'tote',name:'Tote bag',kicker:'Accesorio',description:'Bolso de tela'},
];
const productFamilyForKind=kind=>products[kind]?.family||'men';
const productsForFamily=family=>Object.entries(products).filter(([,product])=>product.family===family);
const designSupportsProduct=(design,kind)=>!design||Boolean(designForProduct(design,modelProductSlug(kind)));
const familyPrice=family=>minimumEligibleVariantPrice(variantRows,productsForFamily(family).map(([kind])=>kind),selectedCatalogDesign());
let variantRows=[];
let variantLoadStatus='loading';
const selectedCatalogDesign=()=>catalogDesigns.find(item=>item.id===state.catalogDesignSlug)||null;
const variantSelectionDesign=design=>design?.id===state.catalogDesignSlug?catalogDesignForVariantSelection(design,state.catalogDesignCustomerImage):design;
function applyCatalogDesignPurchaseMode(design,requestedMode){
 const mode=normalizeCatalogDesignPurchaseMode(design,requestedMode);
 state.catalogDesignPurchaseMode=mode;
 state.catalogDesignCustomerImage=mode==='personalized';
 return mode;
}
function chooseCatalogDesignPurchaseMode(requestedMode){
 const design=selectedCatalogDesign(),previous=state.catalogDesignPurchaseMode,mode=applyCatalogDesignPurchaseMode(design,requestedMode),changed=mode!==previous;
 if(changed){state.step=1;state.checkoutDraftId=null;state.checkoutReady=false;state.cartItemId=null;detailsDisclosure=createDisclosureState();detailsDisclosureScope='';reconcileVariant(design?.sampleColor)}
 confirmDetail('purchaseMode');
 persistDraft();renderStep();syncPreview();
}
const COLOR_DISPLAY_ORDER=['blanco','natural','gris','negro','celeste','azul rey','azul marino','azul oscuro','verde menta','verde','verde botella','verde olivo','verde militar','verde oscuro','lavanda','morado','morado oscuro','rosado','rojo','rojo oscuro','amarillo','mostaza','naranjo','beige','cafe','cafe oscuro'];
const colorDisplayRank=color=>{const normalized=String(color||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return COLOR_DISPLAY_ORDER.indexOf(normalized)===-1?COLOR_DISPLAY_ORDER.length:COLOR_DISPLAY_ORDER.indexOf(normalized)};
const eligibleVariants=(kind,size,design=selectedCatalogDesign())=>{
 if(kind==='body'&&!bodyCommerceReady)return [];
 const rows=allowedVariantRows(variantRows,kind,size,variantSelectionDesign(design));
 const counts=new Map();
 for(const row of rows){const key=`${row.size}:${row.color}`;counts.set(key,(counts.get(key)||0)+1)}
 return rows.filter(row=>counts.get(`${row.size}:${row.color}`)===1);
};
const resolveAvailableVariant=(kind,size,color,design=selectedCatalogDesign())=>kind==='body'&&!bodyCommerceReady?{error:'unavailable'}:resolveExactVariant(variantRows,kind,size,color,variantSelectionDesign(design));
const productPrice=(kind,size,color=null,design=selectedCatalogDesign())=>{const rows=eligibleVariants(kind,size,design);if(color){const selected=resolveAvailableVariant(kind,size,color,design);return selected.variant?.priceClp??null}return rows.length?Math.min(...rows.map(row=>row.priceClp)):null};
function reconcileVariant(preferredColor=null,announce=false){
 const options=eligibleVariants(state.kind,state.size);
 const previous=state.color?.toLowerCase();
 const preferred=String(preferredColor||'').toLowerCase();
 const chosen=options.find(row=>row.color===previous)||options.find(row=>row.color===preferred)||options[0];
 state.color=chosen?.color||normalizeVariantColor(previous)||'#ffffff';state.variantId=chosen?.id||null;
 if(announce&&previous&&previous!==state.color&&!chosen)toast('No hay colores disponibles para esta combinación.','error');
}
const chileRegions=['Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso','Metropolitana de Santiago','O’Higgins','Maule','Ñuble','Biobío','La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes'];
const chileRegionIds={'Arica y Parinacota':'15','Tarapacá':'01','Antofagasta':'02','Atacama':'03','Coquimbo':'04','Valparaíso':'05','Metropolitana de Santiago':'13','O’Higgins':'06','Maule':'07','Ñuble':'16','Biobío':'08','La Araucanía':'09','Los Ríos':'14','Los Lagos':'10','Aysén':'11','Magallanes':'12'};
const samePlace=(a,b)=>String(a).localeCompare(String(b),'es',{sensitivity:'base'})===0;
function communesForRegion(regionName){const matchedRegion=chileRegions.find(region=>samePlace(region,regionName));const regionId=chileRegionIds[matchedRegion];if(!regionId)return communes.map(commune=>commune.name);const provinceIds=new Set(provinces.filter(province=>province.regionId===regionId).map(province=>province.id));return communes.filter(commune=>provinceIds.has(commune.provinceId)).map(commune=>commune.name)}
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const priceLabel=value=>value==null?'Precio por confirmar':`Desde ${money(value)}`;
const sizePriceLabel=(kind,size,design)=>{const prices=[...new Set(eligibleVariants(kind,size,design).map(row=>row.priceClp))];return prices.length?prices.length===1?money(prices[0]):priceLabel(Math.min(...prices)):'Sin precio';};
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
<div class="announcement" data-store-announcement><span class="announcement-message"><span data-store-announcement-text>🛍️ ¡Compra por WhatsApp disponible!</span><svg class="announcement-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 14.3 9.7 22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z"/></svg></span><span class="announcement-origin" data-store-announcement-origin>Hecho a tu pinta, en 🇨🇱 Chile.</span></div>
<header><a class="logo" href="#" aria-label="Polerama inicio">polerama<span>✳</span></a><nav><button type="button" class="product-nav-direct" data-bring-design>Trae tu diseño</button></nav><button class="nav-cta ds-cta ds-cta--sm" data-start="ready">Crear mi polera ↗</button></header>
<main>${useDropWall?`<section class="drop-intro" aria-labelledby="drop-title"><div class="drop-intro-decor" aria-hidden="true"><div class="hero-editorial-rail hero-editorial-rail--left"><span>DISEÑA</span><i></i><b>TU ESTILO <em>—</em> DISEÑOS <em>—</em> POLERAS</b></div><div class="hero-editorial-rail drop-head-rail--right"><span>✦</span><b>HECHA A TU PINTA</b><i></i></div></div><div><span class="eyebrow"><i></i> REGALOS CON PERSONALIDAD</span><h1 id="drop-title">Regalos que dicen:<br><span>pensé en ti.</span><b aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 4v92M4 50h92M17 17l66 66M83 17 17 83"/></svg></b></h1><p class="drop-intro-subtitle">Para cumpleaños, fechas especiales o un regalo porque sí.</p></div><span class="drop-style-note" aria-hidden="true">CERO<br>DISEÑOS<br>ABURRIDOS.</span><div class="drop-intro-aside"><button type="button" class="drop-create-card" data-start="ready"><span class="drop-create-eyebrow">¿TIENES UNA IDEA?</span><span class="drop-create-title">Trae tu<br> diseño</span><span class="drop-create-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12"/></svg></span><svg class="drop-create-rays" viewBox="0 0 44 44" aria-hidden="true"><path d="m12 15 3-11m8 16 9-9M27 30l12-1"/></svg></button></div></section><div class="ticker"><span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳ <span>TU POLERA</span> ✳ <span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳</div>
`:`<section class="hero"><div class="hero-copy"><span class="eyebrow"><i></i> PARA IDEAS QUE NO CABEN EN UN CATÁLOGO</span><h1>Tu idea<br>favorita,<br><span>puesta.</span><svg class="hero-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0l9 33 27-20-19 28 33 9-33 9 19 28-27-20-9 33-9-33-28 20 20-28L0 50l33-9-20-28 28 20Z" fill="#dfff6b" stroke="#242720" stroke-width="2"/></svg></h1><p>Tu mascota, ese recuerdo, una idea muy tuya.<br>Lo convertimos en la polera que solo tú tienes.</p><button class="button dark" data-start="ready">Dale forma a tu idea <span>↗</span></button><div class="hero-note"><span class="mini-faces">☺ ☻ ☺</span><span>Diseñada por ti. Creada contigo.</span></div></div>
<div class="hero-art"><div class="art-grid"></div><span class="art-label">EL LIENZO ERES TÚ</span><div class="bubble">Esta puede ser tu mascota <span aria-hidden="true"><svg viewBox="0 0 70 90" role="img"><path d="M8 8 C50 12, 65 32, 57 55 C52 69, 43 76, 31 78" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M19 64 L30 79 L43 66" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><img class="hero-static-image" src="/hero-customization-v2.png" width="1254" height="1254" alt="Foto de un perro convertida en un diseño sobre una polera personalizada" fetchpriority="high" decoding="async"><button class="hero-personalize" data-start="ready">＋ Agrega tu diseño</button><div class="floating-chip pink">ÚNICA.<br>COMO TÚ. <span>✷</span></div><div class="floating-chip cream"><span>✧</span> Cero poleras aburridas.</div><div class="art-bottom"><span>FOTO A POLERA · HECHA A TU PINTA</span><span>↙ HECHA A TU PINTA</span></div></div></section>
<div class="ticker"><span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳ <span>TU POLERA</span> ✳ <span>TU FOTO</span> ✳ <span>TU IDEA</span> ✳ <span>TU DISEÑO DE IA</span> ✳</div>
`}
<section id="caminos" class="section"><div class="section-heading"><div><span class="eyebrow">PRIMER PASO · ELIGE TU CAMINO</span><h2>¿Qué tienes en mente?</h2></div><p>Tres caminos para llegar<br>a tu polera favorita.</p></div><div class="paths"><button class="path lilac" data-start="ready"><span class="path-top">01 / TENGO DISEÑO <span>↗</span></span><div class="path-art upload-art"><div>↑<small>SUBE TU DISEÑO</small></div><svg class="brand-mark mark-lilac" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 60 33 88 12 70 42 100 50 69 58 86 88 57 67 49 100 40 66 12 86 30 57 0 49 33 40 15 12 43 33Z"/></svg></div><h3>Lo veo en 3D.</h3><p>Sube tu archivo. Si cumple el control técnico, lo visualizas sobre la polera.</p><span class="text-link">Tengo diseño <span>↗</span></span></button><button class="path lime" data-start="improve"><span class="path-top">02 / TE LO REVISO <span>↗</span></span><div class="path-art improve-art"><span>✳</span><b>✳</b><small>PREVIO ABONO</small></div><h3>Te lo reviso.</h3><p>Si necesita trabajo para imprimir, lo revisamos previo abono. Ese pago se descuenta de tu polera.</p><span class="text-link">Te lo reviso ↗</span></button><button class="path pink" data-start="custom"><span class="path-top">03 / MI IDEA <span>↗</span></span><div class="path-art custom-art"><span>¿y si…?</span><svg class="brand-mark mark-four" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 61 39 96 50 61 61 50 96 39 61 4 50 39 39Z"/></svg></div><h3>Mi idea, desde cero.</h3><p>Cuéntanos qué imaginas. Creamos una propuesta contigo, con cuota previa acreditable.</p><span class="text-link">Mi idea <span>↗</span></span></button></div></section>
<section class="how section" id="como"><div><span class="eyebrow">DEL “¿Y SI…?” AL “¡ES MÍA!”</span><h2>Así nace tu<br>próxima favorita.</h2><p>Un proceso simple.<br>Un resultado muy tuyo.</p><a class="text-link" href="#caminos">Vamos a crear ↗</a></div><ol><li><span>01</span><div><h3>Tú pones la idea.</h3><p>Sube tu archivo o cuéntanos qué imaginas. Elige tu polera, talla y color.</p></div></li><li><span>02</span><div><h3>La hacemos realidad.</h3><p>Si tu archivo necesita mejoras, pagas una cuota de revisión que se descuenta de tu polera. Los diseños desde cero se cotizan.</p></div></li><li><span>03</span><div><h3>La ves. Te enamoras. La apruebas.</h3><p>“Tengo diseño” permite ver en 3D los archivos que cumplen el control técnico. En trabajos creativos revisas la propuesta del taller antes de aprobar.</p></div></li><li><span>04</span><div><h3>De nuestra mesa a tu clóset.</h3><p>Con tu aprobación y pago completo, pasa a impresión. Coordinamos la entrega contigo.</p></div></li></ol></section>
<section class="closing"><svg class="brand-mark mark-asterisk" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5v90M5 50h90M18 18l64 64M82 18 18 82"/></svg><h2>Si lo imaginas,<br>te queda bien.</h2><button class="button dark" data-start="custom">Hagamos esa polera ↗</button><p>Sin catálogo. Sin límites a tu idea. Con mucha personalidad.</p></section>
<section class="faq section"><div class="faq-intro"><span class="eyebrow">ANTES DE EMPEZAR</span><h2>Antes de darle al botón.</h2><p>Todo lo necesario para pasar de tu idea a una polera lista para usar.</p><div class="faq-facts"><span>Archivos hasta 12 MB</span><span>Frente o espalda</span><span>Despachos en Chile</span></div><a class="faq-contact" data-store-whatsapp href="https://wa.me/56965217926" target="_blank" rel="noopener">¿Te quedó una duda?<strong>Hablemos por WhatsApp →</strong></a></div><div class="faq-list">${[['¿Puedo subir mi propio diseño o uno hecho con IA?','Sí. Aceptamos JPG, PNG y WEBP de hasta 12 MB. Antes de enviarlo lo convertimos a WebP optimizado; comprobamos formato, peso y resolución para un estampado de hasta 28 × 40 cm, en frente o espalda. Si la resolución no alcanza, te avisaremos antes de avanzar.'],['¿Y si todavía no tengo un diseño?','Elige “Mi idea”, cuéntanos qué imaginas y adjunta una referencia si quieres. El taller prepara una propuesta contigo.'],['¿Puedo revisar mi polera antes de imprimir?','Sí. Verás tu diseño sobre la polera antes de confirmar. El estampado ocupa una sola cara: frente o espalda.'],['¿Cuánto demora mi pedido?','El plazo depende de la revisión, aprobación, producción y despacho. Te confirmaremos una fecha estimada antes de pagar.']].map(([q,a])=>`<details><summary>${q}<span>+</span></summary><p>${a}</p></details>`).join('')}</div></section></main>
<footer>
  <div class="footer-brand"><a class="logo" href="#">polerama<span>✳</span></a><p>Ideas que se llevan puestas.<br>Diseñadas contigo, hechas en Chile.</p></div>
  <nav class="footer-catalog" aria-label="Catálogo indexable"></nav>
  <div class="footer-contact"><span>¿TIENES UNA IDEA?</span><strong>Hagámosla polera.</strong><a class="whatsapp-link" data-store-whatsapp href="https://wa.me/56965217926" target="_blank" rel="noreferrer">Escríbeme por WhatsApp <span aria-hidden="true">↗</span></a><a data-store-support-email class="store-support-email" hidden></a></div>
  <div class="footer-bottom"><a href="/models/oversized-tshirt/ATTRIBUTION.txt" target="_blank" rel="noopener">Modelo oversize: kylelhb · CC BY 4.0</a><span>Hecho con personalidad en Chile. © ${new Date().getFullYear()}</span><a class="footer-how-link" href="#caminos">Cómo funciona <span aria-hidden="true">↗</span></a></div>
</footer>
<dialog id="studio"><div class="dialog-header"><a class="logo" href="#">polerama<span>✳</span></a><span>TU ESTUDIO CREATIVO</span><button class="icon-btn close-button" data-close aria-label="Cerrar estudio"><span aria-hidden="true"></span></button></div><div class="studio-body"><div class="preview"><div id="reference-panel"></div><div id="live-preview" hidden><span class="eyebrow">UNA VISTA A TU PRÓXIMA FAVORITA</span><div id="viewer"><div class="shirt preview-fallback"><div class="shirt-neck"></div><img alt="Tu diseño sobre la polera" hidden/></div></div><button type="button" class="viewer-fullscreen-trigger" id="open-fullscreen-viewer" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>Ver diseño en grande</span></button></div><section id="checkout-cart-preview" class="checkout-cart-preview" hidden></section></div><div class="studio-controls"><div class="steps" aria-label="Progreso del diseño"></div><form id="design-form"><div id="step-content"></div><div class="form-navigation"><button type="button" id="back" class="small-button">Volver</button><button type="submit" class="button dark" id="next">Siguiente</button></div><p class="checkout-progress" id="checkout-progress" role="status" aria-live="polite" hidden></p></form></div></div></dialog>
<dialog id="fullscreen-viewer" class="fullscreen-viewer-dialog" aria-labelledby="fullscreen-viewer-title"><header class="fullscreen-viewer-header"><div><span class="eyebrow">VISTA DE DISEÑO</span><h2 id="fullscreen-viewer-title">Tu diseño en detalle</h2></div><button type="button" class="fullscreen-viewer-close" id="close-fullscreen-viewer" aria-label="Cerrar vista ampliada"></button></header><div id="fullscreen-viewer-canvas" class="fullscreen-viewer-canvas"><span>Preparando vista…</span></div><div class="fullscreen-viewer-toolbar" aria-label="Controles de vista"><div class="fullscreen-zoom-controls"><button type="button" id="fullscreen-zoom-out" aria-label="Alejar el diseño">−</button><output id="fullscreen-zoom-status" aria-live="polite">0%</output><button type="button" id="fullscreen-zoom-in" aria-label="Acercar el diseño">+</button></div><button type="button" id="fullscreen-reset-view" class="fullscreen-reset-view">Restablecer</button></div><p class="fullscreen-viewer-hint">Arrastra para girar la prenda. Usa los controles para acercar el diseño.</p></dialog>
<dialog id="size-guide-modal" aria-labelledby="size-guide-title"><div class="size-guide-header"><div><span class="eyebrow">GUÍA DE TALLAS</span><h2 id="size-guide-title">Encuentra tu medida.</h2></div><button type="button" class="icon-btn close-button" data-size-close aria-label="Cerrar guía de tallas"><span aria-hidden="true"></span></button></div><div class="size-guide-body"><div class="measure-visual"><svg viewBox="0 0 420 390" role="img" aria-labelledby="measure-title measure-desc"><title id="measure-title">Medición del ancho de una polera</title><desc id="measure-desc">La polera se mide en línea recta desde una axila hasta la otra.</desc><path class="measure-shirt" d="M133 55 174 34c9 21 63 21 72 0l41 21 75 60-45 63-34-24v195H137V154l-34 24-45-63 75-60Z"/><path class="measure-neck" d="M174 34c5 35 67 35 72 0"/><path class="measure-line" d="M137 158H283"/><path class="measure-arrow" d="m137 158 16-11m-16 11 16 11m130-11-16-11m16 11-16 11"/><circle cx="137" cy="158" r="6"/><circle cx="283" cy="158" r="6"/><text x="210" y="138" text-anchor="middle">AXILA A AXILA</text><text class="measure-a" x="210" y="190" text-anchor="middle">A</text></svg><div class="measure-caption"><strong>Medida A · Ancho</strong><span>Siempre en línea recta, sin estirar la tela.</span></div></div><div class="measure-info"><ol class="measure-steps"><li><b>1</b><span>Busca una polera que te quede como te gusta.</span></li><li><b>2</b><span>Extiéndela plana sobre una mesa.</span></li><li><b>3</b><span>Mide de axila a axila y compara el resultado.</span></li></ol><div class="visual-size-table"><div class="size-table-head"><span>Talla</span><span>Ancho A</span></div>${[['S','Pequeña','48 cm'],['M','Mediana','52 cm'],['L','Grande','56 cm']].map(([size,label,width])=>`<button type="button" data-guide-size="${size}"><strong>${label}</strong><span>${width}</span></button>`).join('')}</div><p class="measure-note">Las medidas son aproximadas y pueden variar hasta 1–2 cm. Si quedas entre dos tallas, elige la mayor para un calce más suelto.</p></div></div></dialog>
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
const AUTH_REDIRECT_URL=(import.meta.env.VITE_SITE_URL||window.location.origin).replace(/\/$/,'');
const AUTH_ACCOUNT_REDIRECT=`${AUTH_REDIRECT_URL}/?panel=account`;
// El catálogo publicado sustituye estos datos al iniciar. El respaldo local
// evita que el home muestre una grilla vacía mientras llega Supabase.
let collections=[...fallbackCollections];
let catalogProducts=[...fallbackCatalogProducts];
let storefrontSettings={...initialStoreSettings};
let QUALITY_ADJUSTMENT_CLP=DEFAULT_QUALITY_ADJUSTMENT_CLP;
let PRINT_PRICES=defaultStoreSettings;
const qualityReviewFee=()=>QUALITY_ADJUSTMENT_CLP;
let catalogCategories=[...fallbackCategories];
let selectedCatalogCategory='all';
let selectedCatalogProduct='all';
let catalogView='collections';
let catalogFilterMode='collections';
const catalogCardProducts=new Map();
let catalogGridColumns=4;
let catalogDesigns=[...fallbackCatalogDesigns];
let publishedProductSlugs=new Set(['poleras']);
let homeCatalogProducts=[];
let publishedCollections=[];
let publishedDesigns=[];
let productPricesRequest=null;
async function loadProductPrices(){
 if(productPricesRequest)return productPricesRequest;
 productPricesRequest=loadProductPricesOnce();
 try{return await productPricesRequest}finally{productPricesRequest=null}
}
async function loadProductPricesOnce(){
 try{
  const variantsResult=await supabase.from('product_variants').select('id,sku,size,color_name,color_hex,price_clp,active,product_models!inner(code,name,active)').eq('active',true).eq('product_models.active',true);
  if(variantsResult.error)throw variantsResult.error;
  const data=normalizeVariantRows(variantsResult.data||[]);
  if(!data.length)throw new Error('No hay variantes publicadas.');
  variantRows=data;variantLoadStatus='ready';
  const prices=new Map();
  const sizes=new Map();
  for(const product of Object.values(products)){product.sizes=[];product.price=null}
  for(const variant of data){const code=variant.modelCode==='kid'?'kids':variant.modelCode;if(!products[code])continue;prices.set(code,Math.min(prices.get(code)??Infinity,variant.priceClp));if(!sizes.has(code))sizes.set(code,new Set());sizes.get(code).add(variant.size)}
  for(const [code,price] of prices)products[code].price=price;
  for(const [code,available] of sizes)products[code].sizes=sortAvailableSizes(code,available);
  if(!products[state.kind].sizes.includes(state.size))state.size=products[state.kind].sizes[0]||'';
  reconcileVariant(selectedCatalogDesign()?.sampleColor,true);
  renderCatalog();if(studio.open)renderStep();return true;
 }catch(error){variantRows=[];variantLoadStatus='error';console.warn('No pudimos cargar las variantes disponibles desde Insumos:',error);if(studio.open)renderStep();return false}
}
const readLocal=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let account=null,cart=readLocal(CART_KEY,[]),cartExpanded=false,resumeIdeaAfterAuth=false,resumeCheckoutAfterAuth=false;
const saveLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const header=document.querySelector('header');
const accountButton=document.createElement('button');accountButton.type='button';accountButton.className='account-trigger';accountButton.setAttribute('aria-label','Abrir acceso de cuenta');
const headerLogoutButton=document.createElement('button');headerLogoutButton.type='button';headerLogoutButton.className='header-logout';headerLogoutButton.hidden=true;headerLogoutButton.textContent='Cerrar sesión';
const cartButton=document.createElement('button');cartButton.type='button';cartButton.className='cart-trigger ds-cart-button';cartButton.setAttribute('aria-label','Abrir carro de compras');
header?.insertBefore(accountButton,header.querySelector('.nav-cta'));header?.insertBefore(headerLogoutButton,header.querySelector('.nav-cta'));header?.insertBefore(cartButton,header.querySelector('.nav-cta'));
header?.querySelector('.nav-cta')?.remove();
let dropHeroSearch=null;
if(useDropWall){
const menuDivider=document.createElement('span');menuDivider.className='drop-menu-divider';menuDivider.setAttribute('aria-hidden','true');
const searchButton=document.createElement('button');searchButton.type='button';searchButton.className='drop-search-trigger';searchButton.setAttribute('aria-label','Buscar diseños');searchButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
header.insertBefore(menuDivider,accountButton);header.insertBefore(searchButton,accountButton);
function searchEntries(){return catalogDesigns.filter(design=>design.active!==false&&catalogProductOptions(catalogProducts,[design]).length).map(design=>({design,collection:collections.find(item=>item.id===design.collection),products:catalogProductOptions(catalogProducts,[design]).map(product=>product.name),productSlugs:catalogProductOptions(catalogProducts,[design]).map(product=>product.slug)})).filter(entry=>entry.collection).map(entry=>({...entry,category:catalogCategories.find(category=>category.id===entry.collection.category)?.label||''}))}
dropHeroSearch=mountDropHeroSearch(document.querySelector('.drop-intro-aside'),{getEntries:searchEntries,getTopics:()=>catalogCategories.filter(category=>searchEntries().some(entry=>entry.collection.category===category.id)),getProducts:()=>catalogProductOptions(catalogProducts,catalogDesigns),isAvailable:()=>catalogAvailable,getPreview:(design,collection,product)=>catalogPreviewDesign(design,collection.productSlug,product||'all').featuredPhoto,onChoose:openCatalogDesign,onCollection:openCatalogCollection,onCreate:()=>beginIdea(),onRetry:()=>refreshCatalog()});
searchButton.addEventListener('click',()=>dropHeroSearch.open());

}
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
const currentProductConfig=()=>catalogProducts.find(product=>product.slug===modelProductSlug(state.kind))||{slug:modelProductSlug(state.kind),purchase_method:'inherit',active:true};
const currentPurchaseType=()=>purchaseTypeFor(state);
const currentPurchaseMethod=()=>effectivePurchaseMethod({product:currentProductConfig(),settings:storefrontSettings,purchaseType:currentPurchaseType()});
const ideaRequestMethod=()=>state.customChannel||currentPurchaseMethod();
async function createWhatsAppOrder({requestType='purchase',customer,idea='',product=null,details=''}){
 let {data:{session}}=await supabase.auth.getSession();
 if(!session){const result=await signInAnonymouslyWithCaptcha(supabase);if(result.error)throw result.error;session=result.data.session}
 if(!session)throw new Error('No pudimos iniciar una sesión segura para registrar tu solicitud.');
 const signature=JSON.stringify({requestType,customer,idea,product,details});
 const requestId=stableRequestId(localStorage,'droska-whatsapp-attempt',signature);
 const captchaToken=await requestCaptchaToken();
 const {data,error}=await supabase.functions.invoke('create-whatsapp-order',{body:{requestId,requestType,customer,idea,product,details,captchaToken}});
 if(error||data?.error){const detail=error?.context?.json?await error.context.json().catch(()=>null):null;throw new Error(data?.error||detail?.error||error?.message||'No pudimos registrar la solicitud de WhatsApp.');}
 return data;
}
function updateCommerceNav(){const itemCount=cart.reduce((sum,item)=>sum+item.quantity,0),cartAvailable=hasCartPurchase(catalogProducts,storefrontSettings),navigation=accountNavigationState(account);accountButton.innerHTML=navigation.authenticated?`<span class="account-initial" aria-hidden="true">${safe(navigation.label).slice(0,1).toUpperCase()}</span><span class="account-label">${safe(navigation.label)}</span>`:`<span class="account-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></span><span class="account-label">${safe(navigation.label)}</span>`;accountButton.setAttribute('aria-label',navigation.ariaLabel);headerLogoutButton.hidden=!navigation.authenticated;headerLogoutButton.setAttribute('aria-label',navigation.authenticated?`Cerrar sesión de ${navigation.label}`:'Cerrar sesión');cartButton.innerHTML=`<svg class="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-1 14H5L4 5Zm4 0a4 4 0 0 1 8 0"/></svg><b>${itemCount}</b>`;cartButton.hidden=!cartAvailable;cartButton.classList.toggle('has-items',itemCount>0)}
document.addEventListener('click',event=>{
 const button=event.target.closest('#custom-submit');
 if(!button||ideaRequestMethod()!=='whatsapp')return;
 if(publicRequestBusy){event.preventDefault();event.stopImmediatePropagation();return;}
 if(activePublicFlow&&!activePublicFlow.guardFinal(event))return;
 event.preventDefault();event.stopImmediatePropagation();
 const fields=['custom-idea','custom-name','custom-email','custom-phone'].map(id=>document.querySelector(`#${id}`));
 for(const field of fields)if(!field?.checkValidity()){field?.reportValidity();return}
 const popup=window.open('about:blank','droska-whatsapp'),release=lockStudioRequest();button.disabled=true;button.textContent='Abriendo WhatsApp…';
 (async()=>{try{state.customIdea=fields[0].value.trim();state.customName=fields[1].value.trim();state.customEmail=fields[2].value.trim();state.customPhone=fields[3].value.trim();const order=await createWhatsAppOrder({requestType:'creative',idea:state.customIdea,details:'El cliente adjuntará sus referencias directamente en WhatsApp.',customer:{name:state.customName,email:state.customEmail,phone:state.customPhone}});const message=buildWhatsAppPurchaseMessage({purchaseType:'personalized',productName:'Diseño personalizado',designName:state.catalogDesignName,personalization:[state.customIdea,'Adjuntaré mis imágenes de referencia en este chat.',`Solicitud #${order.orderId}`].filter(Boolean).join(' · '),customer:{name:state.customName,email:state.customEmail,phone:state.customPhone}}),url=whatsappPurchaseUrl(storefrontSettings.whatsapp_number,message);if(popup)popup.location.replace(url);else window.location.assign(url)}catch(error){popup?.close();toast(error.message||'No pudimos registrar la solicitud. Intenta nuevamente.','error')}finally{button.innerHTML='Solicitar por WhatsApp <span aria-hidden="true">→</span>';release()}})()
},true);
const accountDate=value=>new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
function accountDashboardShell(active){return `<div class="account-welcome"><span class="account-initial large">${safe(account.name).slice(0,1).toUpperCase()}</span><div><strong>${safe(account.name)}</strong><small>${safe(account.email)}</small></div></div><nav class="account-sections" aria-label="Secciones de mi cuenta"><button type="button" class="${active==='orders'?'active':''}" data-account-section="orders" ${active==='orders'?'aria-current="page"':''}>Mis pedidos</button><button type="button" class="${active==='data'?'active':''}" data-account-section="data" ${active==='data'?'aria-current="page"':''}>Mis datos</button></nav><div class="account-panel" id="account-panel" aria-live="polite"><div class="account-loading"><span></span>Cargando…</div></div><button type="button" class="account-logout" id="logout-account" aria-label="Cerrar sesión de ${safe(account.email)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9"/></svg><span><strong>Cerrar sesión</strong><small>Salir de esta cuenta en este dispositivo</small></span></button>`}
async function signOutAccount(button){button.disabled=true;const {error}=await supabase.auth.signOut(localSignOutOptions);button.disabled=false;if(error)return toast(error.message,'error');account=null;updateCommerceNav();if(accountModal.open)renderAccount('register');toast('Sesión cerrada.')}
function bindAccountDashboard(){document.querySelectorAll('[data-account-section]').forEach(button=>button.onclick=()=>renderAccountDashboard(button.dataset.accountSection));document.querySelector('#logout-account').onclick=event=>signOutAccount(event.currentTarget)}
async function accountOrders(){
 let {data,error}=await supabase.from('orders').select('id,source,price_snapshot,request_type,request_details,quote_message,quoted_total_clp,status,total_clp,shipping_clp,created_at,shipping_address,payment_confirmed_at,payment_confirmed_by,payment_instructions,payment_transfer_notice_at,archived_at,payments(provider,status),order_items(id,name_snapshot,print_sides,print_configuration,quantity,line_total_clp),order_status_history(id,status,note,created_at)').eq('user_id',account.id).order('created_at',{ascending:false});
 if(error){const fallback=await supabase.from('orders').select('id,source,price_snapshot,request_type,request_details,quote_message,quoted_total_clp,status,total_clp,shipping_clp,created_at,shipping_address,payment_confirmed_at,payment_confirmed_by,payment_instructions,payments(provider,status),order_items(id,name_snapshot,print_sides,print_configuration,quantity,line_total_clp),order_status_history(id,status,note,created_at)').eq('user_id',account.id).order('created_at',{ascending:false});data=fallback.data;error=fallback.error;(data||[]).forEach(order=>{order.payment_transfer_notice_supported=false})}else{(data||[]).forEach(order=>{order.payment_transfer_notice_supported=true})}
 const local=readLocal(LOCAL_DEMO_ORDERS_KEY,[]).filter(order=>String(order.shipping_address?.customer?.email||'').toLowerCase()===account.email.toLowerCase());
 if(error&&local.length===0)throw error;
 const visibleOrders=[...(data||[])].map(order=>{const paid=orderPaymentState(order)==='paid';const blockedUntilPayment=!paid&&['in_production','ready','ready_for_pickup','shipped','delivered'].includes(order.status);return blockedUntilPayment?{...order,status:'paid',payment_pending_confirmation:true,order_status_history:(order.order_status_history||[]).filter(item=>['draft','submitted','quoted','awaiting_deposit','deposit_paid','paid'].includes(item.status))}:order});
 return [...local,...visibleOrders].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
async function claimOrdersToAccount(){if(!account)return;try{const {data,error}=await supabase.functions.invoke('claim-orders');if(error||data?.error)throw error||new Error(data.error)}catch(error){console.error('No pudimos asociar los pedidos existentes',error);toast('No pudimos asociar tus solicitudes anteriores. Reintenta al abrir tu cuenta.','error')}}
function orderDestination(order){const address=order.shipping_address||{};if(address.fulfillment==='pickup')return 'Retiro coordinado';return [address.address,address.commune,address.region].filter(Boolean).join(', ')||'Dirección por confirmar'}
function accountOrderPaymentMarkup(order){if(order.archived_at)return '';const transfer=order.payment_instructions?.transfer||{},hasTransfer=Object.values(transfer).some(Boolean),paymentLink=order.payment_instructions?.mercado_pago_url,notice=order.payment_transfer_notice_at,noticeSupported=order.payment_transfer_notice_supported===true,paymentState=orderPaymentState(order),paymentConfirmed=paymentState==='paid';if(!hasTransfer&&!paymentLink)return '';return `<section class="account-order-payment" data-account-order-payment="${safe(order.id)}" aria-label="Datos de pago"><div class="account-order-payment-head"><span>Datos de pago</span><strong>${money(order.total_clp)}</strong></div><p>${paymentConfirmed?'Tu pago fue confirmado. Ya podemos preparar tu pedido.':paymentState==='issue'?'El pago presenta una reversa o mediación. Te contactaremos para resolverla antes de continuar.':paymentState==='review'?'Recibimos información de tu pago. Administración lo está revisando.':'Debes pagar este monto para que podamos preparar tu pedido.'}</p>${hasTransfer?`<dl>${transfer.holder?`<div><dt>Titular</dt><dd>${safe(transfer.holder)}</dd></div>`:''}${transfer.bank?`<div><dt>Banco</dt><dd>${safe(transfer.bank)}</dd></div>`:''}${transfer.account_type||transfer.account_number?`<div><dt>Cuenta</dt><dd>${safe(`${transfer.account_type||''} ${transfer.account_number||''}`.trim())}</dd></div>`:''}${transfer.rut?`<div><dt>RUT</dt><dd>${safe(transfer.rut)}</dd></div>`:''}${transfer.email?`<div><dt>Email</dt><dd>${safe(transfer.email)}</dd></div>`:''}</dl>${noticeSupported&&paymentState==='unpaid'?`<div class="account-order-payment-action">${notice?`<span class="account-order-payment-notice">Aviso enviado. Estamos verificando tu transferencia.</span>`:`<button type="button" class="account-order-payment-link" data-notify-payment-transfer="${safe(order.id)}">Avisar que ya pagué</button>`}</div>`:''}`:''}${paymentLink&&paymentState==='unpaid'?`<a class="account-order-payment-link" href="${safe(paymentLink)}" target="_blank" rel="noreferrer">Pagar online</a>`:''}</section>`}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-notify-payment-transfer]');if(!button)return;event.preventDefault();const orderId=button.dataset.notifyPaymentTransfer;button.disabled=true;button.textContent='Enviando aviso…';const {data,error}=await supabase.functions.invoke('notify-payment-transfer',{body:{orderId}});if(error||data?.error){button.disabled=false;button.textContent='Avisar que ya pagué';toast(data?.error||error?.message||'No pudimos enviar el aviso.','error');return}toast('Avisamos a la tienda que ya realizaste la transferencia.');renderAccountOrders()});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-pay-creative]');if(!button)return;const method=button.dataset.paymentMethod||'mercado_pago';button.disabled=true;button.textContent=method==='transfer'?'Preparando transferencia…':'Preparando pago…';const {data,error}=await supabase.functions.invoke('create-creative-payment',{body:{orderId:Number(button.dataset.payCreative),paymentMethod:method}});if(error||data?.error){button.disabled=false;button.textContent=method==='transfer'?'Transferencia bancaria':'Mercado Pago';toast(data?.error||error?.message||'No pudimos iniciar el pago. Intenta nuevamente.','error');return}if(method==='transfer'){toast('Datos de transferencia disponibles en Mis pedidos.');await renderAccountOrders();return}if(!data?.initPoint){button.disabled=false;toast('No recibimos el enlace de Mercado Pago. Intenta nuevamente.','error');return}window.location.assign(data.initPoint)});
function orderStepper(order){if(order.archived_at)return '<div class="account-order-archived-note">Pedido archivado · solo lectura</div>';const steps=orderSteps(order),current=orderProgressIndex(order.status,order);return `<ol class="order-progress${order.status==='cancelled'?' is-cancelled':''}" style="--order-step-count:${steps.length}" aria-label="Avance del pedido">${steps.map((step,index)=>`<li class="${index<current?'complete':index===current?'current':''}"><span aria-hidden="true">${index<current?'✓':String(index+1).padStart(2,'0')}</span><strong>${safe(step.label)}</strong></li>`).join('')}</ol>${accountOrderPaymentMarkup(order)}`}
function stopAccountOrdersWatch(){if(accountOrdersChannel){supabase.removeChannel(accountOrdersChannel);accountOrdersChannel=null}}
function watchAccountOrders(){stopAccountOrdersWatch();if(!account)return;accountOrdersChannel=supabase.channel(`account-orders-${account.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`user_id=eq.${account.id}`},()=>{if(accountModal.open&&document.querySelector('[data-account-section="orders"].active'))renderAccountOrders()}).subscribe()}
async function renderAccountOrders(){
 const panel=document.querySelector('#account-panel');
 try{const orders=await accountOrders();if(!panel)return;if(!orders.length){panel.innerHTML='<section class="account-empty"><span class="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg></span><strong>Aún no tienes pedidos.</strong><p>Cuando completes una compra podrás seguir su estado desde aquí.</p><button type="button" class="button dark" id="account-start-order">Explorar diseños</button></section>';document.querySelector('#account-start-order').onclick=()=>{accountModal.close();location.hash='catalogo'};watchAccountOrders();return}
 let creativeTransferAvailable=false;
 if(orders.some(order=>order.request_type==='creative'&&['quoted','awaiting_deposit'].includes(order.status))){
  try{const {data,error}=await supabase.functions.invoke('create-payment-preference',{method:'GET'});creativeTransferAvailable=!error&&data?.bankTransferAvailable===true}catch{}
 }
 panel.innerHTML=`<div class="account-orders-head"><span>Tus pedidos se actualizan automáticamente.</span><button type="button" id="account-refresh-orders">Actualizar</button></div><div class="account-orders">${orders.map(order=>`<article class="account-order${order.archived_at?' is-archived':''}"><div><span>Pedido #${safe(order.id)}${order.price_snapshot?.flow_type==='mixed'?' · Pedido combinado':''}</span><strong>${order.request_type==='creative'&&order.status==='submitted'?'Por cotizar':money(order.total_clp)}</strong></div><div><div class="account-order-states"><span class="account-order-status">${order.archived_at?'Archivado':safe(orderStatusLabel(order.status))}</span><span class="account-payment-badge is-${orderPaymentState(order)}">${paymentStateLabels[orderPaymentState(order)]}</span></div><time datetime="${safe(order.created_at)}">${safe(accountDate(order.created_at))}</time></div>${order.request_type==='creative'&&['submitted','quoted','awaiting_deposit'].includes(order.status)?`<section class="account-creative-quote"><strong>${order.status==='quoted'?'Tu propuesta está lista':order.status==='awaiting_deposit'?'Pago pendiente':'Estamos revisando tu idea'}</strong><p>${safe(['quoted','awaiting_deposit'].includes(order.status)?order.quote_message||'Revisa la cotización.':order.request_details||'Te contactaremos con una propuesta.')}</p>${['quoted','awaiting_deposit'].includes(order.status)&&!order.archived_at&&!order.payment_instructions?.transfer?`<div class="account-creative-methods" role="group" aria-label="Elige cómo pagar la cotización"><button type="button" class="button dark" data-pay-creative="${safe(order.id)}" data-payment-method="mercado_pago">Mercado Pago · ${money(order.quoted_total_clp)}</button>${creativeTransferAvailable&&!order.payments?.some(payment=>payment.provider==='mercado_pago'&&payment.status==='pending')?`<button type="button" class="button dark" data-pay-creative="${safe(order.id)}" data-payment-method="transfer">Transferencia bancaria</button>`:''}</div><small>Confirma que el detalle incluya la entrega acordada antes de pagar.</small>`:''}${accountOrderPaymentMarkup(order)}</section>`:orderStepper(order)}<p>${order.request_type==='creative'?'Solicitud de diseño personalizado':safe(orderDestination(order))} · ${safe(orderTypeLabel(order))}</p><details><summary>Ver detalle e historial <b>+</b></summary><div>${(order.order_items||[]).map(item=>`<span><span><strong>${safe(item.name_snapshot)}</strong><small>${safe(printConfigurationLabel(item.print_configuration,item.print_sides))} · ${item.quantity} ${item.quantity===1?'unidad':'unidades'}</small></span><b>${money(item.line_total_clp)}</b></span>`).join('')||'<small>Sin productos asociados.</small>'}</div>${(order.order_status_history||[]).length?`<ul class="account-order-history">${[...order.order_status_history].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(item=>`<li><span>${safe(orderStatusLabel(item.status))}</span><time datetime="${safe(item.created_at)}">${safe(accountDate(item.created_at))}</time></li>`).join('')}</ul>`:''}</details></article>`).join('')}</div>`;document.querySelector('#account-refresh-orders').onclick=renderAccountOrders;watchAccountOrders()}
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
let accountDataDisclosure=null;
async function renderAccountData(){
 accountDataDisclosure?.destroy();accountDataDisclosure=null;
 const panel=document.querySelector('#account-panel');
 try{const profile=await accountProfile();if(!panel)return;panel.innerHTML=`<form class="account-data-form" id="account-data-form"><fieldset><legend>Información</legend><label>Nombre completo<input class="ds-field" name="full_name" autocomplete="name" required value="${safe(profile.full_name)}"></label><div class="account-email-field"><span class="account-field-label">Email de acceso</span><div class="account-readonly-value" aria-label="Email de acceso: ${safe(account.email)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>${safe(account.email)}</span></div><small>Este correo identifica tu cuenta y no se puede cambiar aquí.</small></div><label>Teléfono${phoneFieldHtml('account-phone',profile.phone,'phone')}</label></fieldset><fieldset><legend>Dirección de despacho</legend><label>Región${regionFilterHtml(profile.region,'account-region')}</label><label>Comuna<input class="ds-field" name="commune" autocomplete="address-level2" value="${safe(profile.commune)}"></label><label>Dirección<input class="ds-field" name="address" autocomplete="street-address" value="${safe(profile.address)}"></label><label>Depto., casa u oficina <span>Opcional</span><input class="ds-field" name="address_extra" autocomplete="address-line2" value="${safe(profile.address_extra)}"></label><label>Indicaciones <span>Opcional</span><textarea class="ds-field" name="delivery_notes">${safe(profile.delivery_notes)}</textarea></label></fieldset><button class="button dark commerce-wide" type="submit">Guardar mis datos</button></form>`;
 const phone=panel.querySelector('#account-phone');if(phone)phone.oninput=()=>{phone.value=formatChilePhoneLocal(phone.value)};const form=panel.querySelector('#account-data-form');accountDataDisclosure=mountAccountDataDisclosure({form,regions:chileRegions,communesForRegion,samePlace});setupRegionFilter(panel.querySelector('#account-region'),(value,committed)=>{if(committed)form.elements.region.dispatchEvent(new Event('change',{bubbles:true}))});form.onsubmit=async event=>{if(!accountDataDisclosure.guardSubmit(event))return;try{await saveAccountData(event)}catch(error){console.error(error);toast('No pudimos guardar tus datos. Intenta nuevamente.','error')}finally{const button=form.querySelector('[type="submit"]');button.textContent='Guardar mis datos';accountDataDisclosure?.setBusy(false)}}}
 catch(error){console.error(error);if(panel)panel.innerHTML='<section class="account-empty error"><strong>No pudimos cargar tus datos.</strong><p>Intenta nuevamente en unos minutos.</p></section>'}
}
async function saveAccountData(event){
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),values=accountDataDisclosure.serialize(),payload={full_name:String(values.get('full_name')).trim(),phone:fullChilePhone(values.get('phone')),region:String(values.get('region')).trim(),commune:String(values.get('commune')).trim(),address:String(values.get('address')).trim(),address_extra:String(values.get('address_extra')).trim(),delivery_notes:String(values.get('delivery_notes')).trim(),updated_at:new Date().toISOString()};accountDataDisclosure.setBusy(true);button.disabled=true;button.textContent='Guardando…';
 let {error}=await supabase.from('profiles').update(payload).eq('id',account.id).select('id').maybeSingle();
 if(error)({error}=await supabase.from('profiles').update({full_name:payload.full_name,phone:payload.phone,updated_at:payload.updated_at}).eq('id',account.id).select('id').maybeSingle());
 const {error:metadataError}=await supabase.auth.updateUser({data:{full_name:payload.full_name,customer_profile:{phone:payload.phone,region:payload.region,commune:payload.commune,address:payload.address,address_extra:payload.address_extra,delivery_notes:payload.delivery_notes}}});button.disabled=false;button.textContent='Guardar mis datos';if(error||metadataError)return toast('No pudimos guardar tus datos. Intenta nuevamente.','error');
 account.name=payload.full_name||account.name;const parts=payload.full_name.split(/\s+/).filter(Boolean);account.givenName=parts[0]||account.givenName;Object.assign(state,{firstName:parts[0]||'',lastName:parts.slice(1).join(' '),name:payload.full_name,phone:payload.phone,region:payload.region,commune:payload.commune,address:payload.address,addressExtra:payload.address_extra,deliveryNotes:payload.delivery_notes});storeCustomerDetails();updateCommerceNav();toast('Tus datos quedaron guardados.');renderAccountDashboard('data')
}
function renderAccountDashboard(section='orders'){document.querySelector('#account-title').textContent=`Hola, ${account.name.split(' ')[0]}.`;document.querySelector('#account-content').innerHTML=accountDashboardShell(section);bindAccountDashboard();if(section==='data'){stopAccountOrdersWatch();renderAccountData()}else renderAccountOrders()}
function renderAccount(mode='login',pendingEmail=''){
 if(mode==='forgot'){document.querySelector('#account-title').textContent='Recupera tu contraseña.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Te enviaremos un enlace seguro para crear una contraseña nueva.</p><form id="password-recovery-form" class="account-form"><label>Email<input class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(pendingEmail||state.email)}"></label><button class="button dark commerce-wide ds-cta" type="submit">Enviar enlace</button></form><button type="button" class="commerce-switch" id="account-switch">Volver a iniciar sesión</button><small class="commerce-note">Por seguridad, el enlace tendrá una vigencia limitada.</small>`;document.querySelector('#account-switch').onclick=()=>renderAccount('login');document.querySelector('#password-recovery-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,email=String(new FormData(form).get('email')).trim(),submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Enviando…';const {error}=await authWithCaptcha(captchaToken=>supabase.auth.resetPasswordForEmail(email,{redirectTo:`${AUTH_REDIRECT_URL}/?panel=account`,captchaToken}));submit.disabled=false;submit.textContent='Enviar enlace';if(error)return toast(authErrorMessage(error),'error');state.email=state.email||email;document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Si existe una cuenta para <strong>${safe(email)}</strong>, recibirás un enlace para cambiar tu contraseña.</p><button type="button" class="button dark commerce-wide ds-cta" id="recovery-back">Volver a ingresar</button>`;document.querySelector('#recovery-back').onclick=()=>renderAccount('login',email)};return}
 if(mode==='update-password'){document.querySelector('#account-title').textContent='Crea una contraseña nueva.';document.querySelector('#account-content').innerHTML='<p class="commerce-copy">Elige una contraseña de al menos 6 caracteres.</p><form id="password-update-form" class="account-form"><label>Nueva contraseña<input class="ds-field" name="password" required type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label><button class="button dark commerce-wide ds-cta" type="submit">Guardar contraseña</button></form>';document.querySelector('#password-update-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,password=String(new FormData(form).get('password')),submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Guardando…';const {error}=await supabase.auth.updateUser({password});submit.disabled=false;submit.textContent='Guardar contraseña';if(error)return toast(error.message);toast('Contraseña actualizada.');accountModal.close();};return}
 if(account){renderAccountDashboard(mode==='data'?'data':'orders');return}
 if(mode==='expired'){
  document.querySelector('#account-title').textContent='Tu enlace venció.';
  document.querySelector('#account-content').innerHTML=`<section class="account-confirmation account-expired" aria-labelledby="expired-confirmation-title"><span class="account-confirmation-icon" aria-hidden="true">!</span><h3 id="expired-confirmation-title">No necesitas crear otra cuenta.</h3><p>El enlace de confirmación caducó por seguridad. Escribe el correo con el que te registraste y te enviaremos uno nuevo.</p><form id="expired-confirmation-form" class="account-form"><label for="expired-confirmation-email">Email<input id="expired-confirmation-email" class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(pendingEmail||state.email)}"></label><button type="submit" class="button dark commerce-wide ds-cta">Enviar nuevo enlace</button></form><small>Si no lo encuentras, revisa también tu carpeta de spam.</small></section><button type="button" class="commerce-switch" id="account-switch">Volver a iniciar sesión</button>`;
  document.querySelector('#account-switch').onclick=()=>renderAccount('login',pendingEmail);
  document.querySelector('#expired-confirmation-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,email=String(new FormData(form).get('email')).trim(),button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Enviando…';const {error}=await authWithCaptcha(captchaToken=>supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:AUTH_ACCOUNT_REDIRECT,captchaToken}}));button.disabled=false;button.textContent='Enviar nuevo enlace';if(error)return toast(authErrorMessage(error),'error');state.email=email;storeCustomerDetails();document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">Te enviamos un nuevo enlace de confirmación a <strong>${safe(email)}</strong>. No necesitas registrarte otra vez.</p><button type="button" class="button dark commerce-wide ds-cta" id="expired-back">Volver a ingresar</button>`;document.querySelector('#expired-back').onclick=()=>renderAccount('login',email)};
  return;
 }
 if(mode==='confirm'){document.querySelector('#account-title').textContent='Revisa tu correo.';document.querySelector('#account-content').innerHTML=`<section class="account-confirmation" aria-label="Confirmación de cuenta"><span class="account-confirmation-icon" aria-hidden="true">✓</span><p>Para activar tu cuenta, abre el enlace que enviamos a:</p><strong class="account-confirmation-email">${safe(pendingEmail)}</strong><small>El enlace vence por seguridad. Revisa también tu carpeta de spam.</small></section><div class="account-confirmation-actions"><button type="button" class="button dark commerce-wide ds-cta" id="resend-confirmation">Reenviar enlace</button><button type="button" class="commerce-switch" id="account-switch">Ya confirmé mi cuenta · Ingresar</button></div>`;document.querySelector('#account-switch').onclick=()=>renderAccount('login');document.querySelector('#resend-confirmation').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.textContent='Enviando…';const {error}=await authWithCaptcha(captchaToken=>supabase.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:AUTH_ACCOUNT_REDIRECT,captchaToken}}));button.disabled=false;button.textContent='Reenviar enlace';if(error)return toast(authErrorMessage(error),'error');toast('Te enviamos un nuevo enlace de confirmación.');return};return}
 const isRegister=mode==='register',suggestedName=[state.firstName,state.lastName].filter(Boolean).join(' ');document.querySelector('#account-title').textContent=isRegister?'Crea tu cuenta.':'Qué bueno verte.';document.querySelector('#account-content').innerHTML=`<p class="commerce-copy">${isRegister?'Tus datos de contacto y despacho quedarán precargados para tu próxima compra.':'Ingresa para recuperar tus datos y avanzar más rápido.'}</p><form id="account-form" class="account-form">${isRegister?`<label>Nombre completo<input class="ds-field" name="name" required autocomplete="name" placeholder="Cómo te llamas" value="${safe(suggestedName)}"></label>`:''}<label>Email<input class="ds-field" name="email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${safe(state.email)}"></label><label>Contraseña<input class="ds-field" name="password" required type="password" minlength="6" autocomplete="${isRegister?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"></label>${isRegister?'':'<button type="button" class="account-forgot" id="account-forgot">Olvidé mi contraseña</button>'}<button class="button dark commerce-wide ds-cta" type="submit">${isRegister?'Crear mi cuenta':'Ingresar'}</button></form><button type="button" class="commerce-switch" id="account-switch">${isRegister?'Ya tengo cuenta · Ingresar':'¿Primera vez por aquí? · Crear cuenta'}</button>`;
 document.querySelector('#account-switch').onclick=()=>renderAccount(isRegister?'login':'register');
 document.querySelector('#account-forgot')?.addEventListener('click',()=>renderAccount('forgot',document.querySelector('#account-form [name="email"]')?.value));
 document.querySelector('#account-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form),email=String(data.get('email')).trim(),password=String(data.get('password')),name=isRegister?String(data.get('name')).trim():'';const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Un momento…';const customerProfile={phone:state.phone,region:state.region,commune:state.commune,address:state.address,address_extra:state.addressExtra,delivery_notes:state.deliveryNotes};const result=isRegister?await authWithCaptcha(captchaToken=>supabase.auth.signUp({email,password,options:{data:{full_name:name,customer_profile:customerProfile},emailRedirectTo:AUTH_ACCOUNT_REDIRECT,captchaToken}})):await authWithCaptcha(captchaToken=>supabase.auth.signInWithPassword({email,password,options:{captchaToken}}));submit.disabled=false;submit.textContent=isRegister?'Crear mi cuenta':'Ingresar';if(result.error){console.error('Supabase Auth error',result.error);return toast(authErrorMessage(result.error),'error')}state.email=state.email||email;if(isRegister&&name)state.firstName=state.firstName||name.split(' ')[0];if(!result.data.session){renderAccount('confirm',email);return}account=accountFromUser(result.data.user);state.checkoutAsGuest=false;await claimOrdersToAccount();await hydrateCheckoutFromProfile();updateCommerceNav();accountModal.close();toast(`Listo, ${account.name.split(' ')[0]}. Tu sesión está activa.`);if(resumeCheckoutAfterAuth){resumeCheckoutAfterAuth=false;beginCheckout();return}if(studio.open&&state.step===3)renderStep();if(resumeIdeaAfterAuth){resumeIdeaAfterAuth=false;openStudio('ready')}};
}
function closeCartDrawer(next){cartModal.classList.add('is-closing');window.setTimeout(()=>{cartModal.classList.remove('is-closing');cartModal.close();next?.()},450)}
cartModal.addEventListener('cancel',event=>{event.preventDefault();closeCartDrawer()});
function cartTotal(){return cart.reduce((sum,item)=>sum+item.price*item.quantity,0)}
async function hydrateCheckoutFromProfile(){if(!account)return;try{const profile=await accountProfile(),parts=String(profile.full_name||account.name).split(/\s+/).filter(Boolean);Object.assign(state,{firstName:parts[0]||state.firstName,lastName:parts.slice(1).join(' ')||state.lastName,email:account.email||state.email,phone:profile.phone||state.phone,region:profile.region||state.region,commune:profile.commune||state.commune,address:profile.address||state.address,addressExtra:profile.address_extra||state.addressExtra,deliveryNotes:profile.delivery_notes||state.deliveryNotes});storeCustomerDetails()}catch(error){console.error(error)}}
async function beginCheckout(asGuest=false){
 if(!await loadProductPrices())return toast('No pudimos consultar las variantes actuales. Intenta nuevamente.','error');
 for(const item of cart){
  const design=catalogDesigns.find(candidate=>candidate.id===item.catalogDesignSlug)||null;
  if(item.catalogDesignSlug&&!design)return toast('Un diseño del carro ya no está disponible. Quítalo y vuelve a elegirlo antes de pagar.','error');
  if(design&&!designForProduct(design,modelProductSlug(item.modelCode)))return toast('El diseño ya no está disponible para ese producto. Quítalo y vuelve a elegirlo.','error');
  const selected=resolveAvailableVariant(item.modelCode,item.size,item.color,design);
  if(!selected.variant)return toast('Un producto del carro ya no está disponible en ese color o talla. Quítalo y vuelve a elegirlo antes de pagar.','error');
  item.variantId=selected.variant.id;
  item.qualityReview=effectiveQualityReview(item);
  item.price=orderTotal(selected.variant.priceClp,item.printSides||'front',item.qualityReview?qualityReviewFee():0,printConfigurationCount(item.printConfiguration,item.printSides||'front'),item.modelCode==='tote'?null:item.printConfiguration,PRINT_PRICES).total;
 }
 saveLocal(CART_KEY,cart);
 publicFlowStates.delete('checkout');state.mode='ready';state.checkoutAsGuest=!account&&asGuest;if(account)await hydrateCheckoutFromProfile();state.editingContact=!(state.firstName&&state.lastName&&state.email&&state.phone);state.shippingQuote=null;recalculateShippingQuote();state.step=3;if(!studio.open)openDialog(studio);renderStep();faceSelectedSide()
}
function catalogPreviewForCart(slug,kind='basic'){const source=catalogDesigns.find(item=>item.id===slug),design=source&&designForProduct(source,modelProductSlug(kind));return design?artworkUrl(design):''}
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
 const selection=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign());
 if(!selection.variant)return toast('El color o la talla ya no está disponible. Elige una combinación válida.','error');
 addingCurrentToCart=true;
  try{
  const product=products[state.kind],basePrice=productPrice(state.kind,state.size,state.color),qualityReview=effectiveQualityReview({catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:state.catalogDesignCustomerImage,qualityReview:state.qualityReview}),pricing=orderTotal(basePrice,printChoice(),qualityReview?QUALITY_ADJUSTMENT_CLP:0,printCount(),state.kind==='tote'?null:currentPrintConfiguration(),PRINT_PRICES),id=state.cartItemId||`${state.kind==='tote'?'tote':'shirt'}-${Date.now()}`,catalogPreview=state.catalogDesignCustomerImage?'':catalogPreviewForCart(state.catalogDesignSlug,state.kind),fallback=state.images.front||state.images[state.printSide]||'',designPreview=catalogPreview||await cartPreviewPng(state.uploadFiles.front||state.uploadFiles[state.printSide],fallback),item={id,kind:product.name,modelCode:state.kind,size:state.size,sides:printSidesLabel(),printSides:printChoice(),printConfiguration:currentPrintConfiguration(),color:state.color,variantId:state.variantId,catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:Boolean(state.catalogDesignCustomerImage),qualityReview,designPreview,initial:state.files[state.printSide]?.slice(0,1).toUpperCase()||'*',basePrice,price:pricing.total,quantity:1},existing=cart.findIndex(entry=>entry.id===id);
  let storageWarning=false;
  if(!item.catalogDesignSlug||item.catalogDesignCustomerImage){
   const front=includedSides().includes('front')?state.uploadFiles.front:null,back=includedSides().includes('back')?state.uploadFiles.back:null,prints=Object.fromEntries(state.additionalPrints.map(print=>[print.id,print.file]));
   if((includedSides().includes('front')&&!(front instanceof Blob))||(includedSides().includes('back')&&!(back instanceof Blob))||state.additionalPrints.some(print=>!(print.file instanceof Blob)))throw new Error('Falta el archivo original de un estampado. Vuelve a cargarlo antes de añadir la polera.');
   cartDesignMemory.set(id,{front,back,prints});
   try{await saveCartDesignFiles(id,front,back,prints)}catch(error){storageWarning=true;console.warn('No pudimos persistir el original del diseño; queda disponible durante esta sesión.',error)}
  }else{cartDesignMemory.delete(id);await removeCartDesignFiles(id).catch(()=>{})}
  if(existing>=0)cart[existing]={...cart[existing],...item};else cart.push(item);
  state.cartItemId=id;saveLocal(CART_KEY,cart);updateCommerceNav();persistDraft();studio.close();renderCart();openDialog(cartModal);
  const productLabel=state.kind==='tote'?'tote bag':state.kind==='body'?'body bebé':'polera';
  toast(storageWarning?`Tu ${productLabel} quedó en el carro. Mantén esta pestaña abierta para continuar la compra.`:existing>=0?`Actualizamos tu ${productLabel} en el carro.`:`Tu ${productLabel} quedó añadida al carro.`);
 }catch(error){toast(error.message||'No pudimos guardar el diseño para el pedido.','error')}finally{addingCurrentToCart=false}
}
function showCartAccessGate(target){document.querySelector('#cart-checkout')?.setAttribute('hidden','');target.querySelector('.cart-access-gate')?.remove();target.querySelector('#cart-keep-shopping')?.remove();target.insertAdjacentHTML('beforeend','<section class="cart-access-gate" aria-labelledby="cart-access-title"><div><span class="eyebrow">ANTES DE PAGAR</span><h3 id="cart-access-title">Crea tu cuenta para continuar.</h3><p>Guarda tus pedidos y avanza más rápido en tu próxima compra.</p></div><button type="button" class="button dark ds-cta" id="cart-register">Crear cuenta</button><button type="button" class="cart-access-secondary" id="cart-login">Ya tengo cuenta · Iniciar sesión</button><button type="button" class="cart-access-guest" id="cart-guest">Continuar como invitado</button></section><button type="button" class="cart-keep-shopping" id="cart-keep-shopping">← Seguir comprando</button>');const openAccount=mode=>{resumeCheckoutAfterAuth=mode!=='forgot';closeCartDrawer(()=>{renderAccount(mode);accountModal.showModal()})};document.querySelector('#cart-login').onclick=()=>openAccount('login');document.querySelector('#cart-register').onclick=()=>openAccount('register');document.querySelector('#cart-keep-shopping').onclick=()=>closeCartDrawer();document.querySelector('#cart-guest').onclick=async event=>{const button=event.currentTarget;button.disabled=true;button.textContent='Preparando compra…';const {data:{session}}=await supabase.auth.getSession();if(!session){const {error}=await signInAnonymouslyWithCaptcha(supabase);if(error&&!import.meta.env.DEV){button.disabled=false;button.textContent='Continuar como invitado';return toast('No pudimos iniciar la compra como invitado. Intenta nuevamente.')}}closeCartDrawer(()=>beginCheckout(true))}}
function cartProductLabel(item){return item.modelCode==='tote'||item.kind==='Tote bag'?'Tote bag':item.modelCode==='body'?'Body bebé':`Polera ${item.kind}`}
function cartColorLabel(item){return variantRows.find(variant=>variant.id===item.variantId)?.colorName||variantRows.find(variant=>variant.modelCode===(item.modelCode==='kids'?'kid':item.modelCode)&&variant.size===item.size&&variant.color===normalizeVariantColor(item.color))?.colorName||item.color}
function cartItemBreakdown(item){
 const design=catalogDesigns.find(candidate=>candidate.id===item.catalogDesignSlug)||null;
 const pricingDesign=catalogDesignForVariantSelection(design,Boolean(item.catalogDesignCustomerImage));
 const currentBase=resolveExactVariant(variantRows,item.modelCode,item.size,item.color,pricingDesign).variant?.priceClp??null;
 return cartPriceBreakdown(item,currentBase,qualityReviewFee(),PRINT_PRICES);
}
function normalizeCartPrices(){let changed=false;for(const item of cart){const breakdown=cartItemBreakdown(item);if(item.basePrice!==breakdown.base||item.price!==breakdown.unit||item.qualityReview!==breakdown.qualityReview){item.basePrice=breakdown.base;item.price=breakdown.unit;item.qualityReview=breakdown.qualityReview;changed=true}}if(changed)saveLocal(CART_KEY,cart)}
function cartBreakdownMarkup(item){const breakdown=cartItemBreakdown(item),placement=breakdown.printSides==='both'?'Frente + espalda':breakdown.printSides==='back'?'Espalda':'Frente';return `<dl class="cart-item-breakdown"><div><dt>Producto base</dt><dd>${money(breakdown.base)}</dd></div><div><dt>Estampado · ${placement}</dt><dd>${breakdown.print?`+${money(breakdown.print)}`:'Incluido'}</dd></div>${breakdown.qualityReview?`<div><dt>Ajuste técnico</dt><dd>+${money(breakdown.review)}</dd></div>`:''}${item.quantity>1?`<div><dt>${item.quantity} unidades</dt><dd>${money(breakdown.unit)} c/u</dd></div>`:''}</dl>`}
function cartPrintConfigurationLabel(item){const sides=item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front');return printConfigurationLabel(item.printConfiguration,sides)}
function renderCart(){normalizeCartPrices();const target=document.querySelector('#cart-content');queueMicrotask(()=>{if(!account&&cart.length&&target.isConnected)showCartAccessGate(target)});if(!cart.length){target.innerHTML='<div class="cart-empty"><span>✳</span><h3>Aún no hay poleras aquí.</h3><p>Elige un diseño del catálogo o crea una polera desde cero.</p><div class="cart-empty-actions"><button type="button" class="button dark commerce-wide ds-cta" id="cart-choose">Elegir una polera <span aria-hidden="true">→</span></button><button type="button" class="cart-empty-create" id="cart-start">Crear mi polera</button></div></div>';document.querySelector('#cart-choose').onclick=()=>closeCartDrawer(()=>{location.hash='catalogo'});document.querySelector('#cart-start').onclick=()=>closeCartDrawer(()=>openStudio('ready'));return}const visibleItems=cartExpanded?cart:cart.slice(0,2),hiddenItems=Math.max(0,cart.length-visibleItems.length),itemLabel=cart.reduce((sum,item)=>sum+item.quantity,0)===1?'producto':'productos';target.innerHTML=`<div class="cart-overview"><strong>${cart.reduce((sum,item)=>sum+item.quantity,0)} ${itemLabel} en tu pedido</strong><span>Resumen antes de pagar</span></div><div class="cart-list cart-list--compact">${visibleItems.map(item=>`<article class="cart-item cart-item--compact"><div class="cart-art" style="--cart-color:${safe(item.color)}">${item.designPreview?`<img src="${safe(item.designPreview)}" alt="Diseño elegido">`:`<span>${safe(item.initial)}</span>`}</div><div class="cart-item-copy"><strong>${safe(cartProductLabel(item))}</strong><small>Talla ${safe(sizeLabel(item.modelCode,item.size))} · ${safe(cartColorLabel(item))} · ${safe(item.sides)}</small><small class="cart-item-placement">${safe(cartPrintConfigurationLabel(item))}</small>${cartBreakdownMarkup(item)}<button type="button" data-cart-remove="${safe(item.id)}">Quitar</button></div><div class="cart-price"><strong>${money(item.price*item.quantity)}</strong><div class="quantity"><button type="button" data-cart-quantity="${safe(item.id)}" data-change="-1" aria-label="Reducir cantidad">−</button><span>${item.quantity}</span><button type="button" data-cart-quantity="${safe(item.id)}" data-change="1" aria-label="Aumentar cantidad">+</button></div></div></article>`).join('')}</div>${hiddenItems?`<button type="button" class="cart-show-more" id="cart-show-more">Ver ${hiddenItems} diseño${hiddenItems===1?'':'s'} más <span aria-hidden="true">↓</span></button>`:''}${cartExpanded&&cart.length>2?'<button type="button" class="cart-show-more" id="cart-show-less">Mostrar resumen</button>':''}<div class="cart-total"><span>Subtotal productos</span><strong>${money(cartTotal())}</strong><div class="cart-total-detail"><span>Despacho</span><b>Por calcular</b></div><small>El total final será el subtotal de productos más el despacho calculado en el checkout.</small></div><button type="button" class="button dark commerce-wide ds-cta" id="cart-checkout">Continuar compra <span>→</span></button><button type="button" class="cart-keep-shopping" id="cart-keep-shopping">← Seguir comprando</button>`;target.querySelectorAll('.cart-art').forEach((art,index)=>{const current=visibleItems[index],preview=current?.catalogDesignCustomerImage?'':catalogPreviewForCart(current?.catalogDesignSlug,current?.modelCode);if(preview)art.innerHTML=`<img src="${safe(preview)}" alt="Diseño elegido">`});target.querySelectorAll('[data-cart-remove]').forEach(button=>button.onclick=()=>{cart=cart.filter(item=>item.id!==button.dataset.cartRemove);if(cart.length<=2)cartExpanded=false;saveLocal(CART_KEY,cart);updateCommerceNav();renderCart()});target.querySelectorAll('[data-cart-quantity]').forEach(button=>button.onclick=()=>{const item=cart.find(entry=>entry.id===button.dataset.cartQuantity);if(!item)return;item.quantity+=Number(button.dataset.change);if(item.quantity<1)cart=cart.filter(entry=>entry!==item);if(cart.length<=2)cartExpanded=false;saveLocal(CART_KEY,cart);updateCommerceNav();renderCart()});target.querySelector('#cart-show-more')?.addEventListener('click',()=>{cartExpanded=true;renderCart()});target.querySelector('#cart-show-less')?.addEventListener('click',()=>{cartExpanded=false;renderCart()});document.querySelector('#cart-keep-shopping').onclick=()=>closeCartDrawer();document.querySelector('#cart-checkout').onclick=()=>account?closeCartDrawer(()=>beginCheckout(false)):showCartAccessGate(target)}
document.querySelector('#cart-content').addEventListener('click',event=>{const id=event.target.closest('[data-cart-remove],[data-cart-quantity]')?.dataset.cartRemove||event.target.closest('[data-cart-quantity]')?.dataset.cartQuantity;if(id&&!cart.some(item=>item.id===id))removeCartDesignFiles(id).catch(()=>{})});
async function checkoutItems(withArtwork=true){const items=[];for(const item of cart){const artwork=withArtwork?await paymentArtworkFor(item,(await supabase.auth.getUser()).data.user?.id):{frontDesignPath:null,backDesignPath:null},printSides=item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front');items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides,printConfiguration:normalizePrintConfiguration(item.printConfiguration,printSides),quantity:item.quantity,qualityReview:effectiveQualityReview(item),variantId:item.variantId||null,catalogDesignSlug:item.catalogDesignSlug||null,catalogDesignCustomerImage:Boolean(item.catalogDesignCustomerImage),...artwork})}return items}
async function createCheckoutDraft(){
 const {data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw new Error('Inicia sesión o continúa como invitado antes de pagar.');
 const items=await checkoutItems(true);
 const payload={paymentMethod:'draft',draftOrderId:state.checkoutDraftId,items,couponCode:state.couponCode||null,fulfillment:state.fulfillment,shippingQuoteClp:state.shippingQuote?.amount??null,customer:{firstName:state.firstName,lastName:state.lastName,email:state.email,phone:state.phone},shippingAddress:state.fulfillment==='delivery'?{region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,notes:state.deliveryNotes}:null};
 const {data,error}=await supabase.functions.invoke('create-payment-preference',{body:payload});if(error||!data?.orderId)throw new Error(data?.error||await paymentFunctionError(error,'No pudimos registrar tu pedido en el admin.'));state.checkoutDraftId=data.orderId;persistDraft();return data;
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
 target.innerHTML=`<div class="mp-payment-head"><img class="mp-payment-logo" src="/mercado-pago-logo.svg" alt="Mercado Pago"><button type="button" class="close-button mp-payment-close ds-icon-button" aria-label="Cerrar confirmación de pago"><span aria-hidden="true"></span></button></div><div class="mp-payment-body"><span class="eyebrow">ELIGE CÓMO PAGAR</span><h2 id="payment-title">Revisa tu pedido.</h2><p class="mp-payment-lead">El despacho ya fue calculado. Confirmaremos el importe con los precios vigentes antes de crear tu pedido.</p><div class="mp-payment-summary"><span>${items} ${items===1?'producto':'productos'}<small>Despacho ${money(shipping)}</small></span><strong>${money(total)}</strong></div><div class="payment-methods" role="radiogroup" aria-label="Medio de pago"><label class="payment-method is-selected"><input type="radio" name="payment-method" value="mercado_pago" checked><span><strong>Mercado Pago</strong><small>Tarjetas, transferencia y otros medios disponibles en Checkout Pro.</small></span></label><label class="payment-method"><input type="radio" name="payment-method" value="transfer" data-available="false" disabled><span><strong>Transferencia bancaria</strong><small data-transfer-availability>Comprobando disponibilidad…</small></span></label></div><p class="mp-payment-error" role="alert" hidden></p><button type="button" class="button mp-payment-button" id="continue-to-payment">Continuar a Mercado Pago</button><p class="mp-payment-wait" id="payment-wait-status" role="status" aria-live="polite" hidden></p><small class="mp-payment-legal">Comenzaremos a preparar tu pedido cuando confirmemos el pago.</small></div>`;
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
accountButton.onclick=()=>{renderAccount(account?'orders':'register');accountModal.showModal()};headerLogoutButton.onclick=event=>signOutAccount(event.currentTarget);cartButton.onclick=()=>{renderCart();cartModal.showModal()};document.querySelectorAll('[data-commerce-close]').forEach(button=>button.onclick=()=>button.closest('#cart-modal')?closeCartDrawer():button.closest('dialog').close());accountModal.addEventListener('close',()=>{stopAccountOrdersWatch();if(!account)resumeCheckoutAfterAuth=false});updateCommerceNav();supabase.auth.getUser().then(({data})=>{account=accountFromUser(data.user);updateCommerceNav()});supabase.auth.onAuthStateChange((event,session)=>{const nextAccount=accountFromUser(session?.user);if(account?.id!==nextAccount?.id)state.cloudSaved={front:false,back:false};account=nextAccount;updateCommerceNav();if(event==='PASSWORD_RECOVERY'){renderAccount('update-password');if(!accountModal.open)accountModal.showModal()}});
const requestedCommercePanel=new URLSearchParams(location.search).get('panel');if(requestedCommercePanel==='account'||requestedCommercePanel==='cart'){const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('panel');history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);queueMicrotask(()=>requestedCommercePanel==='account'?accountButton.click():cartButton.click())}
if(expiredConfirmationLink()){clearExpiredConfirmationLink();queueMicrotask(()=>{renderAccount('expired',state.email);accountModal.showModal()})}
document.querySelectorAll('.garment-meta > span').forEach(el=>el.textContent='Elige en el estudio');
document.querySelector('.price-note')?.remove();
document.querySelector('.how')?.remove();
const faqIntro=document.querySelector('.faq-intro');if(faqIntro){faqIntro.querySelector('.eyebrow').textContent='COMPRA CON CLARIDAD';faqIntro.querySelector('h2').textContent='Todo para elegir tu diseño.';faqIntro.querySelector('p').textContent='Resolvemos lo esencial antes de que personalices.';faqIntro.querySelector('.faq-facts').innerHTML='<span>Diseños originales</span><span>Productos disponibles</span><span>Despachos en Chile</span>'}
const faqs=[
 ['¿Cómo elijo un diseño?','Parte por Colecciones para descubrir una temática. Luego abre Diseños para comparar las piezas disponibles y elegir la que quieres personalizar.'],
 ['¿Qué productos puedo personalizar?','En Productos verás solo las opciones activas. Al elegir una, el catálogo muestra los diseños que tienen un mockup disponible para ese producto.'],
 ['¿Cómo sé si un diseño sirve para el producto que quiero?','Cada diseño muestra sus productos compatibles. También puedes usar el filtro Productos para ver únicamente los diseños disponibles para Poleras, Bodys o Totebags.'],
 ['¿Puedo personalizar el diseño que elija?','Sí. Abre “Personalizar este diseño” y selecciona las opciones disponibles antes de agregarlo a tu pedido.'],
 ['¿Hacen despachos a regiones?','Sí. Coordinamos despachos dentro de Chile. El costo y el plazo se calculan antes de pagar, según tu dirección y tu pedido.'],
 ['¿Qué medios de pago aceptan?','Puedes pagar de forma segura con Mercado Pago. Verás el total del pedido y el despacho antes de confirmar el pago.']
];
const faqList=document.querySelector('.faq-list');if(faqList){faqList.replaceChildren(...faqs.map(([question,answer])=>{const item=document.createElement('details'),summary=document.createElement('summary'),toggle=document.createElement('span'),copy=document.createElement('p');summary.append(question,Object.assign(toggle,{textContent:'+'}));copy.textContent=answer;item.append(summary,copy);return item}));faqList.querySelectorAll('details').forEach(item=>item.addEventListener('toggle',()=>{if(!item.open)return;faqList.querySelectorAll('details[open]').forEach(other=>{if(other!==item)other.open=false})}))}
const ticker=document.querySelector('.ticker');if(ticker){const items=[...ticker.childNodes].map(node=>node.cloneNode(true));const track=document.createElement('div');track.className='ticker-track';track.append(...items,...items.map(node=>node.cloneNode(true)));ticker.replaceChildren(track)}
const designPath=document.querySelector('.path[data-start="ready"]');if(designPath){const title=designPath.querySelector('h3');const copy=designPath.querySelector('p');if(title)title.innerHTML='Sube, mira,<br>decide.';if(copy)copy.textContent='Comprueba cómo se ve tu diseño sobre la polera antes de elegir.';const flow=document.createElement('div');flow.className='design-flow';flow.innerHTML='<span><b>01</b> Sube</span><i>→</i><span><b>02</b> Mira en 3D</span><i>→</i><span><b>03</b> Elige</span>';copy?.after(flow);const link=designPath.querySelector('.text-link');if(link)link.innerHTML='Subir mi diseño <span>↗</span>';designPath.remove()}
const whatsappFloat=document.createElement('a');whatsappFloat.className='whatsapp-float';whatsappFloat.href='https://wa.me/56965217926';whatsappFloat.target='_blank';whatsappFloat.rel='noreferrer';whatsappFloat.setAttribute('aria-label','Abrir chat de ayuda');whatsappFloat.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.7-.8L4 20l1.5-3.7A7.2 7.2 0 0 1 4 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z"/><circle cx="8.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="15.5" cy="12" r=".8"/></svg><span>¿Dudas?</span>';document.body.append(whatsappFloat);
const footerCatalog=document.querySelector('.footer-catalog');
function renderFooterCatalog(){
 footerCatalog.replaceChildren();
 const title=document.createElement('strong');title.textContent='Catálogo';footerCatalog.append(title);
 const visibleProducts=homeCatalogProducts.length?homeCatalogProducts:[{slug:'poleras',name:'Poleras'}];
 const appendGroup=(label,entries)=>{if(!entries.length)return;const group=document.createElement('section');group.className='footer-catalog-group';const heading=document.createElement('strong');heading.textContent=label;group.append(heading,...entries);footerCatalog.append(group)};
 appendGroup('Productos',visibleProducts.map(product=>{const link=document.createElement('a');link.href=catalogProductPath(product.slug);link.textContent=product.name;return link}));
 appendGroup('Colecciones',collections.map(collection=>{const link=document.createElement('a');link.href=catalogCollectionPath(collection.productSlug||'poleras',collection.id);link.textContent=collection.label;return link}));
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
const studio=document.querySelector('#studio');const fullscreenViewerDialog=document.querySelector('#fullscreen-viewer');let viewer,viewerPromise,viewerKind=null,viewerVersion=0,fullscreenViewer,fullscreenViewerVersion=0,productTransitionVersion=0,introTurn=null,introSession=0,introInteracted=false;const uploadVersions={front:0,back:0};
const introReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const cancelIntroTurn=()=>{introInteracted=true;introTurn?.cancel()};
studio.addEventListener('pointerdown',cancelIntroTurn,{passive:true});
studio.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))cancelIntroTurn()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelIntroTurn()});
introReducedMotion.addEventListener?.('change',event=>{if(event.matches)cancelIntroTurn()});
studio.addEventListener('close',()=>{cancelIntroTurn();introSession++;closeFullscreenViewer()});
const previewFallbackTemplate=document.querySelector('.preview-fallback')?.cloneNode(true);
document.querySelector('.preview-fallback')?.setAttribute('hidden','');
const previewLoading=document.createElement('div');
previewLoading.id='studio-viewer-loading';
previewLoading.className='studio-viewer-loading';
previewLoading.setAttribute('role','status');
previewLoading.innerHTML='<span class="studio-viewer-spinner" aria-hidden="true"></span><span>Preparando vista 3D…</span>';
previewLoading.hidden=true;
document.querySelector('#live-preview')?.append(previewLoading);
function setPreviewLoading(loading){
 if(previewLoading)previewLoading.hidden=!loading;
 const container=document.querySelector('#viewer');
 if(container)container.setAttribute('aria-busy',String(loading));
}
function showPreviewLoading(){
 document.querySelector('#viewer')?.replaceChildren();
 setPreviewLoading(true);
}
document.querySelector('#viewer').addEventListener('viewer-ready',event=>{
 const canvas=event.detail?.canvas;
 if(canvas!==document.querySelector('#viewer canvas'))return;
 const finish=()=>{if(canvas===document.querySelector('#viewer canvas'))setPreviewLoading(false)};
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
 canvas.addEventListener('transitionend',transition=>{if(transition.propertyName==='opacity')finish()},{once:true});
 setTimeout(finish,800);
});
function showPreviewFallback(preview){
 const container=document.querySelector('#viewer');
 if(!container||!previewFallbackTemplate)return;
 const shell=previewFallbackTemplate.cloneNode(true);
 shell.hidden=false;
 shell.classList.toggle('body-fallback',preview.kind==='body');
 shell.style.setProperty('--shirt',preview.color||'#f4f0e5');
 const image=shell.querySelector('img');
 if(image){image.hidden=!preview.image;image.alt=preview.kind==='body'?'Tu diseño sobre el body':'Tu diseño sobre la polera';if(preview.image)image.src=preview.image}
 container.replaceChildren(shell);
 setPreviewLoading(false);
}
document.querySelector('#viewer').addEventListener('preview-error',()=>toast('No pudimos mostrar ese estampado. Prueba reemplazando el archivo.'));
const colorDock=document.createElement('div');colorDock.className='color-dock';colorDock.innerHTML='<span>COLOR</span>';
const sizeDock=document.createElement('div');sizeDock.className='size-dock';sizeDock.innerHTML='<span>TAMAÑO</span><input id="print-scale" type="range" min="0.55" max="1.70" step="0.01" value="1" aria-label="Tamaño del estampado" title="Tamaño calculado automáticamente"><output id="print-scale-value">100%</output>';
const catalogDesignLocked=()=>Boolean(state.catalogDesign);
const maxPrintScale=()=>catalogDesignLocked()?CATALOG_ARTWORK_SCALE:state.isDefault?1:USER_ARTWORK_SCALE;
const closestPrintSize=scale=>Object.entries(PRINT_SIZE_SCALE).sort((a,b)=>Math.abs(a[1]-scale)-Math.abs(b[1]-scale))[0][0];
const activeAdditionalPrint=()=>state.additionalPrints.find(item=>item.id===state.activePrintId)||null;
const activePrintConfiguration=()=>activeAdditionalPrint()?.configuration||(state.printConfigurations[state.printSide]||(state.printConfigurations[state.printSide]=defaultPrintSideConfiguration(state.printSide)));
const syncScaleControl=()=>{const input=sizeDock.querySelector('input'),config=activePrintConfiguration(),max=maxPrintScale();input.max=max.toFixed(2);state.printScale=Math.min(Number(config.scale)||PRINT_SIZE_SCALE[config.size],max);config.scale=state.printScale;config.size=closestPrintSize(state.printScale);input.value=state.printScale;sizeDock.querySelector('output').textContent=Math.round(state.printScale*100)+'%';input.title=`Tamaño solicitado: ${Math.round(state.printScale*100)}% · el visor lo ajusta si excede la polera · estampado hasta 28 × 40 cm`};
sizeDock.querySelector('input').oninput=e=>{const config=activePrintConfiguration();state.printScale=Math.min(Number(e.target.value),maxPrintScale());config.scale=state.printScale;config.size=closestPrintSize(state.printScale);syncScaleControl();viewer?.update(previewState());persistDraft()};
document.querySelector('.path[data-start="improve"]')?.remove();
const howCatalogLink=document.querySelector('.how .text-link[href="#caminos"]');if(howCatalogLink){howCatalogLink.href='#catalogo';howCatalogLink.textContent='Explorar diseños ↗'}
const footerHowLink=document.querySelector('.footer-how-link[href="#caminos"]');if(footerHowLink){footerHowLink.href='#catalogo';footerHowLink.innerHTML='Explorar catálogo <span aria-hidden="true">↗</span>'}
document.querySelector('#caminos')?.remove();
const pathsIntro=document.querySelector('#caminos .section-heading p');if(pathsIntro)pathsIntro.innerHTML='Un camino para llegar<br>a tu polera favorita.';const ideaPath=document.querySelector('.path[data-start="custom"] .path-top');if(ideaPath&&ideaPath.firstChild)ideaPath.firstChild.textContent='01 / MI IDEA ';
const ideaCard=document.querySelector('.path[data-start="custom"]');if(ideaCard){const ideaCopy=ideaCard.querySelector('p');if(ideaCopy)ideaCopy.outerHTML='<div class="path-stepper"><div><b>01</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6M4 20l3-7L17 3l4 4L11 17l-7 3Zm2-6 4 4M5 5h3M6.5 3.5v3M18 14h3M19.5 12.5v3"/></svg></i><span>Trae tu idea.<small>Una foto, un dibujo o un diseño hecho con IA.</small></span></div><div><b>02</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg></i><span>Sube tu archivo al estudio.</span></div><div><b>03</b><i class="step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 20l1.8-4A8 8 0 1 1 21 11Z"/></svg></i><span>Lo afinamos contigo.</span></div></div>';ideaCard.querySelector('.path-art')?.insertAdjacentHTML('beforeend','<img class="custom-doodles" src="/idea-collage.png" alt=""><img class="custom-shirt-image" src="/idea-shirt.png" alt="Ejemplo de polera personalizada">')}
const ideaLink=document.querySelector('.path[data-start="custom"] .text-link');if(ideaLink)ideaLink.innerHTML='Empezar mi idea <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const primaryCtaMarkup='Empezar mi idea <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
document.querySelector('.hero-personalize')?.remove();
const primaryCtas=[...document.querySelectorAll('.nav-cta[data-start],.hero-copy [data-start],.closing [data-start]')];
primaryCtas.forEach(cta=>{cta.classList.add('primary-idea-cta');cta.dataset.start='ready';cta.innerHTML=primaryCtaMarkup});
ideaLink?.classList.add('primary-idea-cta');
function previewState(){
 const extra=activeAdditionalPrint();
 if(!extra)return studioPreviewState(state,DEFAULT_PLACEHOLDER_IMAGE);
 return studioPreviewState({...state,printSide:extra.side,images:{...state.images,[extra.side]:extra.image},assessments:{...state.assessments,[extra.side]:extra.assessment},printConfigurations:{...state.printConfigurations,[extra.side]:extra.configuration}},DEFAULT_PLACEHOLDER_IMAGE)
}
function updateFullscreenZoomStatus(){const status=document.querySelector('#fullscreen-zoom-status'),value=fullscreenViewer?.zoomPercent?.();if(status&&Number.isFinite(value))status.value=`${value}%`}
function disposeFullscreenViewer(){fullscreenViewerVersion++;fullscreenViewer?.dispose();fullscreenViewer=null;document.querySelector('#fullscreen-viewer-canvas')?.replaceChildren()}
function closeFullscreenViewer(){if(fullscreenViewerDialog?.open)fullscreenViewerDialog.close();else disposeFullscreenViewer()}
async function openFullscreenViewer(){
 const renderState=previewState();
 if(!renderState.image)return;
 const host=document.querySelector('#fullscreen-viewer-canvas');
 const wantedKind=state.kind==='tote'?'tote':'shirt';
 disposeFullscreenViewer();
 const version=fullscreenViewerVersion;
 host.replaceChildren(Object.assign(document.createElement('span'),{textContent:'Preparando vista…'}));
 openDialog(fullscreenViewerDialog);
 try{
  const module=await import(wantedKind==='tote'?'./tote-viewer.js':'./garment.js');
  const created=wantedKind==='tote'?await module.createToteViewer(host,renderState,{minDistance:2.8}):await module.createViewer(host,renderState,{cameraDistance:5.8,minDistance:3.15});
  if(version!==fullscreenViewerVersion||!fullscreenViewerDialog.open){created.dispose();return}
  fullscreenViewer=created;
  created.face(state.printSide);
  created.resize();
  updateFullscreenZoomStatus();
 }catch(error){
  if(version===fullscreenViewerVersion){host.replaceChildren(Object.assign(document.createElement('p'),{className:'fullscreen-viewer-error',textContent:'No pudimos abrir la vista 3D. Vuelve a intentarlo.'}));console.warn('No pudimos abrir la vista ampliada:',error)}
 }
}
document.querySelector('#open-fullscreen-viewer')?.addEventListener('click',openFullscreenViewer);
document.querySelector('#close-fullscreen-viewer')?.addEventListener('click',closeFullscreenViewer);
document.querySelector('#fullscreen-zoom-out')?.addEventListener('click',()=>{fullscreenViewer?.zoomBy(.65);updateFullscreenZoomStatus()});
document.querySelector('#fullscreen-zoom-in')?.addEventListener('click',()=>{fullscreenViewer?.zoomBy(-.65);updateFullscreenZoomStatus()});
document.querySelector('#fullscreen-reset-view')?.addEventListener('click',()=>{fullscreenViewer?.reset();updateFullscreenZoomStatus()});
fullscreenViewerDialog?.addEventListener('close',disposeFullscreenViewer);
function syncPreview(){
 const checkoutPreview=document.querySelector('#checkout-cart-preview');
 if(state.step===3&&!state.catalogDesignCustomerImage){document.querySelector('#reference-panel').hidden=true;document.querySelector('#live-preview').hidden=true;renderCheckoutCartPreview();checkoutPreview.hidden=false;return}
 if(checkoutPreview)checkoutPreview.hidden=true;
 const petPlaceholder=Boolean(state.catalogDesignCustomerImage);
 const sideImage=activeAdditionalPrint()?.image||state.images?.[state.printSide]||'';
 const catalogPreviewReady=Boolean(catalogDesignLocked()&&sideImage);
 const showSample=Boolean(!petPlaceholder&&state.isDefault&&!state.catalogDesign&&!sideImage);
 const isForging=!petPlaceholder&&!sideImage&&!showSample&&!catalogPreviewReady,showMockup=Boolean(petPlaceholder||sideImage||showSample),renderState=petPlaceholder?previewState():isForging?{...state,image:'',assessment:null,isDefault:false}:previewState();
 const livePreview=document.querySelector('#live-preview');livePreview.hidden=!(isForging||showMockup);livePreview.classList.toggle('is-forging',isForging);
 let story=livePreview.querySelector('.studio-personalization-story');
 const personalizedDesign=state.catalogDesignCustomerImage&&selectedCatalogDesign();
 if(personalizedDesign&&sideImage){
  if(!story){story=document.createElement('div');story.className='studio-personalization-story';livePreview.append(story)}
  const storyKey=JSON.stringify([personalizedDesign.id,personalizedDesign.customerPhotoSubject,personalizedDesign.personalizationArrow]);
  if(story.dataset.key!==storyKey){story.innerHTML=catalogPetStory(personalizedDesign.personalizationArrow,personalizedDesign.customerPhotoSubject,true);story.dataset.key=storyKey}
 }else story?.remove();
 const liveEyebrow=livePreview.querySelector(':scope > .eyebrow');if(liveEyebrow){liveEyebrow.hidden=false;liveEyebrow.textContent=catalogPreviewReady?`TU DISEÑO ELEGIDO, EN ${state.kind==='tote'?'LA TOTE BAG':state.kind==='body'?'EL BODY':'LA POLERA'}`:'UNA VISTA A TU PRÓXIMA FAVORITA'}
 let effects=livePreview.querySelector('.forge-3d-effects');
 if(!effects){const particles=Array.from({length:34},(_,index)=>`<i style="--i:${index};--x:${5+(index*37)%90}%;--y:${8+(index*53)%84}%;--s:${3+(index%5)*1.4}px;--drift:${-34+(index*29)%68}px;--duration:${2.6+(index%6)*.28}s"></i>`).join('');livePreview.insertAdjacentHTML('beforeend',`<div class="forge-3d-effects" aria-hidden="true"><div class="forge-3d-halo"></div><div class="forge-3d-scan"></div><div class="forge-3d-particles">${particles}</div><div class="forge-3d-status"><span></span><div><strong></strong><small></small></div></div></div>`);effects=livePreview.querySelector('.forge-3d-effects')}
 effects.hidden=!isForging;if(isForging){effects.querySelector('strong').textContent=sideImage?'Afinando tu mockup…':'Tu próxima polera empieza acá.';effects.querySelector('small').textContent=sideImage?'Te mostraremos una vista previa al terminar la revisión.':'Sube tu diseño y míralo tomar forma en este lienzo.'}
 const panel=document.querySelector('#reference-panel');panel.hidden=true;panel.replaceChildren();
 const fallbackShell=document.querySelector('.preview-fallback');
 if(fallbackShell){fallbackShell.classList.toggle('body-fallback',state.kind==='body');fallbackShell.style.setProperty('--shirt',state.color);const fallback=fallbackShell.querySelector('img');if(fallback){fallback.hidden=!renderState.image;fallback.alt=state.kind==='body'?'Tu diseño sobre el body':'Tu diseño sobre la polera';if(!fallback.hidden)fallback.src=renderState.image}}
 if((isForging||showMockup)&&studio.open){const wantedKind=state.kind==='tote'?'tote':'shirt';if(viewerKind!==wantedKind){viewer?.dispose();viewer=null;viewerPromise=null;introTurn=null;viewerKind=wantedKind;viewerVersion++;showPreviewLoading()}viewer?.update(renderState);if(!viewerPromise){const version=viewerVersion,session=introSession;viewerPromise=import(wantedKind==='tote'?'./tote-viewer.js':'./garment.js').then(async m=>{const created=wantedKind==='tote'?await m.createToteViewer(document.querySelector('#viewer'),renderState):await m.createViewer(document.querySelector('#viewer'),renderState,{cameraDistance:4.9});if(version!==viewerVersion){created.dispose();return null}viewer=created;introTurn=createIntroTurn({turn:created.turn,reducedMotion:()=>introReducedMotion.matches});requestAnimationFrame(()=>requestAnimationFrame(()=>{if(session===introSession&&!introInteracted&&studio.open&&viewer===created)introTurn.start()}));return viewer}).catch(()=>{if(version===viewerVersion){viewerPromise=null;showPreviewFallback(renderState);toast('El visor 3D no está disponible en este navegador.','error')}return null})}
 viewerPromise?.then(created=>{created?.update(renderState);created?.resize()})}
 if(fullscreenViewerDialog?.open)fullscreenViewer?.update(renderState);
}
function renderCheckoutCartPreview(){normalizeCartPrices();const target=document.querySelector('#checkout-cart-preview');if(!target)return;const items=cart,itemCount=cart.reduce((sum,item)=>sum+item.quantity,0),designCount=cart.length,shipping=state.shippingQuote?.amount,hasQuote=Boolean(state.shippingQuote),total=cartTotal()+(shipping||0)-state.couponDiscount,couponSummary=state.couponDiscount?`−${money(state.couponDiscount)}`:'Disponible';target.innerHTML=`<span class="eyebrow">TU PEDIDO · ${designCount} ${designCount===1?'DISEÑO':'DISEÑOS'} · ${itemCount} ${itemCount===1?'PRODUCTO':'PRODUCTOS'}</span><h3>Resumen del pedido</h3><div class="checkout-cart-preview-list">${items.map((item,index)=>{const image=item.catalogDesignCustomerImage?'':catalogPreviewForCart(item.catalogDesignSlug,item.modelCode)||item.designPreview,breakdown=cartItemBreakdown(item);return `<article><div class="checkout-cart-preview-art" style="--cart-color:${safe(item.color)}">${image?`<img src="${safe(image)}" alt="Diseño ${index+1} de tu pedido">`:`<span>${safe(item.initial)}</span>`}</div><div><strong>${safe(cartProductLabel(item))}</strong><small>Talla ${safe(sizeLabel(item.modelCode,item.size))} · ${safe(cartColorLabel(item))} · ${safe(item.sides)} · ${item.quantity} ${item.quantity===1?'unidad':'unidades'}</small><small class="cart-item-placement">${safe(cartPrintConfigurationLabel(item))}</small>${cartBreakdownMarkup(item)}<div class="checkout-cart-line-total"><span>Total del producto</span><b>${money(breakdown.line)}</b></div></div></article>`}).join('')}</div><div class="checkout-cart-preview-total"><table><tbody><tr><th scope="row">Subtotal de productos</th><td>${money(cartTotal())}</td></tr><tr><th scope="row">Despacho</th><td>${hasQuote?(shipping?money(shipping):'Gratis'):'Por calcular'}</td></tr><tr class="checkout-cart-preview-coupon"><th scope="row">Cupón de descuento</th><td>${couponSummary}</td></tr>${hasQuote?`<tr class="checkout-cart-preview-grand-total"><th scope="row">Total</th><td>${money(total)}</td></tr>`:''}</tbody></table></div>`}
function openStudio(mode='choose',kind){state.mode=mode;state.cartItemId=null;state.checkoutAsGuest=false;introSession++;introInteracted=false;introTurn?.reset();introTurn=null;if(kind){state.kind=kind;state.size=products[kind].sizes[0]}state.step=1;studio.showModal();document.body.classList.add('locked');renderStep();loadProductPrices()}
function resetIdea(){
 detailsDisclosure=createDisclosureState();detailsDisclosureScope='own';publicFlowStates.clear();state.referencesBusy=false;
 state.catalogDesignCustomerImage=false;
 state.catalogDesignPurchaseMode='base';
 state.catalogDesignName=null;
 try{localStorage.removeItem(CATALOG_DRAFT_KEY)}catch{}
 [...Object.values(state.images),...state.references.map(reference=>reference.url)].forEach(url=>{if(url?.startsWith('blob:'))URL.revokeObjectURL(url)});
 Object.assign(state,{mode:'choose',kind:'basic',size:'M',color:'#ffffff',variantId:null,image:'',images:{front:'',back:''},files:{front:'',back:''},uploadFiles:{front:null,back:null},cloudSaved:{front:false,back:false},additionalPrints:[],activePrintId:null,references:[],creativeRequestId:crypto.randomUUID(),creativeOrderId:null,uploaded:false,isDefault:true,file:'',catalogDesign:null,catalogDesignSlug:null,assessment:null,assessments:{front:null,back:null},printSide:'front',printSides:[],printScale:1,printConfigurations:{front:defaultPrintSideConfiguration('front'),back:defaultPrintSideConfiguration('back')},printAdjustmentsOpen:false,checking:false,checkingSide:'',artworkTone:'',qualityAccepted:false,qualityReview:false,customIdea:'',customName:'',customEmail:'',customPhone:'',customSubmitted:false,customChannel:null});
}
function beginIdea(){resetIdea();openStudio('choose')}
document.querySelector('[data-bring-design]')?.addEventListener('click',beginIdea);
document.querySelectorAll('[data-start]').forEach(button=>button.onclick=()=>beginIdea());
const catalogSection=document.createElement('section');
catalogSection.id='catalogo';
catalogSection.className='section ready-catalog';
catalogSection.setAttribute('aria-labelledby','catalog-title');
catalogSection.innerHTML=`<div class="section-heading catalog-heading"><div><span class="eyebrow">DISEÑOS LISTOS PARA ELEGIR</span><h2 id="catalog-title">Explora diseños originales.</h2></div><p>Elige uno y personalízalo a tu pinta.</p></div><div class="catalog-actions"></div><div class="catalog-results-bar"><p class="catalog-count" aria-live="polite" aria-atomic="true"></p><button type="button" class="catalog-reset" hidden>Limpiar filtros <span aria-hidden="true">↺</span></button></div><div class="catalog-grid"></div>`;
document.querySelector('.ticker').after(catalogSection);
const trustStrip=document.createElement('section');
trustStrip.className='trust-strip';
trustStrip.setAttribute('aria-label','Beneficios de comprar en droska SHIRT');
trustStrip.innerHTML=`<ul><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 8C23 9 12 17 10 34c12 2 23-5 29-26Z"/><path d="M8 41c7-11 14-18 25-25"/></svg><span><strong>Diseños originales</strong><small>Creaciones exclusivas Droska.</small></span></li><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 12h23v22H6zM29 21h7l6 7v6H29z"/><circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/></svg><span><strong>Despachos a todo Chile</strong><small>Rápido y seguro.</small></span></li><li><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5c5 4 10 6 16 7v11c0 10-6 17-16 21C14 40 8 33 8 23V12c6-1 11-3 16-7Z"/><path d="m17 24 5 5 10-11"/></svg><span><strong>Compra segura</strong><small>Tus datos siempre protegidos.</small></span></li></ul>`;
catalogSection.before(trustStrip);
let dropExplore=null;
if(useDropWall){
document.querySelector('.drop-intro').after(catalogSection);
catalogSection.after(trustStrip);
dropExplore=document.createElement('section');
dropExplore.className='drop-explore';
dropExplore.setAttribute('aria-labelledby','drop-explore-title');
dropExplore.innerHTML='<div class="drop-explore-heading"><h2 id="drop-explore-title">Diseños por explorar</h2><span aria-hidden="true"></span><button type="button" data-explore-all>Ver todos los diseños <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></div><div class="drop-explore-track"></div>';
catalogSection.after(dropExplore);
dropExplore.addEventListener('click',event=>{
 if(event.target.closest('[data-explore-all]')){
  catalogFilterMode='designs';catalogView='designs';
  renderCatalogWithMotion().then(()=>{catalogSection.querySelector('[data-catalog-view="designs"]')?.focus();catalogSection.scrollIntoView({behavior:introReducedMotion.matches?'auto':'smooth'})});
  return;
 }
 const button=event.target.closest('[data-explore-design]');
 if(!button)return;
 const design=catalogDesigns.find(item=>item.id===button.dataset.exploreDesign);
 const collection=collections.find(item=>item.id===design?.collection);
 if(design&&collection)openCatalogDesign(design,collection);
});

document.querySelector('.ticker').remove();
document.body.classList.add('drop-wall-enabled');
document.querySelector('main').prepend(document.querySelector('.drop-intro-decor'));
const pageDots=document.createElement('div');pageDots.className='drop-page-dots';pageDots.setAttribute('aria-hidden','true');document.body.prepend(pageDots);
}
const catalogDialog=document.createElement('dialog');
catalogDialog.className='catalog-dialog';
catalogDialog.setAttribute('aria-labelledby','catalog-dialog-title');
catalogDialog.innerHTML=`<div class="catalog-dialog-shell"><header class="catalog-dialog-head"><div><span class="eyebrow">DISEÑOS DE LA COLECCIÓN</span><h2 id="catalog-dialog-title"></h2><p class="catalog-dialog-count"></p></div><button type="button" class="catalog-dialog-close ds-icon-button close-button" data-close aria-label="Cerrar colección"><span aria-hidden="true"></span></button></header><div class="catalog-dialog-body"><div class="catalog-dialog-grid"></div><p class="catalog-dialog-note">Elige un diseño para abrirlo en el estudio. Después podrás seleccionar modelo, talla y ubicación del estampado.</p></div></div>`;
document.body.append(catalogDialog);
const designDialog=document.createElement('dialog');
designDialog.className='catalog-dialog catalog-design-dialog catalog-dialog--single';
designDialog.setAttribute('aria-labelledby','catalog-design-dialog-title');
designDialog.innerHTML=`<div class="catalog-dialog-shell"><header class="catalog-dialog-head"><div><span class="eyebrow">DISEÑO DE LA COLECCIÓN</span><h2 id="catalog-design-dialog-title"></h2><p class="catalog-design-dialog-collection"></p></div><button type="button" class="catalog-dialog-close ds-icon-button close-button" data-close aria-label="Cerrar diseño"><span aria-hidden="true"></span></button></header><div class="catalog-dialog-body"><div class="catalog-dialog-grid"></div><button type="button" class="catalog-view-all" data-view-collection>Ver toda la colección <span aria-hidden="true">→</span></button></div></div>`;
document.body.append(designDialog);
document.querySelector('.closing p').textContent='Parte con un diseño del catálogo o crea el tuyo desde cero. A tu pinta.';
let catalogAvailable=false;
let catalogMotionPending=false;
function catalogPetArrow(focus,variant='main',fromRight=Number(focus?.x??50)<50){
 const x=Number(focus?.x??50),y=Number(focus?.y??50);
 const startX=fromRight?80:20,startY=64;
 const controlX=(startX+x)/2,controlY=Math.max(startY,y)+22;
 const angle=Math.atan2(y-controlY,x-controlX),head=3.6;
 const leftX=x-head*Math.cos(angle-.6),leftY=y-head*Math.sin(angle-.6);
 const rightX=x-head*Math.cos(angle+.6),rightY=y-head*Math.sin(angle+.6);
 const path=`M${startX} ${startY} Q${controlX} ${controlY} ${x} ${y} M${leftX} ${leftY} L${x} ${y} ${rightX} ${rightY}`;
 return `<svg class="catalog-pet-arrow catalog-pet-arrow--${variant}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="catalog-pet-arrow-outline" d="${path}"/><path d="${path}"/></svg>`;
}
function catalogPetStory(arrowFocus,subject='pets',centerArrow=false){
 const fromRight=Number(arrowFocus?.x??50)<50;
 if(subject==='people')return `<div class="catalog-pet-story${fromRight?' catalog-pet-story--right':''}" aria-hidden="true"><div class="catalog-pet-polaroid catalog-pet-polaroid--dog"><span class="catalog-person-photo"><img src="/people-reference-diptych.webp" alt="" loading="lazy"></span><span>Tu familia</span></div><div class="catalog-pet-polaroid catalog-pet-polaroid--cat"><span class="catalog-person-photo catalog-person-photo--second"><img src="/people-reference-diptych.webp" alt="" loading="lazy"></span><span>Tus amigos</span></div>${catalogPetArrow(centerArrow?{x:50,y:50}:arrowFocus,'main',fromRight)}</div><span class="sr-only">Ejemplo visual: fotos de familiares o amigos apuntan al diseño final. Puedes usar una foto de colegas también.</span>`;
 return `<div class="catalog-pet-story${fromRight?' catalog-pet-story--right':''}" aria-hidden="true"><div class="catalog-pet-polaroid catalog-pet-polaroid--dog"><img src="/pet-reference-dog.webp" alt="" loading="lazy"><span>Tu perro</span></div><div class="catalog-pet-polaroid catalog-pet-polaroid--cat"><img src="/pet-reference-cat.webp" alt="" loading="lazy"><span>Tu gato</span></div>${catalogPetArrow(centerArrow?{x:50,y:50}:arrowFocus,'main',fromRight)}</div><span class="sr-only">Ejemplo visual: fotos separadas de tu perro y tu gato apuntan al diseño final.</span>`;
}
const catalogProductFamily=slug=>({poleras:'men',bodys:'body',totebags:'tote'})[slug];
const catalogProductName=slug=>catalogProducts.find(product=>product.slug===slug)?.name||({poleras:'Poleras',bodys:'Bodys',totebags:'Totebags'})[slug]||slug;
function catalogCardProduct(designs,cardKey,defaultSlug=''){
 const options=catalogProductOptions(catalogProducts,designs);
 const requested=catalogCardProducts.get(cardKey)||(selectedCatalogProduct!=='all'?selectedCatalogProduct:'')||defaultSlug;
 const selected=options.some(product=>product.slug===requested)?requested:(options[0]?.slug||'');
 return {options,selected};
}
function catalogProductBadges(designs,selected,cardKey){
 return catalogProductToggleMarkup({products:catalogProductOptions(catalogProducts,designs),selected,cardKey});
}
function catalogMissingMockup(design){
 const product=catalogProductName(design.previewProductSlug);
 return `<div class="catalog-missing-mockup">${productFamilyIcon(catalogProductFamily(design.previewProductSlug))}<strong>${safe(product)}</strong><span>Mockup pendiente</span><small>Vista del diseño para este producto</small>${artworkUrl(design)?`<img src="${safe(artworkUrl(design))}" alt="Diseño ${safe(design.name)} sin mockup de ${safe(product)}" loading="lazy">`:''}</div>`;
}
function catalogPreviewDesign(design,defaultSlug,productSlug=selectedCatalogProduct){return designWithProductMockup(design,productSlug,defaultSlug,catalogProducts.filter(product=>product.active!==false).map(product=>product.slug))}
function catalogDesignCard(design,index,collection,preferredProduct='',wall=false,wallFeatured=false){
 const sourceDesign=design;
 const cardKey=`design:${design.id}`;
 const productChoice=catalogCardProduct([design],cardKey,preferredProduct||collection?.productSlug);
 design=catalogPreviewDesign(design,collection?.productSlug,productChoice.selected);
 const productSlug=design.previewProductSlug;
 const commerceSupported=['poleras','bodys','totebags'].includes(productSlug);
 const chooseLabel=!commerceSupported?'Próximamente':design.name==='Laika Kauiju'?'Coloca a tu mascota':'Personalizar este diseño';
 const mainFocus=design.mockupFocus||{x:50,y:50};
 const hoverFocus=design.mockupHoverFocus||{x:50,y:50};
 const personalizationArrow=design.personalizationArrow||{x:50,y:50};
 const mainFocusStyle=`--catalog-focus-x:${mainFocus.x}%;--catalog-focus-y:${mainFocus.y}%`;
 const hoverFocusStyle=`--catalog-hover-focus-x:${hoverFocus.x}%;--catalog-hover-focus-y:${hoverFocus.y}%`;
 const petStory=Boolean(design.acceptsCustomerImage);
 const visual=design.featuredPhoto?`<img class="catalog-3d catalog-featured-photo${productSlug==='totebags'?' catalog-featured-photo--tote':''}" style="${mainFocusStyle}" src="${design.featuredPhoto}" alt="Foto principal del diseño ${safe(design.name)}">${design.featuredPhotoHover?`<img class="catalog-3d catalog-featured-photo-hover${productSlug==='totebags'?' catalog-featured-photo--tote':''}" style="${hoverFocusStyle}" src="${design.featuredPhotoHover}" alt="" aria-hidden="true">`:''}`:catalogMissingMockup(design);
 const shareUrl=collection?catalogDesignDialogPath(collection.id,design.id):`/?design=${encodeURIComponent(design.id)}&product=${encodeURIComponent(productSlug)}#catalogo`;
 if(wall){
  const price=priceLabel(productSlug==='totebags'?productPrice('tote','M',null,design):productSlug==='bodys'?productPrice('body',null,null,design):productSlug==='poleras'?productPrice('basic','M',null,design):null);
  const personalizationStory=petStory&&design.featuredPhoto?catalogPetStory(personalizationArrow,design.customerPhotoSubject):'';
  return `<article class="catalog-card drop-collection drop-design-card${petStory?' catalog-card--pet-story':''}${design.featured||wallFeatured?' drop-collection--featured':''}" data-design-id="${safe(design.id)}" data-preview-id="${safe(design.id)}" data-product-slug="${safe(productSlug)}"><div class="catalog-visual catalog-visual--${safe(design.surface)} catalog-theme-${index%4}"><button type="button" class="drop-collection-link" data-design="${safe(design.id)}" data-product="${safe(productSlug)}"${commerceSupported?'':' disabled'} aria-label="${safe(chooseLabel)} para ${safe(design.name)}"><span class="drop-card-media">${visual.replaceAll('<img ',`<img loading="${index<3?'eager':'lazy'}" decoding="async" `)}${personalizationStory}</span><span class="drop-labels"><span class="drop-collection-type">${wallFeatured?'✦ Diseño destacado':design.featured?'✦ Destacado':'Diseño original'}</span>${petStory?'<span class="drop-personalizable">Diseño personalizable</span>':''}</span><span class="drop-design-price">${price}</span><span class="drop-caption"><span><small>${safe(collection?.label||'Diseño original')}</small><strong>${safe(design.name)}</strong>${commerceSupported?'':'<small>Próximamente</small>'}</span><span class="drop-arrow" aria-hidden="true">↗</span></span></button><div class="drop-collection-tools">${catalogProductBadges([sourceDesign],productChoice.selected,cardKey)}<div class="drop-secondary-tools">${design.caption&&!wallFeatured?`<details class="drop-design-description"><summary aria-label="Ver descripción de ${safe(design.name)}" title="Ver descripción"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10v7M12 7h.01"/></svg></summary><p>${safe(design.caption)}</p></details>`:''}<button type="button" class="catalog-share share-button" aria-label="Compartir diseño ${safe(design.name)}" title="Compartir diseño" data-share-url="${safe(shareUrl)}" data-share-title="${safe(design.name)} · Droska" data-share-text="Mira este diseño de Droska.">${shareIcon}<span>Compartir</span></button></div></div></div></article>`;
 }

 return `<article class="catalog-card catalog-design-card${petStory?' catalog-card--pet-story':''}" data-design-id="${safe(design.id)}" data-preview-id="${safe(design.id)}" data-product-slug="${safe(productSlug)}"><div class="catalog-visual catalog-visual--${safe(design.surface)} catalog-theme-${index%4}">${design.featured?'<span class="catalog-featured-pill">Destacado</span>':''}<span class="catalog-design-kicker"><span aria-hidden="true">✦</span> Diseño original</span><span class="catalog-design-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>${visual}${petStory&&design.featuredPhoto?catalogPetStory(personalizationArrow,design.customerPhotoSubject):''}<span class="catalog-price">${priceLabel(productSlug==='totebags'?productPrice('tote','M',null,design):productSlug==='bodys'?productPrice('body',null,null,design):productSlug==='poleras'?productPrice('basic','M',null,design):null)}</span></div><div class="catalog-card-info"><div>${catalogProductBadges([sourceDesign],productChoice.selected,cardKey)}${collection?`<span class="catalog-design-collection">${safe(collection.label)}</span>`:''}<h3>${safe(design.name)}</h3><details class="catalog-description"><summary><span class="catalog-description-show">Ver descripción</span><span class="catalog-description-hide">Ocultar descripción</span></summary><p>${safe(design.caption)}</p></details></div></div><div class="catalog-card-actions"><button type="button" class="catalog-choose ds-cta" data-design="${safe(design.id)}" data-product="${safe(productSlug)}"${commerceSupported?'':' disabled'} aria-label="${safe(chooseLabel)} para ${safe(design.name)}">${chooseLabel} <span aria-hidden="true">→</span></button><button type="button" class="catalog-share share-button" data-share-url="${safe(shareUrl)}" data-share-title="${safe(design.name)} · Droska" data-share-text="Mira este diseño de Droska.">${shareIcon}<span>Compartir</span></button></div></article>`;
}
function catalogCollectionCard(item,index,productDesigns){
 const designs=filterCatalog(item.id,productDesigns);
 const cardKey=`collection:${item.id}`;
 const productChoice=catalogCardProduct(designs,cardKey,item.productSlug);
 const compatibleDesigns=productChoice.selected?designs.filter(design=>designAppliesToProduct(design,productChoice.selected)):designs;
 const sourceCover=[...compatibleDesigns].sort(compareCatalogPriority)[0];
 const cover=sourceCover?catalogPreviewDesign(sourceCover,item.productSlug,productChoice.selected):null;
 const count=designs.length,countText=designCountLabel(count),preview=cover?` data-preview-id="${cover.id}"`:'';
 const productSlug=cover?.previewProductSlug||productChoice.selected||item.productSlug||'poleras';
 const mainFocus=cover?.mockupFocus||{x:50,y:50},hoverFocus=cover?.mockupHoverFocus||{x:50,y:50};
 const mainFocusStyle=`--catalog-focus-x:${mainFocus.x}%;--catalog-focus-y:${mainFocus.y}%`,hoverFocusStyle=`--catalog-hover-focus-x:${hoverFocus.x}%;--catalog-hover-focus-y:${hoverFocus.y}%`;
 const coverVisual=cover?.featuredPhoto?`<img class="catalog-3d catalog-featured-photo${productSlug==='totebags'?' catalog-featured-photo--tote':''}" style="${mainFocusStyle}" src="${cover.featuredPhoto}" alt="Portada de la colección ${safe(item.label)} en ${safe(catalogProductName(productSlug))}">${cover.featuredPhotoHover?`<img class="catalog-3d catalog-featured-photo-hover${productSlug==='totebags'?' catalog-featured-photo--tote':''}" style="${hoverFocusStyle}" src="${cover.featuredPhotoHover}" alt="" aria-hidden="true">`:''}`:cover?catalogMissingMockup(cover):`<div class="catalog-empty-cover" aria-hidden="true"><span>+</span><small>PRIMER DISEÑO</small></div>`;
 const shareUrl=catalogCollectionDialogPath(item.id),petStory=Boolean(cover?.acceptsCustomerImage),petArrowFocus=cover?.personalizationArrow||{x:50,y:50};
 if(!useDropWall){
 return `<article class="catalog-card catalog-collection-card${petStory?' catalog-card--pet-story':''}" data-collection-id="${safe(item.id)}" data-product-slug="${safe(productSlug)}"${preview}><div class="catalog-visual catalog-visual--${safe(cover?.surface||'pink')} catalog-theme-${index%4}"><div class="catalog-status-pills">${item.featured?'<span class="catalog-featured-pill">Destacada</span>':''}${item.isNewCollection?'<span class="catalog-new-collection-pill">Nueva colección</span>':''}</div><span class="catalog-card-collection">COLECCIÓN</span><span class="collection-count-pill">${countText}</span>${coverVisual}${petStory&&cover?.featuredPhoto?catalogPetStory(petArrowFocus,cover?.customerPhotoSubject): ''}<button type="button" class="catalog-round-arrow" data-open-collection="${safe(item.id)}" data-product="${safe(productSlug)}" aria-label="Ver colección ${safe(item.label)} en ${safe(catalogProductName(productSlug))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7h8v8"/></svg></button></div><div class="catalog-card-info"><div>${catalogProductBadges(designs,productChoice.selected,cardKey)}<h3>${safe(item.label)}</h3><p>${cover?(petStory?(cover?.customerPhotoSubject==='people'?'De la foto de alguien especial a un diseño único.':'De tu foto de mascota a un diseño único.'):'Diseños listos para llevar.'):'Colección lista para recibir diseños.'}</p></div></div><div class="catalog-card-actions"><button type="button" class="catalog-choose ds-cta" data-open-collection="${safe(item.id)}" data-product="${safe(productSlug)}" aria-label="Ver colección ${safe(item.label)}, ${countText}, en ${safe(catalogProductName(productSlug))}">Ver colección <span aria-hidden="true">→</span></button><button type="button" class="catalog-share share-button" data-share-url="${safe(shareUrl)}" data-share-title="Colección ${safe(item.label)} · Droska" data-share-text="Mira esta colección de Droska.">${shareIcon}<span>Compartir</span></button></div></article>`;
 }
 const dropCoverVisual=coverVisual.replaceAll('<img ',`<img loading="${index<3?'eager':'lazy'}" decoding="async" `)+(petStory&&cover?.featuredPhoto?catalogPetStory(petArrowFocus,cover?.customerPhotoSubject):'');
 return `<article class="catalog-card catalog-collection-card drop-collection${petStory?' catalog-card--pet-story':''}${item.featured?' drop-collection--featured':''}" data-collection-id="${safe(item.id)}" data-product-slug="${safe(productSlug)}"${preview}><div class="catalog-visual catalog-visual--${safe(cover?.surface||'pink')} catalog-theme-${index%4}"><button type="button" class="drop-collection-link" data-open-collection="${safe(item.id)}" data-product="${safe(productSlug)}" aria-label="Ver colección ${safe(item.label)}, ${countText}, en ${safe(catalogProductName(productSlug))}"><span class="drop-card-media">${dropCoverVisual}</span><span class="drop-labels">${petStory?'':'<span class="drop-collection-type">Colección</span>'}${item.isNewCollection?'<span class="drop-new">Nueva colección</span>':''}${petStory?'<span class="drop-personalizable">Diseño personalizable</span>':''}</span>${item.featured?`<span class="drop-featured-count">${countText}</span>`:''}<span class="drop-caption">${item.featured?'<span class="drop-photo-badge"><i aria-hidden="true">✦</i> Colección destacada</span>':''}<span><small class="drop-featured-overline">${item.featured?'✦ SELECCIÓN DESTACADA':countText}</small><strong>${safe(item.label)}</strong>${item.featured?`<span class="drop-featured-description">${petStory?(cover?.customerPhotoSubject==='people'?'De la foto de alguien especial a un diseño único.':'De tu foto de mascota a un diseño único.'):'Diseños originales para llevar a tu manera.'}</span>`:''}</span>${item.featured?'':'<span class="drop-arrow" aria-hidden="true">↗</span>'}</span></button>${item.featured?`<div class="drop-featured-products">${catalogProductBadges(designs,productChoice.selected,cardKey)}</div>`:''}<div class="drop-collection-tools">${item.featured?'':catalogProductBadges(designs,productChoice.selected,cardKey)}<button type="button" class="catalog-share share-button" aria-label="Compartir colección ${safe(item.label)}" title="Compartir colección" data-share-url="${safe(shareUrl)}" data-share-title="Colección ${safe(item.label)} · Droska" data-share-text="Mira esta colección de Droska.">${shareIcon}<span>Compartir</span></button></div></div></article>`;
}
function featuredDropDesignCard(design,collection){
 let markup=catalogDesignCard(design,0,collection,'',true,true);
 markup=markup.replace(`data-design-id="${safe(design.id)}"`, `data-collection-id="${safe(collection.id)}" data-design-id="${safe(design.id)}"`);
 return markup;
}
function renderDropCollectionSections(shownCollections,productDesigns){
 const sectionMarkup=shownCollections.map((collection,sectionIndex)=>{
  const allDesigns=filterCatalog(collection.id,productDesigns);
  const cardKey=`collection:${collection.id}`;
  const productChoice=catalogCardProduct(allDesigns,cardKey,collection.productSlug);
  const compatibleDesigns=productChoice.selected?allDesigns.filter(design=>designAppliesToProduct(design,productChoice.selected)):allDesigns;
  const coverDesign=[...compatibleDesigns].sort(compareCatalogPriority)[0];
  const designLimit=Math.max(1,Math.min(12,Number(collection.homeDesignLimit)||4));
  const designs=allDesigns.filter(design=>design.id!==coverDesign?.id).slice(0,Math.max(0,designLimit-1)).map((design,index)=>catalogDesignCard(design,index+1,collection,'',true));
  const entries=[featuredDropDesignCard(coverDesign,collection),...designs];
  const plan=planDropWall(entries.length),sectionId=`drop-section-${String(collection.id).replace(/[^a-z0-9_-]/gi,'-')}`;
  const createTile=plan.filler?`<button type="button" class="drop-create-tile${plan.filler.columns<=3?' drop-create-tile--narrow':''}${plan.filler.rows===1?' drop-create-tile--short':''}" data-drop-create><span class="drop-create-eyebrow">¿TIENES UNA IDEA?</span><strong>Trae tu<br> diseño</strong><span class="drop-create-tile-copy">Tu foto, tu dibujo o un diseño de IA.<br>Hazlo a tu pinta.</span><span class="drop-create-tile-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button>`:'';
  const cards=entries.join('');
  return `<section class="drop-collection-section" aria-labelledby="${sectionId}-title"><div class="drop-collection-section-head"><div class="drop-collection-section-copy"><span class="eyebrow"><i aria-hidden="true"></i>${collection.featured?'Selección destacada':'Colección'}</span><h2 id="${sectionId}-title">${safe(collection.label)}</h2></div><span class="drop-collection-section-count">${designCountLabel(allDesigns.length)}</span></div><div class="catalog-grid drop-wall drop-wall--auto drop-collection-section-grid" data-section-id="${safe(collection.id)}" style="--drop-auto-tracks:${plan.rowHeights.map(height=>`${height}px`).join(' ')||'none'}">${cards}${createTile}</div><button type="button" class="drop-collection-more" data-open-collection="${safe(collection.id)}" data-product="${safe(collection.productSlug||'poleras')}">Ver esta colección <span aria-hidden="true">↗</span></button></section>`;
 }).join('');
 return sectionMarkup||'<p class="catalog-empty">No hay colecciones disponibles.</p>';
}
function renderCatalog(){
  const animateCatalogChange=catalogMotionPending;
  catalogMotionPending=false;
  const activeDesigns=catalogDesigns.filter(design=>design.active!==false&&catalogProductOptions(catalogProducts,[design]).length);
  const productOptions=catalogProductOptions(catalogProducts,activeDesigns);
  if(selectedCatalogProduct!=='all'&&!productOptions.some(product=>product.slug===selectedCatalogProduct))selectedCatalogProduct='all';
  const productDesigns=catalogProductDesigns(activeDesigns,selectedCatalogProduct);
  const activeCollections=collections.filter(collection=>productDesigns.some(design=>design.collection===collection.id));
  const visibleCategories=catalogCategories.filter(category=>activeCollections.some(collection=>collection.category===category.id));
  if(selectedCatalogCategory!=='all'&&!visibleCategories.some(category=>category.id===selectedCatalogCategory))selectedCatalogCategory='all';
  const shownCollections=selectedCatalogCategory==='all'?activeCollections:activeCollections.filter(collection=>collection.category===selectedCatalogCategory);
  const shownDesigns=shownCollections.flatMap(collection=>filterCatalog(collection.id,productDesigns).map(design=>({design,collection})));
  const isDesignView=catalogView==='designs';
  const displayedCount=isDesignView?shownDesigns.length:shownCollections.length;
  const itemLabel=isDesignView?(displayedCount===1?'diseño':'diseños'):(displayedCount===1?'colección':'colecciones');
  const scope=[selectedCatalogCategory!=='all'?visibleCategories.find(category=>category.id===selectedCatalogCategory)?.label:'',selectedCatalogProduct!=='all'?catalogProductName(selectedCatalogProduct):''].filter(Boolean);
  catalogSection.querySelector('.catalog-count').textContent=catalogAvailable?`${displayedCount} ${itemLabel}${scope.length?` · ${scope.join(' · ')}`:''}`:'Mostrando ejemplos. El catálogo publicado no está disponible para comprar en este momento.';
  catalogSection.querySelector('.catalog-reset').hidden=!scope.length;
  catalogSection.querySelector('.catalog-actions').innerHTML=catalogFiltersMarkup({view:catalogView,mode:catalogFilterMode,category:selectedCatalogCategory,columns:catalogGridColumns,categories:visibleCategories});
  const grid=catalogSection.querySelector('.catalog-grid');
  if(useDropWall&&!isDesignView){
   grid.innerHTML=renderDropCollectionSections(shownCollections,productDesigns);
  }else{
   grid.innerHTML=isDesignView?shownDesigns.map(({design,collection},index)=>catalogDesignCard(design,index,collection,'',useDropWall)).join(''):shownCollections.map((item,index)=>catalogCollectionCard(item,index,productDesigns)).join('');
  }
  if(useDropWall){
  if(!isDesignView){
   grid.querySelectorAll('.drop-collection-section-grid').forEach(sectionGrid=>{
    const plan=planDropWall(sectionGrid.querySelectorAll('.drop-collection').length);
    sectionGrid.classList.toggle('drop-wall--tablet-complete',!plan.tabletNeedsFiller);
    const place=(element,position)=>{if(!element||!position)return;element.style.setProperty('--drop-column',position.column);element.style.setProperty('--drop-columns',position.columns);element.style.setProperty('--drop-row',position.row);element.style.setProperty('--drop-rows',position.rows)};
    sectionGrid.querySelectorAll('.drop-collection').forEach((card,index)=>place(card,plan.cards[index]));
    const tile=sectionGrid.querySelector('.drop-create-tile');
    place(tile,plan.filler);
    tile?.classList.toggle('drop-create-tile--narrow',plan.filler?.columns<=3);
    tile?.classList.toggle('drop-create-tile--short',plan.filler?.rows===1);
   });
  }
  const wallPlan=planDropWall(shownCollections.length);
  if(false&& !isDesignView&&wallPlan.filler){
   grid.insertAdjacentHTML('beforeend',`<button type="button" class="drop-create-tile" data-drop-create><svg class="drop-create-blueprint" viewBox="0 0 520 480" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
<g fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
<!-- Balanced shirt: relaxed sleeves, broad torso and shallow ribbed neck. -->
<g transform="translate(22 30)">
<path d="M64 40 91 26Q115 44 139 26L166 40 230 83 201 124 185 110V252H45V110L29 124 0 83Z"/>
<path d="M91 26Q96 61 115 61T139 26M64 40 45 110M166 40 185 110M45 242h140M5 88l24 30M225 88l-24 30"/>
<rect x="84" y="91" width="62" height="90" rx="2" stroke-dasharray="4 5"/>
<path d="M115 79v114M77 136h76" stroke-dasharray="2 6"/>
<g opacity=".45"><path d="M4 26v226m-4-226h8m-8 226h8M45 270h140m-140-4v8m140-8v8"/></g>
</g>
<!-- Tote: straight rectangular bag with two flat, moderately long handles. -->
<g transform="translate(300 34)">
<path d="M20 87h132l-5 166H25Z"/>
<path d="M28 95h116l-5 150H33ZM55 87V39Q55 7 86 7T117 39v48M64 87V39q0-23 22-23t22 23v48M48 87v14m17-14v14m42-14v14m17-14v14"/>
<rect x="51" y="126" width="70" height="84" rx="2" stroke-dasharray="4 5"/>
<path d="M86 115v107M42 168h88" stroke-dasharray="2 6"/>
<g opacity=".45"><path d="M169 87v166m-4-166h8m-8 166h8M25 270h122m-122-4v8m122-8v8"/></g>
</g>
<!-- Tape: one continuous ribbon, with a consistent width and a soft folded end. -->
<g transform="translate(39 367) rotate(-8 90 25)">
<path d="M0 0h143a23 23 0 0 1 0 46H73a13 13 0 0 1 0-26h70a3 3 0 0 0 0-6H0ZM73 20v26"/>
<path d="M12 0v9m12-9v6m12-6v9m12-9v6m12-6v9m12-9v6m12-6v9m12-9v6m12-6v9m12-9v6m12-6v9M88 36v10m12-10v6m12-6v10m12-10v6m12-6v10"/>
</g>
<!-- Baby body: rounded hips, curved leg openings and a short snap closure. -->
<g transform="translate(308 338) scale(.9)">
<path d="M37 18 61 6q19 14 38 0l24 12 31 29-20 28-23-15v31q0 22-21 36v13H70v-13Q49 113 49 91V60L26 75 6 47Z"/>
<path d="M61 6q2 26 19 26T99 6M37 18l29 10m57-10-29 10M49 91q16 6 21 36m41-36q-16 6-21 36M70 132h20"/>
<circle cx="75" cy="136" r="1.3"/><circle cx="85" cy="136" r="1.3"/>
<rect x="61" y="48" width="38" height="42" rx="2" stroke-dasharray="4 5"/>
<g opacity=".45"><path d="M172 6v134m-4-134h8m-8 134h8"/></g>
</g>
<!-- Construction guides remain outside the garment silhouettes. -->
<g opacity=".25" stroke-dasharray="3 7"><path d="M270 22v438M16 322h488"/></g>
</g>
<g fill="currentColor" font-family="monospace" font-size="8" text-anchor="middle" letter-spacing="2" opacity=".8">
<text x="137" y="320">POLERA</text><text x="386" y="320">TOTE BAG</text><text x="380" y="478">BODY BEBÉ</text><text x="124" y="439">HUINCHA / TALLER</text>
</g></svg><span class="drop-create-eyebrow">¿TIENES UNA IDEA?</span><strong>Trae tu<br> diseño</strong><span class="drop-create-tile-copy">Tu foto, tu dibujo o un diseño de IA.<br>Hazlo a tu pinta.</span><span class="drop-create-tile-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12"/></svg></span><svg class="drop-create-tile-spark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 7v86M7 50h86M20 20l60 60M80 20 20 80"/></svg></button>`);
  }
  grid.classList.toggle('drop-wall',isDesignView);
  grid.classList.toggle('drop-wall--auto',false);
  grid.classList.toggle('drop-wall--tablet-complete',!wallPlan.tabletNeedsFiller);
  grid.style.setProperty('--drop-auto-tracks',wallPlan.rowHeights.map(height=>`${height}px`).join(' ')||'none');

  grid.classList.toggle('drop-wall--with-promo',Boolean(grid.querySelector('.drop-create-tile')));
  grid.style.setProperty('--drop-full-rows',String(Math.floor(shownCollections.length/4)*2));
  grid.classList.toggle('drop-design-wall',isDesignView);
  }
  grid.classList.toggle('drop-collection-sections',useDropWall&&!isDesignView);
  grid.classList.toggle('catalog-grid--filtering',animateCatalogChange);
  grid.classList.toggle('catalog-grid--four',catalogGridColumns===4);
  grid.querySelectorAll('.catalog-card').forEach((card,index)=>{
    const id=card.dataset.designId||card.dataset.collectionId;
    if(id)card.style.viewTransitionName=`catalog-card-${String(id).replace(/[^a-z0-9_-]/gi,'-')}`;
    card.style.setProperty('--catalog-entry-index',index);
  });
  if(!isDesignView){
    grid.querySelectorAll('.catalog-collection-card').forEach(card=>{
      const pill=card.querySelector('.catalog-featured-pill');
      if(pill){
        card.classList.add('catalog-collection-card--featured');
        pill.className='catalog-featured-pill catalog-featured-pill--collection';
        pill.textContent='Colección destacada';
        card.querySelector('.catalog-card-info>div')?.insertAdjacentHTML('afterbegin','<span class="catalog-featured-overline"><span aria-hidden="true">✦</span> Selección destacada</span>');
      }
    });
  }
  if(useDropWall){renderDropExplore(shownDesigns,isDesignView);dropHeroSearch?.refresh()}
  renderFooterCatalog();
  (isDesignView?shownDesigns.map(item=>item.design):shownDesigns.map(item=>item.design)).forEach(design=>{if(design&&!design.featuredPhoto)showCatalogMockup(design.id)});
}
function renderDropExplore(entries,isDesignView){
 dropExplore.hidden=isDesignView||!entries.length;
 if(dropExplore.hidden)return;
 const seen=new Set(),picks=[];
 for(const entry of entries){if(!seen.has(entry.collection.id)){picks.push(entry);seen.add(entry.collection.id)}if(picks.length===6)break}
 for(const entry of entries){if(picks.length===6)break;if(!picks.some(item=>item.design.id===entry.design.id))picks.push(entry)}
 dropExplore.querySelector('.drop-explore-track').innerHTML=picks.map(({design,collection})=>{
  const preview=catalogPreviewDesign(design,collection.productSlug);
  const image=preview.featuredPhoto||artworkUrl(preview);
  const focus=preview.mockupFocus||{x:50,y:50};
  return `<button type="button" class="drop-explore-card${preview.featuredPhoto?'':' drop-explore-card--art'}" data-explore-design="${safe(design.id)}" aria-label="Explorar ${safe(design.name)}, colección ${safe(collection.label)}">${image?`<img src="${safe(image)}" alt="${safe(design.name)} en ${safe(catalogProductName(preview.previewProductSlug))}" loading="lazy" decoding="async" style="object-position:${Number(focus.x)}% ${Number(focus.y)}%">`:'<span class="drop-explore-placeholder">Mockup pendiente</span>'}<span class="drop-explore-caption"><small>${safe(collection.label)}</small><strong>${safe(design.name)}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button>`;
 }).join('');
}
function renderCatalogWithMotion({animate=true}={}){
  catalogMotionPending=animate;
  if(!animate){
    renderCatalog();
    return Promise.resolve();
  }
  if(introReducedMotion.matches||typeof document.startViewTransition!=='function'){
    renderCatalog();
    return Promise.resolve();
  }
  document.documentElement.classList.add('catalog-view-transition');
  const transition=document.startViewTransition(()=>renderCatalog());
  transition.finished.then(
    ()=>document.documentElement.classList.remove('catalog-view-transition'),
    ()=>document.documentElement.classList.remove('catalog-view-transition')
  );
  return transition.updateCallbackDone;
}
function arrangeSingleCatalogDialog(dialog){
 if(!dialog.classList.contains('catalog-dialog--single'))return;
 const info=dialog.querySelector('.catalog-card-info>div');
 const products=info?.querySelector('.catalog-product-badges');
 const description=info?.querySelector('.catalog-description');
 if(description)description.open=true;
 if(!info||!products)return;
 const group=document.createElement('div');
 group.className='catalog-single-products';
 const label=document.createElement('span');
 label.className='catalog-single-products-label';
 label.textContent='Elige el producto';
 group.append(label,products);
 info.append(group);
}
function openCatalogCollection(collectionId,productSlug=''){
 const collection=collections.find(item=>item.id===collectionId);if(!collection)return;
 catalogDialog.dataset.collectionId=collectionId;
 catalogDialog.dataset.productSlug=productSlug;
 const activeProduct=productSlug||(selectedCatalogProduct!=='all'?selectedCatalogProduct:'all');
 const designs=catalogProductDesigns(filterCatalog(collectionId,catalogDesigns),activeProduct).filter(design=>catalogProductOptions(catalogProducts,[design]).length);
 catalogDialog.classList.toggle('catalog-dialog--single',designs.length===1);
 catalogDialog.classList.toggle('catalog-dialog--compact',designs.length===2);
 catalogDialog.classList.toggle('catalog-dialog--three-up',designs.length===3);
 catalogDialog.querySelector('#catalog-dialog-title').textContent=collection.label;
 catalogDialog.querySelector('.catalog-dialog-count').textContent=`${designCountLabel(designs.length)} en esta colección`;
 catalogDialog.querySelector('.catalog-dialog-note').textContent=designs.some(design=>design.acceptsCustomerImage)?'Elige un diseño. Si se personaliza con una foto, podrás subirla y enviar tus indicaciones al equipo.':'Elige un diseño para abrirlo en el estudio. Después podrás seleccionar modelo, talla y ubicación del estampado.';
 catalogDialog.querySelector('.catalog-dialog-grid').innerHTML=designs.length?designs.map((design,index)=>catalogDesignCard(design,index,collection,activeProduct==='all'?'':activeProduct)).join(''):`<div class="catalog-empty-collection"><span aria-hidden="true">+</span><h3>Esta colección aún no tiene diseños.</h3><p>Cuando agregues el primero desde el panel, aparecerá aquí automáticamente.</p></div>`;
 arrangeSingleCatalogDialog(catalogDialog);
 if(!catalogDialog.open)catalogDialog.showModal();document.body.classList.add('locked');
 designs.forEach(design=>{if(!design.featuredPhoto)showCatalogMockup(design.id)});
}
function openCatalogDesign(design,collection,preferredProduct=''){
  designDialog.dataset.designId=design.id;
  designDialog.querySelector('#catalog-design-dialog-title').textContent=design.name;
  designDialog.querySelector('.catalog-design-dialog-collection').textContent=collection.label;
  designDialog.querySelector('.catalog-dialog-grid').innerHTML=catalogDesignCard(design,0,collection,preferredProduct);
  arrangeSingleCatalogDialog(designDialog);
  designDialog.querySelector('[data-view-collection]').dataset.collectionId=collection.id;
  if(!designDialog.open)designDialog.showModal();document.body.classList.add('locked');
  if(!design.featuredPhoto)showCatalogMockup(design.id);
}
const catalogMockups=new Map();
const catalogMockupKeys=new Map();
function renderHeroCatalogSamples(){
 const target=document.querySelector('.hero-catalog-samples');if(!target)return;
 const shirtCollectionIds=new Set(collections.filter(collection=>(collection.productSlug||'poleras')==='poleras').map(collection=>collection.id));
 const candidates=catalogDesigns.filter(design=>design.active!==false&&shirtCollectionIds.has(design.collection));
 const selectedIds=storefrontSettings.hero_catalog_design_ids||[];
 const selected=selectedIds.map(id=>candidates.find(design=>Number(design.databaseId)===Number(id))).filter(Boolean);
 const picks=selected.length===3?selected:candidates.slice(0,3);
 target.innerHTML=picks.map(source=>{const design=designWithProductMockup(source,'poleras');const image=design.featuredPhoto||catalogMockups.get(design.id);return `<figure class="hero-catalog-sample" role="listitem">${image?`<img src="${image}" alt="${design.featuredPhoto?'Foto principal':'Polera de colección'}: ${safe(design.name)}">`:`<span class="hero-catalog-sample-loader" role="status"><i aria-hidden="true"></i><span>Preparando diseño</span></span>`}</figure>`}).join('');
}
function showCatalogMockup(id){
 const design=catalogDesigns.find(item=>item.id===id);if(design?.featuredPhoto){renderHeroCatalogSamples();return}
 const image=catalogMockups.get(id);if(!image)return;
 const cards=[...document.querySelectorAll('.catalog-card')].filter(item=>item.dataset.previewId===id);
 for(const card of cards){const visual=card.querySelector('.catalog-visual'),mockup=visual.querySelector('.catalog-3d');if(!mockup||visual.querySelector('.catalog-missing-mockup'))continue;mockup.src=image;mockup.hidden=false;visual.classList.add('is-3d');visual.removeAttribute('aria-busy');visual.querySelector('.catalog-viewer-loading')?.remove()}
 renderHeroCatalogSamples();
}
function loadCatalogArtwork(design){
 const source=artworkUrl(design);
 const load=(useCors)=>new Promise((resolve,reject)=>{
  const artwork=new Image();
  if(useCors&&/^https?:/i.test(source))artwork.crossOrigin='anonymous';
  artwork.onload=()=>resolve(artwork);
  artwork.onerror=()=>reject(new Error('No se pudo cargar el archivo del diseño'));
  artwork.src=source;
 });
 // Preferimos CORS para los previews que necesitan inspección, pero una
 // imagen pública no debería impedir abrir el estudio mientras se propaga la
 // política CORS del dominio de R2.
 return load(true).catch(()=>load(false));
}
function drawContainedArtwork(context,image,width,height){
 context.clearRect(0,0,width,height);const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
}
async function prepareCatalogMockups(){
 const pending=catalogDesigns.flatMap(design=>{
  if(design.featuredPhoto||design.active===false)return [];
  const productSlug=designForProduct(design,'poleras')?'poleras':'totebags';
  const productDesign=designForProduct(design,productSlug);
  if(!productDesign)return [];
  const key=previewKey(design,productSlug,artworkUrl(productDesign));
  return needsGeneratedPreview(design,key,catalogMockupKeys)?[{design,productSlug,productDesign,key}]:[];
 });
 if(!pending.length)return;
 let viewport,viewer,toteViewer,toteViewport;
 try{
  const {createViewer}=await import('./garment.js');
  viewport=document.createElement('div');viewport.className='catalog-render-viewport';viewport.setAttribute('aria-hidden','true');document.body.append(viewport);
  const preview={kind:'basic',color:'#ffffff',image:'',printSide:'front',printScale:1.4,assessment:null,catalogPreview:true};
  viewer=await createViewer(viewport,preview,{cameraDistance:5.15});
  for(const {design,productSlug,productDesign,key} of pending){
   let activeViewer=viewer;
   const previewColor=productSlug==='totebags'?(eligibleVariants('tote','M',design)[0]?.color||'#d9c7a4'):normalizeSampleColor(design.sampleColor);
   if(productSlug==='totebags'){if(!toteViewer){toteViewport=document.createElement('div');toteViewport.className='catalog-render-viewport';toteViewport.setAttribute('aria-hidden','true');document.body.append(toteViewport);const {createToteViewer}=await import('./tote-viewer.js');toteViewer=await createToteViewer(toteViewport,{...preview,kind:'tote',size:'M',color:previewColor})}activeViewer=toteViewer}
   const artwork=await loadCatalogArtwork(productDesign);
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2160;
   drawContainedArtwork(canvas.getContext('2d'),artwork,canvas.width,canvas.height);
   await activeViewer.update({...preview,kind:productSlug==='totebags'?'tote':'basic',size:'M',color:previewColor,image:canvas.toDataURL('image/png')});
   catalogMockups.set(design.id,activeViewer.snapshot());
   catalogMockupKeys.set(design.id,key);
   showCatalogMockup(design.id);
  }
 }catch(error){console.warn('Se conserva la vista alternativa del catálogo:',error)}
 finally{viewer?.dispose();viewport?.remove();toteViewer?.dispose();toteViewport?.remove()}
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
  const productsChanged=JSON.stringify(catalogProducts)!==JSON.stringify(result.productTypes);
  catalogProducts=result.productTypes;
  updateCommerceNav();
  publishedProductSlugs=new Set(result.designs.filter(design=>design.active!==false).flatMap(design=>Object.keys(designProductArtworks(design))));
  homeCatalogProducts=result.productTypes.filter(product=>publishedProductSlugs.has(product.slug));
  const publicCollections=collectionsWithDesigns(result.collections,result.designs);
  const publicCollectionIds=new Set(publicCollections.map(collection=>collection.id));
  const publicDesigns=result.designs.filter(design=>publicCollectionIds.has(design.collection));
  publishedCollections=publicCollections;
  publishedDesigns=publicDesigns;
  const before=JSON.stringify([catalogCategories,collections,catalogDesigns]);
  const after=JSON.stringify([result.categories,publicCollections,publicDesigns]);
  catalogCategories=result.categories;collections=publicCollections;catalogDesigns=publicDesigns;
  if(state.catalogDesignSlug){
   const savedDesign=catalogDesigns.find(design=>design.id===state.catalogDesignSlug);
   if(savedDesign){applyCatalogDesignPurchaseMode(savedDesign,state.catalogDesignPurchaseMode);state.catalogDesignName=savedDesign.name;state.catalogDesign=savedDesign.name}
   else{state.catalogDesign=null;state.catalogDesignName=null;state.catalogDesignSlug=null;state.catalogDesignCustomerImage=false;state.catalogDesignPurchaseMode='base'}
  }
  if(variantRows.length)reconcileVariant(selectedCatalogDesign()?.sampleColor,true);
  if(before!==after||productsChanged||!wasAvailable){
   renderCatalog();renderHeroCatalogSamples();if(catalogRenderStarted)requestCatalogMockups();
   if(catalogDialog.open){const collection=collections.find(item=>item.id===catalogDialog.dataset.collectionId);if(collection)openCatalogCollection(collection.id,catalogDialog.dataset.productSlug);else catalogDialog.close()}
   if(designDialog.open){const design=catalogDesigns.find(item=>item.id===designDialog.dataset.designId),collection=collections.find(item=>item.id===design?.collection);if(design&&collection&&catalogProductOptions(catalogProducts,[design]).length)openCatalogDesign(design,collection);else designDialog.close()}
  }
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
 .on('postgres_changes',{event:'*',schema:'public',table:'catalog_categories'},refreshCatalog)
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
  if(!touchCatalogZoom.matches||!event.target.closest('[data-zoom-preview]'))return false;
  const preview=event.target.closest('.catalog-3d,.catalog-shirt');if(!preview)return false;
  const visual=preview.closest('.catalog-visual');if(!visual)return false;
  event.preventDefault();event.stopPropagation();
  document.querySelectorAll('.catalog-visual.is-zoomed').forEach(item=>{if(item!==visual)item.classList.remove('is-zoomed')});
  visual.classList.toggle('is-zoomed');
  return true;
}
catalogSection.querySelector('.catalog-grid').addEventListener('click',async event=>{
  if(event.target.closest('[data-drop-create]')){beginIdea();return}
  if(toggleCatalogZoom(event))return;
  const productButton=event.target.closest('[data-card-product]');
  if(productButton){event.preventDefault();event.stopPropagation();selectCatalogCardProduct(productButton);return}
  const shareButton=event.target.closest('[data-share-url]');
  if(shareButton){event.preventDefault();event.stopPropagation();await shareCatalogLink(shareButton);return}
  const visual=event.target.closest('.catalog-visual');
  if(visual&&!event.target.closest('button,summary,[data-card-product]')){
    const card=visual.closest('.catalog-card');
    if(card?.dataset.collectionId){openCatalogCollection(card.dataset.collectionId,card.dataset.productSlug);return}
    const design=catalogDesigns.find(item=>item.id===card?.dataset.designId);
    const collection=collections.find(item=>item.id===design?.collection);
    if(design&&collection){openCatalogDesign(design,collection,card.dataset.productSlug);return}
  }
  const collectionButton=event.target.closest('[data-open-collection]');if(collectionButton){openCatalogCollection(collectionButton.dataset.openCollection,collectionButton.dataset.product);return}
  await chooseCatalogDesign(event.target.closest('[data-design]'));
});
function focusCatalogCardProduct(root,cardKey,productSlug){
 [...root.querySelectorAll('[data-card-product]')].find(button=>button.dataset.cardKey===cardKey&&button.dataset.cardProduct===productSlug)?.focus();
}
function selectCatalogCardProduct(button){
 const {cardKey,cardProduct}=button.dataset;
 if(!cardKey||!cardProduct||button.getAttribute('aria-pressed')==='true')return;
 catalogCardProducts.set(cardKey,cardProduct);
 if(catalogDialog.contains(button)){
  openCatalogCollection(catalogDialog.dataset.collectionId,catalogDialog.dataset.productSlug);
  focusCatalogCardProduct(catalogDialog,cardKey,cardProduct);
  return;
 }
 if(designDialog.contains(button)){
  const design=catalogDesigns.find(item=>item.id===designDialog.dataset.designId);
  const collection=collections.find(item=>item.id===design?.collection);
  if(design&&collection)openCatalogDesign(design,collection);
  focusCatalogCardProduct(designDialog,cardKey,cardProduct);
  return;
 }
 renderCatalogWithMotion({animate:false}).then(()=>focusCatalogCardProduct(catalogSection,cardKey,cardProduct));
}
async function shareCatalogLink(button){
  const result=await shareLink({url:button.dataset.shareUrl,title:button.dataset.shareTitle,text:button.dataset.shareText});
  if(result==='copied')toast('Link copiado.');
  else if(result==='failed')toast('No pudimos compartir el enlace. Puedes copiarlo desde la barra del navegador.','error');
}
catalogSection.querySelector('.catalog-reset').addEventListener('click',()=>{
 selectedCatalogCategory='all';selectedCatalogProduct='all';
 renderCatalogWithMotion().then(()=>catalogSection.querySelector('[data-category="all"]')?.focus());
});
catalogSection.querySelector('.catalog-actions').addEventListener('click',event=>{
 const layoutButton=event.target.closest('[data-catalog-grid-columns]');if(layoutButton){catalogGridColumns=Number(layoutButton.dataset.catalogGridColumns)===4?4:3;renderCatalogWithMotion().then(()=>catalogSection.querySelector(`[data-catalog-grid-columns="${catalogGridColumns===3?4:3}"]`)?.focus());return}
  const viewButton=event.target.closest('[data-catalog-view]');if(viewButton){catalogFilterMode=viewButton.dataset.catalogView;catalogView=catalogFilterMode;renderCatalogWithMotion().then(()=>catalogSection.querySelector(`[data-catalog-view="${catalogFilterMode}"]`)?.focus());return}
 const button=event.target.closest('[data-category]');if(!button)return;
  selectedCatalogCategory=button.dataset.category;renderCatalogWithMotion().then(()=>catalogSection.querySelector(`[data-category="${selectedCatalogCategory}"]`)?.focus());
});
async function chooseCatalogDesign(button){
  if(!button||button.disabled)return;
  if(!catalogAvailable){toast('El catálogo publicado no está disponible. Vuelve a intentarlo más tarde.','error');return}
  const design=catalogDesigns.find(item=>item.id===button.dataset.design);if(!design)return;
  const loading=document.createElement('span');
  loading.className='catalog-design-loading';
  loading.setAttribute('role','status');
  loading.setAttribute('aria-live','polite');
  loading.innerHTML='<span class="catalog-design-loading-content"><i aria-hidden="true"></i><span>Preparando tu diseño</span></span>';
  button.disabled=true;button.classList.add('is-preparing');button.setAttribute('aria-busy','true');
  (button.querySelector('.drop-card-media')||button).append(loading);
  try{
    const requestedProduct=button.dataset.product||(selectedCatalogProduct!=='all'?selectedCatalogProduct:new URLSearchParams(location.search).get('product'));
    const kind=requestedProduct==='totebags'&&designAppliesToProduct(design,'totebags')?'tote':requestedProduct==='bodys'&&designAppliesToProduct(design,'bodys')?'body':designForProduct(design,'poleras')?'basic':designForProduct(design,'totebags')?'tote':designForProduct(design,'bodys')?'body':null;
    if(!kind)throw new Error('Este diseño no tiene productos disponibles en el estudio.');
    state.additionalPrints=[];state.activePrintId=null;state.catalogDesignName=design.name;state.catalogDesign=design.name;state.catalogDesignSlug=design.id;applyCatalogDesignPurchaseMode(design,'personalized');state.kind=kind;state.size=products[kind].sizes[0]||'';state.color=normalizeSampleColor(design.sampleColor);reconcileVariant(design.sampleColor,true);state.printConfigurations={front:{...defaultPrintSideConfiguration('front'),scale:CATALOG_ARTWORK_SCALE},back:{...defaultPrintSideConfiguration('back'),scale:CATALOG_ARTWORK_SCALE}};state.printScale=CATALOG_ARTWORK_SCALE;state.printSides=['front'];state.printAdjustmentsOpen=false;
    if(state.petRequest?.designId!==design.id||state.petRequest?.orderId)state.petRequest={designId:design.id};
    saveForFifteenDays(CATALOG_DRAFT_KEY,{catalogDesignSlug:state.catalogDesignSlug,catalogDesignName:state.catalogDesignName,catalogDesignCustomerImage:state.catalogDesignCustomerImage,catalogDesignPurchaseMode:state.catalogDesignPurchaseMode});
    if(state.catalogDesignCustomerImage){
      for(const side of ['front','back']){if(state.images[side]?.startsWith('blob:'))URL.revokeObjectURL(state.images[side]);state.images[side]='';state.files[side]='';state.uploadFiles[side]=null;state.cloudSaved[side]=false;state.assessments[side]=null}
      state.image='';state.file='';state.uploaded=false;state.assessment=null;state.isDefault=false;state.printSide='front';
    }
    // El arte público ya está optimizado y vive en R2. No lo volvemos a pasar
    // por un canvas del navegador: si el dominio de imágenes aún no propagó
    // CORS, ese paso falla aunque la imagen sea perfectamente visible.
    // El visor 3D puede consumir la URL pública directamente y los pedidos de
    // catálogo no necesitan guardar una copia privada del arte.
    const artwork=designForProduct(design,modelProductSlug(kind));
    const image=await loadCatalogArtwork(artwork);
    const artworkUrlValue=artworkUrl(artwork);
    if(!artworkUrlValue||!image.naturalWidth)throw new Error('No se pudo cargar el archivo del diseño');
    const previous=state.images.front;
    if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
    state.images.front=artworkUrlValue;
    state.files.front=`droska-${design.id}.webp`;
    state.uploadFiles.front=null;
    state.cloudSaved.front=false;
    state.uploaded=true;
    state.assessment=checkResolution(image.naturalWidth,image.naturalHeight);
    state.assessments.front=state.assessment;
    state.printConfigurations.front.size='large';state.printConfigurations.front.scale=CATALOG_ARTWORK_SCALE;state.printScale=CATALOG_ARTWORK_SCALE;
    activateSide('front');
    syncPreview();
    catalogDialog.close();designDialog.close();
    openStudio('ready');
  }catch(error){console.warn('No pudimos abrir el diseño del catálogo:',error);toast('No pudimos abrir este diseño. Vuelve a intentarlo.')}finally{loading.remove();button.disabled=false;button.classList.remove('is-preparing');button.removeAttribute('aria-busy')}
}
let requestedDesignOpened=false;
function openRequestedCatalogCollection(){
  const collectionSlug=new URLSearchParams(location.search).get('collection');
  const collection=collections.find(item=>item.id===collectionSlug);
  if(collection)openCatalogCollection(collection.id);
}
function openRequestedCatalogDesignDialog(){
  const designSlug=new URLSearchParams(location.search).get('shared-design');
  const design=catalogDesigns.find(item=>item.id===designSlug);
  const collection=collections.find(item=>item.id===design?.collection);
  if(design&&collection)openCatalogDesign(design,collection);
}
async function openRequestedCatalogDesign(){
  const designSlug=new URLSearchParams(location.search).get('design');
  if(!designSlug||requestedDesignOpened||!catalogDesigns.some(item=>item.id===designSlug))return;
  requestedDesignOpened=true;
  const trigger=document.createElement('button');trigger.dataset.design=designSlug;
  await chooseCatalogDesign(trigger);
  const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('design');cleanUrl.searchParams.delete('product');history.replaceState({},'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}
refreshCatalog().then(async()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('shared-design'))openRequestedCatalogDesignDialog();
  else if(!params.get('design'))openRequestedCatalogCollection();
  await openRequestedCatalogDesign();
});
async function handleCatalogDialogCardClick(event){
  if(toggleCatalogZoom(event))return;
  const productButton=event.target.closest('[data-card-product]');
  if(productButton){event.preventDefault();event.stopPropagation();selectCatalogCardProduct(productButton);return}
  const shareButton=event.target.closest('[data-share-url]');
  if(shareButton){event.preventDefault();await shareCatalogLink(shareButton);return}
  await chooseCatalogDesign(event.target.closest('[data-design]'));
}
catalogDialog.querySelector('.catalog-dialog-grid').addEventListener('click',handleCatalogDialogCardClick);
designDialog.querySelector('.catalog-dialog-grid').addEventListener('click',handleCatalogDialogCardClick);
designDialog.querySelector('[data-view-collection]').onclick=()=>{
  const collectionId=designDialog.querySelector('[data-view-collection]').dataset.collectionId;
  designDialog.close();
  const nextUrl=new URL(location.href);nextUrl.searchParams.delete('shared-design');nextUrl.searchParams.set('collection',collectionId);
  history.replaceState(null,'',`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  openCatalogCollection(collectionId);
};
catalogDialog.addEventListener('click',event=>{if(event.target===catalogDialog)catalogDialog.close()});
designDialog.addEventListener('click',event=>{if(event.target===designDialog)designDialog.close()});
catalogDialog.addEventListener('close',()=>{
  const cleanUrl=new URL(location.href);
  if(!cleanUrl.searchParams.has('collection'))return;
  cleanUrl.searchParams.delete('collection');
  history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
});
designDialog.addEventListener('close',()=>{
  const cleanUrl=new URL(location.href);
  if(!cleanUrl.searchParams.has('shared-design'))return;
  cleanUrl.searchParams.delete('shared-design');cleanUrl.searchParams.delete('collection');
  history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('locked')}));
document.querySelector('#space-create').onclick=()=>{document.querySelector('#space').close();openStudio()};
const sideNames={front:'Frente',back:'Espalda'};
const includedSides=()=>state.kind==='tote'?['front']:state.printSides;
const printLayerSides=()=>[...new Set([...includedSides(),...state.additionalPrints.map(item=>item.side)])];
const hasTwoSides=()=>printLayerSides().length===2;
const printChoice=()=>hasTwoSides()?'both':printLayerSides()[0]||'front';
const printSidesLabel=()=>printLayerSides().map(side=>sideNames[side]).join(' + ');
const primaryPrintLayers=()=>includedSides().map(side=>({id:`primary-${side}`,side,...state.printConfigurations[side],fileName:state.files[side]||''}));
const allPrintLayers=()=>[...primaryPrintLayers(),...state.additionalPrints.map(item=>({id:item.id,side:item.side,...item.configuration,fileName:item.fileName||''}))];
function currentPrintConfiguration(designPaths={}){
 const prints=allPrintLayers().map(item=>({...item,...(designPaths[item.id]?{designPath:designPaths[item.id]}:{})}));
 if(!prints.length)return {prints:[]};
 return normalizePrintConfiguration({...state.printConfigurations,prints},printChoice());
}
const printCount=()=>allPrintLayers().length;
const hasRequiredFiles=()=>includedSides().every(side=>Boolean(state.images[side]))&&state.additionalPrints.every(item=>Boolean(item.image));
const failingSides=()=>[...includedSides().map(side=>state.assessments[side]),...state.additionalPrints.map(item=>item.assessment)].filter(assessment=>assessment&&!assessment.qualifies);
function activateSide(side){if(!includedSides().includes(side))return;state.activePrintId=null;state.printSide=side;state.image=state.images[side]||'';state.assessment=state.assessments[side]||null;state.isDefault=!state.images.front&&!state.images.back&&!state.additionalPrints.some(item=>item.image);const config=activePrintConfiguration();state.printScale=Number(config.scale)||PRINT_SIZE_SCALE[config.size]}
function activateAdditionalPrint(id){const item=state.additionalPrints.find(candidate=>candidate.id===id);if(!item)return;state.activePrintId=item.id;state.printSide=item.side;state.image=item.image||'';state.assessment=item.assessment||null;state.isDefault=false;state.printScale=Number(item.configuration.scale)||PRINT_SIZE_SCALE[item.configuration.size]}
function faceSelectedSide(){viewer?.face(state.printSide);viewerPromise?.then(()=>viewer?.face(state.printSide))}
function moveCatalogDesignTo(side){
 const source=state.images.front?'front':'back';
 if(source===side)return;
 state.images[side]=state.images[source];state.files[side]=state.files[source];state.uploadFiles[side]=state.uploadFiles[source];state.cloudSaved[side]=state.cloudSaved[source];state.assessments[side]=state.assessments[source];
 state.images[source]='';state.files[source]='';state.uploadFiles[source]=null;state.cloudSaved[source]=false;state.assessments[source]=null;
}
function addPrimaryPrint(side){
 if(state.kind==='tote'){state.printSides=['front'];activateSide('front');return}
 if(!['front','back'].includes(side)||state.printSides.includes(side))return;
 if(printCount()>=PRINT_MAX_LAYERS)return toast(`Puedes combinar hasta ${PRINT_MAX_LAYERS} estampados por producto.`);
 if(catalogDesignLocked())moveCatalogDesignTo(side);
 state.printSides=[...state.printSides,side].sort((left,right)=>left==='front'?-1:right==='front'?1:0);activateSide(side);
 openPrintLayerId=`primary-${side}`;state.qualityAccepted=false;state.qualityReview=false;persistDraft();renderStep();faceSelectedSide();
}
function removePrimaryPrint(side){
 if(state.kind==='tote')return;
 const previous=state.images[side];if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
 state.images[side]='';state.files[side]='';state.uploadFiles[side]=null;state.cloudSaved[side]=false;state.assessments[side]=null;state.printSides=state.printSides.filter(item=>item!==side);
 if(side==='front'&&!state.catalogDesignCustomerImage){state.catalogDesign=null;state.catalogDesignSlug=null;state.catalogDesignName=null}
 state.qualityAccepted=false;state.qualityReview=false;state.uploaded=hasRequiredFiles();state.activePrintId=null;state.printSide=includedSides()[0]||'front';state.image=state.images[state.printSide]||'';state.assessment=state.assessments[state.printSide]||null;removeSavedDesignFile(side).catch(()=>{});persistDraft();renderStep();toast('Ubicación eliminada.');
}
function removeSide(side){const previous=state.images[side];if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);state.images[side]='';state.files[side]='';state.uploadFiles[side]=null;state.cloudSaved[side]=false;state.assessments[side]=null;if(side==='front'&&!state.catalogDesignCustomerImage){state.catalogDesign=null;state.catalogDesignSlug=null;state.catalogDesignName=null}state.qualityAccepted=false;state.qualityReview=false;state.uploaded=hasRequiredFiles();if(includedSides().length)activateSide(includedSides()[0]);removeSavedDesignFile(side).catch(()=>{})}
function addAdditionalPrint(type='arm'){
 if(state.kind==='tote'||state.catalogDesignCustomerImage)return toast('Los estampados adicionales no están disponibles para este producto.');
 if(printCount()>=PRINT_MAX_LAYERS)return toast(`Puedes combinar hasta ${PRINT_MAX_LAYERS} estampados por producto.`);
 const side='front',id=`extra-${crypto.randomUUID()}`,pocket=type==='pocket';
 state.additionalPrints.push({id,side,configuration:{...defaultPrintSideConfiguration(side),placement:pocket?'chest_left':'sleeve_left',size:'pocket',scale:PRINT_SIZE_SCALE.pocket},image:state.catalogDesign?state.images.front:'',fileName:state.catalogDesign?state.catalogDesignName||'Diseño de colección':'',file:null,assessment:null,checking:false});
 activateAdditionalPrint(id);openPrintLayerId=id;state.printAdjustmentsOpen=true;state.qualityAccepted=false;state.qualityReview=false;persistDraft();renderStep();faceSelectedSide();
}
function removeAdditionalPrint(id){
 const index=state.additionalPrints.findIndex(item=>item.id===id);if(index<0)return;
 const [item]=state.additionalPrints.splice(index,1);if(item.image?.startsWith('blob:'))URL.revokeObjectURL(item.image);removeSavedDesignFile(`extra:${id}`).catch(()=>{});
 activateSide(includedSides()[0]);state.qualityAccepted=false;state.qualityReview=false;persistDraft();renderStep();toast('Estampado adicional eliminado.');
}
function changeAdditionalPrintSide(side){
 const item=activeAdditionalPrint();if(!item||!['front','back'].includes(side))return;
 item.side=side;item.configuration=normalizePrintSideConfiguration({...item.configuration,placement:side==='back'?'center':item.configuration.placement},side);state.printSide=side;state.printScale=item.configuration.scale;persistDraft();renderStep();faceSelectedSide();
}
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
const shirtPlacementOptions=side=>side==='back'
 ? [['center','Centro'],['upper_back','Espalda alta']]
 : [['center','Centro'],['chest_left','Pecho izquierdo'],['chest_right','Pecho derecho'],['sleeve_left','Manga izquierda'],['sleeve_right','Manga derecha']];
const movementDescription=config=>{
 const horizontal=config.offsetX<0?'un poco a la izquierda':config.offsetX>0?'un poco a la derecha':'';
 const vertical=config.offsetY<0?'un poco arriba':config.offsetY>0?'un poco abajo':'';
 return [horizontal,vertical].filter(Boolean).join(' y ')||'Sin desplazamiento';
};
function printLayerConfiguration(id){
 if(id?.startsWith('primary-'))return state.printConfigurations[id.replace('primary-','')];
 return state.additionalPrints.find(item=>item.id===id)?.configuration||null;
}
function activatePrintLayer(id){
 if(!id)return;
 if(id.startsWith('primary-'))activateSide(id.replace('primary-',''));
 else activateAdditionalPrint(id);
}
function printLayerSettingsHtml(id,side,config,kind){
 if(!['basic','over','woman','kids','body'].includes(state.kind))return '';
 const isArm=kind==='Brazo',isPocket=kind==='Bolsillo';
 const positions=isArm?[['sleeve_left','Izquierdo'],['sleeve_right','Derecho'],['sleeve_both',`Ambos · +${money(PRINT_PRICES.arm_clp*2)}`]]:isPocket?[['chest_left','Izquierdo'],['chest_right','Derecho']]:[];
 return `<section class="print-layer-settings" data-print-layer-id="${id}">${positions.length?`<fieldset class="print-adjustment-group"><legend>Lado del ${kind.toLowerCase()}</legend><div class="print-placement-options ${positions.length===3?'three-options':''}">${positions.map(([value,text])=>`<button type="button" data-print-placement="${value}" class="${config.placement===value?'selected':''}" aria-pressed="${config.placement===value}"><strong>${text}</strong></button>`).join('')}</div></fieldset>`:''}<fieldset class="print-adjustment-group print-movement-group"><legend>Ajustar posición · opcional</legend><div class="print-movement-control"><button type="button" data-print-move="up" aria-label="Subir diseño" ${config.offsetY<=-2?'disabled':''}>↑</button><button type="button" data-print-move="left" aria-label="Mover diseño a la izquierda" ${config.offsetX<=-2?'disabled':''}>←</button><button type="button" data-print-move="reset" aria-label="Centrar diseño">•</button><button type="button" data-print-move="right" aria-label="Mover diseño a la derecha" ${config.offsetX>=2?'disabled':''}>→</button><button type="button" data-print-move="down" aria-label="Bajar diseño" ${config.offsetY>=2?'disabled':''}>↓</button></div><output>${escapeText(movementDescription(config))}</output></fieldset><div class="print-adjustment-footer"><p>Podrás confirmar la ubicación antes de producir.</p><button type="button" class="text-link" data-reset-print-adjustments>Restablecer ajustes</button></div></section>`;
}
let openPrintLayerId=null;
function printLayerCardHtml({id,side,kind,position,config,fileName,image,index}){
 const active=openPrintLayerId===id;
 const price=kind==='Brazo'?PRINT_PRICES.arm_clp*(config.placement==='sleeve_both'?2:1):kind==='Bolsillo'?PRINT_PRICES.front_pocket_clp:side==='back'?PRINT_PRICES.back_large_clp:PRINT_PRICES.front_large_clp;
 const upload=state.catalogDesign?'':currentPurchaseMethod()==='whatsapp'?'<p class="print-file-instruction">Adjunta la imagen de esta ubicación cuando se abra el chat de WhatsApp.</p>':id.startsWith('primary-')?uploadCardHtml(side,true):additionalUploadCardHtml(state.additionalPrints.find(item=>item.id===id),index,true);
 const remove=id.startsWith('primary-')?`<button type="button" class="print-layer-remove" data-remove-primary-print="${side}" aria-label="Quitar ${kind.toLowerCase()}">Quitar</button>`:`<button type="button" class="print-layer-remove" data-remove-print-layer="${id}" aria-label="Quitar ${kind.toLowerCase()}">Quitar</button>`;
 const status=state.catalogDesign?'Diseño de colección':currentPurchaseMethod()==='whatsapp'?'Archivo por WhatsApp':image?'Archivo listo':'Falta adjuntar imagen';
 return `<details class="print-layer-card ${active?'selected':''}" data-print-layer-panel="${id}" ${active?'open':''}><summary><span class="print-layer-copy"><strong>${kind}</strong><small>${position} · ${status}</small></span><span class="print-layer-meta"><strong>+${money(price)}</strong><b>${active?'Cerrar':'Editar'}</b></span></summary><div class="print-layer-body"><div class="print-layer-upload">${upload}</div>${printLayerSettingsHtml(id,side,config,kind)}<div class="print-layer-actions">${remove}<button type="button" class="ds-secondary-button" data-close-print-layer="${id}">Cerrar ${kind.toLowerCase()}</button></div></div></details>`;
}
function printCompositionHtml(){
 if(state.kind==='tote'||state.catalogDesignCustomerImage)return '';
 const primary=side=>includedSides().includes(side)?printLayerCardHtml({id:`primary-${side}`,side,kind:sideNames[side],position:side==='front'?'Grande centrado arriba':'Grande centrado',config:state.printConfigurations[side],fileName:state.files[side],image:state.images[side]}):'';
 const extra=prefix=>{const index=state.additionalPrints.findIndex(item=>item.configuration.placement.startsWith(prefix));if(index<0)return '';const item=state.additionalPrints[index],placement=item.configuration.placement;return printLayerCardHtml({id:item.id,side:item.side,kind:prefix==='sleeve_'?'Brazo':'Bolsillo',position:placement==='sleeve_both'?'Ambos brazos':placement.endsWith('right')?'Derecho':'Izquierdo',config:item.configuration,fileName:item.fileName,image:item.image,index})};
 const add=(kind,label,price,primary=false)=>`<button type="button" class="add-print-layer" data-add-${primary?'primary-print':'print-layer'}="${kind}" ${printCount()>=PRINT_MAX_LAYERS?'disabled':''}><strong>+ Añadir ${label}</strong><span>+${money(price)}</span></button>`;
 return `<section class="print-composition" aria-label="Ubicaciones del estampado">${primary('front')||add('front','frente',PRINT_PRICES.front_large_clp,true)}${primary('back')||add('back','espalda',PRINT_PRICES.back_large_clp,true)}${extra('sleeve_')||add('arm','brazo',PRINT_PRICES.arm_clp)}${extra('chest_')||add('pocket','bolsillo',PRINT_PRICES.front_pocket_clp)}</section>`;
}
function printSidesHtml(){
 if(state.kind==='tote')return `<fieldset class="print-side-picker tote-front-only"><legend>Frente · Grande centrado</legend><p>Única ubicación disponible.</p>${state.catalogDesign?'':currentPurchaseMethod()==='whatsapp'?'<p>Adjunta tu imagen cuando se abra el chat de WhatsApp.</p>':uploadCardHtml('front',true)}</fieldset>`;
 return printCompositionHtml();
}
function uploadCardHtml(side,inline=false){
 const image=state.images[side];const assessment=state.assessments[side];const checking=state.checking&&state.checkingSide===side;
 const readyLabel=side==='front'?'Frente listo':'Espalda lista';
 const action=checking?'Revisando archivo…':image?`${readyLabel} · Cambiar imagen`:`Adjuntar imagen ${side==='front'?'frente':'espalda'}`;
 const detail=checking?'Optimizando formato y resolución':image?(assessment?.qualifies?'Archivo cargado':'Archivo cargado · revisaremos su calidad'):'JPG, PNG o WEBP · hasta 12 MB · se optimiza antes de enviar';
 const suffix=inline?'-layer':'';
 if(checking)return `<div class="upload-card upload-processing" role="status" aria-live="polite"><span class="upload-processing-spinner" aria-hidden="true"></span><div><strong>Optimizando tu archivo</strong><small>Validamos formato, resolución y calidad de impresión. Esto puede tomar unos segundos.</small></div></div>`;
 return `<div class="upload-card ${image?'uploaded':''}" data-upload-card="${side}"><label class="dropzone upload-zone" data-drop-side="${side}"><input id="file-${side}${suffix}" data-file-side="${side}" type="file" accept="image/png,image/jpeg,image/webp"/><span>${image?'<img src="'+image+'" alt="Miniatura del diseño para '+sideNames[side].toLowerCase()+'">':'<svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>'}</span><strong>${action}</strong><small>${detail}</small></label>${image?`<label class="upload-file-name"><span>Nombre del archivo</span><input type="text" data-file-name-side="${side}" value="${escapeText(state.files[side])}" maxlength="120" spellcheck="false" aria-describedby="file-name-help-${side}${suffix}"><small id="file-name-help-${side}${suffix}">Puedes cambiarlo sin alterar la imagen.</small></label><button type="button" class="small-button" data-remove-side="${side}">Quitar archivo</button>`:''}</div>`;
}
function additionalUploadCardHtml(item,index,inline=false){
 const image=item.image,checking=item.checking,placement=item.configuration.placement,kind=placement.startsWith('sleeve_')?'brazo':'bolsillo',where=`${sideNames[item.side]} · ${PRINT_PLACEMENT_LABEL[placement]}`;
 if(checking)return `<div class="upload-card upload-processing" role="status" aria-live="polite"><span class="upload-processing-spinner" aria-hidden="true"></span><div><strong>Optimizando tu archivo</strong><small>Validamos formato, resolución y calidad de impresión. Esto puede tomar unos segundos.</small></div></div>`;
 return `<div class="upload-card additional-upload-card ${image?'uploaded':''}" data-extra-upload-card="${item.id}"><div class="additional-upload-heading"><strong>Adjuntar imagen ${kind}</strong><small>${escapeText(where)}</small></div><label class="dropzone upload-zone"><input data-extra-file="${item.id}" type="file" accept="image/png,image/jpeg,image/webp"/><span>${image?`<img src="${image}" alt="Miniatura del estampado ${index+1}">`:'<svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>'}</span><strong>${image?'Archivo listo · Cambiar':`Adjuntar imagen ${kind}`}</strong><small>${image?(item.assessment?.qualifies?'Archivo optimizado':'Revisaremos su calidad'):'JPG, PNG o WEBP · hasta 12 MB'}</small></label>${image?`<button type="button" class="small-button" data-remove-extra-file="${item.id}">Quitar archivo</button>`:''}</div>`;
}
function fulfillmentPickerHtml(){const deliveryPrice=state.shippingQuote&&state.fulfillment==='delivery'?money(state.shippingQuote.amount):'Por calcular';return `<fieldset class="fulfillment-picker"><legend>¿Cómo quieres recibirla?</legend><div class="fulfillment-options"><button type="button" data-fulfillment="delivery" class="fulfillment-choice ${state.fulfillment==='delivery'?'selected':''}" aria-pressed="${state.fulfillment==='delivery'}"><span class="fulfillment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg></span><span><strong>Despacho</strong><small>Calculamos el valor con tu dirección</small></span><b>${deliveryPrice}</b></button><button type="button" data-fulfillment="pickup" class="fulfillment-choice ${state.fulfillment==='pickup'?'selected':''}" aria-pressed="${state.fulfillment==='pickup'}"><span class="fulfillment-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg></span><span><strong>Retiro</strong><small>Coordinamos contigo el punto y horario</small></span><b>Gratis</b></button></div></fieldset>`}
const escapeText=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatChilePhoneLocal=value=>{let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('569')&&digits.length>=11)digits=digits.slice(3);else if(digits.startsWith('56')&&digits.length>=10)digits=digits.slice(2).replace(/^9/,'');else if(digits.startsWith('9')&&digits.length===9)digits=digits.slice(1);else if(digits.length>8)digits=digits.slice(-8);return digits.slice(0,8).replace(/^(\d{4})(\d+)/,'$1 $2')};
const fullChilePhone=value=>{const local=formatChilePhoneLocal(value);return local?`+56 9 ${local}`:''};
const phoneFieldHtml=(id,value,name='')=>`<div class="phone-input"><span class="phone-prefix" aria-hidden="true">🇨🇱 <b>+56 9</b></span><input id="${id}"${name?` name="${name}"`:''} type="tel" required autocomplete="tel" inputmode="numeric" pattern="[0-9]{4} [0-9]{4}" maxlength="9" placeholder="1234 5678" value="${escapeText(formatChilePhoneLocal(value))}"></div>`;
const searchFilterHtml=(value,id,name,autocomplete,placeholder,required=false)=>`<div class="region-filter"><input id="${id}" class="ds-field" name="${name}"${required?' required':''} autocomplete="${autocomplete}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" placeholder="${placeholder}" value="${escapeText(value)}"><div id="${id}-options" class="region-filter-options" role="listbox" hidden></div></div>`;
const regionFilterHtml=(value,id)=>searchFilterHtml(value,id,'region','address-level1','Busca tu región');
function setupSearchFilter(input,getItems,onChange,emptyLabel){if(!input)return;const options=input.parentElement.querySelector('.region-filter-options');let active=-1;const render=()=>{const query=input.value.trim().toLocaleLowerCase('es-CL'),items=getItems(),matches=items.filter(item=>item.toLocaleLowerCase('es-CL').includes(query));options.innerHTML=matches.length?matches.map((item,index)=>`<button type="button" role="option" aria-selected="${index===active}" data-value="${escapeText(item)}">${escapeText(item)}</button>`).join(''):`<p>${emptyLabel}</p>`;options.hidden=false;input.setAttribute('aria-expanded','true')};const notify=(committed=false)=>onChange?.(input.value,committed);const choose=value=>{input.value=value;options.hidden=true;input.setAttribute('aria-expanded','false');active=-1;notify(true)};input.onfocus=render;input.oninput=()=>{active=-1;notify(false);render()};input.onkeydown=event=>{const items=[...options.querySelectorAll('[role=option]')];if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(event.key==='ArrowDown'?1:-1)));render()}else if(event.key==='Enter'&&active>=0&&items[active]){event.preventDefault();choose(items[active].dataset.value)}else if(event.key==='Escape'){options.hidden=true;input.setAttribute('aria-expanded','false')}};options.onmousedown=event=>{const option=event.target.closest('[data-value]');if(option){event.preventDefault();choose(option.dataset.value)}};input.addEventListener('blur',()=>setTimeout(()=>{options.hidden=true;input.setAttribute('aria-expanded','false')},120))}
const setupRegionFilter=(input,onChange)=>setupSearchFilter(input,()=>chileRegions,onChange,'No encontramos una región.');
const MAX_IDEA_REFERENCES=5;
function customReferencesHtml(){
 if(ideaRequestMethod()==='whatsapp')return `<aside class="whatsapp-file-note" role="note"><strong>Envía tus referencias por WhatsApp</strong><span>Cuando abras el chat podrás adjuntar fotos, bocetos o ejemplos directamente allí. No subas archivos en este formulario.</span></aside>`;
 const items=state.references.map((reference,index)=>`<div class="reference-thumb"><img src="${reference.url}" alt="Referencia ${index+1}"><span title="${escapeText(reference.name)}">${escapeText(reference.name)}</span><button type="button" data-remove-reference="${index}" aria-label="Quitar ${escapeText(reference.name)}">×</button></div>`).join('');
 const full=state.references.length>=MAX_IDEA_REFERENCES;
 return `<div class="custom-references"><div class="custom-references-heading"><strong>Fotos de referencia <span>Opcional</span></strong><small>Mascotas, familiares, personas, objetos o estilos que quieras considerar.</small></div><label class="reference-dropzone ${full?'is-full':''}"><input id="reference-files" type="file" accept="image/png,image/jpeg,image/webp" multiple ${full?'disabled':''}><span>＋</span><strong>${full?'Límite de fotos alcanzado':'Adjuntar fotos'}</strong><small>${state.references.length} de ${MAX_IDEA_REFERENCES} fotos · JPG, PNG o WEBP · hasta 12 MB cada una · se optimizan antes de enviar${full?' · Quita una para agregar otra':''}</small></label>${items?`<div class="reference-thumbs">${items}</div>`:''}</div>`;
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
async function applyCheckoutCoupon(){const input=document.querySelector('#checkout-coupon'),status=document.querySelector('#checkout-coupon-status'),button=document.querySelector('#apply-coupon'),code=input?.value.trim().toUpperCase();if(!code)return input?.focus();button.disabled=true;button.textContent='Validando…';const {data,error}=await supabase.functions.invoke('validate-coupon',{body:{code,subtotal:cartTotal()}});button.disabled=false;button.textContent='Aplicar';if(error||data?.error){state.couponCode='';state.couponDiscount=0;state.couponLabel='';status.textContent=data?.error||await paymentFunctionError(error,'No pudimos validar el cupón.');status.dataset.tone='error';return}state.couponCode=data.code;state.couponDiscount=Number(data.discountClp||0);state.couponLabel=data.label;renderStep();toast(`Cupón ${data.code} aplicado.`)}
let activePublicFlow=null,publicRequestBusy=false;
function lockStudioRequest(){
 publicRequestBusy=true;state.publicRequestBusy=true;
 const controls=[...studio.querySelectorAll('button,input,textarea,select')],disabled=controls.map(control=>control.disabled);
 controls.forEach(control=>control.disabled=true);studio.setAttribute('aria-busy','true');
 return ()=>{publicRequestBusy=false;state.publicRequestBusy=false;controls.forEach((control,index)=>control.disabled=disabled[index]);studio.removeAttribute('aria-busy');activePublicFlow?.refresh()};
}
const publicFlowStates=new Map();
function publicFlowState(key){if(!publicFlowStates.has(key))publicFlowStates.set(key,createDisclosureState());return publicFlowStates.get(key)}
function confirmCheckoutDecision(id){const confirmed=activePublicFlow?.confirm(id);if(confirmed){const flow=publicFlowState('checkout');flow.focus=flow.active||'next'}return confirmed}
let detailsDisclosure=createDisclosureState(savedDraftDetails.disclosure);
let detailsDisclosureScope=savedDraftDetails.disclosure?.scope||'';
function detailDisclosureSteps(){
 const source=selectedCatalogDesign(),family=productFamilyForKind(state.kind);
 const available=([id])=>designSupportsProduct(source,id)&&eligibleVariants(id,null,source).length>0;
 const families=productFamilies.filter(item=>productsForFamily(item.id).some(available));
 const models=productsForFamily(family).filter(available);
 const sizes=products[state.kind].sizes.filter(size=>eligibleVariants(state.kind,size,source).length);
 const colors=[...new Map(eligibleVariants(state.kind,state.size,source).map(row=>[row.color,row.colorName])).entries()];
 const sides=state.kind==='tote'?['front']:['front','back','both'];
 const definitions=[
  {id:'product',title:'Producto',selector:'.product-family-block',value:family,summary:productFamilies.find(item=>item.id===family)?.name||family,valid:families.some(item=>item.id===family),single:families.length===1},
  {id:'model',title:family==='tote'?'Formato':'Modelo',selector:'.model-block',value:state.kind,summary:products[state.kind].name,valid:models.some(([id])=>id===state.kind),single:models.length===1},
  {id:'size',title:['kids','body'].includes(state.kind)?'Edad':'Talla',selector:'.size-block',value:`${modelProductSlug(state.kind)}:${state.size}`,summary:sizeLabel(state.kind,state.size),valid:sizes.includes(state.size),single:sizes.length===1},
  {id:'color',title:state.kind==='tote'?'Tela':'Color',selector:'.color-block',value:state.color,summary:colors.find(([value])=>value===state.color)?.[1]||'Sin disponibilidad',valid:colors.some(([value])=>value===state.color),single:colors.length===1},
 ];
 if(studioDetailIncludesPrintPlacement(state.catalogDesignSlug))definitions.push({id:'side',title:state.kind==='tote'?'Diseño de tu tote bag':state.kind==='body'?'Diseño de tu body':'Crea tu polera',instruction:currentPurchaseMethod()==='whatsapp'?'Añade las ubicaciones. Adjuntarás las imágenes en WhatsApp.':state.kind==='tote'?'Adjunta la imagen para el frente.':'Añade una ubicación, adjunta su imagen y ajusta el diseño. Puedes combinar varias.',preserveSelection:true,selector:'.print-placement-block',value:JSON.stringify(currentPrintConfiguration()),summary:printCount()?printConfigurationLabel(currentPrintConfiguration(),printChoice()):'Sin estampados aún',valid:printCount()>0&&sides.includes(printChoice())&&(currentPurchaseMethod()==='whatsapp'||(hasRequiredFiles()&&!state.checking&&!state.additionalPrints.some(item=>item.checking))),single:false});
 if(catalogDesignAllowsBasePurchase(source))definitions.unshift({id:'purchaseMode',title:'Versión del diseño',selector:'.catalog-purchase-mode',value:state.catalogDesignPurchaseMode,summary:state.catalogDesignPurchaseMode==='base'?'Comprar tal cual':'Personalizar con tus fotos',valid:['base','personalized'].includes(state.catalogDesignPurchaseMode),single:false});
 return definitions;
}
function ensureDetailsDisclosure(){
 const scope=state.catalogDesignSlug?`catalog:${state.catalogDesignSlug}:${state.catalogDesignPurchaseMode}`:'own';
 if(scope!==detailsDisclosureScope){detailsDisclosure=createDisclosureState();detailsDisclosureScope=scope;}
 const result=reconcileDisclosure(detailsDisclosure,detailDisclosureSteps(),{ready:variantLoadStatus==='ready'});
 if(result.lost.length)detailsDisclosure.focus=result.pending||'next';
 return result;
}
function confirmDetail(id){
 const result=ensureDetailsDisclosure(),steps=detailDisclosureSteps();
 const confirmed=confirmDisclosure(detailsDisclosure,steps,id,{ready:variantLoadStatus==='ready'});
 const affected=result.lost.filter(title=>title!==steps.find(step=>step.id===id)?.title);
 if(confirmed&&affected.length)detailsDisclosure.message=`Revisa ${affected.join(', ').toLocaleLowerCase('es-CL')}. Conservamos las selecciones compatibles.`;
 return confirmed;
}
function detailsCanContinue(){
 const result=ensureDetailsDisclosure(),steps=detailDisclosureSteps();
 return result.complete||result.pending==='side'&&steps.find(step=>step.id==='side')?.valid;
}
function mountStudioDetails(container){
 ensureDetailsDisclosure();
 if(!studioDetailIncludesPrintPlacement(state.catalogDesignSlug))container.querySelector('.print-placement-block')?.remove();
 const grid=container.querySelector('.details-grid');
 if(grid){while(grid.firstChild)grid.before(grid.firstChild);grid.remove();}
 const group=document.createElement('div');group.className='studio-detail-disclosure';
 container.querySelector('.product-family-block').before(group);
 const steps=detailDisclosureSteps().map(step=>({...step,node:container.querySelector(step.selector)}));
 steps.forEach(step=>{if(step.node)group.append(step.node)});
 const result=mountDisclosure({container:group,state:detailsDisclosure,steps,ready:variantLoadStatus==='ready',onEdit:()=>renderStep(),idPrefix:'studio-detail'});
 if(state.catalogDesignSlug&&variantLoadStatus==='ready')group.querySelector('.ds-disclosure-status')?.remove();
 if(variantLoadStatus!=='ready'){
  const status=group.querySelector('.ds-disclosure-status');status.textContent=variantLoadStatus==='loading'?'Cargando productos y variantes…':'No pudimos cargar las variantes. Reintenta para continuar.';
  if(variantLoadStatus==='error'){const retry=document.createElement('button');retry.type='button';retry.className='ds-secondary-button';retry.textContent='Reintentar carga';retry.onclick=()=>{variantLoadStatus='loading';renderStep();void loadProductPrices()};status.append(document.createElement('br'),retry);}
 }
 const price=container.querySelector('.studio-price-summary');group.after(price);
 if(!['product','model','size','color'].every(id=>Object.hasOwn(detailsDisclosure.confirmed,id))){
  price.querySelector('strong').textContent=priceLabel(productPrice(state.kind,null));
  price.querySelector('small').textContent='Confirma producto, modelo, talla y color para ver el precio de tu selección.';
 }else if(studioDetailIncludesPrintPlacement(state.catalogDesignSlug)&&!Object.hasOwn(detailsDisclosure.confirmed,'side')){
  const variant=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant;
  const current=variant?orderTotal(variant.priceClp,printChoice(),0,printCount(),state.kind==='tote'?null:currentPrintConfiguration(),PRINT_PRICES):null;
  price.querySelector('strong').textContent=current?money(current.total):'Precio por confirmar';price.querySelector('small').textContent=current?`Producto ${money(current.base)} · Estampado ${money(current.print)}`:'Elige la ubicación para confirmar el estampado.';
 }
 container.querySelectorAll('.sizes').forEach(node=>node.classList.add('disclosure-sizes'));
 const next=document.querySelector('#next');next.disabled=state.checking||!detailsCanContinue();
 sizeDock.hidden=true;
 if(detailsDisclosure.focus){const target=detailsDisclosure.focus;detailsDisclosure.focus=null;requestAnimationFrame(()=>{if(state.step!==1||!studio.open)return;focusDisclosure(target==='next'?next:target.startsWith('edit:')?container.querySelector(`[data-disclosure-edit="${target.slice(5)}"]`):document.querySelector(`#studio-detail-${target}-heading`))});}
 return result;
}
function renderStep(){
 const previousDetailPanelId=studio.querySelector('.studio-detail-disclosure .is-active>.ds-disclosure-panel')?.id;
 const previousField=activePublicFlow&&document.activeElement?.closest('#step-content')&&document.activeElement.matches('input,textarea,select')?document.activeElement:null;
 const previousFocus=previousField?{id:previousField.id,petValue:previousField.dataset.petValue,start:previousField.selectionStart,end:previousField.selectionEnd,scroll:studio.querySelector('.studio-controls')?.scrollTop||0}:null;
 const restorePublicFocus=()=>{if(!previousFocus||!activePublicFlow)return;const target=previousFocus.id?document.getElementById(previousFocus.id):document.querySelector(`[data-pet-value="${CSS.escape(previousFocus.petValue||'')}"]`);if(!target||target.matches(':disabled')||target.closest('[hidden]'))return;const scroller=studio.querySelector('.studio-controls');if(scroller)scroller.scrollTop=previousFocus.scroll;target.focus({preventScroll:true});try{if(previousFocus.start!==null)target.setSelectionRange(previousFocus.start,previousFocus.end)}catch{}};
 activePublicFlow?.destroy();activePublicFlow=null;
 const studioBody=studio.querySelector('.studio-body');
 const studioScroller=['auto','scroll'].includes(getComputedStyle(studioBody).overflowY)?studioBody:studio.querySelector('.studio-controls');
 const preserveScroll=state.step===1&&studioScroller?studioScroller.scrollTop:0;
 const focused=document.activeElement;
 const focusedLayer=focused?.closest('[data-print-layer-panel]')?.dataset.printLayerPanel;
 const printFocusAttribute=['data-print-placement','data-print-move','data-reset-print-adjustments'].find(key=>focused?.hasAttribute(key));
 const printFocusValue=printFocusAttribute?focused.getAttribute(printFocusAttribute):null;
 const preserveFocus=state.step===1&&focused?.closest('#step-content')?['data-product-family','data-product','data-size','data-color','data-print-sides'].map(key=>focused.dataset?.[key]).find(Boolean):null;
 studio.classList.toggle('is-checkout-step',state.step===3&&!state.catalogDesignCustomerImage);
 studio.classList.toggle('is-entry-choice',state.mode==='choose');
 studio.classList.toggle('is-request-mode',state.mode==='custom');
 colorDock.hidden=true;sizeDock.hidden=catalogDesignLocked();
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
  if(!state.customChannel){
   const whatsappMessage=[
    'Hola, quiero solicitar un diseño personalizado en Droska.',
    state.customIdea&&`Mi idea: ${state.customIdea}`,
    state.customName&&`Mi nombre: ${state.customName}`,
    state.customEmail&&`Mi correo: ${state.customEmail}`,
    state.customPhone&&`Mi teléfono: ${state.customPhone}`,
    'Te enviaré mis fotos de referencia por este chat.'
   ].filter(Boolean).join('\n\n');
   const whatsappUrl=whatsappPurchaseUrl(storefrontSettings.whatsapp_number,whatsappMessage);
   stepContent.innerHTML=`<button type="button" class="studio-back-choice" data-studio-choice="choose">← Cambiar ruta</button><span class="eyebrow">RUTA 2 · TU IDEA</span><h2>¿Cómo quieres solicitar tu diseño?</h2><p class="studio-choice-intro">Elige cómo enviarnos tu idea. Primero la revisaremos y te contactaremos con una propuesta.</p><div class="studio-choice-grid"><button type="button" class="studio-choice-card studio-choice-card--design" data-custom-channel="form"><span class="studio-choice-number">01 · EN ESTA PÁGINA</span><span class="studio-choice-icon" aria-hidden="true">✎</span><strong>Solicitar por formulario</strong><small>Cuéntanos tu idea, adjunta referencias y envía la solicitud aquí.</small><span class="studio-choice-link">Abrir formulario <span aria-hidden="true">→</span></span></button><a class="studio-choice-card studio-choice-card--idea" href="${escapeText(whatsappUrl)}" target="_blank" rel="noopener noreferrer"><span class="studio-choice-number">02 · EN WHATSAPP</span><span class="studio-choice-icon" aria-hidden="true">↗</span><strong>Solicitar por WhatsApp</strong><small>Cuéntanos tu idea y adjunta las fotos directamente en el chat.</small><span class="studio-choice-link">Abrir WhatsApp <span aria-hidden="true">↗</span></span></a></div>`;
   applyDesignSystemClasses(stepContent);
   stepContent.querySelector('[data-studio-choice]').onclick=()=>{state.mode='choose';renderStep()};
   stepContent.querySelectorAll('[data-custom-channel]').forEach(button=>button.onclick=()=>{state.customChannel=button.dataset.customChannel;renderStep()});
   restorePublicFocus();return;
  }
  stepContent.innerHTML=state.customSubmitted?`<span class="eyebrow">SOLICITUD RECIBIDA</span><h2>Tu idea ya está en camino.</h2><p>Solicitud #${safe(state.creativeOrderId)}</p><p class="custom-request-lead">Revisaremos lo que nos contaste y te contactaremos con una propuesta de diseño, precio y plazo. Crea una cuenta con el mismo correo para seguirla en Mis pedidos.</p><div class="custom-request-success"><strong>¿Quieres acelerar la conversación?</strong><span>También puedes enviarnos el detalle directamente por WhatsApp.</span><button type="button" class="button dark ds-cta" id="custom-whatsapp">Enviar por WhatsApp <span aria-hidden="true">→</span></button></div>`:`<div class="custom-route-actions"><button type="button" class="studio-back-choice" data-studio-choice="choose">← Cambiar ruta</button><button type="button" class="studio-back-choice" id="custom-change-channel">Cambiar canal</button></div><span class="eyebrow">RUTA 2 · TU IDEA</span><h2>Cuéntanos qué imaginas.</h2><p class="custom-request-lead">No necesitas tener un diseño listo. Con tu idea y algunas referencias, preparamos una propuesta contigo.</p><label class="field">¿Qué te gustaría crear?<textarea id="custom-idea" required minlength="10" maxlength="4000" placeholder="Ej. Una polera para mi banda, con un dibujo de una serpiente y la frase…">${escapeText(state.customIdea)}</textarea></label>${customReferencesHtml()}<div class="custom-request-contact"><label class="field">Tu nombre<input id="custom-name" required autocomplete="name" placeholder="Cómo te llamas" value="${escapeText(state.customName)}"></label><label class="field">Tu email<input id="custom-email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${escapeText(state.customEmail)}"></label><label class="field">Tu teléfono<input id="custom-phone" required type="tel" autocomplete="tel" placeholder="+56 9 1234 5678" value="${escapeText(state.customPhone)}"></label></div><button type="button" class="button dark ds-cta custom-submit" id="custom-submit">Enviar mi idea <span aria-hidden="true">→</span></button><p class="studio-choice-note">Todavía no estás comprando. Primero te enviaremos una propuesta y cotización.</p>`;
  applyDesignSystemClasses(stepContent);
  if(!state.customSubmitted&&ideaRequestMethod()==='whatsapp'){
   const customButton=stepContent.querySelector('#custom-submit');if(customButton)customButton.innerHTML='Solicitar por WhatsApp <span aria-hidden="true">→</span>';
   const note=stepContent.querySelector('.studio-choice-note');if(note)note.textContent='Al abrir WhatsApp podrás adjuntar tus referencias directamente en el chat.';
  }
  stepContent.querySelector('[data-studio-choice]')?.addEventListener('click',()=>{state.mode='choose';renderStep()});
  stepContent.querySelector('#custom-change-channel')?.addEventListener('click',()=>{state.customChannel=null;renderStep()});
  for(const [id,key] of [['custom-idea','customIdea'],['custom-name','customName'],['custom-email','customEmail'],['custom-phone','customPhone']])stepContent.querySelector('#'+id)?.addEventListener('input',event=>{state[key]=event.target.value});
  stepContent.querySelector('#reference-files')?.addEventListener('change',event=>addReferenceFiles(event.target.files));
  stepContent.querySelectorAll('[data-remove-reference]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.removeReference),reference=state.references.splice(index,1)[0];if(reference?.url?.startsWith('blob:'))URL.revokeObjectURL(reference.url);renderStep()});
  stepContent.querySelector('#custom-submit')?.addEventListener('click',async event=>{if(publicRequestBusy||activePublicFlow&&!activePublicFlow.guardFinal(event))return;const fields=['custom-idea','custom-name','custom-email','custom-phone'].map(id=>document.querySelector(`#${id}`));for(const field of fields)if(!field.checkValidity())return field.reportValidity();const button=event.currentTarget;state.customIdea=fields[0].value.trim();state.customName=fields[1].value.trim();state.customEmail=fields[2].value.trim();state.customPhone=fields[3].value.trim();const signature=JSON.stringify([state.customIdea,state.customEmail.toLowerCase(),state.customPhone,state.references.map(reference=>reference.name)]);try{const attempt=JSON.parse(localStorage.getItem('droska-creative-attempt')||'null');state.creativeRequestId=attempt?.signature===signature&&attempt?.id||crypto.randomUUID();localStorage.setItem('droska-creative-attempt',JSON.stringify({signature,id:state.creativeRequestId}))}catch{}const release=lockStudioRequest();button.disabled=true;button.textContent='Enviando…';try{let {data:{session}}=await supabase.auth.getSession();if(!session){const result=await signInAnonymouslyWithCaptcha(supabase);if(result.error)throw result.error;session=result.data.session}if(!session)throw new Error('No pudimos iniciar la sesión de solicitud.');const references=[];for(const reference of state.references){if(reference.path&&reference.userId!==session.user.id){reference.path=null}if(!reference.path){button.textContent='Subiendo referencias…';reference.path=await uploadPrivateDesign(supabase,session.user.id,'reference',reference.file);reference.userId=session.user.id}references.push({name:reference.name,path:reference.path})}button.textContent='Verificando solicitud…';const captchaToken=await requestCaptchaToken();button.textContent='Enviando idea…';const {data,error}=await supabase.functions.invoke('create-design-request',{body:{requestId:state.creativeRequestId,idea:state.customIdea,customer:{firstName:state.customName,email:state.customEmail,phone:state.customPhone},references,catalogDesignSlug:state.catalogDesignCustomerImage?state.catalogDesignSlug:null,captchaToken}});if(error||data?.error){const detail=error?.context?.json?await error.context.json().catch(()=>null):null;throw new Error(data?.error||detail?.error||error?.message||'No pudimos enviar tu idea.');}state.creativeOrderId=data.orderId;state.customSubmitted=true;try{localStorage.removeItem('droska-creative-attempt')}catch{}renderStep()}catch(error){if(error?.name==='CaptchaError'||/verificaci[oó]n de seguridad|verificar tu solicitud/i.test(String(error?.message||error))){button.disabled=false;button.innerHTML='Reintentar envío <span aria-hidden="true">→</span>';toast(error.message,'error');return}if(/anonymous sign-ins are disabled/i.test(String(error?.message||error))){button.disabled=false;button.innerHTML='Reintentar envío <span aria-hidden="true">→</span>';state.email=state.customEmail;renderAccount('login');document.querySelector('#account-title').textContent='Ingresa para enviar tu idea.';document.querySelector('#account-content .commerce-copy').textContent='Tus respuestas y fotos siguen aquí. Inicia sesión o crea una cuenta y luego reintenta el envío.';if(!accountModal.open)accountModal.showModal();return}button.textContent='Registrando respaldo para contactarte…';try{const order=await createWhatsAppOrder({requestType:'creative',idea:state.customIdea,details:'La solicitud web falló. El cliente enviará sus referencias por WhatsApp.',customer:{name:state.customName,email:state.customEmail,phone:state.customPhone}});const message=`Hola, soy ${state.customName}. Quiero continuar la solicitud #${order.orderId}.\n\nMi idea: ${state.customIdea}\n\nEmail: ${state.customEmail}\nTeléfono: ${state.customPhone}${state.references.length?`\n\nTengo ${state.references.length} foto(s) de referencia para enviar por aquí.`:''}`;window.location.assign(whatsappPurchaseUrl(storefrontSettings.whatsapp_number,message))}catch(fallbackError){button.disabled=false;button.innerHTML='Reintentar envío <span aria-hidden="true">→</span>';toast(fallbackError.message||error.message||'No pudimos registrar tu solicitud. Tus datos siguen aquí para reintentar.','error')}}finally{release()}});
  stepContent.querySelector('#custom-whatsapp')?.addEventListener('click',()=>{const message=`Hola, soy ${state.customName}. Quiero diseñar una polera. Mi idea es: ${state.customIdea}`;window.open(`https://wa.me/56965217926?text=${encodeURIComponent(message)}`,'_blank','noopener')});
  if(!state.customSubmitted)activePublicFlow=mountIdeaFlow({container:stepContent,button:stepContent.querySelector('#custom-submit'),state,disclosure:publicFlowState(`idea:${state.creativeRequestId}:${ideaRequestMethod()}`),purchaseMethod:ideaRequestMethod()});
  restorePublicFocus();return;
 }
 if(state.step===2&&!resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant){state.step=1;toast('La talla o el color cambió. Revisa una opción disponible.','error')}
 if(state.catalogDesignCustomerImage&&state.step>1){
  const draft=state.petRequest||(state.petRequest={designId:state.catalogDesignSlug});
  const variant=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant;
  const selection={variantId:variant?.id,model:products[state.kind].name,size:state.size,color:variant?.colorName||state.color,side:state.printSide};
  document.querySelector('.steps').innerHTML='<div class="steps-rail" style="--step-count:3;--rail-progress:'+((state.step-1)/3*100)+'%;--rail-edge:16.67%"><i aria-hidden="true"></i>'+['Detalles',selectedCatalogDesign()?.customerPhotoSubject==='people'?'Tu foto':'Tu mascota','Enviar solicitud'].map((label,index)=>`<span class="${state.step===index+1?'active':''}" ${state.step===index+1?'aria-current="step"':''}><b>${index+1}</b><small>${label}</small></span>`).join('')+'</div>';
  stepContent.innerHTML=petStepHtml({step:state.step,draft,selection,designName:state.catalogDesignName,subject:selectedCatalogDesign()?.customerPhotoSubject,purchaseMethod:currentPurchaseMethod(),escapeText});
  bindPetStep(stepContent,draft,()=>activePublicFlow?.refresh(),selectedCatalogDesign()?.customerPhotoSubject);
  applyDesignSystemClasses(stepContent);
  next.hidden=Boolean(draft.orderId);back.hidden=Boolean(draft.orderId);next.disabled=false;
  next.textContent=petSubmitLabel(state.step,currentPurchaseMethod());
  stepContent.querySelector('[data-pet-done]')?.addEventListener('click',()=>studio.close());
  if(!draft.orderId)activePublicFlow=mountPetFlow({container:stepContent,button:next,draft,step:state.step,disclosure:publicFlowState(`pet:${draft.designId}:${state.step}:${currentPurchaseMethod()}`),purchaseMethod:currentPurchaseMethod()});
  restorePublicFocus();syncPreview();return;
 }
 const labels=state.catalogDesignCustomerImage?['Detalles',selectedCatalogDesign()?.customerPhotoSubject==='people'?'Tu foto':'Tu mascota','Enviar solicitud']:['Detalles','Resumen','Datos y pago'];
 const railProgress=((state.step-1)/labels.length)*100,railEdge=50/labels.length;
 document.querySelector('.steps').innerHTML=`<div class="steps-rail" style="--step-count:${labels.length};--rail-progress:${railProgress.toFixed(2)}%;--rail-edge:${railEdge.toFixed(2)}%"><i aria-hidden="true"></i>${labels.map((label,index)=>`<span class="${index+1===state.step?'active':''} ${index+1<state.step?'done':''}" aria-label="Paso ${index+1} de ${labels.length}: ${label}" ${index+1===state.step?'aria-current="step"':''}><b aria-hidden="true">${index+1<state.step?'✓':String(index+1).padStart(2,'0')}</b><small>${label}</small></span>`).join('')}</div>`;
 const p=products[state.kind],choice=printChoice(),selectedVariant=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant,selectedPrice=selectedVariant?.priceClp??null,qualityReview=effectiveQualityReview({catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:state.catalogDesignCustomerImage,qualityReview:state.qualityReview}),pricing=orderTotal(selectedPrice??0,choice,qualityReview?QUALITY_ADJUSTMENT_CLP:0,printCount(),state.kind==='tote'?null:currentPrintConfiguration(),PRINT_PRICES),whatsappPurchase=currentPurchaseMethod()==='whatsapp';
 next.hidden=false;next.disabled=state.checking||state.step===1&&!resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant;back.hidden=state.step===1;
 const ctas=['Ver resumen',purchaseMethodLabel(currentPurchaseMethod(),{purchaseType:currentPurchaseType()}),'Confirmar pedido'];next.textContent=state.catalogDesignCustomerImage?(selectedCatalogDesign()?.customerPhotoSubject==='people'?'Continuar · Tu foto':'Continuar · Foto de tu mascota'):ctas[state.step-1];
 let html='';
 if(state.step===1){
  const activeFamily=productFamilyForKind(state.kind),source=selectedCatalogDesign(),available=([id])=>designSupportsProduct(source,id)&&eligibleVariants(id,null,source).length>0;
  const colorOptions=[...new Map(eligibleVariants(state.kind,state.size,source).map(variant=>[variant.color,[variant.color,variant.colorName]])).values()].sort((a,b)=>colorDisplayRank(a[1])-colorDisplayRank(b[1])||String(a[1]).localeCompare(String(b[1]),'es'));
  const familyOptions=productFamilies.filter(family=>productsForFamily(family.id).some(available));
  const familyCards=familyOptions.map(family=>{
   const enabled=productsForFamily(family.id).some(available);
   return enabled?`<button type="button" class="${activeFamily===family.id?'selected':''}" data-product-family="${family.id}" aria-pressed="${activeFamily===family.id}"><span class="family-heading"><span class="family-kicker">${family.kicker}</span>${productFamilyIcon(family.id)}</span><strong>${family.name}</strong><span class="family-description">${family.description}</span><small class="family-price">${priceLabel(familyPrice(family.id))}</small></button>`:`<div class="product-family-unavailable"><span class="family-heading"><span class="family-kicker">${family.kicker}</span>${productFamilyIcon(family.id)}</span><strong>${family.name}</strong><span class="family-description">${family.description}</span><small class="family-price">Próximamente · Precio por confirmar</small></div>`;
  }).join('');
  const modelOptions=productsForFamily(activeFamily).filter(available);
  const purchaseModeChoice=catalogDesignAllowsBasePurchase(source)?`<section class="catalog-purchase-mode"><div class="catalog-purchase-mode-options" role="group" aria-label="Versión del diseño"><button type="button" data-catalog-purchase-mode="base" aria-pressed="${state.catalogDesignPurchaseMode==='base'}" class="${state.catalogDesignPurchaseMode==='base'?'selected':''}"><span aria-hidden="true">✓</span><strong>Comprar tal cual</strong><small>Recibe el diseño original que ves en la muestra.</small></button><button type="button" data-catalog-purchase-mode="personalized" aria-pressed="${state.catalogDesignPurchaseMode==='personalized'}" class="${state.catalogDesignPurchaseMode==='personalized'?'selected':''}"><span aria-hidden="true">☺</span><strong>Personalizar con tus fotos</strong><small>Cambiamos los rostros por tu familia, amigos o colegas.</small></button></div></section>`:'';
  html=`<span class="eyebrow">PASO 1 · DETALLES</span><h2>${state.catalogDesignPurchaseMode==='base'?'Elige tu producto.':'Elige qué quieres personalizar.'}</h2>${purchaseModeChoice}<section class="detail-block product-family-block"><div class="detail-heading"><strong>Elige un producto</strong><small>Después define modelo, talla y color</small></div><div class="product-family-options" role="group" aria-label="Tipo de producto">${familyCards}</div></section><section class="detail-block model-block"><div class="detail-heading"><strong>${activeFamily==='tote'?'Formato':'Modelo'}</strong><small>Precio base</small></div><div class="product-options">${modelOptions.map(([id,item])=>`<button type="button" class="${state.kind===id?'selected':''}" data-product="${id}"><strong>${item.name}</strong><span class="model-price">${priceLabel(productPrice(id,null,null,source))}</span></button>`).join('')}</div></section><div class="details-grid"><section class="detail-block color-block"><div class="detail-heading"><strong>${state.kind==='tote'?'Tela':'Color'}</strong><small>${colorOptions.length===1?'Única opción':'Elige uno'}</small></div><div class="colors" role="group" aria-label="Color del producto">${colorOptions.map(([color,name])=>`<button type="button" aria-label="${escapeText(name)}" aria-pressed="${state.color===color}" data-color="${color}" style="--swatch:${color}" class="${state.color===color?'chosen':''}"><i aria-hidden="true"></i><span>${escapeText(name)}</span></button>`).join('')}</div>${!colorOptions.length?`<p class="field-note" role="status">${variantLoadStatus==='loading'?'Cargando colores disponibles…':'No hay colores disponibles para esta talla y diseño.'}</p>`:''}</section><section class="detail-block size-block"><div class="detail-heading"><strong>${state.kind==='kids'?'Edad':state.kind==='body'?'Edad':'Talla'}</strong>${state.kind==='kids'||state.kind==='tote'||state.kind==='body'?'':`<button type="button" class="size-guide-trigger" id="open-size-guide"><span class="size-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16 16V4m-5 5 5-5 5 5"/><path d="M5 14v5h14v-5"/></svg></span><span class="size-guide-label">Guía de tallas</span><i aria-hidden="true">›</i></button>`}</div><div class="sizes ${adultShirtKinds.has(state.kind)?'named-garment-sizes':''}">${p.sizes.map(size=>`<button type="button" data-size="${size}" class="${state.size===size?'selected':''}" aria-pressed="${state.size===size}"><span class="size-name">${sizeLabel(state.kind,size)}</span><small class="size-price">${sizePriceLabel(state.kind,size,source)}</small></button>`).join('')}</div></section></div><div class="studio-price-summary" aria-live="polite"><div><span>Precio de tu selección</span><strong>${selectedVariant?money(pricing.total):'Elige talla y color'}</strong></div>${selectedVariant?`<small>Producto ${money(selectedPrice)} · Estampado ${pricing.print?`+${money(pricing.print)}`:'incluido'}${qualityReview?` · Revisión +${money(QUALITY_ADJUSTMENT_CLP)}`:''}</small>`:'<small>El precio final depende de la talla, el color y el estampado.</small>'}</div><section class="detail-block print-placement-block">${printSidesHtml()}</section>`;
 }
 if(state.step===1&&!state.catalogDesign&&failingSides().length){const names=[...includedSides().filter(side=>state.assessments[side]&&!state.assessments[side].qualifies).map(side=>sideNames[side].toLowerCase()),...state.additionalPrints.filter(item=>item.assessment&&!item.assessment.qualifies).map(item=>item.configuration.placement.startsWith('sleeve_')?'brazo':'bolsillo')].join(' y ');html+=`<aside class="quality-inline-notice" role="status"><strong>Revisión técnica necesaria</strong><p>El archivo de ${names} podría verse pixelado al imprimir. Lo revisaremos antes de producirlo; el ajuste se verá desglosado en el resumen.</p><span>+${money(QUALITY_ADJUSTMENT_CLP)}</span></aside>`}
 if(state.step===2)html=`<span class="eyebrow">PASO 2 · RESUMEN</span><h2>Tu idea, lista para pedir.</h2>${hasTwoSides()?`<div class="mockup-sides">${includedSides().map(side=>`<button type="button" data-view-side="${side}" class="${state.printSide===side?'selected':''}">${sideNames[side]}</button>`).join('')}</div>`:''}<p class="mockup-note">Gira el producto y revisa todos los detalles antes de añadirla al carro.</p>${qualityReview?`<div class="review-chip">Revisión del equipo incluida · ${money(QUALITY_ADJUSTMENT_CLP)}</div>`:''}<div class="order-summary"><div><span>${state.kind==='tote'?'Tote bag':state.kind==='body'?'Body bebé':`Polera ${p.name}`} · talla ${sizeLabel(state.kind,state.size)} · ${escapeText(selectedVariant?.colorName||state.color)}</span><strong>${money(pricing.base)}</strong></div><div><span>Diseño ${printSidesLabel()}</span><strong>${pricing.print?`+${money(pricing.print)}`:'Incluido'}</strong></div><div class="order-summary-detail"><span>Posición y tamaño</span><strong>${escapeText(printConfigurationLabel(currentPrintConfiguration(),choice))}</strong></div>${qualityReview?`<div><span>Ajuste técnico del archivo</span><strong>+${money(QUALITY_ADJUSTMENT_CLP)}</strong></div>`:''}<div><span>Extras</span><strong>${money(0)}</strong></div><div class="total"><span>Total</span><strong>${money(pricing.total)}</strong></div></div>`;
 if(state.step===2&&currentPurchaseMethod()==='whatsapp')html+=`<section class="whatsapp-purchase-contact" aria-labelledby="whatsapp-contact-title"><div class="whatsapp-contact-heading"><span class="eyebrow">DATOS PARA CONTACTARTE</span><h3 id="whatsapp-contact-title">Te escribiremos por WhatsApp.</h3><p>Completa tus datos para enviar la solicitud con tu selección.</p></div><div class="whatsapp-contact-fields"><label class="field"><span>Nombre completo</span><input id="whatsapp-name" required autocomplete="name" placeholder="Tu nombre" value="${escapeText(state.name||[state.firstName,state.lastName].filter(Boolean).join(' '))}"></label><label class="field"><span>Email</span><input id="whatsapp-email" required type="email" autocomplete="email" placeholder="tu@email.com" value="${escapeText(state.email)}"></label><label class="field"><span>Teléfono</span><input id="whatsapp-phone" required type="tel" autocomplete="tel" placeholder="+56 9 1234 5678" value="${escapeText(state.phone)}"></label></div><small class="whatsapp-contact-note"><span aria-hidden="true">📎</span><span>Al abrir WhatsApp, adjunta ahí tus imágenes o archivos de referencia.</span></small></section>`;
 if(state.step===3){state.editingContact=true;const shipping=state.shippingQuote?.amount||0,subtotal=cartTotal(),total=subtotal+shipping-state.couponDiscount,hasQuote=Boolean(state.shippingQuote);html=`<span class="eyebrow">PASO 3 · DATOS Y PAGO</span><div class="checkout-title-row"><h2>Completa tu pedido.</h2><button type="button" class="checkout-edit-order" id="edit-order">← Editar mi polera</button></div>${checkoutAccessHtml()}${fulfillmentPickerHtml()}${fulfillmentDetailsHtml()}${hasQuote?`<section class="shipping-quote" aria-live="polite"><span class="shipping-quote-icon" aria-hidden="true">✓</span><div><strong>${state.shippingQuote.label} calculado</strong><small>${state.fulfillment==='delivery'?`${state.commune}, ${state.region}`:'Coordinaremos el punto y horario contigo.'}</small></div><b>${shipping?money(shipping):'Gratis'}</b></section>`:`<p class="shipping-calculation-note">Completa los datos y calcula el despacho antes de pasar al pago.</p>`}<div class="notice">Elige tu medio de pago después de revisar el pedido.</div>`;next.textContent=hasQuote?`Ir a pagar · ${money(total)}`:'Calcular despacho';}
 document.querySelector('#step-content').innerHTML=html;
 if(state.step===1){
  stepContent.querySelectorAll('[data-catalog-purchase-mode]').forEach(button=>button.onclick=()=>chooseCatalogDesignPurchaseMode(button.dataset.catalogPurchaseMode));
  const details=stepContent.querySelector('.details-grid');
  const sizeBlock=details?.querySelector('.size-block');
  const colorBlock=details?.querySelector('.color-block');
  if(details&&sizeBlock&&colorBlock)details.insertBefore(sizeBlock,colorBlock);
  const blocks=stepContent.querySelectorAll('.product-family-block,.model-block,.size-block,.color-block,.print-placement-block');
  const positions=[...blocks].map(block=>DETAIL_BLOCK_ORDER.indexOf([...block.classList].find(name=>DETAIL_BLOCK_ORDER.includes(name))));
  if(positions.some((value,index)=>value!==index))console.warn('El orden del detalle no coincide con la secuencia comercial.',positions);
  const lookup=key=>stepContent.querySelector(`[data-product-family="${CSS.escape(key)}"],[data-product="${CSS.escape(key)}"],[data-size="${CSS.escape(key)}"],[data-color="${CSS.escape(key)}"],[data-print-sides="${CSS.escape(key)}"]`);
  preserveStudioView({scrollTop:preserveScroll,activeKey:preserveFocus,find:lookup});
 }
 if(state.step===1){
  mountStudioDetails(stepContent);
  const activePanel=stepContent.querySelector('.studio-detail-disclosure .is-active>.ds-disclosure-panel');
  if(activePanel&&activePanel.id===previousDetailPanelId)activePanel.style.animation='none';
 }
 if(state.step===1&&state.kind==='tote')stepContent.querySelector('.size-block .sizes')?.classList.add('named-tote-sizes');
 if(state.step===1&&state.catalogDesign){
  if(state.kind==='tote'){
   stepContent.querySelector('h2').textContent='Elige tu tote bag.';
   stepContent.querySelector('#open-size-guide')?.remove();
   const locked=stepContent.querySelector('.locked-color span');if(locked)locked.textContent='Tela natural para este diseño.';
  }
 }
 if(state.step===2&&state.kind==='tote'){
  const note=stepContent.querySelector('.mockup-note');if(note)note.textContent='Gira la tote bag y revisa todos los detalles antes de añadirla al carro.';
  const summary=stepContent.querySelector('.order-summary span');if(summary)summary.textContent=`Tote bag · talla ${sizeLabel(state.kind,state.size)} · ${selectedVariant?.colorName||state.color}`;
 }
 if(state.step===2){
  const placementSummary=stepContent.querySelector('.order-summary-detail strong');if(placementSummary)placementSummary.textContent=printConfigurationLabel(currentPrintConfiguration(),printChoice());
  let mockupTabs=stepContent.querySelector('.mockup-sides');if(!mockupTabs&&printCount()>1){mockupTabs=document.createElement('div');mockupTabs.className='mockup-sides';stepContent.querySelector('.mockup-note')?.before(mockupTabs)}if(mockupTabs)mockupTabs.innerHTML=allPrintLayers().map((item,index)=>{const active=state.activePrintId?state.activePrintId===item.id:state.printSide===item.side&&item.id===`primary-${item.side}`;return `<button type="button" data-view-print-layer="${item.id}" class="${active?'selected':''}">${index+1}. ${sideNames[item.side]} · ${PRINT_PLACEMENT_LABEL[item.placement]}</button>`}).join('');
 }
 if(state.step===3)renderCheckoutCartPreview();
 if(state.step===3){const notice=document.querySelector('#step-content .notice');if(notice)notice.insertAdjacentHTML('beforebegin',`<section class="checkout-coupon"><label for="checkout-coupon">Cupón de descuento</label><div><input id="checkout-coupon" value="${safe(state.couponCode)}" placeholder="Ingresa tu código"><button type="button" id="apply-coupon">Aplicar</button></div><small id="checkout-coupon-status" ${state.couponLabel?'data-tone="success"':''}>${safe(state.couponLabel||'El descuento se validará antes del pago.')}</small></section>`)}
 applyDesignSystemClasses(document.querySelector('#step-content'));
 ['summary-email','summary-first-name','summary-last-name','summary-phone'].forEach(id=>{const input=document.querySelector(`#${id}`);if(!input)return;if(!input.placeholder)input.placeholder='tu@email.com';const wrapper=document.createElement('div');wrapper.className='clearable-input';input.before(wrapper);wrapper.append(input);const clear=document.createElement('button');clear.type='button';clear.className='clear-input';clear.setAttribute('aria-label',`Borrar ${id.includes('phone')?'teléfono':id.includes('last-name')?'apellido':id.includes('name')?'nombre':'email'}`);clear.innerHTML='<span aria-hidden="true"></span>';clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()};wrapper.append(clear)});
 const addPrintInPlace=(button,update)=>replaceStudioControl({control:button,scroller:studioScroller,update,findReplacement:()=>stepContent.querySelector('.print-layer-card[open]>summary'),focus:element=>focusDisclosure(element,{scroll:false})});
 stepContent.querySelectorAll('[data-add-primary-print]').forEach(button=>button.onclick=()=>addPrintInPlace(button,()=>addPrimaryPrint(button.dataset.addPrimaryPrint)));
 stepContent.querySelectorAll('[data-add-print-layer]').forEach(button=>button.addEventListener('click',()=>addPrintInPlace(button,()=>addAdditionalPrint(button.dataset.addPrintLayer))));
 if(focusedLayer&&printFocusAttribute)stepContent.querySelector(`[data-print-layer-panel="${CSS.escape(focusedLayer)}"] [${printFocusAttribute}="${CSS.escape(printFocusValue)}"]`)?.focus({preventScroll:true});
 stepContent.querySelectorAll('[data-print-layer-panel]').forEach(panel=>panel.ontoggle=()=>{
  if(!panel.isConnected)return;
  panel.classList.toggle('selected',panel.open);panel.querySelector('summary b').textContent=panel.open?'Cerrar':'Editar';
  if(!panel.open){if(openPrintLayerId===panel.dataset.printLayerPanel)openPrintLayerId=null;return;}
  openPrintLayerId=panel.dataset.printLayerPanel;
  stepContent.querySelectorAll('[data-print-layer-panel]').forEach(other=>{if(other!==panel)other.open=false});
  activatePrintLayer(openPrintLayerId);persistDraft();faceSelectedSide();viewer?.update(previewState());
 });
 stepContent.querySelectorAll('[data-close-print-layer]').forEach(button=>button.onclick=()=>{const panel=button.closest('details');panel.open=false;openPrintLayerId=null;panel.querySelector('summary').focus({preventScroll:true})});
 stepContent.querySelectorAll('[data-remove-print-layer]').forEach(button=>button.onclick=event=>{event.stopPropagation();removeAdditionalPrint(button.dataset.removePrintLayer)});
 stepContent.querySelectorAll('[data-remove-primary-print]').forEach(button=>button.onclick=event=>{event.stopPropagation();removePrimaryPrint(button.dataset.removePrimaryPrint)});
 stepContent.querySelectorAll('[data-extra-print-side]').forEach(button=>button.onclick=()=>changeAdditionalPrintSide(button.dataset.extraPrintSide));
 stepContent.querySelectorAll('[data-adjust-print-side]').forEach(button=>button.onclick=()=>{state.printAdjustmentsOpen=true;activateSide(button.dataset.adjustPrintSide);persistDraft();renderStep();faceSelectedSide()});
 const configurationFor=button=>{const id=button.closest('[data-print-layer-id]')?.dataset.printLayerId;activatePrintLayer(id);return [id,printLayerConfiguration(id)]};
 stepContent.querySelectorAll('[data-print-placement]').forEach(button=>button.onclick=()=>{const [,config]=configurationFor(button);if(!config)return;config.placement=button.dataset.printPlacement;if(['chest_left','chest_right','sleeve_left','sleeve_right','sleeve_both'].includes(config.placement)&&config.size==='large'){config.size='pocket';config.scale=PRINT_SIZE_SCALE.pocket}state.printScale=config.scale;persistDraft();renderStep();faceSelectedSide()});
 stepContent.querySelectorAll('[data-print-size]').forEach(button=>button.onclick=()=>{const [,config]=configurationFor(button);if(!config)return;config.size=button.dataset.printSize;config.scale=PRINT_SIZE_SCALE[config.size];state.printScale=config.scale;persistDraft();renderStep();viewer?.update(previewState())});
 stepContent.querySelectorAll('[data-print-move]').forEach(button=>button.onclick=()=>{const [,config]=configurationFor(button);if(!config)return;const direction=button.dataset.printMove;if(direction==='reset'){config.offsetX=0;config.offsetY=0}else if(direction==='left')config.offsetX=Math.max(-2,config.offsetX-1);else if(direction==='right')config.offsetX=Math.min(2,config.offsetX+1);else if(direction==='up')config.offsetY=Math.max(-2,config.offsetY-1);else if(direction==='down')config.offsetY=Math.min(2,config.offsetY+1);persistDraft();renderStep();viewer?.update(previewState())});
 stepContent.querySelectorAll('[data-reset-print-adjustments]').forEach(button=>button.addEventListener('click',()=>{const [id,config]=configurationFor(button);if(!config)return;const extra=state.additionalPrints.find(item=>item.id===id);if(extra)extra.configuration={...defaultPrintSideConfiguration(extra.side),placement:extra.configuration.placement?.startsWith('chest_')?'chest_left':'sleeve_left',size:'pocket',scale:PRINT_SIZE_SCALE.pocket};else state.printConfigurations[config===state.printConfigurations.back?'back':'front']=defaultPrintSideConfiguration(config===state.printConfigurations.back?'back':'front');state.printScale=printLayerConfiguration(id).scale;persistDraft();renderStep();viewer?.update(previewState())}));
 const selectProductKind=async (kind,decision='model')=>{
  if(kind===state.kind){confirmDetail(decision);persistDraft();renderStep();return;}
  const source=catalogDesigns.find(item=>item.id===state.catalogDesignSlug),design=source&&designForProduct(source,modelProductSlug(kind));
  if(source&&!design)return toast('Este diseño no está disponible para ese producto.','error');
  const changingProduct=source&&modelProductSlug(kind)!==modelProductSlug(state.kind);
  if(changingProduct){
   const transition=++productTransitionVersion;
   const controls=[...stepContent.querySelectorAll('button,input')],disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
   try{
    const image=await loadCatalogArtwork(design);
    if(transition!==productTransitionVersion){controls.forEach((control,index)=>control.disabled=disabled[index]);return}
    const side=state.printSide,previous=state.images[side];
    state.images[side]=artworkUrl(design);state.uploadFiles[side]=null;state.files[side]=`droska-${source.id}-${kind}.webp`;state.cloudSaved[side]=false;state.assessments[side]=checkResolution(image.naturalWidth,image.naturalHeight);activateSide(side);
    if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
   }catch{controls.forEach((control,index)=>control.disabled=disabled[index]);return toast('No pudimos cargar el archivo para ese producto. Inténtalo otra vez.','error')}
  }
  state.kind=kind;
  if(kind==='tote'){if(!state.images.front&&state.images.back)moveCatalogDesignTo('front');state.printSides=['front'];activateSide('front')}
  if(!products[kind].sizes.includes(state.size))state.size=products[kind].sizes[0]||'';reconcileVariant(source?.sampleColor,true);confirmDetail(decision);persistDraft();renderStep();
 };
 document.querySelectorAll('[data-product-family]').forEach(button=>{
  button.onclick=()=>{
   const source=selectedCatalogDesign(),next=productsForFamily(button.dataset.productFamily).find(([id])=>designSupportsProduct(source,id)&&eligibleVariants(id,null,source).length);
   if(next)void selectProductKind(next[0],'product');
  };
 });
 document.querySelectorAll('[data-product]').forEach(button=>button.onclick=()=>selectProductKind(button.dataset.product));
 document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{state.size=b.dataset.size;reconcileVariant(selectedCatalogDesign()?.sampleColor,true);confirmDetail('size');persistDraft();renderStep()});
 document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;reconcileVariant();confirmDetail('color');persistDraft();renderStep();viewer?.update(previewState())});
 const guide=document.querySelector('#size-guide-modal');const openGuide=document.querySelector('#open-size-guide');if(openGuide)openGuide.onclick=()=>guide.showModal();
 guide.querySelectorAll('[data-size-close]').forEach(button=>button.onclick=()=>guide.close());
 guide.querySelectorAll('[data-guide-size]').forEach(button=>button.onclick=()=>{state.size=button.dataset.guideSize;reconcileVariant(selectedCatalogDesign()?.sampleColor,true);guide.close();confirmDetail('size');persistDraft();renderStep();toast(`Talla ${sizeLabel(state.kind,state.size)} seleccionada.`)});
 document.querySelectorAll('[data-view-side]').forEach(b=>b.onclick=()=>{activateSide(b.dataset.viewSide);renderStep();faceSelectedSide()});
 document.querySelectorAll('[data-view-print-layer]').forEach(button=>button.onclick=()=>{const id=button.dataset.viewPrintLayer;if(id.startsWith('primary-'))activateSide(id.replace('primary-',''));else activateAdditionalPrint(id);renderStep();faceSelectedSide()});
 document.querySelectorAll('[data-remove-side]').forEach(b=>b.onclick=()=>{removeSide(b.dataset.removeSide);renderStep();toast('Archivo eliminado.')});
 document.querySelectorAll('[data-file-side]').forEach(file=>{const side=file.dataset.fileSide;file.onchange=()=>upload(file.files[0],side);const drop=file.closest('.dropzone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');upload(e.dataTransfer.files[0],side)}})
 document.querySelectorAll('[data-extra-file]').forEach(input=>{const id=input.dataset.extraFile;input.onchange=()=>uploadAdditionalPrint(input.files[0],id);const drop=input.closest('.dropzone');drop.ondragover=event=>{event.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=event=>{event.preventDefault();drop.classList.remove('dragging');uploadAdditionalPrint(event.dataTransfer.files[0],id)}});
 document.querySelectorAll('[data-remove-extra-file]').forEach(button=>button.onclick=()=>removeAdditionalPrintFile(button.dataset.removeExtraFile));
 const clearShippingQuote=invalidateShippingQuote;
 const refreshShippingQuote=decision=>{recalculateShippingQuote();if(decision)confirmCheckoutDecision(decision);renderStep()};
 const address=document.querySelector('#delivery-address');if(address){address.oninput=()=>{clearShippingQuote();state.address=address.value;storeCustomerDetails()};address.onchange=()=>activePublicFlow?.refresh()}
 const commune=document.querySelector('#delivery-commune');setupSearchFilter(commune,()=>communesForRegion(document.querySelector('#delivery-region')?.value||state.region),(value,committed)=>{clearShippingQuote();commune.setCustomValidity('');state.commune=value;storeCustomerDetails();if(committed)refreshShippingQuote('commune')},'No encontramos una comuna en esta región.');
 const region=document.querySelector('#delivery-region');setupRegionFilter(region,(value,committed)=>{clearShippingQuote();region.setCustomValidity('');state.region=value;const allowed=communesForRegion(value);if(commune&&commune.value&&!allowed.some(item=>samePlace(item,commune.value))){commune.value='';state.commune=''}storeCustomerDetails();if(committed)refreshShippingQuote('region')});
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
 document.querySelectorAll('[data-fulfillment]').forEach(button=>button.onclick=()=>{state.fulfillment=button.dataset.fulfillment;state.shippingQuote=null;recalculateShippingQuote();confirmCheckoutDecision('fulfillment');persistDraft();renderStep()});
 if(state.step===2&&currentPurchaseMethod()==='whatsapp'){
  for(const [id,key] of [['whatsapp-name','name'],['whatsapp-email','email'],['whatsapp-phone','phone']]){const input=stepContent.querySelector('#'+id);if(input)input.oninput=()=>{state[key]=input.value;if(key==='name'){const parts=input.value.trim().split(/\s+/);state.firstName=parts.shift()||'';state.lastName=parts.join(' ')}}}
  activePublicFlow=mountWhatsAppFlow({container:stepContent,button:next,disclosure:publicFlowState(`whatsapp:${state.catalogDesignSlug||'own'}:${state.kind}`),busy:()=>publicRequestBusy});
 }
 if(state.step===3&&!state.catalogDesignCustomerImage)activePublicFlow=mountCheckoutFlow({container:stepContent,button:next,state,disclosure:publicFlowState('checkout'),regions:chileRegions,communesForRegion,samePlace,onConfirm:id=>{if(id==='address'){recalculateShippingQuote();publicFlowState('checkout').focus='next';queueMicrotask(()=>{if(studio.open&&state.step===3)renderStep()})}}});
 restorePublicFocus();syncScaleControl();syncPreview();
 if(checkoutScrollSnapshot){const {scroller,top}=checkoutScrollSnapshot;checkoutScrollSnapshot=null;requestAnimationFrame(()=>{if(scroller)scroller.scrollTop=top;const quote=document.querySelector('.shipping-quote');quote?.classList.add('is-new');quote?.scrollIntoView({block:'nearest'});setTimeout(()=>quote?.classList.remove('is-new'),1400)})}
 normalizeTextSymbols(document.querySelector('#step-content')||document);
 // Restore only after the disclosure has moved its nodes and hidden other steps.
 if(state.step===1&&studioScroller)studioScroller.scrollTop=preserveScroll;
}
async function addReferenceFiles(fileList){
 const incoming=[...(fileList||[])];if(!incoming.length)return;
 if(state.references.length>=MAX_IDEA_REFERENCES)return toast(`Puedes adjuntar hasta ${MAX_IDEA_REFERENCES} fotos de referencia.`);
 if(state.referencesBusy)return;const requestId=state.creativeRequestId;state.referencesBusy=true;activePublicFlow?.refresh();
 let added=0;
 for(const file of incoming){
  if(state.references.length>=MAX_IDEA_REFERENCES)break;
  if(imageFileError(file,CUSTOMER_IMAGE_POLICY))continue;
  try{const optimized=await optimizeImage(file,{policy:CUSTOMER_IMAGE_POLICY,baseName:file.name}),url=URL.createObjectURL(optimized.file);if(requestId!==state.creativeRequestId){URL.revokeObjectURL(url);return}if(state.references.length>=MAX_IDEA_REFERENCES){URL.revokeObjectURL(url);break}state.references.push({name:optimized.file.name,url,file:optimized.file,path:null});added++}catch{}
 }
 state.referencesBusy=false;renderStep();
 if(!added)return toast('Elige fotos JPG, PNG o WEBP legibles de hasta 12 MB.');
 if(added<incoming.length)toast(`Adjuntamos ${added} foto${added===1?'':'s'}. El máximo es ${MAX_IDEA_REFERENCES}; algunas fotos no eran compatibles o no se pudieron leer.`);
 else toast(`${added} foto${added===1?' adjunta':'s adjuntas'} como referencia opcional.`);
}
async function upload(file,side=state.printSide,fromCatalog=false){
 if(!file)return false;
 const validation=imageFileError(file,CUSTOMER_IMAGE_POLICY);if(validation){toast(validation);return false}
 openPrintLayerId=`primary-${side}`;const token=++uploadVersions[side];let url='';state.checking=true;state.checkingSide=side;activateSide(side);renderStep();viewer?.face(side);
 try{
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const optimized=await optimizeImage(file,{policy:CUSTOMER_IMAGE_POLICY,baseName:file.name});file=optimized.file;url=URL.createObjectURL(file);
  const img=new Image();img.src=url;await img.decode();if(token!==uploadVersions[side]){URL.revokeObjectURL(url);return false}
  const previous=state.images[side];if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
  state.images[side]=url;state.files[side]=file.name;state.uploadFiles[side]=file;state.cloudSaved[side]=false;if(side==='front'&&!fromCatalog&&!state.catalogDesignCustomerImage){state.catalogDesign=null;state.catalogDesignSlug=null;state.catalogDesignName=null}activateSide(side);state.uploaded=hasRequiredFiles();state.file=file.name;state.artworkTone=artworkTone(img);state.assessment=checkResolution(img.naturalWidth,img.naturalHeight);state.assessments[side]=state.assessment;if(!fromCatalog){const config=activePrintConfiguration();config.size='large';config.scale=USER_ARTWORK_SCALE;state.printScale=config.scale}state.checking=false;state.checkingSide='';state.qualityAccepted=false;state.qualityReview=false;saveDesignFile(side,file).catch(()=>toast('El diseño se cargó, pero este navegador no pudo guardarlo para después.'));renderStep();faceSelectedSide();toast(state.assessment.qualifies?'Diseño optimizado y mockup actualizado.':'Diseño optimizado y mockup actualizado. Incluiremos revisión técnica.');return true
 }catch(error){if(url)URL.revokeObjectURL(url);if(token===uploadVersions[side]){state.checking=false;state.checkingSide='';renderStep();toast(error.message||'El archivo no se pudo leer. Prueba con otra imagen.')}return false}}
async function uploadAdditionalPrint(file,id){
 const item=state.additionalPrints.find(candidate=>candidate.id===id);if(!file||!item)return false;
 const validation=imageFileError(file,CUSTOMER_IMAGE_POLICY);if(validation){toast(validation);return false}
 openPrintLayerId=id;const versionKey=`extra:${id}`,token=uploadVersions[versionKey]=(uploadVersions[versionKey]||0)+1;let url='';item.checking=true;activateAdditionalPrint(id);renderStep();viewer?.face(item.side);
 try{
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const optimized=await optimizeImage(file,{policy:CUSTOMER_IMAGE_POLICY,baseName:file.name});file=optimized.file;url=URL.createObjectURL(file);
  const image=new Image();image.src=url;await image.decode();if(token!==uploadVersions[versionKey]){URL.revokeObjectURL(url);return false}
  if(item.image?.startsWith('blob:'))URL.revokeObjectURL(item.image);item.image=url;item.file=file;item.fileName=file.name;item.assessment=checkResolution(image.naturalWidth,image.naturalHeight);item.checking=false;state.qualityAccepted=false;state.qualityReview=false;state.uploaded=hasRequiredFiles();saveDesignFile(versionKey,file).catch(()=>toast('El estampado se cargó, pero este navegador no pudo guardarlo para después.'));persistDraft();renderStep();faceSelectedSide();toast(item.assessment.qualifies?'Estampado optimizado y listo.':'Estampado optimizado. Incluiremos revisión técnica.');return true
 }catch(error){if(url)URL.revokeObjectURL(url);if(token===uploadVersions[versionKey]){item.checking=false;renderStep();toast(error.message||'El archivo no se pudo leer. Prueba con otra imagen.')}return false}
}
function removeAdditionalPrintFile(id){const item=state.additionalPrints.find(candidate=>candidate.id===id);if(!item)return;if(item.image?.startsWith('blob:'))URL.revokeObjectURL(item.image);item.image='';item.file=null;item.fileName='';item.assessment=null;removeSavedDesignFile(`extra:${id}`).catch(()=>{});state.uploaded=hasRequiredFiles();state.qualityAccepted=false;state.qualityReview=false;persistDraft();renderStep();toast('Archivo eliminado.')}
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
async function openWhatsAppForCurrentSelection(){
 if(publicRequestBusy)return;
 const fields=[document.querySelector('#whatsapp-name'),document.querySelector('#whatsapp-email'),document.querySelector('#whatsapp-phone')];
 for(const field of fields)if(!field?.checkValidity()){field?.reportValidity();return}
 const popup=window.open('about:blank','droska-whatsapp'),release=lockStudioRequest();
 try{
  const [name,email,phone]=fields.map(field=>field.value.trim());state.name=name;state.email=email;state.phone=phone;
  const variant=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant;
  if(!variant)throw new Error('La talla o el color ya no están disponibles.');
  const personalization=state.catalogDesignCustomerImage?'Adjuntaré la imagen del cliente en este chat.':currentPurchaseType()==='personalized'?'Adjuntaré mi diseño o referencia en este chat.':'';
  const printSides=printChoice(),printConfiguration=currentPrintConfiguration();
  const order=await createWhatsAppOrder({requestType:'purchase',customer:{name,email,phone},details:personalization,product:{variantId:variant.id,modelCode:state.kind,size:state.size,color:state.color,printSides,printConfiguration,catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:Boolean(state.catalogDesignCustomerImage),purchaseType:currentPurchaseType()}});
  const message=buildWhatsAppPurchaseMessage({purchaseType:currentPurchaseType(),productName:state.kind==='tote'?'Tote bag':state.kind==='body'?'Body bebé':'Polera',designName:state.catalogDesignName||state.catalogDesign,model:products[state.kind]?.name,size:sizeLabel(state.kind,state.size),color:variant?.colorName||state.color,sides:printConfigurationLabel(printConfiguration,printSides),quantity:1,personalization:[personalization,`Solicitud #${order.orderId}`].filter(Boolean).join(' · '),customer:{name,email,phone}});
  const url=whatsappPurchaseUrl(storefrontSettings.whatsapp_number,message);storeCustomerDetails();persistDraft();
  if(popup)popup.location.replace(url);else window.location.assign(url);
 }catch(error){popup?.close();toast(error.message||'No pudimos preparar la solicitud por WhatsApp.','error')}finally{release()}
}
async function restoreSavedDesigns(){
 try{
  const saved=await savedDesignFiles();
  for(const stored of saved){
   if(stored.expiresAt<=Date.now()){removeSavedDesignFile(stored.side).catch(()=>{});continue}
   if(!(stored.file instanceof Blob))continue;
   const url=URL.createObjectURL(stored.file),image=new Image();image.src=url;
   try{await image.decode()}catch{URL.revokeObjectURL(url);removeSavedDesignFile(stored.side).catch(()=>{});continue}
   if(String(stored.side).startsWith('extra:')){
    const extra=state.additionalPrints.find(item=>`extra:${item.id}`===stored.side);if(!extra){URL.revokeObjectURL(url);continue}
    extra.image=url;extra.file=stored.file;extra.fileName=stored.file.name||extra.fileName||'Diseño guardado';extra.assessment=checkResolution(image.naturalWidth,image.naturalHeight);continue
   }
   if(!['front','back'].includes(stored.side)){URL.revokeObjectURL(url);continue}
   state.images[stored.side]=url;state.files[stored.side]=stored.file.name||'Diseño guardado';state.uploadFiles[stored.side]=stored.file;state.assessments[stored.side]=checkResolution(image.naturalWidth,image.naturalHeight);state.artworkTone=artworkTone(image)
  }
  state.uploaded=hasRequiredFiles();activateSide(includedSides()[0]);syncPreview();if(studio.open)renderStep()
 }catch{}
}
function persistDraft(){syncFullName();try{saveForFifteenDays(DRAFT_KEY,{kind:state.kind,size:state.size,color:state.color,variantId:state.variantId,printSides:state.printSides,printConfigurations:normalizePrintConfiguration(state.printConfigurations,printChoice()),additionalPrints:state.additionalPrints.map(item=>({id:item.id,side:item.side,configuration:item.configuration,fileName:item.fileName})),qualityReview:state.qualityReview,fulfillment:state.fulfillment,checkoutDraftId:state.checkoutDraftId,disclosure:{version:1,scope:detailsDisclosureScope,confirmed:detailsDisclosure.confirmed},date:new Date().toISOString()});saveForFifteenDays(CATALOG_DRAFT_KEY,{catalogDesignSlug:state.catalogDesignSlug,catalogDesignName:state.catalogDesignName,catalogDesignCustomerImage:Boolean(state.catalogDesignCustomerImage),catalogDesignPurchaseMode:state.catalogDesignPurchaseMode})}catch{toast('No pudimos guardar el avance en este navegador.')}}
document.querySelector('#back').onclick=()=>{state.step=Math.max(1,state.step-1);renderStep()};
document.querySelector('#design-form').onsubmit=e=>{
 e.preventDefault();if(state.checking||checkoutOpening||state.petRequest?.busy||publicRequestBusy)return;
 if(activePublicFlow&&!activePublicFlow.guardFinal(e))return;
 if(state.mode==='custom'){document.querySelector('#custom-submit')?.click();return;}
 if(state.catalogDesignCustomerImage&&state.step>1){
  const draft=state.petRequest;
  if(state.step===2){if(currentPurchaseMethod()!=='whatsapp'){const error=petPhotoError(draft?.files?.length?draft.files:draft?.file,selectedCatalogDesign()?.customerPhotoSubject);if(error)return toast(error,'error')}state.step=3;return renderStep()}
  if(draft.orderId)return;
  const variant=resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant;
  if(!variant){state.step=1;renderStep();return toast('Revisa una talla y color disponibles.','error')}
  const fields=[...document.querySelectorAll('[data-pet-contact]')];
  for(const field of fields)if(!field.value.trim()||!field.reportValidity())return field.focus();
  if(currentPurchaseMethod()==='whatsapp'){
   draft.busy=true;const popup=window.open('about:blank','droska-whatsapp'),release=lockStudioRequest();
   const status=document.querySelector('[data-pet-status]');if(status)status.textContent='Preparando tu solicitud para WhatsApp…';
   (async()=>{
    try{
     const people=selectedCatalogDesign()?.customerPhotoSubject==='people';const personalization=[draft.petName&&`${people?'Persona':'Mascota'}: ${draft.petName}`,draft.notes,people?'Adjuntaré la foto de la persona en este chat.':'Adjuntaré la foto de mi mascota en este chat.'].filter(Boolean).join(' · ');
     const printSides=state.printSide==='back'?'back':'front',printConfiguration=normalizePrintConfiguration(state.printConfigurations,printSides);
     const order=await createWhatsAppOrder({requestType:'purchase',customer:{name:draft.firstName,email:draft.email,phone:draft.phone},details:personalization,product:{variantId:variant.id,modelCode:state.kind,size:state.size,color:state.color,printSides,printConfiguration,catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:true,purchaseType:'personalized'}});
     const message=buildWhatsAppPurchaseMessage({purchaseType:'personalized',productName:state.kind==='tote'?'Tote bag':state.kind==='body'?'Body bebé':'Polera',designName:state.catalogDesignName,model:products[state.kind].name,size:state.size,color:variant.colorName||state.color,sides:printConfigurationLabel(printConfiguration,printSides),personalization:[personalization,`Solicitud #${order.orderId}`].filter(Boolean).join(' · '),customer:{name:draft.firstName,email:draft.email,phone:draft.phone}});
     const url=whatsappPurchaseUrl(storefrontSettings.whatsapp_number,message);
     if(popup)popup.location.replace(url);else window.location.assign(url);
    }catch(error){popup?.close();toast(error.message||'No pudimos registrar la solicitud. Intenta nuevamente.','error')}finally{draft.busy=false;if(status)status.textContent='';release()}
   })()
   return;
  }
  const controls=[...studio.querySelectorAll('button,input,textarea')],disabled=controls.map(control=>control.disabled);
  draft.busy=true;controls.forEach(control=>control.disabled=true);studio.setAttribute('aria-busy','true');
  const status=document.querySelector('[data-pet-status]');
  sendPetRequest({draft,design:selectedCatalogDesign(),selection:{variantId:variant.id,modelCode:state.kind,model:products[state.kind].name,size:state.size,color:variant.colorName,colorHex:state.color,side:state.printSide},supabase,
    uploadPhoto:(userId,file)=>uploadPrivateDesign(supabase,userId,'reference',file),onStatus:message=>{status.textContent=message}
  }).then(()=>renderStep()).catch(error=>{status.textContent=error.message}).finally(()=>{draft.busy=false;studio.removeAttribute('aria-busy');controls.forEach((control,index)=>control.disabled=disabled[index])});
  return;
 }
 if(state.step===1){const customPlacement=studioDetailIncludesPrintPlacement(state.catalogDesignSlug);if(!detailsCanContinue()){detailsDisclosure.focus=ensureDetailsDisclosure().pending;renderStep();return toast(customPlacement?'Completa la ubicación y los archivos pendientes para continuar.':'Completa las opciones pendientes para continuar.','error')}if(customPlacement&&!confirmDetail('side')){detailsDisclosure.focus='side';renderStep();return toast('Completa la ubicación y los archivos pendientes para continuar.','error')}persistDraft();const whatsappPurchase=currentPurchaseMethod()==='whatsapp';if(!resolveAvailableVariant(state.kind,state.size,state.color,selectedCatalogDesign()).variant)return toast('Elige una talla y color disponibles para este diseño.','error');if(customPlacement&&!whatsappPurchase&&!hasRequiredFiles())return toast('Carga el archivo pendiente de cada estampado para continuar.');state.qualityAccepted=true;state.qualityReview=effectiveQualityReview({catalogDesignSlug:state.catalogDesignSlug,catalogDesignCustomerImage:state.catalogDesignCustomerImage,qualityReview:Boolean(failingSides().length)});state.step=2;activateSide(includedSides()[0]);return renderStep()}
 if(state.step===2){if(currentPurchaseMethod()==='whatsapp'){void openWhatsAppForCurrentSelection();return}addCurrentToCart();return}
 const summaryFirstName=document.querySelector('#summary-first-name'),summaryLastName=document.querySelector('#summary-last-name'),summaryEmail=document.querySelector('#summary-email'),summaryPhone=document.querySelector('#summary-phone');
 if(state.editingContact){for(const field of [summaryFirstName,summaryLastName,summaryEmail,summaryPhone])if(!field?.checkValidity())return field?.reportValidity();state.firstName=summaryFirstName.value.trim();state.lastName=summaryLastName.value.trim();state.email=summaryEmail.value.trim();state.phone=fullChilePhone(summaryPhone.value)}
 if(!state.firstName||!state.lastName||!state.email||!state.phone){state.editingContact=true;renderStep();return document.querySelector('#summary-first-name')?.focus()}
 if(state.fulfillment==='delivery'){const fields=['delivery-region','delivery-address','delivery-commune'].map(id=>document.querySelector(`#${id}`));for(const field of fields)if(!field?.checkValidity())return field?.reportValidity();const matchedRegion=chileRegions.find(region=>samePlace(region,fields[0].value.trim()));if(!matchedRegion){fields[0].setCustomValidity('Selecciona una región de la lista.');return fields[0].reportValidity()}const matchedCommune=communesForRegion(matchedRegion).find(commune=>samePlace(commune,fields[2].value.trim()));if(!matchedCommune){fields[2].setCustomValidity('Selecciona una comuna de la lista.');return fields[2].reportValidity()}state.region=matchedRegion;state.address=fields[1].value.trim();state.commune=matchedCommune;state.addressExtra=document.querySelector('#delivery-address-extra')?.value.trim()||'';state.deliveryNotes=document.querySelector('#delivery-notes')?.value.trim()||''}
 storeCustomerDetails();state.editingContact=false;state.checkoutReady=true;persistDraft();if(!state.shippingQuote){const scroller=studio.querySelector('.studio-controls');checkoutScrollSnapshot={scroller,top:scroller?.scrollTop||0};state.shippingQuote=quoteShipping(state.fulfillment,state.region,cart.reduce((sum,item)=>sum+item.quantity,0));renderStep();return}openPaymentConfirmation()
};
async function paymentArtworkFor(item,userId){
  if(item.catalogDesignSlug&&!item.catalogDesignCustomerImage)return {frontDesignPath:null,backDesignPath:null,printConfiguration:normalizePrintConfiguration(item.printConfiguration,item.printSides)};
 const sides=item.printSides==='both'?['front','back']:[item.printSides];
 let originals=await cartDesignFiles(item.id);
 if(!originals&&sides.length===1){
  const preview=await cartPreviewFile(item.designPreview,sides[0]);
  if(preview)originals={[sides[0]]:preview};
 }
 if(!originals)throw new Error('Falta el diseño de una polera del carro. Vuelve al estudio y añádela nuevamente antes de pagar.');
 const paths={frontDesignPath:null,backDesignPath:null};
 const configuration=normalizePrintConfiguration(item.printConfiguration,item.printSides);
 if(configuration.prints?.length){
  const prints=[];
  for(const print of configuration.prints){
   const primarySide=print.id===`primary-${print.side}`;
   const file=primarySide?originals[print.side]:originals.prints?.[print.id];
   if(!(file instanceof Blob))throw new Error(`Falta el archivo original del estampado ${print.fileName||print.id}. Vuelve a añadir la polera.`);
   const designPath=await uploadPrivateDesign(supabase,userId,print.side,file);prints.push({...print,designPath});
   if(primarySide)paths[print.side==='front'?'frontDesignPath':'backDesignPath']=designPath;
  }
  return {...paths,printConfiguration:normalizePrintConfiguration({...configuration,prints},item.printSides)};
 }
 for(const side of sides){
  const file=originals[side];
  if(!(file instanceof Blob))throw new Error(`Falta el archivo original del ${side==='front'?'frente':'reverso'}. Vuelve a añadir la polera.`);
  paths[side==='front'?'frontDesignPath':'backDesignPath']=await uploadPrivateDesign(supabase,userId,side,file);
 }
 return {...paths,printConfiguration:configuration};
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
   const printSides=item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front');
   items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides,printConfiguration:normalizePrintConfiguration(item.printConfiguration,printSides),quantity:item.quantity,qualityReview:effectiveQualityReview(item),variantId:item.variantId||null,catalogDesignSlug:item.catalogDesignSlug||null,catalogDesignCustomerImage:Boolean(item.catalogDesignCustomerImage),...artwork});
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
  for(const item of cart){const artwork=await paymentArtworkFor(item,user.id),printSides=item.printSides||(/^Espalda$/i.test(item.sides)?'back':item.sides?.includes('+')?'both':'front');items.push({modelCode:item.modelCode||Object.entries(products).find(([,product])=>product.name===item.kind)?.[0]||'basic',size:item.size,color:item.color,printSides,printConfiguration:normalizePrintConfiguration(item.printConfiguration,printSides),quantity:item.quantity,qualityReview:effectiveQualityReview(item),variantId:item.variantId||null,catalogDesignSlug:item.catalogDesignSlug||null,catalogDesignCustomerImage:Boolean(item.catalogDesignCustomerImage),...artwork})}
  const payload={paymentMethod:'transfer',draftOrderId:state.checkoutDraftId,items,couponCode:state.couponCode||null,fulfillment:state.fulfillment,shippingQuoteClp:state.shippingQuote?.amount??null,customer:{firstName:state.firstName,lastName:state.lastName,email:state.email,phone:state.phone},shippingAddress:state.fulfillment==='delivery'?{region:state.region,commune:state.commune,address:state.address,addressExtra:state.addressExtra,notes:state.deliveryNotes}:null};
  const {data,error}=await supabase.functions.invoke('create-payment-preference',{body:payload});
  if(error||!data?.orderId)throw new Error(data?.error||await paymentFunctionError(error,'No pudimos ingresar el pedido por transferencia. Intenta nuevamente.'));
  const submittedCart=[...cart];cart=[];state.cartItemId=null;state.checkoutDraftId=null;saveLocal(CART_KEY,cart);updateCommerceNav();for(const item of submittedCart)removeCartDesignFiles(item.id).catch(()=>{});
  const transfer=data.paymentInstructions?.transfer||{},account=[transfer.holder&&`<div><span>Titular</span><strong>${safe(transfer.holder)}</strong></div>`,transfer.bank&&`<div><span>Banco</span><strong>${safe(transfer.bank)}</strong></div>`,(transfer.account_type||transfer.account_number)&&`<div><span>Cuenta</span><strong>${safe(`${transfer.account_type||''} ${transfer.account_number||''}`.trim())}</strong></div>`,transfer.rut&&`<div><span>RUT</span><strong>${safe(transfer.rut)}</strong></div>`,transfer.email&&`<div><span>Email</span><strong>${safe(transfer.email)}</strong></div>`].filter(Boolean).join('');const emailNote=data.email?.sent?'También enviamos estos datos a tu correo.':'Guarda estos datos para hacer la transferencia. Podrás verlos nuevamente en Mis pedidos al iniciar sesión.';const target=document.querySelector('#payment-content');setPaymentLoading(false,'Solicitar pago por transferencia');target.innerHTML=`<div class="mp-success"><div class="mp-success-icon" aria-hidden="true">✓</div><span class="eyebrow">PEDIDO RECIBIDO</span><h2>Completa tu transferencia.</h2><p>Tu pedido #${data.orderId} quedó ingresado y pendiente de confirmación.</p><dl class="account-order-payment">${account}</dl><p>${emailNote}</p><button type="button" class="button dark" id="transfer-done">Entendido</button><small>Comenzaremos a preparar tu pedido cuando confirmemos el abono.</small></div>`;target.querySelector('#transfer-done').onclick=()=>paymentModal.close();persistDraft();
 }catch(error){setPaymentLoading(false,'Solicitar pago por transferencia');if(errorNode){errorNode.textContent=error.message||'No pudimos ingresar el pedido por transferencia.';errorNode.hidden=false}}
}
async function showMercadoPagoReturn(){
 const params=new URLSearchParams(location.search),status=params.get('mp_status');
 if(!status)return;
 const orderId=params.get('order_id');
 const cleanUrl=new URL(location.href);['mp_status','order_id','payment_id','status','external_reference','preference_id'].forEach(key=>cleanUrl.searchParams.delete(key));history.replaceState(null,'',`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
 if(status==='failure')persistDraft()
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
let toastTimer;function toast(message,tone='info'){const raw=String(message||''),guestCheckoutFailure=/no pudimos iniciar la compra como invitado/i.test(raw),looksTechnical=/invalid|credentials|email not confirmed|already registered|password should|rate limit|auth|anonymous sign-ins are disabled/i.test(raw),localized=(looksTechnical||guestCheckoutFailure)?authErrorMessage(raw):raw,resolvedTone=guestCheckoutFailure?'error':tone;const el=document.querySelector('#toast');(document.querySelector('dialog[open]')||document.body).append(el);el.dataset.tone=resolvedTone;el.setAttribute('role',resolvedTone==='error'?'alert':'status');el.innerHTML=`<span aria-hidden="true">${resolvedTone==='error'?'!':'✓'}</span><p>${safe(localized)}</p>`;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500)}
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
mountHomeSnow();
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
if(import.meta.env.DEV){const theme=new URLSearchParams(location.search).get('preview-theme');if(theme==='light'||theme==='dark')savedTheme=theme}
setTheme(savedTheme,{persist:false});

Promise.resolve(initialStoreSettings).then(settings=>{storefrontSettings=settings;QUALITY_ADJUSTMENT_CLP=settings.quality_review_fee_clp;PRINT_PRICES=settings;normalizeCartPrices();applyStoreSettings(settings);whatsappFloat.href=`https://wa.me/${settings.whatsapp_number}`;updateCommerceNav();renderHeroCatalogSamples();if(studio.open)renderStep()}).catch(error=>console.warn('No pudimos actualizar la información de la tienda:',error));
