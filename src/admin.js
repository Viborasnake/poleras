import {confirmOrderAction,showOrderDialog} from './admin-order-dialog.js';
import {catalogDialogMarkup,catalogFileField,confirmCatalogDiscard,openCatalogDialog,performCatalogDialogAction,setCatalogFileStatus} from './admin-catalog-dialog.js';
import {renderCustomerService} from './admin-customer-service.js';
import {catalogPrintViews} from './catalog-print-presentation.js';
import {orderPrintPlanMarkup} from './admin-order-print-plan.js';
import {initializePoleraPrintFields,poleraPrintFields,syncPoleraPrintFields,wirePoleraPrintFields} from './admin-polera-prints.js';
import {POLERA_PRINT_LOCATIONS,catalogPoleraComposition,normalizePoleraPrints} from '../supabase/functions/_shared/catalog-polera-prints.js';
import {adminActions,adminFilters,adminSearch,updateAdminFilterCount,bindAdminActions,observeAdminDialogs,prepareAdminTable} from './admin-ui.js';
import {priceGuideMarkup,priceServicesMarkup,priceTableToolsMarkup,wirePriceFilters,wirePriceSettingForm} from './admin-prices-panel.js';
import {collectionsPanelMarkup} from './admin-collections-panel.js';
import {productMockupFields,productMockupDraft,mockupInputName,mockupVideoInputName} from './admin-product-mockups.js';
import {designProductMockups} from './catalog-product-mockups.js';
import {catalogVideoFileError,optimizeCatalogVideo} from './video-optimization.js';
import {catalogDesignVideoUrl} from './featured-design-video.js';
import {wireStoreSettings as bindStoreSettings,wireAdminNotifications as bindAdminNotifications} from './admin-store-settings.js';
import {mountCouponDisclosure,mountPaymentInstructionsDisclosure} from './admin-settings-disclosure.js';
import {mountAdminOrderDisclosure} from './admin-order-disclosure.js';
import {mountAdminFormDisclosure,unmountAdminFormDisclosure,adminFormData,adminStepSnapshot,submitAdminFormDisclosure} from './admin-form-disclosure.js';
import {designProductArtworks, validateProductArtworks} from './catalog-product-artworks.js';
import './design-system.css';
import './accessibility.css';
import './dialog-motion.js';
import './admin.css';
import './admin-email-preview.css';
import './admin-overdue.css';
import './admin-manual-order.css';
import './admin-creative-quote.css';
import './admin-dark.css';
import './admin-collections.css';
import './admin-prices.css';
import './admin-workspace.css';
import './admin-order-dialog.css';
import './admin-catalog-dialog.css';
import { createClient } from '@supabase/supabase-js';
import {authWithCaptcha} from './auth-captcha.js';
import { defaultStoreSettings, normalizeStoreSettings, validateStoreSettings, fetchStoreSettings } from './store-settings.js';
import { collections as baseCollections, catalogDesigns as baseDesigns, artworkUrl, catalogAssetUrl, catalogMockupPhoto, normalizeMockupFocus, normalizeSampleColor } from './catalog.js';
import {compatibleSupplierVariants,supplierVariantsForPrice} from './supplier-variant-match.js';
import { orderSteps, nextOrderStatus, orderProgressIndex, orderStatusLabel, orderKanbanStage } from './order-status.js';
import { orderPaymentState, paymentStateLabels } from './payment-state.js';
import { archivedOrderStatus, filterArchivedOrders } from './archive-history.js';
import { orderCardOriginLabel, orderChannelLabel } from './order-card-origin.js';
import { orderTraceability } from './admin-order-traceability.js';
import { orderTypeLabel } from './order-type.js';
import { buildOrdersWorkbook } from './orders-export.js';
import { renderSupplierProducts, principalCalculation, minimumPriceWithVat } from './admin-supplier-products.js';
import { CATALOG_ARTWORK_POLICY, CATALOG_IMAGE_POLICY, IMAGE_TYPES, optimizeImage } from './image-optimization.js';
import {beginUploadFeedback} from './upload-feedback.js';
import { matchesDesignFilters } from './admin-design-filters.js';
import {purchaseMethodLabel} from './purchase-methods.js';
import {PRODUCT_COLORS,COLOR_PRODUCT_FAMILIES,activeProductColorCodes,invalidDesignProductColors,productColorAvailability,productColorGroups} from './product-colors.js';
import {designProductColorMap} from '../supabase/functions/_shared/catalog-product-colors.js';
import {adminAuthOptions,localSignOutOptions} from './auth-client-options.js';
import {printConfigurationLabel} from '../supabase/functions/_shared/print-configuration.js';
import {catalogPrintLayoutFor,normalizeCatalogPrintLayout} from './catalog-print-layout.js';
import {renderInventory} from './admin-inventory.js';
import { productSizeRows,PRODUCT_SIZE_MODELS,SUPPLIER_SIZE_FAMILIES } from './admin-product-sizes.js';

const root=document.querySelector('#admin-app');
const mobileAdmin=window.matchMedia('(max-width:760px)');
bindAdminActions(root);
observeAdminDialogs(root);
mobileAdmin.addEventListener('change',placeAdminAccount);
function placeAdminAccount(){
 const account=root.querySelector('.admin-account');
 const host=root.querySelector(mobileAdmin.matches?'.admin-sidebar-head':'.admin-topbar');
 if(account&&host)host.append(account);
}

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS',{auth:adminAuthOptions});
const CATALOG_BUCKET='catalog-designs';
const CATALOG_SOURCE_MAX_BYTES=CATALOG_IMAGE_POLICY.sourceMaxBytes;
const LOCAL_DEMO_ORDERS_KEY='droska-local-demo-orders';
const LAST_OPENED_ORDER_KEY='droska-admin-last-opened-order';
const ADMIN_ORDER_SELECT='id,user_id,source,request_type,creative_request_id,whatsapp_request_id,request_details,request_references,quote_message,quoted_total_clp,quoted_at,quoted_by,coupon_code,status,currency,subtotal_clp,shipping_clp,discount_clp,total_clp,created_at,updated_at,submitted_at,shipping_address,price_snapshot,payment_instructions,payment_email_sent_at,payment_email_sent_by,payment_confirmed_at,payment_confirmed_by,payment_transfer_notice_at,archived_at,archived_by,archived_from_status,edit_pending_approval,edit_pending_at,edit_pending_by,edit_pending_snapshot,order_edit_version,order_edit_email_sent_at,order_edit_email_sent_by,order_items(id,product_variant_id,name_snapshot,sku_snapshot,color_hex,print_sides,print_configuration,quantity,unit_price_clp,line_total_clp,quality_review,catalog_design_id,catalog_artwork_path,front_design_path,back_design_path),order_status_history(id,status,note,created_at),payments(id,provider,provider_reference,status,amount_clp,confirmed_at)';
const ARCHIVE_PREVIEW_LIMIT=4;
const ARCHIVE_HISTORY_PAGE_SIZE=100;
const ORDER_EXPORT_PAGE_SIZE=100;
const ORDER_EXPORT_SELECT='id,source,request_type,creative_request_id,whatsapp_request_id,request_details,request_references,price_snapshot,coupon_code,status,subtotal_clp,shipping_clp,discount_clp,total_clp,created_at,submitted_at,shipping_address,payment_confirmed_at,payment_confirmed_by,payment_transfer_notice_at,archived_at,archived_from_status,order_items(name_snapshot,sku_snapshot,print_sides,print_configuration,quantity,unit_price_clp,line_total_clp,front_design_path,back_design_path),order_status_history(status,note,created_at),payments(provider,status,amount_clp,confirmed_at)';
const THEME_STORAGE_KEY='droska-theme';
const ADMIN_THEME_STORAGE_KEY='droska-admin-theme';
const SIDEBAR_COLLAPSED_KEY='droska-admin-sidebar-collapsed';
let sidebarCollapsed=false;
try{sidebarCollapsed=localStorage.getItem(SIDEBAR_COLLAPSED_KEY)==='true'}catch{}
let lastOpenedOrderId='';
try{lastOpenedOrderId=sessionStorage.getItem(LAST_OPENED_ORDER_KEY)||''}catch{}
const DTF_SEMITONE_URL='/herramientas/semitonos-dtf/';
const SHIPPING_SENDER={name:'droska SHIRT',location:'Providencia, Santiago, Chile'};
const manualProductOptions=[
 {id:'polera-basica',label:'Polera básica',sizes:['XS','S','M','L','XL']},
 {id:'polera-oversize',label:'Polera oversize',sizes:['S','M','L','XL']},
 {id:'polera-mujer',label:'Polera mujer',sizes:['S','M','L']},
 {id:'polera-ninos',label:'Polera niños',sizes:['2 años','3 años','4 años','6 años','8 años','10 años']},
 {id:'body-bebe',label:'Body bebé',sizes:['0-3 meses','3-6 meses','6-8 meses']},
 {id:'otro',label:'Otro producto / detalle manual',sizes:['A definir']}
];
const manualColorOptions=PRODUCT_COLORS.map(color=>[color.hex,color.name]);
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value||0);
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paymentStatusLabel=status=>({pending:'Pendiente',approved:'Aprobado',rejected:'Rechazado',cancelled:'Cancelado',refunded:'Reembolsado',partially_refunded:'Reembolso parcial',charged_back:'Contracargo',in_mediation:'En mediación'})[status]||status||'Sin estado';
const paymentIssueStatuses=new Set(['refunded','partially_refunded','charged_back','in_mediation']);
const chileRegions=['Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso','Metropolitana de Santiago','O’Higgins','Maule','Ñuble','Biobío','La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes'];
const regionFilterHtml=id=>`<div class="admin-region-filter"><input id="${id}" name="region" autocomplete="address-level1" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" placeholder="Busca tu región"><div id="${id}-options" class="admin-region-options" role="listbox" hidden></div></div>`;
function setupAdminRegionFilter(input){if(!input)return;const options=input.parentElement.querySelector('.admin-region-options');const render=()=>{const query=input.value.toLocaleLowerCase('es-CL'),matches=chileRegions.filter(region=>region.toLocaleLowerCase('es-CL').includes(query));options.innerHTML=matches.length?matches.map(region=>`<button type="button" role="option" data-region="${safe(region)}">${safe(region)}</button>`).join(''):'<p>No encontramos una región.</p>';options.hidden=false;input.setAttribute('aria-expanded','true')};const choose=region=>{input.value=region;options.hidden=true;input.setAttribute('aria-expanded','false')};input.onfocus=render;input.oninput=render;input.onkeydown=event=>{if(event.key==='Escape'){options.hidden=true;input.setAttribute('aria-expanded','false')}};options.onmousedown=event=>{const option=event.target.closest('[data-region]');if(option){event.preventDefault();choose(option.dataset.region)}};input.addEventListener('blur',()=>setTimeout(()=>{options.hidden=true;input.setAttribute('aria-expanded','false')},120))}
const readLocalOrders=()=>{try{const value=JSON.parse(localStorage.getItem(LOCAL_DEMO_ORDERS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}};
const date=value=>new Intl.DateTimeFormat('es-CL',{dateStyle:'medium'}).format(new Date(value));
const dateTime=value=>new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const icons={
 home:'<path d="M4 20V9l8-6 8 6v11h-6v-6h-4v6H4Z"/>',box:'<path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 18l9 5 9-5"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6"/>',users:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a4 4 0 0 1 4 4v2M16 3a4 4 0 0 1 0 7"/>',tag:'<path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',logout:'<path d="M10 4H4v16h6M15 8l4 4-4 4M8 12h11"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const adminBrandMarkup=()=>'<a class="admin-brand" href="/" aria-label="Droska SHIRT, ir a la tienda"><img class="admin-brand-logo" src="/droska-print-logo.png" alt="" width="2366" height="542"></a>';
let sessionUser=null;
let adminData=null;
let adminOrdersChannel=null;

function loginView(message=''){
 root.innerHTML=`<section class="admin-login">${adminBrandMarkup()}<span class="admin-eyebrow">ADMINISTRACIÓN</span><h1>Tu tienda empieza aquí.</h1><p>Ingresa con tu cuenta de administración.</p>${message?`<p class="admin-notice admin-error" role="alert">${safe(message)}</p>`:''}<form id="admin-login-form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button class="ds-cta" type="submit">Ingresar al panel</button><button type="button" class="admin-recovery" id="admin-forgot-password">¿Olvidaste tu clave?</button><p class="admin-form-status" id="admin-recovery-status" role="status" aria-live="polite"></p></form></section>`;
 const loginForm=root.querySelector('#admin-login-form');
 loginForm.onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Ingresando…';const form=new FormData(event.currentTarget);const {error}=await authWithCaptcha(captchaToken=>supabase.auth.signInWithPassword({email:form.get('email'),password:form.get('password'),options:{captchaToken}}));if(error)return loginView(error.message);boot()};
 root.querySelector('#admin-forgot-password').onclick=async event=>{const button=event.currentTarget,emailInput=loginForm.elements.email,status=root.querySelector('#admin-recovery-status'),email=String(emailInput.value||'').trim();if(!email){emailInput.focus();emailInput.reportValidity();return}button.disabled=true;button.textContent='Enviando…';status.textContent='';const redirectBase=(import.meta.env.VITE_SITE_URL||window.location.origin).replace(/\/$/,'');const {error}=await authWithCaptcha(captchaToken=>supabase.auth.resetPasswordForEmail(email,{redirectTo:`${redirectBase}/admin?panel=account`,captchaToken}));button.disabled=false;button.textContent='¿Olvidaste tu clave?';if(error){status.textContent=error.name==='CaptchaError'?error.message:'No pudimos enviar el enlace. Intenta nuevamente.';return}status.textContent='Si la cuenta de administración existe, recibirás un enlace para crear una clave nueva.'};
}
function loadingView(){
 if(root.querySelector('.admin-loading'))return;
 root.innerHTML='<section class="admin-loading" role="status" aria-live="polite"><div class="admin-loading-card"><img class="admin-loading-logo" src="/droska-print-logo.png" alt="droska SHIRT" width="2366" height="542"><p class="admin-loading-message">Cargando panel…</p><div class="admin-loading-track" aria-hidden="true"><i></i></div></div></section>';
}
function deniedView(){root.innerHTML=`<section class="admin-login">${adminBrandMarkup()}<h1>Sin acceso</h1><p>Esta cuenta no tiene permisos de administración.</p><button class="admin-secondary" type="button" id="admin-logout">Cerrar sesión</button></section>`;root.querySelector('#admin-logout').onclick=logout}
async function logout(){if(adminOrdersChannel){await supabase.removeChannel(adminOrdersChannel);adminOrdersChannel=null}await supabase.auth.signOut(localSignOutOptions);sessionUser=null;adminData=null;loginView()}

function clearRecoveryUrl(){const url=new URL(window.location.href);url.hash='';url.searchParams.delete('panel');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`)}
function passwordRecoveryView(){
 root.innerHTML=`<section class="admin-login">${adminBrandMarkup()}<span class="admin-eyebrow">ADMINISTRACIÓN</span><h1>Crea una clave nueva.</h1><p>Esta recuperación corresponde a tu cuenta de Administración.</p><form id="admin-password-recovery-form"><label>Nueva clave<input name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required></label><label>Repite la nueva clave<input name="confirmation" type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required></label><button class="ds-cta" type="submit">Guardar nueva clave</button><p class="admin-form-status" role="alert"></p></form></section>`;
 const form=root.querySelector('#admin-password-recovery-form');
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,password=String(form.elements.password.value||''),confirmation=String(form.elements.confirmation.value||''),status=form.querySelector('.admin-form-status');if(password.length<6){status.textContent='La nueva clave debe tener al menos 6 caracteres.';form.elements.password.focus();return}if(password!==confirmation){status.textContent='Las nuevas claves no coinciden.';form.elements.confirmation.focus();return}button.disabled=true;button.textContent='Guardando…';const {error}=await supabase.auth.updateUser({password});if(error){button.disabled=false;button.textContent='Guardar nueva clave';status.textContent=error.message||'No pudimos actualizar la clave.';return}await supabase.auth.signOut(localSignOutOptions);clearRecoveryUrl();loginView('Clave actualizada. Ingresa con tu nueva clave.')};
 form.elements.password.focus();
}
async function handlePasswordRecovery(){
 const params=new URLSearchParams(window.location.hash.slice(1));
 if(params.get('type')!=='recovery')return false;
 const accessToken=params.get('access_token'),refreshToken=params.get('refresh_token');
 if(!accessToken||!refreshToken){clearRecoveryUrl();loginView('El enlace de recuperación está incompleto o vencido.');return true}
 loadingView();
 const {data,error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
 if(error||!data.session){clearRecoveryUrl();loginView('El enlace de recuperación está vencido. Solicita uno nuevo.');return true}
 const {data:isAdmin,error:adminError}=await supabase.rpc('is_admin');
 if(adminError||!isAdmin){await supabase.auth.signOut(localSignOutOptions);clearRecoveryUrl();deniedView();return true}
 passwordRecoveryView();
 return true;
}

async function readAdminData(){
 const [variants,orders,profiles,productTypes,productSizes,categories,collections,designs,coupons,supplierCosts,supplierProducts,supplierCategories,supplierComponents,supplierVariantLinks,recentArchived]=await Promise.all([
  supabase.from('product_variants').select('id,sku,size,color_name,color_hex,price_clp,personalization_base_price_clp,active,product_models!inner(name,code,active)').order('sku'),
  supabase.from('orders').select(ADMIN_ORDER_SELECT).order('created_at',{ascending:false}).limit(100),
  supabase.from('profiles').select('id',{count:'exact',head:true}),
  supabase.from('catalog_product_types').select('id,slug,name,menu_description,purchase_method,active,sort_order,created_at').order('sort_order').order('name'),
  supabase.from('catalog_product_sizes').select('id,product_type_id,model_code,size_code,label,sort_order,created_at').order('sort_order').order('size_code'),
  supabase.from('catalog_categories').select('id,slug,name,active,sort_order,created_at').order('sort_order').order('name'),
  supabase.from('catalog_collections').select('id,product_type_id,category_id,slug,name,active,is_featured,is_new_collection,home_design_limit,sort_order,created_at').order('sort_order').order('name'),
  supabase.from('catalog_designs').select('id,collection_id,slug,name,caption,artwork_path,product_artworks,product_mockups,print_layouts,polera_prints,mockup_path,mockup_focus_x,mockup_focus_y,mockup_hover_path,mockup_hover_focus_x,mockup_hover_focus_y,personalization_arrow_x,personalization_arrow_y,sample_color,allowed_colors,allowed_product_colors,accepts_customer_image,customer_photo_subject,is_featured,active,created_at').order('created_at',{ascending:false}),
  supabase.from('coupons').select('*').order('created_at',{ascending:false}),
  supabase.from('supplier_costs').select('*').order('product_name'),
  supabase.from('supplier_products').select('*').order('category_id').order('sort_order').order('name'),
  supabase.from('supplier_categories').select('*').eq('active',true).order('sort_order').order('name'),
  supabase.from('supplier_product_components').select('*').order('principal_product_id').order('sort_order'),
  supabase.from('supplier_product_variants').select('supplier_product_id,product_variant_id'),
  supabase.from('orders').select(ADMIN_ORDER_SELECT,{count:'exact'}).not('archived_at','is',null).order('archived_at',{ascending:false}).order('id',{ascending:false}).limit(ARCHIVE_PREVIEW_LIMIT)
 ]);
 if(orders.error&&/archived_at|archived_by|archived_from_status/i.test(orders.error.message||'')){
  const fallback=await supabase.from('orders').select('id,user_id,source,coupon_code,status,currency,subtotal_clp,shipping_clp,discount_clp,total_clp,created_at,updated_at,submitted_at,shipping_address,price_snapshot,payment_instructions,payment_email_sent_at,payment_email_sent_by,payment_confirmed_at,payment_confirmed_by,payment_transfer_notice_at,edit_pending_approval,edit_pending_at,edit_pending_by,edit_pending_snapshot,order_edit_version,order_edit_email_sent_at,order_edit_email_sent_by,order_items(id,product_variant_id,name_snapshot,sku_snapshot,color_hex,print_sides,print_configuration,quantity,unit_price_clp,line_total_clp,quality_review,catalog_design_id,catalog_artwork_path,front_design_path,back_design_path),order_status_history(id,status,note,created_at),payments(id,provider,provider_reference,status,amount_clp,confirmed_at)').order('created_at',{ascending:false}).limit(100);
  orders.data=fallback.data;orders.error=fallback.error;
 }
 for(const result of [variants,orders,profiles,productTypes,productSizes,categories,collections,designs,coupons,supplierCosts,supplierProducts,supplierCategories,supplierComponents,supplierVariantLinks,recentArchived])if(result.error)throw result.error;
  const localOrders=import.meta.env.DEV?readLocalOrders():[];
 const localArchived=localOrders.filter(order=>order.archived_at);
 const archivedRecent=[...localArchived,...(recentArchived.data||[])].sort((a,b)=>new Date(b.archived_at)-new Date(a.archived_at)).slice(0,ARCHIVE_PREVIEW_LIMIT);
 return {archivedRecent,archivedCount:(recentArchived.count||0)+localArchived.length,variants:variants.data||[],orders:[...localOrders,...(orders.data||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),profileCount:profiles.count||0,productTypes:productTypes.data||[],productSizes:productSizes.data||[],categories:categories.data||[],collections:collections.data||[],designs:designs.data||[],coupons:coupons.data||[],supplierCosts:supplierCosts.data||[],supplierProducts:supplierProducts.data||[],supplierCategories:supplierCategories.data||[],supplierComponents:supplierComponents.data||[],supplierVariantLinks:supplierVariantLinks.data||[]};
}

async function ensureBaseCatalog(){
 const {data:productTypes,error:productTypeError}=await supabase.from('catalog_product_types').select('id,slug');
 if(productTypeError)throw productTypeError;const polerasId=productTypes?.find(item=>item.slug==='poleras')?.id;if(!polerasId)throw new Error('Falta el producto Poleras en el catálogo.');
 const {data:categories,error:categoryError}=await supabase.from('catalog_categories').select('id,slug');
 if(categoryError)throw categoryError;const categoryIds=new Map((categories||[]).map(item=>[item.slug,item.id]));
 const {data:existingCollections,error:collectionReadError}=await supabase.from('catalog_collections').select('id,slug');
 if(collectionReadError)throw collectionReadError;
 const existingSlugs=new Set((existingCollections||[]).map(item=>item.slug));
 const missingCollections=existingCollections?.length?[]:baseCollections.filter(item=>!existingSlugs.has(item.id)).map((item,index)=>({product_type_id:polerasId,category_id:categoryIds.get(item.category)||categoryIds.get('general'),slug:item.id,name:item.label,active:true,sort_order:(index+1)*10}));
 if(missingCollections.length){const {error}=await supabase.from('catalog_collections').upsert(missingCollections,{onConflict:'slug',ignoreDuplicates:true});if(error)throw error}
 const {data:allCollections,error:collectionRefreshError}=await supabase.from('catalog_collections').select('id,slug');
 if(collectionRefreshError)throw collectionRefreshError;
 const collectionIds=new Map((allCollections||[]).map(item=>[item.slug,item.id]));
 const {data:existingDesigns,error:designReadError}=await supabase.from('catalog_designs').select('slug');
 if(designReadError)throw designReadError;
 const existingDesignSlugs=new Set((existingDesigns||[]).map(item=>item.slug));
 const missingDesigns=existingDesigns?.length?[]:baseDesigns.filter(item=>!existingDesignSlugs.has(item.id)&&collectionIds.has(item.collection)).map(item=>({collection_id:collectionIds.get(item.collection),slug:item.id,name:item.name,caption:item.caption,artwork_path:`local:${item.id}`,sample_color:normalizeSampleColor(item.sampleColor),active:true}));
 if(missingDesigns.length){const {error}=await supabase.from('catalog_designs').upsert(missingDesigns,{onConflict:'slug',ignoreDuplicates:true});if(error)throw error}
 return {collections:missingCollections.length,designs:missingDesigns.length};
}

const routes=[['resumen','home','Resumen'],['productos','box','Productos'],['categorias','tag','Categorías'],['colecciones','layers','Colecciones'],['disenos','image','Diseños'],['tallas','tag','Tallas'],['inventario','box','Inventario'],['insumos','tag','Insumos'],['precios','receipt','Precios'],['pedidos','receipt','Pedidos'],['servicio-cliente','users','Servicio al cliente'],['cupones','tag','Cupones'],['clientes','users','Clientes'],['analitica','chart','Analítica'],['configuracion','settings','Configuración']];
const configurationAnchors=new Set(['config-store','config-appearance','config-team','config-system']);
function currentRoute(){const route=location.hash.replace('#','');if(configurationAnchors.has(route))return 'configuracion';if(route==='proveedores'){history.replaceState(null,'','#insumos');return 'insumos'}return routes.some(([id])=>id===route)?route:'resumen'}
function navMarkup(active){
 const catalogIds=new Set(['productos','categorias','colecciones','disenos','tallas','insumos','precios','inventario']);
 const activeOrderCount=adminData.orders.filter(order=>!order.archived_at).length;
 const link=([id,iconName,label],catalog=false)=>`<a href="#${id}" class="${active===id?'active ':''}${catalog?'admin-catalog-link ':''}${id==='productos'?'admin-catalog-parent ':''}${catalog&&id!=='productos'?'admin-catalog-child ':''}${['resumen','productos','categorias','colecciones','tallas','disenos','pedidos','inventario','insumos','precios','cupones','clientes','configuracion'].includes(id)?'':' is-planned'}" aria-label="${label}" title="${label}" ${active===id?'aria-current="page"':''}>${icon(iconName)}<span>${label}</span>${id==='pedidos'&&activeOrderCount?`<b aria-hidden="true">${activeOrderCount}</b>`:''}</a>`;
 const catalogOrder=['productos','categorias','colecciones','disenos','tallas','insumos','precios','inventario'];
 const catalog=routes.filter(([id])=>catalogIds.has(id)).sort((a,b)=>catalogOrder.indexOf(a[0])-catalogOrder.indexOf(b[0]));
 const catalogNav=`<div class="admin-catalog-nav${catalogIds.has(active)?' has-active-child':''}" role="group" aria-label="Productos y contenido del catálogo">${link(catalog[0],true)}<div class="admin-catalog-children">${catalog.slice(1).map(item=>link(item,true)).join('')}</div></div>`;
 const toolLink=`<a href="${DTF_SEMITONE_URL}" target="_blank" rel="noreferrer" aria-label="Semitonos DTF, abre en una pestaña nueva" title="Semitonos DTF">${icon('image')}<span>Semitonos DTF</span></a>`;
 return `${routes.filter(([id])=>!catalogIds.has(id)).map(route=>route[0]==='resumen'?`${link(route)}${catalogNav}`:link(route)).join('')}${toolLink}`;
}
function pageHeading(eyebrow,title,copy,action=''){
 return `<div class="admin-page-heading"><div><span class="admin-eyebrow">${eyebrow}</span><h1>${title.replace(/\.$/,'')}</h1><p>${copy}</p></div>${action?`<div class="admin-page-heading-actions">${action}</div>`:''}</div>`;
}
function listSearch(label,placeholder,filterPopover=''){
 return `<div class="admin-list-toolbar">${adminSearch({label,placeholder,input:'id="admin-search-input"',output:'<output id="admin-search-count" for="admin-search-input" aria-live="polite"></output>'})}${filterPopover}</div>`;
}
const searchEmpty='<p class="admin-list-empty" data-admin-search-empty hidden>No hay coincidencias. Prueba otra búsqueda o ajusta los filtros.</p>';
function shell(content,active){
 const initial=safe((sessionUser.email||'A').slice(0,1).toUpperCase());
 const sidebarToggleLabel=sidebarCollapsed?'Expandir menú lateral':'Contraer menú lateral';
 const menu=`<button type="button" class="admin-secondary" id="admin-mobile-nav-toggle" aria-controls="admin-sidebar-nav" aria-expanded="false">Menú <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>`;
 const account=`<div class="admin-account"><span class="admin-avatar" aria-hidden="true">${initial}</span><span class="admin-account-identity"><strong>Administración</strong><small>${safe(sessionUser.email)}</small></span>${adminActions({id:'admin-account-actions',label:'Cuenta',items:`<p class="admin-account-email">${safe(sessionUser.email)}</p><button type="button" id="admin-password">Cambiar clave</button><button type="button" id="admin-logout">${icon('logout')} Cerrar sesión</button>`})}</div>`;
 root.innerHTML=`<div class="admin-layout${sidebarCollapsed?' is-sidebar-collapsed':''}"><aside class="admin-sidebar"><div class="admin-sidebar-head">${adminBrandMarkup()}${menu}<button type="button" id="admin-sidebar-toggle" class="admin-sidebar-toggle" aria-controls="admin-sidebar-nav" aria-expanded="${!sidebarCollapsed}" aria-label="${sidebarToggleLabel}" title="${sidebarToggleLabel}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m7-11-3 3 3 3"/></svg></button></div><nav id="admin-sidebar-nav" aria-label="Administración">${navMarkup(active)}</nav></aside><div class="admin-workspace"><header class="admin-topbar">${account}</header><main class="admin-main" id="admin-main">${content}</main></div></div><div class="admin-toast" role="status" aria-live="polite"></div>`;
 placeAdminAccount();
 const navToggle=root.querySelector('#admin-mobile-nav-toggle'),nav=root.querySelector('#admin-sidebar-nav');
 const closeNavigation=()=>navToggle.setAttribute('aria-expanded','false');
 navToggle.onclick=()=>navToggle.setAttribute('aria-expanded',String(navToggle.getAttribute('aria-expanded')==='false'));
 nav.addEventListener('click',event=>{
  const link=event.target.closest('a');
  if(!mobileAdmin.matches||!link)return;
  closeNavigation();
  if(link.matches('[aria-current]'))focusPageHeading();
  else if(link.target==='_blank')navToggle.focus();
 });
 root.querySelector('.admin-sidebar').onkeydown=event=>{
  if(event.key!=='Escape'||navToggle.getAttribute('aria-expanded')!=='true'||event.target.closest('.admin-account'))return;
  closeNavigation();
  navToggle.focus();
 };
 for(const table of root.querySelectorAll('.admin-table-wrap > table.admin-table')){
  const region=table.parentElement;
  if(!region.hasAttribute('aria-label'))region.setAttribute('aria-label',region.closest('.admin-panel')?.querySelector('h2')?.textContent||routes.find(([id])=>id===active)[2]);
  prepareAdminTable(table);
 }
 if(active!=='inventario')root.querySelector('#admin-search-input')?.addEventListener('input',event=>filterCurrentView(event.currentTarget.value));
 root.querySelector('#admin-sidebar-toggle').onclick=()=>{
  sidebarCollapsed=!sidebarCollapsed;
  try{localStorage.setItem(SIDEBAR_COLLAPSED_KEY,String(sidebarCollapsed))}catch{}
  root.querySelector('.admin-layout').classList.toggle('is-sidebar-collapsed',sidebarCollapsed);
  const toggle=root.querySelector('#admin-sidebar-toggle');
  const label=sidebarCollapsed?'Expandir menú lateral':'Contraer menú lateral';
  toggle.setAttribute('aria-expanded',String(!sidebarCollapsed));
  toggle.setAttribute('aria-label',label);
  toggle.title=label;
 };
 root.querySelector('#admin-password').onclick=openPasswordDialog;
 root.querySelector('#admin-logout').onclick=logout;
}
function openPasswordDialog(){
 root.querySelector('#admin-password-dialog')?.remove();
 root.insertAdjacentHTML('beforeend','<dialog class="admin-dialog admin-password-dialog" id="admin-password-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">CUENTA</span><h2>Cambiar clave</h2><p>Confirma tu clave actual y elige una nueva para entrar a Administración.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><label>Clave actual<input name="current_password" type="password" autocomplete="current-password" required></label><label>Nueva clave<input name="new_password" type="password" autocomplete="new-password" minlength="6" required><small>Usa al menos 6 caracteres.</small></label><label>Repite la nueva clave<input name="confirm_password" type="password" autocomplete="new-password" minlength="6" required></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar clave</button></div><p class="admin-form-status" role="alert"></p></form></dialog>');
 const dialog=root.querySelector('#admin-password-dialog'),form=dialog.querySelector('form'),close=()=>dialog.close();
 dialog.querySelector('.dialog-close').onclick=close;
 dialog.querySelector('.dialog-cancel').onclick=close;
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),current=String(form.elements.current_password.value||''),next=String(form.elements.new_password.value||''),confirm=String(form.elements.confirm_password.value||'');
  if(next.length<6){status.textContent='La nueva clave debe tener al menos 6 caracteres.';form.elements.new_password.focus();return}
  if(next!==confirm){status.textContent='Las nuevas claves no coinciden.';form.elements.confirm_password.focus();return}
  button.disabled=true;button.textContent='Verificando…';status.textContent='';
  const {error:signInError}=await authWithCaptcha(captchaToken=>supabase.auth.signInWithPassword({email:sessionUser?.email||'',password:current,options:{captchaToken}}));
  if(signInError){button.disabled=false;button.textContent='Guardar clave';status.textContent=signInError.name==='CaptchaError'?signInError.message:'La clave actual no es correcta.';return}
  button.textContent='Guardando…';
  const {error}=await supabase.auth.updateUser({password:next});
  if(error){button.disabled=false;button.textContent='Guardar clave';status.textContent=error.message||'No pudimos actualizar la clave.';return}
  close();toast('Clave actualizada.');
 };
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.showModal();
 dialog.querySelector('input')?.focus();
}
function toast(message){const dialog=document.activeElement?.closest('dialog[open]')||[...root.querySelectorAll('dialog[open]')].at(-1);let node=dialog?.querySelector('.admin-dialog-toast');if(dialog&&!node){node=document.createElement('div');node.className='admin-toast admin-dialog-toast';node.setAttribute('role','status');node.setAttribute('aria-live','polite');dialog.append(node)}node=node||root.querySelector('.admin-toast');if(!node)return;node.textContent=message;node.classList.add('visible');setTimeout(()=>node.classList.remove('visible'),2200)}
function focusPageHeading(){
 const heading=root.querySelector('.admin-main h1');
 if(!heading)return;
 heading.tabIndex=-1;
 heading.focus({preventScroll:true});
 window.scrollTo(0,0);
}

function filterCurrentView(query){
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 const normalized=normalize(query.trim()),items=[...root.querySelectorAll('[data-admin-searchable]')];
 const categoryId=root.querySelector('#admin-design-category-filter')?.value||'';
 const collectionId=root.querySelector('#admin-design-collection-filter')?.value||'';
 const stage=root.querySelector('#admin-order-stage')?.value||'';
 updateAdminFilterCount(root,'design-filters',Number(Boolean(categoryId))+Number(Boolean(collectionId)));
 updateAdminFilterCount(root,'order-stage-filter',Number(Boolean(stage)));
 let visible=0;
 items.forEach(item=>{
  item.hidden= !matchesDesignFilters({searchable:normalize(item.dataset.adminSearchable),categoryId:item.dataset.adminCategoryId,collectionId:item.dataset.adminCollectionId},{query:normalized,categoryId,collectionId});
  if(!item.hidden&&(!stage||item.closest('[data-order-stage]')?.dataset.orderStage===stage))visible++;
 });
 for(const column of root.querySelectorAll('[data-order-stage]')){
  column.hidden=Boolean(stage&&column.dataset.orderStage!==stage);
  const total=column.querySelectorAll('[data-admin-searchable]:not([hidden])').length;
  column.querySelector('[data-stage-count]').textContent=total;
  const empty=column.querySelector('.admin-kanban-empty');
  empty.hidden=total>0;
  empty.textContent=normalized?'No hay coincidencias en esta etapa.':'No hay pedidos en esta etapa.';
 }
 const count=root.querySelector('#admin-search-count');
 if(count)count.textContent=`${visible} ${visible===1?'resultado':'resultados'}`;
 const empty=root.querySelector('[data-admin-search-empty]');
 if(empty)empty.hidden=visible>0;
}

function inventoryView(){renderInventory({root,shell,toast,products:adminData.productTypes,client:supabase})}

function summaryView(){
 const activeModels=new Set(adminData.variants.filter(item=>item.active).map(item=>item.product_models?.code)).size;
 const activeCollections=adminData.collections.filter(item=>item.active).length;
 const recentOrders=adminData.orders.slice(0,5);
 const action=`<a class="admin-primary" href="#colecciones">${icon('plus')} Nueva colección</a>`;
 const content=`${pageHeading('RESUMEN','Tu tienda, bajo control.','Administra el catálogo y la operación de Droska desde un solo lugar.',action)}<section class="admin-metrics" aria-label="Resumen de la tienda"><article><span class="metric-icon">${icon('users')}</span><small>Clientes</small><strong>${adminData.profileCount}</strong><p>Total registrados</p></article><article><span class="metric-icon">${icon('box')}</span><small>Modelos activos</small><strong>${activeModels}</strong><p>De ${new Set(adminData.variants.map(item=>item.product_models?.code)).size} totales</p></article><article><span class="metric-icon">${icon('layers')}</span><small>Colecciones</small><strong>${activeCollections}</strong><p>${adminData.designs.filter(item=>item.active).length} diseños activos</p></article><article><span class="metric-icon">${icon('receipt')}</span><small>Pedidos recientes</small><strong>${adminData.orders.length}</strong><p>Últimos registrados</p></article></section><div class="admin-dashboard-grid"><section class="admin-panel admin-quick"><div class="admin-panel-head"><div><span class="admin-eyebrow">ATAJOS</span><h2>Acciones rápidas</h2></div></div><div class="quick-grid"><a href="#colecciones">${icon('plus')}<span><strong>Crear colección</strong><small>Organiza tus productos</small></span></a><a href="#disenos">${icon('image')}<span><strong>Cargar diseño</strong><small>Publica en una colección</small></span></a><a href="#inventario">${icon('box')}<span><strong>Registrar inventario</strong><small>Prendas, stock y ubicación</small></span></a><a href="#insumos">${icon('tag')}<span><strong>Gestionar insumos</strong><small>Costos y margen por producto</small></span></a></div></section><section class="admin-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">OPERACIÓN</span><h2>Pedidos recientes</h2></div><a href="#pedidos">Ver todos →</a></div>${recentOrders.length?`<div class="admin-order-list">${recentOrders.map(order=>`<div><strong>#${order.id}</strong><span>${money(order.total_clp)}</span><span class="admin-payment-badge is-${orderPaymentState(order)}">${paymentStateLabels[orderPaymentState(order)]}</span><small>${date(order.created_at)}</small></div>`).join('')}</div>`:'<div class="admin-empty">Aún no hay pedidos. Cuando conectemos el checkout aparecerán aquí.</div>'}</section></div>`;
 shell(content,'resumen');
}

const designCountLabel=count=>`${count} ${count===1?'diseño':'diseños'}`;
const activeDesignCountLabel=count=>`${designCountLabel(count)} ${count===1?'activo':'activos'}`;
const collectionCountLabel=count=>`${count} ${count===1?'colección':'colecciones'}`;
const isOrderOverdue=order=>!['delivered','cancelled'].includes(order.status)&&Date.now()-new Date(order.updated_at||order.submitted_at||order.created_at).getTime()>24*60*60*1000;
const productName=id=>adminData.productTypes.find(item=>item.id===id)?.name||'Sin producto';
const categoryName=id=>adminData.categories.find(item=>item.id===id)?.name||'Sin categoría';
function categoriesView(){
 const rows=adminData.categories.map(category=>{const collectionCount=adminData.collections.filter(collection=>collection.category_id===category.id).length;return `<tr data-admin-searchable="${safe(`${category.name} ${category.slug}`.toLowerCase())}"><td><strong>${safe(category.name)}</strong><small>/${safe(category.slug)}</small></td><td>${collectionCountLabel(collectionCount)}</td><td>${category.sort_order}</td><td><span class="status-pill ${category.active?'is-active':'is-hidden'}">${category.active?'Visible':'Oculta'}</span></td><td><div class="row-actions"><button type="button" class="admin-secondary" data-edit-category="${category.id}">Editar</button>${adminActions({id:`category-actions-${category.id}`,name:`Más acciones para ${category.name}`,items:`<button type="button" class="admin-danger-link" data-delete-category="${category.id}" ${collectionCount?'disabled':''} title="${collectionCount?'Primero mueve o elimina las colecciones de esta categoría.':'Eliminar categoría'}">Eliminar</button>${collectionCount?'<small>Mueve primero las colecciones de esta categoría.</small>':''}`})}</div></td></tr>`}).join('');
 const action=`<button type="button" class="admin-primary" id="new-category">${icon('plus')} Nueva categoría</button>`;
 const dialog=`<dialog class="admin-dialog" id="category-dialog"><form id="category-form"><div class="dialog-title"><div><span class="admin-eyebrow">CATÁLOGO</span><h2>Categoría</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><input type="hidden" name="id"><label>Nombre<input name="name" maxlength="70" required placeholder="Ej. Paisajes"></label><label>Slug<input name="slug" maxlength="70" pattern="(?:[a-z0-9]|-)+" required placeholder="paisajes"></label><label>Orden<input name="sort_order" type="number" min="0" max="999" value="0"></label><label class="admin-check"><input name="active" type="checkbox" checked><span>Mostrar categoría en la tienda</span></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar categoría</button></div><p class="admin-form-status" role="alert"></p></form></dialog><dialog class="admin-dialog admin-confirm-dialog" id="delete-category-dialog"><form method="dialog"><div class="dialog-title"><div><span class="admin-eyebrow">ACCIÓN PERMANENTE</span><h2>Eliminar categoría</h2></div><button type="button" class="dialog-close" data-delete-category-cancel aria-label="Cerrar">×</button></div><p>Vas a eliminar <strong data-delete-category-name></strong>. Esta acción no se puede deshacer.</p><input type="hidden" name="category_id"><div class="dialog-actions"><button type="button" class="admin-secondary" data-delete-category-cancel>Cancelar</button><button type="submit" class="admin-danger">Eliminar categoría</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
 const content=`${pageHeading('CATÁLOGO','Categorías.','Agrupa las colecciones por tema antes de publicar sus diseños.',action)}<section class="admin-panel collection-panel"><div class="admin-panel-head"><div><h2>Todas las categorías</h2><p>${adminData.categories.length} en total · ${adminData.categories.filter(category=>category.active).length} visibles</p></div></div>${rows?`${listSearch('Buscar categoría','Nombre o slug')}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Categoría</th><th>Colecciones</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div>${searchEmpty}`:'<div class="admin-empty"><strong>Aún no hay categorías.</strong><p>Crea la primera para empezar a organizar las colecciones.</p></div>'}</section>${dialog}`;
 shell(content,'categorias');wireCategories();filterCurrentView('');
}
function productColorDialogMarkup(){
 const families=COLOR_PRODUCT_FAMILIES.filter(family=>adminData.productTypes.some(product=>product.slug===family.slug));
 const tabs=families.map((family,index)=>`<button type="button" role="tab" id="product-color-tab-${family.slug}" aria-controls="product-color-panel-${family.slug}" aria-selected="${index===0}" tabindex="${index===0?'0':'-1'}" data-product-color-tab="${family.slug}">${safe(family.name)} <span data-product-color-count="${family.slug}">${activeProductColorCodes(adminData.variants,family.slug).length}</span></button>`).join('');
 const panels=families.map((family,index)=>{const active=new Set(activeProductColorCodes(adminData.variants,family.slug));return `<section role="tabpanel" id="product-color-panel-${family.slug}" aria-labelledby="product-color-tab-${family.slug}" data-product-color-panel="${family.slug}" ${index?'hidden':''}><div class="admin-color-batch-tools"><p>Se aplicará a todas las tallas y modelos publicados de ${safe(family.name.toLowerCase())}.</p><div><button type="button" class="admin-color-action" data-product-color-all="${family.slug}">Seleccionar todos</button><button type="button" class="admin-color-action" data-product-color-none="${family.slug}">Deseleccionar todos</button></div></div><div class="admin-color-groups">${productColorGroups().map(group=>`<section class="admin-color-group"><h3>${safe(group.label)}</h3><div class="admin-color-grid">${group.colors.map(color=>`<label class="admin-color-option"><input type="checkbox" name="product_colors_${family.slug}" value="${color.code}" ${active.has(color.code)?'checked':''}><i style="--sample-color:${color.hex}" aria-hidden="true"></i><span>${safe(color.name)}</span></label>`).join('')}</div></section>`).join('')}</div></section>`}).join('');
 return catalogDialogMarkup({
  id:'product-colors-dialog',formId:'product-colors-form',className:'admin-product-colors-dialog',
  title:'Colores globales',context:'Estos cambios se aplican a todos los diseños de cada producto.',
  body:`<div class="admin-color-product-tabs" role="tablist" aria-label="Producto">${tabs}</div>${panels}`,
  submit:'Guardar colores',discard:true,
 });
}
function productsView(){
 const counts=new Map();for(const collection of adminData.collections)counts.set(collection.product_type_id,(counts.get(collection.product_type_id)||0)+1);
 const colorFamilies=new Map(COLOR_PRODUCT_FAMILIES.map(family=>[family.slug,family]));
 const rows=adminData.productTypes.map(product=>{const family=colorFamilies.get(product.slug),colorCount=family?activeProductColorCodes(adminData.variants,product.slug).length:null;return `<tr data-admin-searchable="${safe(`${product.name} ${product.slug} ${product.menu_description||''}`.toLowerCase())}"><td><span class="collection-swatch product-swatch" aria-hidden="true"></span><div><strong>${safe(product.name)}</strong><small>/${safe(product.slug)}</small></div></td><td>${safe(product.menu_description||'Sin descripción')}</td><td>${collectionCountLabel(counts.get(product.id)||0)}</td><td>${colorCount===null?'<span class="admin-muted">No aplica</span>':`<strong>${colorCount}</strong> activos`}</td><td>${product.sort_order}</td><td><span class="status-pill ${product.active?'is-active':'is-hidden'}">${product.active?'Visible':'Oculto'}</span></td><td>${product.purchase_method==='inherit'?'Hereda global':safe(purchaseMethodLabel(product.purchase_method))}</td><td><div class="row-actions"><button type="button" class="admin-secondary" data-edit-product="${product.id}">Editar</button><a class="admin-secondary" href="#tallas">Tallas</a></div></td></tr>`}).join('');
 const action=`<button type="button" class="admin-primary" id="new-product">${icon('plus')} Nuevo producto</button><button type="button" class="admin-secondary" id="manage-product-colors">Disponibilidad de colores</button>`;
 const content=`${pageHeading('CATÁLOGO','Productos.','Esta lista alimenta el menú Productos de la tienda. Poleras, bodys y tote bags administran su color en lote.',action)}<section class="admin-hierarchy" aria-label="Jerarquía del catálogo"><strong>Producto</strong><span>→</span><strong>Categoría</strong><span>→</span><strong>Colección</strong><span>→</span><strong>Diseño</strong></section><section class="admin-panel collection-panel"><div class="admin-panel-head"><div><h2>Tipos de producto</h2><p>${adminData.productTypes.length} configurados</p></div></div>${listSearch('Buscar producto','Nombre, slug o descripción')}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Producto</th><th>Descripción del menú</th><th>Colecciones</th><th>Colores</th><th>Orden</th><th>Visibilidad</th><th>Método de compra</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div>${searchEmpty}</section><dialog class="admin-dialog" id="product-dialog"><form id="product-form"><div class="dialog-title"><div><span class="admin-eyebrow">CATÁLOGO</span><h2 id="product-dialog-title">Nuevo producto</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><input type="hidden" name="id"><label>Nombre<input name="name" required maxlength="70" placeholder="Ej. Totebags"></label><label>Slug<input name="slug" required maxlength="70" pattern="(?:[a-z0-9]|-)+" placeholder="totebags"><small>El slug no se puede cambiar después de crear el producto.</small></label><label>Descripción en el menú<input name="menu_description" required maxlength="140" placeholder="Ej. Tu idea para llevar"></label><label>Orden<input name="sort_order" type="number" min="0" max="999" value="0"></label><fieldset class="admin-purchase-method"><legend>Método de compra</legend><label><input type="radio" name="purchase_method" value="inherit" checked> Heredar configuración global</label><label><input type="radio" name="purchase_method" value="cart"> Carrito de compras</label><label><input type="radio" name="purchase_method" value="whatsapp"> WhatsApp</label><small>Esta elección tiene prioridad sobre Métodos de compra.</small></fieldset><label class="admin-check"><input name="active" type="checkbox" checked><span>Mostrar este producto en el menú</span></label><p class="admin-notice">Los productos nuevos aparecerán como “Próximamente” hasta que tengan un flujo de compra.</p><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar producto</button></div><p class="admin-form-status" role="alert"></p></form></dialog>${productColorDialogMarkup()}`;
 shell(content,'productos');wireProducts();filterCurrentView('');
}
function wireProductColorDialog({triggerSelector='[data-open-product-colors]',onSaved=async()=>{}}={}){
 const colorDialog=root.querySelector('#product-colors-dialog'),colorForm=colorDialog?.querySelector('form');if(!colorForm)return;
 const colorInputs=slug=>[...colorForm.querySelectorAll(`[name="product_colors_${CSS.escape(slug)}"]`)];
 const syncColorCount=slug=>{const target=colorForm.querySelector(`[data-product-color-count="${CSS.escape(slug)}"]`);if(target)target.textContent=colorInputs(slug).filter(input=>input.checked).length};
 const selectColorTab=slug=>{
  colorForm.querySelectorAll('[data-product-color-tab]').forEach(tab=>{const selected=tab.dataset.productColorTab===slug;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
  colorForm.querySelectorAll('[data-product-color-panel]').forEach(panel=>{panel.hidden=panel.dataset.productColorPanel!==slug});
 };
 const tabs=[...colorForm.querySelectorAll('[data-product-color-tab]')];
 let initialColors='';
 confirmCatalogDiscard(colorDialog,()=>adminStepSnapshot(colorForm)!==initialColors);
 const openFromTrigger=trigger=>{
  const slug=trigger.dataset.openProductColors||tabs[0]?.dataset.productColorTab;
  colorForm.reset();
  tabs.forEach(tab=>syncColorCount(tab.dataset.productColorTab));
  if(slug)selectColorTab(slug);
  initialColors=adminStepSnapshot(colorForm);
  openCatalogDialog(colorDialog,trigger);
  (tabs.find(tab=>tab.dataset.productColorTab===slug)||colorDialog.querySelector('.dialog-close')).focus({preventScroll:true});
 };
 if(root._productColorTriggerHandler)root.removeEventListener('click',root._productColorTriggerHandler);
 root._productColorTriggerHandler=event=>{const trigger=event.target.closest(triggerSelector);if(trigger&&root.contains(trigger))openFromTrigger(trigger)};
 root.addEventListener('click',root._productColorTriggerHandler);
 tabs.forEach((tab,index)=>{
  const select=()=>{selectColorTab(tab.dataset.productColorTab);colorForm.querySelector('.admin-catalog-dialog-body').scrollTop=0};
  tab.onclick=select;
  tab.onkeydown=event=>{
   const next={ArrowLeft:(index-1+tabs.length)%tabs.length,ArrowRight:(index+1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
   if(next===undefined)return;
   event.preventDefault();
   tabs[next].click();
   tabs[next].focus();
  };
 });
 colorForm.querySelectorAll('[data-product-color-panel]').forEach(panel=>{
  const slug=panel.dataset.productColorPanel,inputs=colorInputs(slug);inputs.forEach(input=>input.onchange=()=>syncColorCount(slug));
  panel.querySelector('[data-product-color-all]').onclick=()=>{inputs.forEach(input=>{input.checked=true});syncColorCount(slug)};
  panel.querySelector('[data-product-color-none]').onclick=()=>{inputs.forEach(input=>{input.checked=false});syncColorCount(slug)};
 });
 colorForm.onsubmit=event=>{
  event.preventDefault();
  const status=colorForm.querySelector('.admin-form-status');
  const availability=Object.fromEntries(tabs.map(tab=>{
   const slug=tab.dataset.productColorTab;
   return [slug,colorInputs(slug).filter(input=>input.checked).map(input=>input.value)];
  }));
  const empty=tabs.find(tab=>!availability[tab.dataset.productColorTab].length);
  if(empty){
   const slug=empty.dataset.productColorTab;
   status.textContent=`Selecciona al menos un color para ${COLOR_PRODUCT_FAMILIES.find(family=>family.slug===slug).name}.`;
   status.dataset.tone='error';
   empty.click();
   empty.focus();
   return;
  }
  return performCatalogDialogAction(colorForm,{message:'Actualizando la gama global…',pendingLabel:'Guardando…',action:async()=>{
   const {data,error}=await supabase.rpc('set_product_color_availability',{_availability:availability});
   if(error||data?.error)throw new Error(data?.error||error.message);
   for(const [slug,codes] of Object.entries(availability)){
    for(const input of colorInputs(slug))input.defaultChecked=codes.includes(input.value);
   }
   const variants=await supabase.from('product_variants').select('id,sku,size,color_name,color_hex,price_clp,active,product_models!inner(name,code,active)').order('sku');
   if(variants.error)throw new Error(`Los colores se guardaron, pero no pudimos actualizar la lista. ${variants.error.message}`);
   adminData.variants=variants.data||[];
   const selectedTab=colorForm.querySelector('[aria-selected="true"]');
   colorDialog.close();
   await onSaved(availability,selectedTab?.dataset.productColorTab);
  }});
 };
}
function wireProducts(){
 const dialog=root.querySelector('#product-dialog'),form=dialog.querySelector('form');
 wireProductColorDialog({triggerSelector:'#manage-product-colors',onSaved:()=>refreshData('Disponibilidad de colores actualizada.',true)});
 const open=product=>{unmountAdminFormDisclosure(form);form.reset();form.elements.id.value=product?.id||'';form.elements.name.value=product?.name||'';form.elements.slug.value=product?.slug||'';form.elements.slug.readOnly=Boolean(product);form.elements.menu_description.value=product?.menu_description||'';form.elements.sort_order.value=product?.sort_order??(adminData.productTypes.length+1)*10;form.elements.purchase_method.value=product?.purchase_method||'inherit';form.elements.active.checked=product?.active??true;form.querySelector('.admin-form-status').textContent='';root.querySelector('#product-dialog-title').textContent=product?'Editar producto':'Nuevo producto';dialog.showModal();mountAdminFormDisclosure(form,'product',{editableSections:Boolean(product)})};
 root.querySelector('#new-product').onclick=()=>open();
 root.querySelectorAll('[data-edit-product]').forEach(button=>button.onclick=()=>open(adminData.productTypes.find(product=>product.id===Number(button.dataset.editProduct))));
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
 form.elements.name.oninput=()=>{if(!form.elements.id.value)form.elements.slug.value=slugify(form.elements.name.value)};
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),values=adminFormData(form),id=Number(values.get('id'));const payload={name:String(values.get('name')).trim(),menu_description:String(values.get('menu_description')).trim(),sort_order:Number(values.get('sort_order'))||0,purchase_method:String(values.get('purchase_method')||'inherit'),active:values.get('active')==='on'};if(!id)payload.slug=slugify(values.get('slug'));if(!payload.name||!payload.menu_description||(!id&&!payload.slug)){status.textContent='Completa nombre, slug y descripción.';return}button.disabled=true;const query=id?supabase.from('catalog_product_types').update(payload).eq('id',id):supabase.from('catalog_product_types').insert(payload);const {error}=await query;button.disabled=false;if(error){status.textContent=error.code==='23505'?'Ya existe un producto con ese slug.':error.message;return}dialog.close();await refreshData(id?'Producto actualizado.':'Producto creado.',true);if(!id)location.hash='#tallas'};
}
function sizesView(){
 const rows=productSizeRows(adminData);
 const publishedCount=rows.filter(row=>row.published).length;
 const sections=adminData.productTypes.map(product=>{
  const sizes=rows.filter(row=>row.productSlug===product.slug);
  const productHeading=`<tr class="supplier-theme-row size-product-row" data-size-product-row="${safe(product.slug)}" data-size-product-name="${safe(product.name)}"><th colspan="4"><span>${safe(product.name)}</span><small>${sizes.length} ${sizes.length===1?'talla':'tallas'} · ${sizes.filter(row=>row.published).length} publicadas</small></th><th><button type="button" class="admin-secondary" data-new-size="${product.id}" aria-label="Agregar talla a ${safe(product.name)}">Agregar talla</button></th></tr>`;
  if(!sizes.length)return `${productHeading}<tr class="size-empty-row" data-size-empty-product="${safe(product.slug)}" data-size-product-name="${safe(product.name)}"><td colspan="5">Este producto aún no tiene tallas o medidas. Agrégalas aquí y después asocia sus insumos.</td></tr>`;
  const modelOrder=PRODUCT_SIZE_MODELS[product.slug]?.map(([code])=>code)||[];
  const modelCodes=[...new Set(sizes.map(row=>row.modelCode))].sort((a,b)=>{const indexA=modelOrder.indexOf(a),indexB=modelOrder.indexOf(b);return (indexA<0?999:indexA)-(indexB<0?999:indexB)||a.localeCompare(b,'es')});
  const modelGroups=modelCodes.map(modelCode=>{
   const modelSizes=sizes.filter(row=>row.modelCode===modelCode);
   const modelName=modelSizes[0].model;
   const heading=`<tr class="supplier-subcategory-row" data-size-model-row="${safe(product.slug)}" data-size-model-code="${safe(modelCode)}"><th colspan="5">${safe(modelName)}</th></tr>`;
   const entries=modelSizes.map(row=>{
    const supplies=row.suppliers.map(supplier=>`<span class="size-supplier">${safe(supplier.name)}</span>`).join('')||'<span class="admin-muted">Sin insumo</span>';
    const prices=row.suppliers.map(supplier=>`<span class="size-supplier-price">${supplier.confirmed_price_clp?money(supplier.confirmed_price_clp):'Pendiente'}</span>`).join('')||'<span class="admin-muted">—</span>';
    const categoryIds=adminData.supplierCategories.filter(category=>{const family=SUPPLIER_SIZE_FAMILIES[category.slug];return family?.[0]===row.productSlug&&family[1]===row.modelCode}).map(category=>String(category.id));
    const candidates=adminData.supplierProducts.filter(supplier=>categoryIds.includes(String(supplier.category_id))&&String(supplier.catalog_product_size_id)!==String(row.id)&&!supplier.confirmed_price_clp);
    const canLink=(row.modelCode==='tote'||!row.suppliers.length)&&candidates.length>0;
    const state=row.published?'Publicada':row.suppliers.length?'Sin precio publicado':'Sin insumo';
    const searchable=`${product.name} ${row.model} ${row.size} ${row.label} ${row.suppliers.map(supplier=>supplier.name).join(' ')} ${state}`;
    return `<tr data-size-row="${row.id}" data-size-product="${safe(product.slug)}" data-size-model="${safe(modelCode)}" data-size-search="${safe(searchable)}"><td><strong>${safe(row.label)}</strong><small>${safe(row.size)} · ${safe(product.name)} · ${safe(row.model)}</small></td><td>${supplies}</td><td>${prices}</td><td><span class="status-pill ${row.published?'is-active':'is-hidden'}">${state}</span></td><td><div class="row-actions"><button type="button" class="admin-secondary" data-edit-size="${row.id}">Editar</button>${adminActions({id:`size-actions-${row.id}`,name:`Más acciones para ${product.name} ${row.label}`,items:`${canLink?`<button type="button" data-link-size="${row.id}">Asociar insumo</button>`:''}${!row.suppliers.length&&categoryIds.length?`<button type="button" data-create-size-supplier="${row.id}">Crear insumo</button>`:''}<button type="button" class="admin-danger-link" data-delete-size="${row.id}" ${row.suppliers.length?'disabled title="Primero cambia los insumos asociados"':''}>Eliminar talla</button>${row.suppliers.length?'<small>Para eliminar la talla, cambia primero los insumos asociados.</small>':''}`})}</div></td></tr>`;
   }).join('');
   return heading+entries;
  }).join('');
  return productHeading+modelGroups;
 }).join('');
 const sizeDialog=`<dialog class="admin-dialog" id="product-size-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">PRODUCTO → TALLA</span><h2 data-size-title>Agregar talla</h2><p>La talla se define aquí. Después se asocia un insumo y se publica su precio.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><input type="hidden" name="id"><input type="hidden" name="product_type_id"><label>Producto<input name="product_name" readonly></label><label>Modelo<select name="model_code" required></select></label><label>Código de talla o medida<input name="size_code" required maxlength="40" placeholder="Ej. M, XXL, 4 años o 12-24 meses"><small>Este código aparecerá en la selección de compra.</small></label><label>Nombre visible<input name="label" required maxlength="80" placeholder="Ej. Mediana"></label><label>Orden<input name="sort_order" type="number" min="0" max="9999" value="0"></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar talla</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
 const linkDialog=`<dialog class="admin-dialog" id="size-supplier-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">TALLA → INSUMO</span><h2>Asociar insumo</h2><p data-link-description></p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><input type="hidden" name="size_id"><label>Insumo existente<select name="supplier_id" required></select></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Asociar insumo</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
 const table=`<section class="admin-panel supplier-compact-panel size-catalog-panel" aria-labelledby="size-catalog-title"><div class="admin-panel-head"><div><h2 id="size-catalog-title">Tallas y medidas</h2><p>${rows.length} ${rows.length===1?'talla configurada':'tallas configuradas'} · ${publishedCount} publicadas · ${rows.length-publishedCount} pendientes</p></div></div><div class="admin-list-toolbar">${adminSearch({label:'Buscar talla',placeholder:'Producto, modelo, talla o insumo',input:'data-size-search-input',output:`<output data-size-results aria-live="polite">${rows.length} ${rows.length===1?'talla':'tallas'}</output>`})}</div><div class="admin-table-wrap"><table class="admin-table supplier-compact-table size-catalog-table"><thead><tr><th scope="col">Talla o medida</th><th scope="col">Insumos</th><th scope="col">Precio</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>${sections}</tbody></table></div><p class="admin-list-empty" data-size-search-empty role="status" aria-live="polite" hidden>No encontramos tallas que coincidan con la búsqueda.</p></section>`;
 shell(`${pageHeading('PRODUCTOS','Tallas.','Define las tallas de cada producto y modelo. Después asocia un insumo y publica su precio.')}${table}${sizeDialog}${linkDialog}`,'tallas');
 wireSizes(rows);
}
function wireSizes(rows){
 const sizeDialog=root.querySelector('#product-size-dialog'),sizeForm=sizeDialog.querySelector('form'),sizeStatus=sizeForm.querySelector('.admin-form-status');
 const linkDialog=root.querySelector('#size-supplier-dialog'),linkForm=linkDialog.querySelector('form'),linkStatus=linkForm.querySelector('.admin-form-status');
 const search=root.querySelector('[data-size-search-input]'),tbody=root.querySelector('.size-catalog-table tbody'),searchEmpty=root.querySelector('[data-size-search-empty]');
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 search?.addEventListener('input',()=>{
  const query=normalize(search.value).trim(),visible=new Set(),models=new Set();
  let count=0;
  tbody.querySelectorAll('[data-size-row]').forEach(row=>{const matches=!query||normalize(row.dataset.sizeSearch).includes(query);row.hidden=!matches;if(matches){count++;visible.add(row.dataset.sizeProduct);models.add(`${row.dataset.sizeProduct}:${row.dataset.sizeModel}`)}});
  tbody.querySelectorAll('[data-size-model-row]').forEach(row=>{row.hidden=!models.has(`${row.dataset.sizeModelRow}:${row.dataset.sizeModelCode}`)});
  tbody.querySelectorAll('[data-size-empty-product]').forEach(row=>{row.hidden=Boolean(query)&&!normalize(row.dataset.sizeProductName).includes(query)});
  tbody.querySelectorAll('[data-size-product-row]').forEach(row=>{row.hidden=!visible.has(row.dataset.sizeProductRow)&&!tbody.querySelector(`[data-size-empty-product="${CSS.escape(row.dataset.sizeProductRow)}"]:not([hidden])`)});
  root.querySelector('[data-size-results]').textContent=`${count} ${count===1?'talla':'tallas'}`;
  searchEmpty.hidden=!query||Boolean(visible.size)||Boolean(tbody.querySelector('[data-size-empty-product]:not([hidden])'));
 });
 const openSize=(product,row=null)=>{
  sizeForm.reset();sizeStatus.textContent='';sizeForm.dataset.autoLabel='';
  sizeForm.elements.id.value=row?.id||'';sizeForm.elements.product_type_id.value=product.id;sizeForm.elements.product_name.value=product.name;
  const models=PRODUCT_SIZE_MODELS[product.slug]||[['general','General']];
  sizeForm.elements.model_code.innerHTML=models.map(([code,label])=>`<option value="${safe(code)}">${safe(label)}</option>`).join('');
  sizeForm.elements.model_code.value=row?.modelCode||models[0][0];
  sizeForm.elements.model_code.disabled=Boolean(row?.suppliers.length);
  sizeForm.elements.size_code.value=row?.size||'';sizeForm.elements.size_code.readOnly=Boolean(row?.suppliers.length);
  sizeForm.elements.label.value=row?.label||'';
  sizeForm.elements.sort_order.value=row?.sortOrder??Math.max(0,...rows.filter(item=>item.productSlug===product.slug).map(item=>Number(item.sortOrder)||0))+10;
  sizeForm.querySelector('[data-size-title]').textContent=row?'Editar talla':'Agregar talla';
  sizeDialog.showModal();sizeForm.elements.size_code.focus();
 };
 root.querySelectorAll('[data-new-size]').forEach(button=>button.onclick=()=>openSize(adminData.productTypes.find(product=>String(product.id)===button.dataset.newSize)));
 root.querySelectorAll('[data-edit-size]').forEach(button=>button.onclick=()=>{const row=rows.find(item=>String(item.id)===button.dataset.editSize),product=adminData.productTypes.find(item=>item.slug===row?.productSlug);if(row&&product)openSize(product,row)});
 sizeDialog.querySelector('.dialog-close').onclick=()=>sizeDialog.close();sizeDialog.querySelector('.dialog-cancel').onclick=()=>sizeDialog.close();
 sizeForm.elements.size_code.oninput=()=>{if(!sizeForm.elements.label.value.trim()||sizeForm.dataset.autoLabel===sizeForm.elements.label.value){sizeForm.elements.label.value=sizeForm.elements.size_code.value;sizeForm.dataset.autoLabel=sizeForm.elements.label.value}};
 sizeForm.onsubmit=async event=>{
  event.preventDefault();const button=event.submitter,status=sizeStatus,id=Number(sizeForm.elements.id.value),model=sizeForm.elements.model_code.value,code=String(sizeForm.elements.size_code.value).trim(),label=String(sizeForm.elements.label.value).trim(),productId=Number(sizeForm.elements.product_type_id.value);
  const modelCode=model==='general'?'':model;
  if(!code||!label){status.textContent='Completa el código y nombre de la talla.';return}
  if(modelCode==='kid'&&!/^\d{1,2} años$/.test(code)){status.textContent='Para niños usa una edad, por ejemplo 4 años.';return}
  if(modelCode==='body'&&!/^\d{1,2}-\d{1,2} meses$/.test(code)){status.textContent='Para Body usa un rango, por ejemplo 12-24 meses.';return}
  if(modelCode==='tote'&&!['S','M','L'].includes(code)){status.textContent='Para Tote Bag usa S, M o L.';return}
  if(['basic','woman','over'].includes(modelCode)&&!/^(?:XS|S|M|L|XL|XXL|[3-9]XL)$/.test(code)){status.textContent='Para poleras usa XS, S, M, L, XL, XXL o 3XL–9XL.';return}
  button.disabled=true;const payload={product_type_id:productId,model_code:modelCode,size_code:code,label,sort_order:Number(sizeForm.elements.sort_order.value)||0,updated_at:new Date().toISOString()};
  const result=id?await supabase.from('catalog_product_sizes').update(payload).eq('id',id):await supabase.from('catalog_product_sizes').insert(payload);
  button.disabled=false;if(result.error){status.textContent=result.error.code==='23505'?'Esta talla ya existe para este producto y modelo.':result.error.message;return}
  sizeDialog.close();await refreshData(id?'Talla actualizada.':'Talla agregada.',true);
 };
 root.querySelectorAll('[data-link-size]').forEach(button=>button.onclick=()=>{
  const row=rows.find(item=>String(item.id)===button.dataset.linkSize);if(!row)return;
  const categoryIds=adminData.supplierCategories.filter(category=>{const family=SUPPLIER_SIZE_FAMILIES[category.slug];return family?.[0]===row.productSlug&&family[1]===row.modelCode}).map(category=>String(category.id));
  const candidates=adminData.supplierProducts.filter(supplier=>categoryIds.includes(String(supplier.category_id))&&String(supplier.catalog_product_size_id)!==String(row.id)&&!supplier.confirmed_price_clp);
  linkForm.reset();linkStatus.textContent='';linkForm.elements.size_id.value=row.id;
  linkForm.querySelector('[data-link-description]').textContent=`${row.productName} · ${row.model} · ${row.size}`;
  linkForm.elements.supplier_id.innerHTML=`<option value="">Selecciona un insumo</option>${candidates.map(supplier=>`<option value="${supplier.id}">${safe(supplier.name)}</option>`).join('')}`;
  linkDialog.showModal();linkForm.elements.supplier_id.focus();
 });
 linkDialog.querySelector('.dialog-close').onclick=()=>linkDialog.close();linkDialog.querySelector('.dialog-cancel').onclick=()=>linkDialog.close();
 linkForm.onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;const {error}=await supabase.from('supplier_products').update({catalog_product_size_id:Number(linkForm.elements.size_id.value),updated_at:new Date().toISOString()}).eq('id',Number(linkForm.elements.supplier_id.value));button.disabled=false;if(error){linkStatus.textContent=error.message;return}linkDialog.close();await refreshData('Insumo asociado a la talla.',true)};
 root.querySelectorAll('[data-delete-size]').forEach(button=>button.onclick=async()=>{const row=rows.find(item=>String(item.id)===button.dataset.deleteSize);if(!row||row.suppliers.length||!window.confirm(`¿Eliminar la talla ${row.size} de ${row.productName}?`))return;button.disabled=true;const {error}=await supabase.from('catalog_product_sizes').delete().eq('id',row.id);if(error){button.disabled=false;toast(error.message);return}await refreshData('Talla eliminada.',true)});
 root.querySelectorAll('[data-create-size-supplier]').forEach(button=>button.onclick=()=>{try{sessionStorage.setItem('droska:pending-supplier-size',button.dataset.createSizeSupplier)}catch{}location.hash='#insumos'});
}
function collectionsPanel(){
 return collectionsPanelMarkup({collections:adminData.collections,designs:adminData.designs,productName,categoryName,search:listSearch('Buscar colección','Nombre, producto o categoría'),searchEmpty,previewUrl:(design,collection)=>{
  if(!design)return '';
  const slug=adminData.productTypes.find(product=>product.id===collection.product_type_id)?.slug;
  const mockups=designProductMockups(design);
  return catalogAssetUrl(mockups[slug]?.path||Object.values(mockups).find(mockup=>mockup.path)?.path||'');
 }});
}
function wireHomeOrder(){
 const list=root.querySelector('[data-home-order-list]');if(!list)return;
 const status=root.querySelector('.home-order-status'),saveButton=root.querySelector('[data-save-home-order]');let dragged=null;
 const markDirty=()=>{saveButton.disabled=false;status.textContent='Cambios sin guardar';status.dataset.state='pending'};
 const syncMoveButtons=()=>{const visible=[...list.querySelectorAll('[data-home-collection]')].filter(row=>!row.hidden);visible.forEach((row,index)=>{row.querySelector('[data-home-up]').disabled=index===0;row.querySelector('[data-home-down]').disabled=index===visible.length-1})};
 const updatePositions=()=>{list.querySelectorAll('[data-home-collection]').forEach((row,index)=>{const position=row.querySelector('.home-order-position');position.textContent=index+1;position.setAttribute('aria-label',`Posición ${index+1}`)});syncMoveButtons();markDirty()};
 const move=(row,offset)=>{const rows=[...list.querySelectorAll('[data-home-collection]')].filter(item=>!item.hidden),index=rows.indexOf(row),next=rows[index+offset];if(!next)return;const focused=document.activeElement;offset<0?list.insertBefore(row,next):list.insertBefore(next,row);updatePositions();(focused?.disabled?row.querySelector('[data-home-up]:not(:disabled),[data-home-down]:not(:disabled)'):focused)?.focus()};
 const save=async()=>{
  const rows=[...list.querySelectorAll('[data-home-collection]')];if(!rows.length)return;
  const button=root.querySelector('[data-save-home-order]');button.disabled=true;list.setAttribute('inert','');status.textContent='Guardando…';status.dataset.state='busy';
  try{
   const collectionUpdates=rows.map((row,index)=>{const id=Number(row.dataset.homeCollection);const limit=Math.max(1,Math.min(12,Number(row.querySelector('[data-home-limit]').value)||4));return supabase.from('catalog_collections').update({sort_order:index*10,home_design_limit:limit}).eq('id',id)});
   const results=await Promise.all(collectionUpdates);const failed=results.find(result=>result.error);if(failed?.error)throw failed.error;
   for(const row of rows){
    const collectionId=Number(row.dataset.homeCollection),featuredId=Number(row.querySelector('[data-home-featured]').value)||null;
    const clear=await supabase.from('catalog_designs').update({is_featured:false}).eq('collection_id',collectionId);if(clear.error)throw clear.error;
    if(featuredId){const chosen=await supabase.from('catalog_designs').update({is_featured:true}).eq('id',featuredId).eq('collection_id',collectionId);if(chosen.error)throw chosen.error}
   }
   await refreshData('Configuración del home actualizada.',true);
  }catch(error){button.disabled=false;status.textContent=`No se pudo guardar: ${error.message}`;status.dataset.state='error'}finally{list.removeAttribute('inert')}
 };
 list.querySelectorAll('[data-home-up]').forEach(button=>button.onclick=()=>move(button.closest('[data-home-collection]'),-1));
 list.querySelectorAll('[data-home-down]').forEach(button=>button.onclick=()=>move(button.closest('[data-home-collection]'),1));
 list.querySelectorAll('[data-home-collection]').forEach(row=>{
  row.querySelector('[data-home-drag]').addEventListener('dragstart',event=>{dragged=row;row.classList.add('is-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',row.dataset.homeCollection)});
  row.addEventListener('dragover',event=>{event.preventDefault();if(!dragged||dragged===row)return;const before=event.clientY<row.getBoundingClientRect().top+row.offsetHeight/2;list.insertBefore(dragged,before?row:row.nextSibling);updatePositions()});
  row.addEventListener('drop',event=>event.preventDefault());
  row.addEventListener('dragend',()=>{row.classList.remove('is-dragging');dragged=null});
 });
 syncMoveButtons();
 root.querySelector('#admin-search-input')?.addEventListener('input',syncMoveButtons);
 root.querySelector('[data-save-home-order]').onclick=save;
 list.querySelectorAll('[data-home-limit],[data-home-featured]').forEach(input=>input.addEventListener('change',()=>{syncMoveButtons();markDirty()}));
}
function collectionsView(){
 const action=`<button type="button" class="admin-primary" id="new-collection">${icon('plus')} Nueva colección</button>`;
 const productOptions=adminData.productTypes.map(product=>`<option value="${product.id}">${safe(product.name)}</option>`).join('');
 const categoryOptions=adminData.categories.map(category=>`<option value="${category.id}">${safe(category.name)}${category.active?'':' (Oculta)'}</option>`).join('');
 const content=`${pageHeading('CATÁLOGO','Colecciones.','Crea y ordena las portadas que tus clientes exploran en la tienda.',action)}${collectionsPanel()}<dialog class="admin-dialog" id="collection-dialog"><form method="dialog" id="collection-form"><div class="dialog-title"><div><span class="admin-eyebrow">CATÁLOGO</span><h2 id="collection-dialog-title">Nueva colección</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><input type="hidden" name="id"><label>Producto<select name="product_type_id" required><option value="">Selecciona un producto</option>${productOptions}</select></label><label>Categoría<select name="category_id" required><option value="">Selecciona una categoría</option>${categoryOptions}</select></label><label>Nombre<input name="name" required maxlength="70" placeholder="Ej. Para Papá"></label><label>Slug<input name="slug" required maxlength="70" pattern="(?:[a-z0-9]|-)+" placeholder="para-papa"><small>Se usa en URLs y conexiones internas.</small></label><label>Orden<input name="sort_order" type="number" min="0" max="999" value="0"></label><label class="admin-check"><input name="is_featured" type="checkbox"><span>Destacar esta colección en la tienda</span></label><p class="admin-notice">Solo una colección puede estar destacada. Al guardar, reemplaza la anterior.</p><label class="admin-check"><input name="active" type="checkbox" checked><span>Mostrar esta colección en la tienda</span></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar colección</button></div><p class="admin-form-status" role="alert"></p></form></dialog><dialog class="admin-dialog admin-confirm-dialog" id="delete-collection-dialog"><form method="dialog"><div class="dialog-title"><div><span class="admin-eyebrow">ACCIÓN PERMANENTE</span><h2>Eliminar colección</h2></div><button type="button" class="dialog-close" data-delete-cancel aria-label="Cerrar">×</button></div><p>Vas a eliminar <strong data-delete-name></strong>. Esta acción no se puede deshacer.</p><input type="hidden" name="collection_id"><div class="dialog-actions"><button type="button" class="admin-secondary" data-delete-cancel>Cancelar</button><button type="submit" class="admin-danger">Eliminar colección</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
 shell(content,'colecciones');wireHomeOrder();wireCollections();filterCurrentView('');
}
function openCollectionDialog(collection){
 const dialog=root.querySelector('#collection-dialog');const form=root.querySelector('#collection-form');unmountAdminFormDisclosure(form);form.reset();form.elements.id.value=collection?.id||'';form.elements.product_type_id.value=collection?.product_type_id||adminData.productTypes.find(item=>item.slug==='poleras')?.id||'';form.elements.category_id.value=collection?.category_id||adminData.categories.find(item=>item.slug==='general')?.id||'';form.elements.name.value=collection?.name||'';form.elements.slug.value=collection?.slug||'';form.elements.sort_order.value=collection?.sort_order??adminData.collections.length;form.elements.is_featured.checked=Boolean(collection?.is_featured);form.elements.active.checked=collection?.active??true;root.querySelector('#collection-dialog-title').textContent=collection?'Editar colección':'Nueva colección';dialog.showModal();mountAdminFormDisclosure(form,'collection',{editableSections:Boolean(collection)});
}
function wireCategories(){
 const dialog=root.querySelector('#category-dialog'),form=root.querySelector('#category-form'),deleteDialog=root.querySelector('#delete-category-dialog'),deleteForm=deleteDialog.querySelector('form');
 const open=category=>{form.reset();form.elements.id.value=category?.id||'';form.elements.name.value=category?.name||'';form.elements.slug.value=category?.slug||'';form.elements.sort_order.value=category?.sort_order??adminData.categories.length*10;form.elements.active.checked=category?.active??true;form.querySelector('.admin-form-status').textContent='';dialog.showModal();form.elements.name.focus()};
 root.querySelector('#new-category').onclick=()=>open();
 root.querySelectorAll('[data-edit-category]').forEach(button=>button.onclick=()=>open(adminData.categories.find(category=>category.id===Number(button.dataset.editCategory))));
 root.querySelectorAll('[data-delete-category]').forEach(button=>button.onclick=()=>{const category=adminData.categories.find(item=>item.id===Number(button.dataset.deleteCategory));if(!category)return;deleteForm.elements.category_id.value=category.id;deleteForm.querySelector('[data-delete-category-name]').textContent=`“${category.name}”`;deleteForm.querySelector('.admin-form-status').textContent='';deleteDialog.showModal();deleteDialog.querySelector('[data-delete-category-cancel]').focus()});
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
 deleteDialog.querySelectorAll('[data-delete-category-cancel]').forEach(button=>button.onclick=()=>deleteDialog.close());
 form.elements.name.oninput=()=>{if(!form.elements.id.value)form.elements.slug.value=slugify(form.elements.name.value)};
 deleteForm.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=deleteForm.querySelector('.admin-form-status'),id=Number(deleteForm.elements.category_id.value);button.disabled=true;button.textContent='Eliminando…';const {error}=await supabase.from('catalog_categories').delete().eq('id',id);if(error){button.disabled=false;button.textContent='Eliminar categoría';status.textContent=error.code==='23503'?'La categoría todavía contiene colecciones. Muévelas o elimínalas primero.':error.message;return}deleteDialog.close();await refreshData('Categoría eliminada.',true)};
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=form.querySelector('.admin-form-status'),values=new FormData(form),id=Number(values.get('id'));const payload={name:String(values.get('name')).trim(),slug:slugify(values.get('slug')),sort_order:Number(values.get('sort_order'))||0,active:values.get('active')==='on'};if(!payload.name||!payload.slug){status.textContent='Completa nombre y slug.';return}button.disabled=true;const query=id?supabase.from('catalog_categories').update(payload).eq('id',id):supabase.from('catalog_categories').insert(payload);const {error}=await query;button.disabled=false;if(error){status.textContent=error.code==='23505'?'Ya existe una categoría con ese slug.':error.message;return}dialog.close();await refreshData(id?'Categoría actualizada.':'Categoría creada.',true)};
}
function wireCollections(){
 const dialog=root.querySelector('#collection-dialog');const form=root.querySelector('#collection-form');const deleteDialog=root.querySelector('#delete-collection-dialog');const deleteForm=deleteDialog.querySelector('form');const name=form.elements.name;const slug=form.elements.slug;let slugTouched=false;
 root.querySelector('#new-collection').onclick=()=>openCollectionDialog();dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
 slug.addEventListener('input',()=>{slugTouched=true});name.addEventListener('input',()=>{if(!slugTouched)slug.value=slugify(name.value)});
 root.querySelectorAll('[data-edit-collection]').forEach(button=>button.onclick=()=>openCollectionDialog(adminData.collections.find(item=>item.id===Number(button.dataset.editCollection))));
 root.querySelectorAll('[data-toggle-collection]').forEach(button=>button.onclick=async()=>{const collection=adminData.collections.find(item=>item.id===Number(button.dataset.toggleCollection));button.disabled=true;const {error}=await supabase.from('catalog_collections').update({active:!collection.active}).eq('id',collection.id);if(error){button.disabled=false;return toast(`No se pudo cambiar el estado: ${error.message}`)}await refreshData('Estado actualizado.',true)});
 root.querySelectorAll('[data-delete-collection]').forEach(button=>button.onclick=()=>{const collection=adminData.collections.find(item=>item.id===Number(button.dataset.deleteCollection));if(!collection)return;deleteForm.elements.collection_id.value=collection.id;deleteDialog.querySelector('[data-delete-name]').textContent=`“${collection.name}”`;deleteDialog.showModal();deleteDialog.querySelector('[data-delete-cancel]').focus()});
 deleteDialog.querySelectorAll('[data-delete-cancel]').forEach(button=>button.onclick=()=>deleteDialog.close());
 deleteForm.onsubmit=async event=>{event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]'),status=deleteForm.querySelector('.admin-form-status'),id=Number(deleteForm.elements.collection_id.value);button.disabled=true;button.textContent='Eliminando…';const {error}=await supabase.from('catalog_collections').delete().eq('id',id);if(error){button.disabled=false;button.textContent='Eliminar colección';status.textContent=error.code==='23503'?'La colección todavía contiene diseños. Muévelos o elimínalos primero.':error.message;return}deleteDialog.close();await refreshData('Colección eliminada.',true)};
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]');const status=form.querySelector('.admin-form-status');const values=adminFormData(form);const payload={product_type_id:Number(values.get('product_type_id')),category_id:Number(values.get('category_id')),name:String(values.get('name')).trim(),slug:slugify(values.get('slug')),sort_order:Number(values.get('sort_order'))||0,is_featured:values.get('is_featured')==='on',active:values.get('active')==='on'};if(!payload.product_type_id||!payload.category_id||!payload.name||!payload.slug){status.textContent='Completa producto, categoría, nombre y slug.';return}button.disabled=true;button.textContent='Guardando…';const id=Number(values.get('id'));const query=id?supabase.from('catalog_collections').update(payload).eq('id',id):supabase.from('catalog_collections').insert(payload);const {data:saved,error}=await query.select('id').single();if(error){button.disabled=false;button.textContent='Guardar colección';status.textContent=error.code==='23505'?'Ya existe una colección con ese slug.':error.message;return}if(payload.is_featured){const {error:clearError}=await supabase.from('catalog_collections').update({is_featured:false}).eq('is_featured',true).neq('id',saved.id);if(clearError){await supabase.from('catalog_collections').update({is_featured:false}).eq('id',saved.id);button.disabled=false;button.textContent='Guardar colección';status.textContent=`La colección se guardó, pero no se pudo cambiar la destacada: ${clearError.message}`;return}}dialog.close();await refreshData(id?'Colección actualizada.':'Colección creada.',true)};
}

// La pill editorial tiene un control independiente de la colección destacada.
// Se mantiene aquí para que el panel siga siendo compatible con instalaciones
// que aún no tienen el campo en el HTML generado por una versión anterior.
function wireCollectionsV2(){
 const dialog=root.querySelector('#collection-dialog'),form=root.querySelector('#collection-form'),deleteDialog=root.querySelector('#delete-collection-dialog'),deleteForm=deleteDialog.querySelector('form');
 const featured=form.elements.is_featured;
 featured.closest('label')?.insertAdjacentHTML('afterend','<label class="admin-check"><input name="is_new_collection" type="checkbox"><span>Mostrar la pill «Nueva colección»</span></label>');
 const newFlag=form.elements.is_new_collection;
 root.querySelector('#new-collection').onclick=()=>openCollectionDialog();
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
 root.querySelectorAll('[data-edit-collection]').forEach(button=>button.onclick=()=>{const collection=adminData.collections.find(item=>item.id===Number(button.dataset.editCollection));openCollectionDialog(collection);newFlag.checked=Boolean(collection?.is_new_collection)});
 root.querySelectorAll('[data-toggle-collection]').forEach(button=>button.onclick=async()=>{const collection=adminData.collections.find(item=>item.id===Number(button.dataset.toggleCollection));button.disabled=true;const {error}=await supabase.from('catalog_collections').update({active:!collection.active}).eq('id',collection.id);if(error){button.disabled=false;return toast(`No se pudo cambiar el estado: ${error.message}`)}await refreshData('Estado actualizado.',true)});
 root.querySelectorAll('[data-delete-collection]').forEach(button=>button.onclick=()=>{const collection=adminData.collections.find(item=>item.id===Number(button.dataset.deleteCollection));if(!collection)return;deleteForm.elements.collection_id.value=collection.id;deleteDialog.querySelector('[data-delete-name]').textContent=`“${collection.name}”`;deleteDialog.showModal();deleteDialog.querySelector('[data-delete-cancel]').focus()});
 deleteDialog.querySelectorAll('[data-delete-cancel]').forEach(button=>button.onclick=()=>deleteDialog.close());
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),values=adminFormData(form),payload={product_type_id:Number(values.get('product_type_id')),category_id:Number(values.get('category_id')),name:String(values.get('name')).trim(),slug:slugify(values.get('slug')),sort_order:Number(values.get('sort_order'))||0,is_featured:values.get('is_featured')==='on',is_new_collection:values.get('is_new_collection')==='on',active:values.get('active')==='on'};if(!payload.product_type_id||!payload.category_id||!payload.name||!payload.slug){status.textContent='Completa producto, categoría, nombre y slug.';return}button.disabled=true;button.textContent='Guardando…';const id=Number(values.get('id'));const query=id?supabase.from('catalog_collections').update(payload).eq('id',id):supabase.from('catalog_collections').insert(payload);const {data:saved,error}=await query.select('id').single();if(error){button.disabled=false;button.textContent='Guardar colección';status.textContent=error.code==='23505'?'Ya existe una colección con ese slug.':error.message;return}if(payload.is_featured){const {error:clearError}=await supabase.from('catalog_collections').update({is_featured:false}).eq('is_featured',true).neq('id',saved.id);if(clearError){button.disabled=false;button.textContent='Guardar colección';status.textContent=`La colección se guardó, pero no se pudo cambiar la destacada: ${clearError.message}`;return}}dialog.close();await refreshData(id?'Colección actualizada.':'Colección creada.',true)};
}
wireCollections=wireCollectionsV2;

const collectionName=id=>adminData.collections.find(item=>item.id===id)?.name||'Sin colección';
function availableDesignColors(){
 return PRODUCT_COLORS.map(color=>({value:color.hex,label:color.name,group:color.group,shade:color.shade}));
}
function designColorOptionsMarkup(name,type,available=availableDesignColors(),selected=[]){
 const colors=available.map(color=>color.value?color:{value:color.hex,label:color.name,group:color.group,shade:color.shade}),first=selected.find(value=>colors.some(color=>color.value===value))||colors[0]?.value;
 const groups=productColorGroups(colors.map(color=>({code:color.value,name:color.label,hex:color.value,group:color.group,shade:color.shade}))).map(group=>`<section class="admin-color-group"><h3>${safe(group.label)} <small>${safe(group.colors.map(color=>color.shade.toLowerCase()).filter((value,index,items)=>items.indexOf(value)===index).join(' · '))}</small></h3><div class="admin-color-grid">${group.colors.map(color=>`<label class="admin-color-option"><input type="${type}" name="${name}" value="${color.hex}" ${(type==='radio'&&color.hex===first)||(type==='checkbox'&&selected.includes(color.hex))?'checked':''}${type==='radio'?' required':''}><i style="--sample-color:${color.hex}" aria-hidden="true"></i><span>${safe(color.name)}</span></label>`).join('')}</div></section>`).join('');
 return `<div class="admin-color-groups">${groups}</div>`;
}
function designArtworkSrc(design){
 const local=design.artwork_path?.startsWith('local:')?baseDesigns.find(item=>item.id===design.slug):null;
 return local?artworkUrl(local):catalogAssetUrl(design.artwork_path);
}
function designPreview(design){
 const src=designArtworkSrc(design);
 return src?`<img src="${safe(src)}" alt="Vista previa de ${safe(design.name)}">`:`<span>${icon('image')}</span>`;
}
function mockupPreview(design){const entry=Object.entries(designProductMockups(design)).find(([,photo])=>photo.path);if(!entry)return '<span>Sin mockup</span>';const [slug,photo]=entry,name=adminData.productTypes.find(product=>product.slug===slug)?.name||slug;return `<img src="${safe(photo.path)}" alt="Mockup de ${safe(name)} para ${safe(design.name)}">`}
function designProductFilesMarkup(){
 const products=adminData.productTypes.map(product=>{
  const slug=safe(product.slug),name=safe(product.name);
  const file=catalogFileField({name:`artwork_${slug}`,label:`Arte ${slug==='poleras'?'principal':`para ${product.name}`}`,disabled:true});
  const upload=`<div class="admin-catalog-upload">
   ${file}
   <div class="design-file-preview" hidden><img alt="Arte para ${name}"></div>
  </div>`;
  return `<section data-design-product="${slug}">
   <label class="admin-check"><input type="checkbox" name="design_products" value="${slug}"><span>${name}${product.active?'':' (oculto)'}</span></label>
   <div data-product-upload hidden>${slug==='poleras'?poleraPrintFields(upload):upload}</div>
  </section>`;
 }).join('');
 return `<fieldset class="admin-product-artworks">
  <legend>Disponibilidad por producto</legend>
  <p>Selecciona los productos y carga su arte. PNG, JPG o WebP de hasta 25 MB.</p>
  ${products}
 </fieldset>`;
}
function designEditorMarkup(options){
 return catalogDialogMarkup({
  id:'design-dialog',formId:'design-form',className:'admin-design-dialog',
  title:'Nuevo diseño',submit:'Publicar diseño',discard:true,workflow:true,
  body:`<input type="hidden" name="id"><label>Colección<select name="collection_id" required><option value="">Selecciona una colección</option>${options}</select></label>
   <label>Nombre<input name="name" required maxlength="80" placeholder="Ej. Reto lunar"></label>
   <label>Slug<input name="slug" required maxlength="80" pattern="(?:[a-z0-9]|-)+" placeholder="reto-lunar"><small>Identificador único del diseño.</small></label>
   <label>Descripción<textarea name="caption" maxlength="180" rows="3" placeholder="Una frase breve para la tarjeta."></textarea></label>${designProductFilesMarkup()}<fieldset class="admin-sample-colors admin-allowed-colors"><legend>Colores que usará este diseño</legend><p>Elige qué tonos de la gama global se ofrecerán con este diseño.</p><div class="admin-design-product-colors" data-design-product-colors></div><p data-color-config-note role="status" aria-live="polite"></p></fieldset>
   <fieldset class="admin-sample-colors" data-design-sample-colors><legend>Color de polera para la muestra</legend><p>Este color se usa para mostrar el diseño en la vista previa.</p><div data-sample-color-options></div></fieldset>${productMockupFields(adminData.productTypes)}<fieldset class="admin-design-flags"><legend>Visibilidad y personalización</legend><label class="admin-check"><input name="accepts_customer_image" type="checkbox"><span>Este diseño comienza con una imagen del cliente</span></label><label data-customer-photo-subject hidden>¿De quién será la foto?<select name="customer_photo_subject" disabled><option value="pets">Mascotas (perro y gato)</option><option value="people">Personas (familia, amigos o colegas)</option></select><small>Cambia las fotos de ejemplo en la tarjeta y las indicaciones del pedido.</small></label><label class="admin-check admin-auto-base-purchase"><input name="allows_base_purchase" type="checkbox" disabled><span><strong>Permitir comprar el diseño tal cual</strong><small data-base-purchase-note>Se configura automáticamente según el tipo de foto.</small></span></label><label class="admin-check"><input name="is_featured" type="checkbox"><span>Mostrar primero como diseño destacado</span></label><label class="admin-check"><input name="active" type="checkbox" checked><span>Mostrar este diseño en la tienda</span></label></fieldset>`,
 });
}
function deleteDesignDialogMarkup(){
 return catalogDialogMarkup({
  id:'delete-design-dialog',className:'admin-confirm-dialog',title:'Eliminar diseño',
  body:`<input type="hidden" name="design_id"><div class="admin-catalog-delete-details">
   <p><strong data-delete-design-name></strong><span data-delete-design-collection></span></p>
   <img data-delete-design-preview alt="" hidden>
  </div>
  <p>El diseño y sus archivos se eliminarán de forma permanente. Para retirarlo de la tienda y conservarlo, usa «Ocultar».</p>`,
  submit:'Eliminar diseño',danger:true,
 });
}
function designsView(){
 const designColors=availableDesignColors();
 const rows=adminData.designs.map(design=>{
  const collection=adminData.collections.find(item=>item.id===design.collection_id);
  const color=normalizeSampleColor(design.sample_color),colorName=designColors.find(item=>item.value===color)?.label||color,productColors=designProductColorMap(design,Object.keys(currentProductArtworks(design))),colorCount=Object.values(productColors).reduce((total,colors)=>total+colors.length,0),flags=[design.accepts_customer_image?(design.customer_photo_subject==='people'?'Base + foto de personas':'Foto de mascotas obligatoria'):'',design.is_featured?'Destacado':'',colorCount?`${colorCount} selecciones de color`:'Colores por producto pendientes'].filter(Boolean).join(' · ');
  const canAdjust=Object.keys(currentProductArtworks(design)).some(slug=>['poleras','bodys','totebags'].includes(slug));
  const searchable=`${design.name} ${design.slug} ${collection?.name||''} ${categoryName(collection?.category_id)} ${colorName} ${flags}`.toLowerCase();
  return `<tr data-admin-searchable="${safe(searchable)}" data-admin-category-id="${safe(collection?.category_id||'')}" data-admin-collection-id="${safe(design.collection_id)}"><td><div class="admin-design-thumb" style="--sample-color:${color}">${designPreview(design)}</div><div class="admin-design-name"><strong>${safe(design.name)}</strong><small>${safe(design.caption||'Sin descripción.')} · ${safe(Object.keys(currentProductArtworks(design)).map(slug=>adminData.productTypes.find(product=>product.slug===slug)?.name||slug).join(', '))}</small><small>${safe(flags)}</small></div></td><td><div class="admin-mockup-thumb">${mockupPreview(design)}</div></td><td><span class="admin-collection-label">${safe(collectionName(design.collection_id))}</span></td><td><span class="admin-sample-swatch" style="--sample-color:${color}"><i aria-hidden="true"></i>${safe(colorName)}</span></td><td><code>/${safe(design.slug)}</code></td><td><span class="status-pill ${design.active?'is-active':'is-hidden'}">${design.active?'Activo':'Oculto'}</span></td><td><div class="row-actions"><button type="button" class="admin-secondary" data-edit-design="${design.id}">Editar</button>${adminActions({id:`design-actions-${design.id}`,name:`Más acciones para ${design.name}`,items:`${canAdjust?`<button type="button" data-adjust-design="${design.id}">Ajustar estampado</button>`:''}<button type="button" data-toggle-design="${design.id}">${design.active?'Ocultar':'Mostrar'}</button><button type="button" class="admin-danger-link" data-delete-design="${design.id}">Eliminar</button>`})}</div></td></tr>`;
 }).join('');
 const action=`<button type="button" class="admin-primary" id="new-design">${icon('plus')} Nuevo diseño</button>`;
 const options=adminData.collections.map(collection=>`<option value="${collection.id}">${safe(collection.name)}</option>`).join('');
 const populatedCollections=adminData.collections.filter(collection=>adminData.designs.some(design=>design.collection_id===collection.id));
 const populatedCategories=adminData.categories.filter(category=>populatedCollections.some(collection=>collection.category_id===category.id));
 const categoryOptions=populatedCategories.map(category=>`<option value="${category.id}">${safe(category.name)}</option>`).join('');
 const collectionFilterOptions=populatedCollections.map(collection=>`<option value="${collection.id}" data-category-id="${safe(collection.category_id)}">${safe(collection.name)} · ${safe(productName(collection.product_type_id))}</option>`).join('');
 const filters=`<label class="admin-filter-field" for="admin-design-category-filter">Tipo de colección<select id="admin-design-category-filter"><option value="">Todos los tipos</option>${categoryOptions}</select></label><label class="admin-filter-field" for="admin-design-collection-filter">Colección<select id="admin-design-collection-filter"><option value="">Todas</option>${collectionFilterOptions}</select></label>`;
 const list=rows?`<section class="admin-panel admin-design-panel"><div class="admin-panel-head"><div><h2>Todos los diseños</h2><p>${adminData.designs.length} en total · ${adminData.designs.filter(item=>item.active).length} activos</p></div></div>${listSearch('Buscar diseño','Nombre, colección o color',filters)}<div class="admin-table-wrap"><table class="admin-table admin-design-table"><thead><tr><th>Diseño</th><th>Mockup</th><th>Colección</th><th>Polera muestra</th><th>Slug</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div>${searchEmpty}</section>`:'<section class="admin-panel admin-empty"><strong>Aún no hay diseños.</strong><p>Carga el primero para comenzar tu catálogo.</p></section>';
 const content=`${pageHeading('CATÁLOGO','Diseños.','Carga piezas y asígnalas a una colección. Los diseños activos aparecen en la tienda.',action)}${list}`;
 shell(content+designEditorMarkup(options)+printLayoutDialogMarkup()+deleteDesignDialogMarkup()+productColorDialogMarkup(),'disenos');
 const categoryFilter=root.querySelector('#admin-design-category-filter');
 const collectionFilter=root.querySelector('#admin-design-collection-filter');
 const applyFilters=()=>filterCurrentView(root.querySelector('#admin-search-input')?.value||'');
 categoryFilter?.addEventListener('change',()=>{
  for(const option of collectionFilter.options){
   if(option.value)option.disabled=Boolean(categoryFilter.value&&option.dataset.categoryId!==categoryFilter.value);
  }
  if(collectionFilter.selectedOptions[0]?.disabled)collectionFilter.value='';
  applyFilters();
 });
 collectionFilter?.addEventListener('change',applyFilters);
 wireDesigns();
 filterCurrentView('');
}
function validateArtwork(file,required,maxBytes=CATALOG_SOURCE_MAX_BYTES){
 if(!file)return required?'Selecciona un archivo para el diseño.':'';
 if(!file.size)return 'El archivo está vacío. Elige otra imagen.';
 if(!IMAGE_TYPES.includes(file.type))return 'Usa un archivo PNG, JPG o WebP.';
 if(file.size>maxBytes)return `El archivo supera el máximo de ${Math.round(maxBytes/1024/1024)} MB.`;
 return '';
}
const fileSizeLabel=bytes=>bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
async function optimizeCatalogArtwork(file,baseName='diseño',policy=CATALOG_IMAGE_POLICY){
 return optimizeImage(file,{policy,baseName});
}
async function uploadCatalogFileToR2(path,file){
 const label=file.type==='video/mp4'?'video':'imagen';
 const feedback=beginUploadFeedback(file.name,`Publicando ${label}`);
 try{
 const body=new FormData();body.set('path',path);body.set('file',file,file.name);
 const {data,error}=await supabase.functions.invoke('sync-catalog-design',{body});
 if(error){
  const detail=await error.context?.json?.().catch(()=>null);
  throw new Error(detail?.error||`No pudimos publicar ${label} en Cloudflare: ${error.message}`);
 }
 if(!data?.url)throw new Error(`No pudimos confirmar la publicación de ${label} en Cloudflare.`);
 return data.url;
 }finally{feedback.done()}
}
function storagePathFromUrl(url){const marker=`/storage/v1/object/public/${CATALOG_BUCKET}/`;return url?.includes(marker)?decodeURIComponent(url.split(marker)[1]):''}
function r2PathFromUrl(url){const marker='https://images.frontbook.cl/';return url?.startsWith(marker)?decodeURIComponent(url.slice(marker.length)):''}
async function removeCatalogAssets(urls){
 const uniqueUrls=[...new Set(urls.filter(Boolean))],storagePaths=uniqueUrls.map(storagePathFromUrl).filter(Boolean),r2Paths=uniqueUrls.map(r2PathFromUrl).filter(Boolean);
 const failures=[];
 if(storagePaths.length){const {error}=await supabase.storage.from(CATALOG_BUCKET).remove(storagePaths);if(error)failures.push(error)}
 for(let start=0;start<r2Paths.length;start+=20){
  const {data,error}=await supabase.functions.invoke('sync-catalog-design',{body:{action:'delete',paths:r2Paths.slice(start,start+20)}});
  if(error||data?.error)failures.push(error||new Error(data.error));
 }
 return failures[0]||null;
}
const mockupFileLabel=(file,fallback,label='Imagen')=>file?`${label} · ${fileSizeLabel(file.size)}`:fallback;
function storedMockupVideo(design,slug){
 return catalogDesignVideoUrl(design?.slug,slug,designProductMockups(design||{})[slug]?.videoPath);
}
function showMockupVideo(input,stored=''){
 const group=input.closest('.admin-mockup-video'),video=group.querySelector('video');
 const section=input.closest('[data-mockup-product]'),clear=section.querySelector('[data-remove-mockup-video]'),remove=clear.querySelector('input');
 const previous=video.getAttribute('src');
 if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
 const file=input.files[0],error=file?catalogVideoFileError(file):'';
 const src=remove.checked?'':file&&!error?URL.createObjectURL(file):stored;
 video.pause();
 video.preload=file&&!error?'metadata':'none';
 if(src)video.src=src;else{video.removeAttribute('src');video.load()}
 video.hidden=!src;
 const output=group.querySelector('output');
 output.textContent=error|| (remove.checked?'Se quitará al guardar.':file?`${file.name} · ${fileSizeLabel(file.size)}. Se optimizará al guardar.`:stored?'Video actual guardado. Puedes reemplazarlo.':'Sin video cargado.');
 output.dataset.tone=error?'error':'';
 clear.hidden=!stored;
}
function clearMockupVideoPreviews(form){
 form.querySelectorAll('.admin-mockup-video video').forEach(video=>{
  const source=video.getAttribute('src');
  video.pause();video.removeAttribute('src');video.load();video.hidden=true;
  if(source?.startsWith('blob:'))URL.revokeObjectURL(source);
 });
}
function showMockupPreview(form,name,src=''){
 const preview=form.querySelector(`[data-preview="${name}"]`);if(!preview)return;
 const image=preview.querySelector('img');if(src){image.src=src;preview.hidden=false}else{image.removeAttribute('src');preview.hidden=true}
 syncMockupFocusPicker(form,name,src);
}
function setMockupFocus(form,name,x=50,y=50){
 const focus=normalizeMockupFocus(x,y),picker=form.querySelector(`[data-mockup-focus-picker="${name}"]`);
 form.elements[`${name}_focus_x`].value=focus.x;form.elements[`${name}_focus_y`].value=focus.y;
 if(!picker)return;
 picker.style.setProperty('--mockup-focus-x',`${focus.x}%`);picker.style.setProperty('--mockup-focus-y',`${focus.y}%`);
 picker.parentElement.querySelector('[data-mockup-focus-value]').textContent=`Foco: ${Math.round(focus.x)}% horizontal · ${Math.round(focus.y)}% vertical`;
}
function syncMockupFocusPicker(form,name,src=''){
 const panel=form.querySelector(`[data-mockup-focus="${name}"]`),image=panel?.querySelector('img');if(!panel||!image)return;
 panel.hidden=!src;if(!src){image.removeAttribute('src');return}
 image.src=src;
}
function mountMockupFocusPicker(form,name,title,target=null){
 const fieldset=target||form.querySelector('.admin-mockup-files');if(!fieldset||fieldset.querySelector(`[data-mockup-focus="${name}"]`))return;
 const panel=document.createElement('section');panel.className='admin-mockup-focus';panel.hidden=true;panel.dataset.mockupFocus=name;
 const imageLabel=title.toLowerCase();
 panel.innerHTML=`<div class="admin-mockup-focus-copy"><strong>${title}</strong><p>Haz clic donde debe quedar el diseño al recortarse en el home. En celular, un toque hace lo mismo.</p><output data-mockup-focus-value role="status">Foco: 50% horizontal · 50% vertical</output></div><button type="button" class="admin-mockup-focus-picker" data-mockup-focus-picker="${name}" aria-label="Elegir foco del ${imageLabel}"><img alt="Recorte del ${imageLabel} para definir el foco"><i aria-hidden="true"></i></button><input type="hidden" name="${name}_focus_x" value="50"><input type="hidden" name="${name}_focus_y" value="50">`;
 fieldset.append(panel);
 const picker=panel.querySelector('[data-mockup-focus-picker]');
 const choose=event=>{const rect=picker.getBoundingClientRect();setMockupFocus(form,name,((event.clientX-rect.left)/rect.width)*100,((event.clientY-rect.top)/rect.height)*100)};
 picker.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.pointerType==='touch'||event.pointerType==='pen')choose(event)});
 picker.addEventListener('keydown',event=>{
  const current=normalizeMockupFocus(form.elements[`${name}_focus_x`].value,form.elements[`${name}_focus_y`].value),step=event.shiftKey?10:2;
  const changes={ArrowLeft:[current.x-step,current.y],ArrowRight:[current.x+step,current.y],ArrowUp:[current.x,current.y-step],ArrowDown:[current.x,current.y+step]};
  if(!changes[event.key])return;event.preventDefault();setMockupFocus(form,name,...changes[event.key]);
 });
}
function setPersonalizationArrow(form,x=50,y=50){
 const point=normalizeMockupFocus(x,y),picker=form.querySelector('[data-personalization-arrow-picker]');
 form.elements.personalization_arrow_x.value=point.x;form.elements.personalization_arrow_y.value=point.y;
 if(!picker)return;
 picker.style.setProperty('--mockup-focus-x',`${point.x}%`);picker.style.setProperty('--mockup-focus-y',`${point.y}%`);
 picker.parentElement.querySelector('[data-personalization-arrow-value]').textContent=`Punta: ${Math.round(point.x)}% horizontal · ${Math.round(point.y)}% vertical`;
}
function syncCustomerPhotoSubject(form){
 const field=form.querySelector('[data-customer-photo-subject]');
 if(!field)return;
 field.hidden=!form.elements.accepts_customer_image.checked;
 form.elements.customer_photo_subject.disabled=field.hidden;
 const allowsBase=Boolean(form.elements.accepts_customer_image.checked&&form.elements.customer_photo_subject.value==='people');
 form.elements.allows_base_purchase.checked=allowsBase;
 const note=form.querySelector('[data-base-purchase-note]');
 if(note)note.textContent=allowsBase?'Activo automáticamente para Personas: el cliente podrá comprar la base o personalizarla.':form.elements.accepts_customer_image.checked?'Para Mascotas la foto es obligatoria; no se ofrece la compra del diseño base.':'Activa la imagen del cliente y elige Personas para habilitar ambas opciones.';
}
function syncPersonalizationArrowPicker(form,src=''){
 const panel=form.querySelector('[data-personalization-arrow]'),image=panel?.querySelector('img'),enabled=Boolean(form.elements.accepts_customer_image?.checked);
 if(!panel||!image)return;
 panel.hidden=!enabled;
 panel.querySelector('[data-personalization-arrow-empty]').hidden=Boolean(src);
 panel.querySelector('[data-personalization-arrow-picker]').hidden=!src;
 if(src)image.src=src;else image.removeAttribute('src');
}
function mountPersonalizationArrowPicker(form){
 const fieldset=form.querySelector('.admin-mockup-files');if(!fieldset||fieldset.querySelector('[data-personalization-arrow]'))return;
 const panel=document.createElement('section');panel.className='admin-mockup-focus';panel.hidden=true;panel.dataset.personalizationArrow='';
 panel.innerHTML=`<div class="admin-mockup-focus-copy"><strong>Punta de la flecha de personalización</strong><p>Marca dónde termina la flecha que conecta las fotos de referencia con el resultado. No modifica el recorte del mockup.</p><output data-personalization-arrow-value role="status">Punta: 50% horizontal · 50% vertical</output><small data-personalization-arrow-empty>Primero carga un mockup principal para ubicar la punta.</small></div><button type="button" class="admin-mockup-focus-picker" data-personalization-arrow-picker aria-label="Elegir la punta de la flecha de personalización" hidden><img alt="Mockup para definir dónde termina la flecha"><i aria-hidden="true"></i></button><input type="hidden" name="personalization_arrow_x" value="50"><input type="hidden" name="personalization_arrow_y" value="50">`;
 fieldset.append(panel);
 const picker=panel.querySelector('[data-personalization-arrow-picker]');
 const choose=event=>{const rect=picker.getBoundingClientRect();setPersonalizationArrow(form,((event.clientX-rect.left)/rect.width)*100,((event.clientY-rect.top)/rect.height)*100)};
 picker.addEventListener('pointerdown',event=>choose(event));
 picker.addEventListener('keydown',event=>{const current=normalizeMockupFocus(form.elements.personalization_arrow_x.value,form.elements.personalization_arrow_y.value),step=event.shiftKey?10:2,changes={ArrowLeft:[current.x-step,current.y],ArrowRight:[current.x+step,current.y],ArrowUp:[current.x,current.y-step],ArrowDown:[current.x,current.y+step]};if(!changes[event.key])return;event.preventDefault();setPersonalizationArrow(form,...changes[event.key])});
}
function selectedDesignProductSlugs(form){
 return [...form.querySelectorAll('[name="design_products"]:checked')].map(input=>input.value);
}
function currentDesignProductColors(form){
 return Object.fromEntries(COLOR_PRODUCT_FAMILIES.flatMap(family=>{
  const panel=form.querySelector(`[data-design-color-product="${CSS.escape(family.slug)}"]`);if(!panel)return [];
  return [[family.slug,[...panel.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value)]];
 }));
}
function syncDesignSampleColors(form,preferred=''){
 const fieldset=form.querySelector('[data-design-sample-colors]'),target=form.querySelector('[data-sample-color-options]');if(!fieldset||!target)return;
 const selected=currentDesignProductColors(form).poleras||[],available=productColorAvailability(adminData.variants,'poleras').filter(color=>selected.includes(color.hex));
 fieldset.hidden=!selectedDesignProductSlugs(form).includes('poleras');
 if(fieldset.hidden){target.innerHTML='';return}
 target.innerHTML=available.length?designColorOptionsMarkup('sample_color','radio',available,[preferred]):'<p class="admin-color-empty">Selecciona al menos un color para Poleras.</p>';
 const preview=form.querySelector('[data-design-product="poleras"] .design-file-preview');
 const updatePreview=()=>{preview?.style.setProperty('--sample-color',target.querySelector(':checked')?.value||'')};
 target.querySelectorAll('[name="sample_color"]').forEach(input=>input.addEventListener('change',updatePreview));
 updatePreview();
}
function renderDesignProductColors(form,preferredColors={}){
 const container=form.querySelector('[data-design-product-colors]');if(!container)return;
 const selectedSlugs=selectedDesignProductSlugs(form),supported=new Set(COLOR_PRODUCT_FAMILIES.map(family=>family.slug));
 const previous={...currentDesignProductColors(form),...preferredColors};
 const families=COLOR_PRODUCT_FAMILIES.filter(family=>selectedSlugs.includes(family.slug));
 if(!families.length){container.innerHTML=selectedSlugs.some(slug=>!supported.has(slug))?'<p class="admin-color-empty">Los productos seleccionados no administran color.</p>':'<p class="admin-color-empty">Marca un producto arriba para elegir sus colores.</p>';syncDesignSampleColors(form);return}
 container.innerHTML=families.map(family=>{
  const available=productColorAvailability(adminData.variants,family.slug),availableHexes=new Set(available.map(color=>color.hex));
  const remembered=Object.prototype.hasOwnProperty.call(previous,family.slug)?previous[family.slug]:available.map(color=>color.hex),chosen=remembered.filter(color=>availableHexes.has(color));
  const options=available.length?designColorOptionsMarkup(`design_colors_${family.slug}`,'checkbox',available,chosen):'';
  return `<section class="admin-design-color-product" data-design-color-product="${family.slug}"><div class="admin-design-color-heading"><div><h3>${safe(family.name)}</h3><p>${available.length} ${available.length===1?'tono disponible':'tonos disponibles'} en la gama global.</p></div><div><button type="button" class="admin-color-action" data-design-colors-all>Usar todos</button><button type="button" class="admin-color-action" data-design-colors-none>Quitar todos</button></div></div>${options||`<div class="admin-color-empty admin-color-empty-action"><strong>Falta configurar la gama global de ${safe(family.name)}.</strong><span>Hazlo aquí y vuelve a elegir sin perder los datos del diseño.</span><button type="button" class="admin-secondary" data-open-product-colors="${family.slug}">Configurar colores globales</button></div>`}</section>`;
 }).join('');
 for(const panel of container.querySelectorAll('[data-design-color-product]')){
  const inputs=[...panel.querySelectorAll('input[type="checkbox"]')];
  const syncSample=()=>syncDesignSampleColors(form,form.querySelector('[name="sample_color"]:checked')?.value||'');
  panel.querySelector('[data-design-colors-all]')?.addEventListener('click',()=>{inputs.forEach(input=>{input.checked=true});syncSample();syncDesignColorCompatibility(form)});
  panel.querySelector('[data-design-colors-none]')?.addEventListener('click',()=>{inputs.forEach(input=>{input.checked=false});syncSample();syncDesignColorCompatibility(form)});
  inputs.forEach(input=>input.addEventListener('change',()=>{syncSample();syncDesignColorCompatibility(form)}));
 }
 syncDesignSampleColors(form,form.querySelector('[name="sample_color"]:checked')?.value||'');
}
function openDesignDialog(design,trigger){
 const dialog=root.querySelector('#design-dialog'),form=root.querySelector('#design-form');
 unmountAdminFormDisclosure(form);form.reset();
 for(const input of form.querySelectorAll('input[type=file]'))input.setCustomValidity('');
 form.elements.id.value=design?.id||'';
 form.elements.collection_id.value=design?.collection_id||'';
 form.elements.name.value=design?.name||'';
 form.elements.slug.value=design?.slug||'';
 form.elements.slug.dataset.manual=String(Boolean(design));
 form.elements.caption.value=design?.caption||'';
 form.elements.active.checked=design?.active??true;
 form.elements.accepts_customer_image.checked=Boolean(design?.accepts_customer_image);
 form.elements.customer_photo_subject.value=design?.customer_photo_subject==='people'?'people':'pets';
 syncCustomerPhotoSubject(form);
 form.elements.is_featured.checked=Boolean(design?.is_featured);
 const sampleColor=normalizeSampleColor(design?.sample_color),colorNote=form.querySelector('[data-color-config-note]');colorNote.textContent='';delete colorNote.dataset.tone;
 root.querySelector('#design-dialog-title').textContent=design?'Editar diseño':'Nuevo diseño';
 const context=dialog.querySelector('[data-catalog-dialog-context]');
 context.textContent=design?`${design.name} · ${collectionName(design.collection_id)}`:'Completa las secciones para publicar en el catálogo.';
 context.hidden=false;
 form.querySelector('[type="submit"]').textContent=design?'Guardar cambios':form.elements.active.checked?'Publicar diseño':'Guardar diseño oculto';
 initializeProductUploads(form,design);
 initializePoleraPrintFields(form,design);
 const productSlugs=Object.keys(currentProductArtworks(design));
 renderDesignProductColors(form,designProductColorMap(design,productSlugs));
 syncDesignSampleColors(form,sampleColor);
 syncDesignColorCompatibility(form);
 form.querySelector('.admin-form-status').textContent='';
 const photos=designProductMockups(design||{});
 for(const product of adminData.productTypes){
  const name=mockupInputName(product.slug),photo=photos[product.slug];
  setCatalogFileStatus(form.elements[name],photo?.path?'Mockup actual':'Sin mockup',Boolean(photo?.path));
  const clear=form.elements[`clear_${name}`];clear.closest('label').hidden=!photo?.path;
  showMockupPreview(form,name,photo?.path||'');setMockupFocus(form,name,photo?.focusX??50,photo?.focusY??50);
  showMockupVideo(form.elements[mockupVideoInputName(product.slug)],storedMockupVideo(design,product.slug));
 }
 const personalizationArrow=normalizeMockupFocus(design?.personalization_arrow_x,design?.personalization_arrow_y);
 setPersonalizationArrow(form,personalizationArrow.x,personalizationArrow.y);syncPersonalizationArrowPicker(form,photos.poleras?.path||'');
 syncProductMockupFields(form);
 openCatalogDialog(dialog,trigger);
 mountAdminFormDisclosure(form,'design',{validateFile:(file,field)=>field.name.startsWith('mockup_video_')?catalogVideoFileError(file):validateArtwork(file,false),editableSections:Boolean(design)});
 dialog.dataset.initialDesign=adminStepSnapshot(form);
}
function currentProductArtworks(design){
 const collection=adminData.collections.find(item=>item.id===design?.collection_id);
 const product=adminData.productTypes.find(item=>item.id===collection?.product_type_id);
 return designProductArtworks(design,product?.slug||'poleras');
}
function printLayoutDialogMarkup(){
 const control=(key,label,min,max)=>`<div class="admin-layout-control">
  <div class="admin-layout-control-head"><label for="print-layout-${key}">${label}</label>
   <div class="admin-layout-stepper" role="group" aria-label="Ajustar ${label.toLowerCase()}">
    <button type="button" data-layout-step="${key}" data-layout-direction="down" aria-label="Disminuir ${label.toLowerCase()}">−</button>
    <output for="print-layout-${key}" data-layout-value="${key}"></output>
    <button type="button" data-layout-step="${key}" data-layout-direction="up" aria-label="Aumentar ${label.toLowerCase()}">+</button>
   </div>
  </div>
  <input id="print-layout-${key}" name="${key}" type="range" min="${min}" max="${max}" step="0.01">
 </div>`;
 return catalogDialogMarkup({
  id:'print-layout-dialog',formId:'print-layout-form',className:'admin-print-layout-dialog',
  title:'Ajustar estampado',submit:'Guardar encuadre',discard:true,
  body:`<div class="admin-layout-selects">
   <label>Producto<select name="product"></select></label>
   <label data-layout-view hidden>Ubicación en la vista<select name="print_view"></select></label>
  </div>
  <div class="admin-print-layout-grid">
   <figure class="admin-layout-figure">
    <div class="admin-print-layout-preview" id="print-layout-preview" role="group">
     <div class="admin-layout-preview-message">
      <p role="status"></p>
      <button type="button" class="admin-secondary" data-layout-retry hidden>Reintentar vista 3D</button>
     </div>
    </div>
    <figcaption>Arrastra para girar la prenda. El encuadre se aplica al catálogo y al estudio.</figcaption>
   </figure>
   <fieldset class="admin-print-layout-controls">
    <legend>Arte principal</legend>
    <p data-layout-readonly hidden>Esta ubicación adicional se puede revisar en la vista. Selecciona el arte principal para ajustar el encuadre.</p>
    ${control('size','Tamaño','0.6','1.15')}
    ${control('x','Horizontal','-0.3','0.3')}
    ${control('y','Vertical','-0.3','0.3')}
    <button type="button" class="admin-secondary" data-layout-reset>Restablecer encuadre</button>
   </fieldset>
  </div>`,
 });
}
function openPrintLayoutDialog(design){
 const dialog=root.querySelector('#print-layout-dialog'),form=dialog.querySelector('form'),select=form.elements.product;
 const artworks=currentProductArtworks(design),slugs=Object.keys(artworks).filter(slug=>['poleras','bodys','totebags'].includes(slug)&&artworks[slug]);
 if(!slugs.length)return toast('Este diseño aún no tiene un archivo para mostrar.','error');

 const initial=Object.fromEntries(slugs.map(slug=>[slug,catalogPrintLayoutFor(design,slug)])),draft={...initial};
 const preview=dialog.querySelector('#print-layout-preview'),message=preview.querySelector('.admin-layout-preview-message');
 const status=message.querySelector('p'),retry=message.querySelector('button'),save=form.querySelector('[type="submit"]');
 const footerStatus=form.querySelector('.admin-form-status'),controls=form.querySelector('.admin-print-layout-controls');
 const readonly=form.querySelector('[data-layout-readonly]'),view=form.elements.print_view;
 const context=dialog.querySelector('[data-catalog-dialog-context]');
 const changed=()=>slugs.filter(slug=>['size','x','y'].some(key=>initial[slug][key]!==draft[slug][key]));
 let viewer=null,stage=null,ready=false;

 select.innerHTML=slugs.map(slug=>`<option value="${safe(slug)}">${safe(adminData.productTypes.find(item=>item.slug===slug)?.name||slug)}</option>`).join('');
 context.textContent=design.name;
 context.hidden=false;
 preview.setAttribute('aria-label',`Vista 3D de ${design.name}`);

 const prints=()=>select.value==='poleras'?catalogPoleraComposition({...design,product_artworks:artworks},'basic')?.configuration.prints||[]:[];
 const imageFor=path=>{
  const local=path?.startsWith('local:')?baseDesigns.find(item=>`local:${item.id}`===path):null;
  return artworkUrl(local||{artworkPath:catalogAssetUrl(path)});
 };
 const views=()=>catalogPrintViews(prints());
 const selectedView=()=>views().find(print=>print.key===view.value);
 const updateViews=()=>{
  const options=views();
  view.closest('label').hidden=options.length<2;
  view.disabled=options.length<2;
  view.innerHTML=options.map(print=>`<option value="${safe(print.key)}">${safe(print.label)}${print.id.startsWith('primary-')?' · Principal':''}</option>`).join('');
 };
 const face=()=>{
  const print=selectedView();
  if(print)viewer?.face(print.side,print.placement);
 };
 const state=()=>{
  const layers=prints();
  return {
   kind:select.value==='totebags'?'tote':select.value==='bodys'?'body':'basic',size:'M',color:normalizeSampleColor(design.sample_color),
   image:imageFor(artworks[select.value]),printSide:'front',printScale:1.7,catalogDesign:true,catalogPrintLayout:draft[select.value],
   ...(layers.length?{printLayers:layers.map(layer=>({...layer,image:imageFor(layer.catalogArtworkPath)}))}:{}),
  };
 };
 const syncActions=()=>{
  const print=selectedView();
  const reviewingAdditional=Boolean(print&&!print.id.startsWith('primary-'));
  readonly.hidden=!reviewingAdditional;
  controls.disabled=!ready||reviewingAdditional;
  save.disabled=!ready||!changed().length;
 };
 const showValues=()=>{
  const layout=draft[select.value];
  for(const key of ['size','x','y'])form.elements[key].value=layout[key];
  form.querySelector('[data-layout-value="size"]').textContent=`${Math.round(layout.size*100)}%`;
  for(const key of ['x','y']){
   const direction=key==='x'?(layout[key]>0?'derecha':'izquierda'):(layout[key]>0?'arriba':'abajo');
   form.querySelector(`[data-layout-value="${key}"]`).textContent=layout[key]===0?'Centro':`${Math.round(Math.abs(layout[key])*100)}% ${direction}`;
  }
 };
 const releasePreview=()=>{
  viewer?.dispose();
  viewer=null;
  stage?.remove();
  stage=null;
 };
 const loadPreview=async()=>{
  releasePreview();
  const slug=select.value,target=document.createElement('div');
  target.className='admin-layout-stage';
  stage=target;
  preview.prepend(target);
  ready=false;
  syncActions();
  message.hidden=false;
  retry.hidden=true;
  status.textContent='Preparando vista 3D…';
  target.setAttribute('aria-busy','true');
  let failed=false;
  const fail=()=>{
   if(stage!==target)return;
   failed=true;
   ready=false;
   syncActions();
   target.removeAttribute('aria-busy');
   message.hidden=false;
   retry.hidden=false;
   status.textContent='No pudimos cargar la vista 3D de este producto.';
  };
  target.addEventListener('preview-error',fail);
  try{
   const module=await import(slug==='totebags'?'./tote-viewer.js':'./garment.js');
   if(stage!==target)return;
   const create=slug==='totebags'?module.createToteViewer:module.createViewer;
   const created=await create(target,state());
   if(stage!==target||!dialog.open){created.dispose();return}
   viewer=created;
   face();
   if(failed)return;
   ready=true;
   target.removeAttribute('aria-busy');
   message.hidden=true;
   syncActions();
  }catch{fail()}
 };
 const updateLayout=layout=>{
  draft[select.value]=normalizeCatalogPrintLayout(layout);
  showValues();
  syncActions();
  delete footerStatus.dataset.tone;
  footerStatus.textContent=changed().length?'Encuadre sin guardar.':'';
  void viewer?.update(state());
 };
 select.onchange=()=>{updateViews();showValues();void loadPreview()};
 view.onchange=()=>{face();syncActions()};
 retry.onclick=()=>{select.focus({preventScroll:true});void loadPreview()};
 for(const key of ['size','x','y'])form.elements[key].oninput=event=>updateLayout({...draft[select.value],[key]:event.target.value});
 form.querySelectorAll('[data-layout-step]').forEach(button=>button.onclick=()=>{
  const input=form.elements[button.dataset.layoutStep];
  if(button.dataset.layoutDirection==='up')input.stepUp();else input.stepDown();
  input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 form.querySelector('[data-layout-reset]').onclick=()=>updateLayout();
 dialog.onclose=releasePreview;
 dialog.catalogHasChanges=()=>Boolean(changed().length);
 form.onsubmit=event=>{
  event.preventDefault();
  if(!ready||!changed().length)return;
  return performCatalogDialogAction(form,{message:'Guardando el encuadre…',pendingLabel:'Guardando…',action:async()=>{
   const layouts=Object.fromEntries(changed().map(slug=>[slug,draft[slug]]));
   const {error}=await supabase.from('catalog_designs').update({print_layouts:{...(design.print_layouts||{}),...layouts}}).eq('id',design.id);
   if(error)throw new Error(`No pudimos guardar el encuadre. ${error.message}`);
   dialog.close();
   await refreshData('Encuadre guardado para el diseño.',false);
   root.querySelector(`[data-edit-design="${design.id}"]`)?.focus({preventScroll:true});
  }});
 };
 updateViews();
 showValues();
 openCatalogDialog(dialog);
 select.focus({preventScroll:true});
 void loadPreview();
}

function syncProductMockupFields(form){
 form.querySelectorAll('[data-mockup-product]').forEach(section=>{
  const slug=section.dataset.mockupProduct,selected=form.querySelector(`[name="design_products"][value="${CSS.escape(slug)}"]`)?.checked;
  section.hidden=!selected;
  section.querySelectorAll('input').forEach(input=>input.disabled=!selected);
 });
}
function updateProductUpload(section){
 const selected=section.querySelector('[name="design_products"]').checked,input=section.querySelector('[type="file"]');
 section.querySelector('[data-product-upload]').hidden=!selected;input.disabled=!selected;input.required=selected&&!section.dataset.currentArtwork;
 syncProductMockupFields(section.closest('form'));
}
function initializeProductUploads(form,design){
 const existing=currentProductArtworks(design);
 form.querySelectorAll('[data-design-product]').forEach(section=>{
  const slug=section.dataset.designProduct,path=existing[slug]||'';
  section.dataset.currentArtwork=path;section.querySelector('[name="design_products"]').checked=Boolean(path);
  setCatalogFileStatus(section.querySelector('[type=file]'),path?'Archivo guardado':'Sin archivo',Boolean(path));
  const preview=section.querySelector('.design-file-preview'),image=preview.querySelector('img');
  if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);
  const local=path.startsWith('local:')?baseDesigns.find(item=>`local:${item.id}`===path):null;
  const src=local?artworkUrl(local):catalogAssetUrl(path);
  if(src){image.src=src;preview.hidden=false}else{image.removeAttribute('src');preview.hidden=true}
  updateProductUpload(section);
 });
}
async function submitDesign(form,event){
 event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),values=adminFormData(form),id=Number(values.get('id')),current=id?adminData.designs.find(item=>item.id===id):null;
 status.dataset.tone='error';
 const selected=adminData.productTypes.filter(product=>values.getAll('design_products').includes(product.slug)),existing=currentProductArtworks(current);
 const supported=new Set(COLOR_PRODUCT_FAMILIES.map(family=>family.slug)),colorProductSlugs=selected.map(product=>product.slug).filter(slug=>supported.has(slug)),allowedProductColors=currentDesignProductColors(form);
 const colorIssues=invalidDesignProductColors(adminData.variants,allowedProductColors,colorProductSlugs);
 if(colorIssues.length){const names=colorIssues.map(slug=>adminData.productTypes.find(product=>product.slug===slug)?.name||slug);status.textContent=`Elige al menos un color global disponible para ${names.join(' y ')}. Si la gama está vacía, usa “Configurar colores globales” sin salir de este diseño.`;return}
 const sampleColor=colorProductSlugs.includes('poleras')?String(values.get('sample_color')||'').toLowerCase():normalizeSampleColor(current?.sample_color);
 if(colorProductSlugs.includes('poleras')&&!allowedProductColors.poleras?.includes(sampleColor)){status.textContent='El color de muestra debe estar entre los colores elegidos para Poleras.';return}
 const allowedColors=[...new Set(Object.values(allowedProductColors).flat())];
 const productFiles=Object.fromEntries(selected.map(product=>[product.slug,form.elements[`artwork_${product.slug}`].files[0]]));
 const missing=validateProductArtworks(selected,existing,productFiles);if(missing){status.textContent=missing;return}
 const poleraPrints={primary:String(values.get('polera_primary_print')||'front'),additional:{},mockups:{}};
 const extraFiles={};
 for(const location of values.getAll('polera_additional_print')){
  const input=form.elements[`polera_print_${location}`],file=input.files[0],path=input.dataset.currentArtwork;
  if(!file&&!path){status.textContent=`Sube el archivo para ${POLERA_PRINT_LOCATIONS[location].label.toLowerCase()}.`;return}
  if(file)extraFiles[`print:${location}`]=file;
  if(path)poleraPrints.additional[location]=path;
 }
 if(selected.some(product=>product.slug==='poleras')){
  for(const location of [poleraPrints.primary,...values.getAll('polera_additional_print')]){
   if(values.get(`clear_polera_mockup_${location}`)==='on')continue;
   const input=form.elements[`polera_mockup_${location}`],file=input.files[0],path=input.dataset.currentArtwork;
   if(file)extraFiles[`print-mockup:${location}`]=file;
   if(path)poleraPrints.mockups[location]=path;
  }
 }
 const files={...extraFiles,...Object.fromEntries(Object.entries(productFiles).map(([slug,file])=>[`product:${slug}`,file])),...Object.fromEntries(selected.map(product=>[`mockup:${product.slug}`,values.get(`clear_${mockupInputName(product.slug)}`)==='on'?null:form.elements[mockupInputName(product.slug)].files[0]]))};
 for(const file of Object.values(files)){const validation=validateArtwork(file,false);if(validation){status.textContent=validation;return}}
 const videos=selected.flatMap(product=>{
  const name=mockupVideoInputName(product.slug),file=form.elements[name].files[0];
  return file&&values.get(`clear_${name}`)!=='on'?[{product,file}]:[];
 });
 for(const {product,file} of videos){
  const validation=catalogVideoFileError(file);
  if(validation){status.textContent=`Video de ${product.name}: ${validation}`;return}
 }
 const personalizationArrow=normalizeMockupFocus(values.get('personalization_arrow_x'),values.get('personalization_arrow_y'));
 const payload={collection_id:Number(values.get('collection_id')),name:String(values.get('name')).trim(),slug:slugify(values.get('slug')),caption:String(values.get('caption')).trim()||null,sample_color:sampleColor,allowed_colors:allowedColors.length?allowedColors:null,allowed_product_colors:Object.fromEntries(colorProductSlugs.map(slug=>[slug,allowedProductColors[slug]])),personalization_arrow_x:personalizationArrow.x,personalization_arrow_y:personalizationArrow.y,accepts_customer_image:values.get('accepts_customer_image')==='on',customer_photo_subject:values.get('accepts_customer_image')==='on'&&values.get('customer_photo_subject')==='people'?'people':'pets',is_featured:values.get('is_featured')==='on',active:values.get('active')==='on'};if(!payload.collection_id||!payload.name||!payload.slug){status.textContent='Completa colección, nombre y slug.';return}
 payload.polera_prints=poleraPrints;
 payload.product_mockups=productMockupDraft(current,adminData.productTypes,values);
 payload.product_artworks=Object.fromEntries(selected.filter(product=>existing[product.slug]).map(product=>[product.slug,existing[product.slug]]));
 button.disabled=true;status.textContent='Guardando el diseño…';status.dataset.tone='busy';
 try{
 const collection=adminData.collections.find(item=>item.id===payload.collection_id),prepared=[];
 for(const [kind,sourceFile] of Object.entries(files)){
  if(!sourceFile)continue;
  const suffix=kind.startsWith('print-mockup:')?`mockup-poleras-${kind.slice(13)}`:kind.startsWith('print:')?`artwork-poleras-${kind.slice(6)}`:kind.startsWith('product:')?`artwork-${kind.slice(8)}`:`mockup-${kind.slice(7)}`,baseName=`${payload.slug}-${suffix}`;
  const imageLabel=kind.startsWith('print-mockup:')?`Mockup de ${POLERA_PRINT_LOCATIONS[kind.slice(13)].label.toLowerCase()}`:kind.startsWith('print:')?POLERA_PRINT_LOCATIONS[kind.slice(6)].label:kind.startsWith('product:')?`Diseño para ${adminData.productTypes.find(product=>product.slug===kind.slice(8))?.name||kind.slice(8)}`:`Mockup de ${adminData.productTypes.find(product=>product.slug===kind.slice(7))?.name||kind.slice(7)}`;
  button.textContent=`Optimizando ${imageLabel.toLowerCase()}…`;
  let result;
  const policy=(kind.startsWith('mockup:')||kind.startsWith('print-mockup:'))?CATALOG_IMAGE_POLICY:CATALOG_ARTWORK_POLICY;
  try{result=await optimizeCatalogArtwork(sourceFile,baseName,policy)}catch(error){throw new Error(`${imageLabel} (${sourceFile.name}): ${error.message}`)}
  const file=result.file,optimizedValidation=validateArtwork(file,true,policy.targetBytes);
  if(optimizedValidation)throw new Error(`${imageLabel}: ${optimizedValidation}`);
  status.textContent=`${imageLabel}: ${fileSizeLabel(file.size)} · ${result.width} × ${result.height} px`;
  prepared.push({kind,suffix,file,imageLabel});
 }
 const preparedVideos=[];
 for(const {product,file} of videos){
  const label=`Video de ${product.name}`,baseName=`${payload.slug}-video-${product.slug}`;
  button.textContent='Optimizando video…';
  status.textContent=`Preparando ${label.toLowerCase()}…`;
  let lastProgress='';
  try{
   const result=await optimizeCatalogVideo(file,baseName,(percentage,attempt)=>{
    const progress=`${label} · ${attempt>1?'Ajustando peso · ':''}${Math.floor(percentage/10)*10}%`;
    if(progress!==lastProgress){lastProgress=progress;status.textContent=progress}
   });
   preparedVideos.push({slug:product.slug,label,file:result.file});
  }catch(error){throw new Error(`${label}: ${error.message}`)}
 }
 for(const {kind,suffix,file,imageLabel} of prepared){
  button.textContent=`Publicando ${imageLabel.toLowerCase()}…`;
  const extension=file.name.split('.').pop().toLowerCase(),path=`${collection.slug}/${payload.slug}-${suffix}-${Date.now()}.${extension}`,url=await uploadCatalogFileToR2(path,file);
  if(kind.startsWith('print-mockup:'))payload.polera_prints.mockups[kind.slice(13)]=url;
  else if(kind.startsWith('print:'))payload.polera_prints.additional[kind.slice(6)]=url;
  else if(kind.startsWith('product:'))payload.product_artworks[kind.slice(8)]=url;else payload.product_mockups[kind.slice(7)]={...payload.product_mockups[kind.slice(7)],path:url};
 }
  for(const {slug:fileSlug,label,file} of preparedVideos){
   button.textContent='Publicando video…';
   status.textContent=`${label} optimizado · ${fileSizeLabel(file.size)}`;
   const path=`${collection.slug}/${payload.slug}-video-${fileSlug}-${crypto.randomUUID()}.mp4`;
   payload.product_mockups[fileSlug].videoPath=await uploadCatalogFileToR2(path,file);
  }
  payload.polera_prints=normalizePoleraPrints(payload.polera_prints);
  const collectionProduct=adminData.productTypes.find(product=>product.id===collection.product_type_id)?.slug;
  payload.artwork_path=payload.product_artworks[collectionProduct]||Object.values(payload.product_artworks)[0];
  payload.mockup_path=payload.product_mockups.poleras?.path||null;
  payload.mockup_focus_x=payload.product_mockups.poleras?.focusX??50;payload.mockup_focus_y=payload.product_mockups.poleras?.focusY??50;
  payload.mockup_hover_path=payload.product_mockups.totebags?.path||null;
  payload.mockup_hover_focus_x=payload.product_mockups.totebags?.focusX??50;payload.mockup_hover_focus_y=payload.product_mockups.totebags?.focusY??50;
  button.textContent='Guardando…';const query=id?supabase.from('catalog_designs').update(payload).eq('id',id):supabase.from('catalog_designs').insert(payload);const {error}=await query;if(error)throw error;
  // Keep prior catalog files: existing orders can reference their immutable URL.

  form.closest('dialog').close();await refreshData(id?'Diseño actualizado.':'Diseño publicado.',true);
 }catch(error){button.disabled=false;button.textContent=id?'Guardar cambios':'Publicar diseño';status.textContent=error.code==='23505'?'Ya existe un diseño con ese slug.':`No pudimos guardar: ${error.message}`}
}
function syncDesignColorCompatibility(form){
 const note=form.querySelector('[data-color-config-note]');if(!note)return [];
 const supported=new Set(COLOR_PRODUCT_FAMILIES.map(family=>family.slug)),slugs=selectedDesignProductSlugs(form).filter(slug=>supported.has(slug)),issues=invalidDesignProductColors(adminData.variants,currentDesignProductColors(form),slugs);
 if(issues.length){const names=issues.map(slug=>adminData.productTypes.find(product=>product.slug===slug)?.name||slug);note.textContent=`Falta elegir un color disponible para ${names.join(' y ')}.`;note.dataset.tone='error';note.dataset.availabilityIssue='true'}
 else if(note.dataset.availabilityIssue){note.textContent='';delete note.dataset.tone;delete note.dataset.availabilityIssue}
 return issues;
}
function wireDesigns(){
 const dialog=root.querySelector('#design-dialog'),form=root.querySelector('#design-form');
 const deleteDialog=root.querySelector('#delete-design-dialog'),deleteForm=deleteDialog.querySelector('form');
 const {name,slug}=form.elements;
 const printLayoutDialog=root.querySelector('#print-layout-dialog');
 confirmCatalogDiscard(printLayoutDialog,()=>printLayoutDialog.catalogHasChanges?.());
 confirmCatalogDiscard(dialog,()=>adminStepSnapshot(form)!==dialog.dataset.initialDesign);
 dialog.addEventListener('close',()=>{
  unmountAdminFormDisclosure(form);
  clearMockupVideoPreviews(form);
  for(const image of form.querySelectorAll('img[src^="blob:"]')){
   URL.revokeObjectURL(image.src);
   image.removeAttribute('src');
  }
  for(const details of form.querySelectorAll('details[open]'))details.open=false;
 });
 adminData.productTypes.forEach(product=>mountMockupFocusPicker(form,mockupInputName(product.slug),`Foco de ${product.name}`,form.querySelector(`[data-mockup-product="${product.slug}"]`)));
 mountPersonalizationArrowPicker(form);
 wirePoleraPrintFields(form);
 wireProductColorDialog({onSaved:async(_availability,slug)=>{
  const previous=currentDesignProductColors(form);
  const completed=Object.fromEntries(selectedDesignProductSlugs(form).map(product=>[
   product,previous[product]?.length?previous[product]:productColorAvailability(adminData.variants,product).map(color=>color.hex),
  ]));
  renderDesignProductColors(form,completed);
  syncDesignColorCompatibility(form);
  form.querySelector('[data-design-product-colors]').dispatchEvent(new Event('change',{bubbles:true}));
  const colorPanel=[...form.querySelectorAll('[data-design-color-product]')].find(panel=>panel.dataset.designColorProduct===slug);
  colorPanel?.querySelector('input[type="checkbox"], [data-open-product-colors]')?.focus();
  toast('Gama global actualizada.','success');
 }});
 root.querySelector('#new-design').onclick=event=>openDesignDialog(null,event.currentTarget);
 slug.addEventListener('input',()=>{slug.dataset.manual='true'});
 name.addEventListener('input',()=>{if(slug.dataset.manual!=='true')slug.value=slugify(name.value)});
 form.elements.active.addEventListener('change',()=>{
  if(!form.elements.id.value)form.querySelector('[type="submit"]').textContent=form.elements.active.checked?'Publicar diseño':'Guardar diseño oculto';
 });
 root.querySelectorAll('[data-edit-design]').forEach(button=>button.onclick=()=>openDesignDialog(adminData.designs.find(item=>item.id===Number(button.dataset.editDesign)),button));
 root.querySelectorAll('[data-adjust-design]').forEach(button=>button.onclick=()=>openPrintLayoutDialog(adminData.designs.find(item=>item.id===Number(button.dataset.adjustDesign))));
 root.querySelectorAll('[data-toggle-design]').forEach(button=>button.onclick=async()=>{const design=adminData.designs.find(item=>item.id===Number(button.dataset.toggleDesign));if(!design.active){const slugs=Object.keys(currentProductArtworks(design)).filter(slug=>COLOR_PRODUCT_FAMILIES.some(family=>family.slug===slug)),colors=designProductColorMap(design,slugs),issues=invalidDesignProductColors(adminData.variants,colors,slugs);if(issues.length){const names=issues.map(slug=>adminData.productTypes.find(product=>product.slug===slug)?.name||slug);return toast(`No se puede activar: elige colores por producto para ${names.join(' y ')}.`,'error')}}button.disabled=true;const {error}=await supabase.from('catalog_designs').update({active:!design.active}).eq('id',design.id);if(error){button.disabled=false;return toast(`No se pudo cambiar el estado: ${error.message}`)}await refreshData('Estado del diseño actualizado.',true)});
 root.querySelectorAll('[data-delete-design]').forEach(button=>button.onclick=()=>{
  const design=adminData.designs.find(item=>item.id===Number(button.dataset.deleteDesign));
  if(!design)return;
  deleteForm.elements.design_id.value=design.id;
  deleteDialog.querySelector('[data-delete-design-name]').textContent=design.name;
  deleteDialog.querySelector('[data-delete-design-collection]').textContent=collectionName(design.collection_id);
  const image=deleteDialog.querySelector('[data-delete-design-preview]');
  const src=Object.values(designProductMockups(design)).find(photo=>photo.path)?.path||designArtworkSrc(design);
  image.hidden=!src;
  if(src)image.src=src;else image.removeAttribute('src');
  openCatalogDialog(deleteDialog);
  deleteForm.querySelector('.dialog-cancel').focus({preventScroll:true});
 });
 deleteForm.onsubmit=event=>{
  event.preventDefault();
  const id=Number(deleteForm.elements.design_id.value),design=adminData.designs.find(item=>item.id===id);
  return performCatalogDialogAction(deleteForm,{message:'Eliminando el diseño y sus archivos…',pendingLabel:'Eliminando…',action:async()=>{
   const {error}=await supabase.from('catalog_designs').delete().eq('id',id);
   if(error)throw new Error(error.code==='23503'?'Este diseño está asociado a un carro o pedido. Puedes ocultarlo desde Más acciones.':error.message);
   const prints=normalizePoleraPrints(design?.polera_prints);
   const assetError=await removeCatalogAssets([design?.artwork_path,...Object.values(currentProductArtworks(design)),...Object.values(prints.additional),...Object.values(prints.mockups),design?.mockup_path,design?.mockup_hover_path,...Object.values(designProductMockups(design||{})).flatMap(photo=>[photo.path,photo.hoverPath,photo.videoPath])]).catch(error=>error);
   deleteDialog.close();
   await refreshData(assetError?'Diseño eliminado; quedó un archivo pendiente de limpieza.':'Diseño eliminado.',true);
   root.querySelector('#new-design')?.focus({preventScroll:true});
  }});
 };
 form.querySelectorAll('[data-design-product]').forEach(section=>{
  section.querySelector('[name="design_products"]').addEventListener('change',()=>{const previous=currentDesignProductColors(form);updateProductUpload(section);syncPoleraPrintFields(form);renderDesignProductColors(form,previous);syncDesignColorCompatibility(form)});
  section.querySelector('[type="file"]').addEventListener('change',event=>{
   const file=event.target.files[0],preview=section.querySelector('.design-file-preview'),image=preview.querySelector('img'),path=section.dataset.currentArtwork;
   if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);
   setCatalogFileStatus(event.target,file?file.name:path?'Archivo guardado':'Sin archivo',Boolean(file||path));
    const local=path.startsWith('local:')?baseDesigns.find(item=>`local:${item.id}`===path):null;
   const src=file?URL.createObjectURL(file):local?artworkUrl(local):catalogAssetUrl(path);
   preview.hidden=!src;
   if(src)image.src=src;else image.removeAttribute('src');
  });
 });
 for(const product of adminData.productTypes){
  const name=mockupInputName(product.slug),input=form.elements[name],clear=form.elements[`clear_${name}`];
  const update=()=>{
   const current=adminData.designs.find(design=>design.id===Number(form.elements.id.value));
   const path=designProductMockups(current||{})[product.slug]?.path;
   const previous=form.querySelector(`[data-preview="${name}"] img`)?.getAttribute('src');
   if(previous?.startsWith('blob:'))URL.revokeObjectURL(previous);
   const file=input.files[0],src=clear.checked?'':file?URL.createObjectURL(file):catalogAssetUrl(path);
   setCatalogFileStatus(input,clear.checked?'Se quitará al guardar':file?file.name:path?'Mockup actual':'Sin mockup',Boolean(src));
   showMockupPreview(form,name,src);
   if(product.slug==='poleras')syncPersonalizationArrowPicker(form,src);
  };
  input.addEventListener('change',()=>{if(input.files.length)clear.checked=false;update()});
  clear.addEventListener('change',()=>{if(clear.checked)input.value='';update()});
 }
 adminData.productTypes.forEach(product=>{
  const name=mockupVideoInputName(product.slug),input=form.elements[name],clear=form.elements[`clear_${name}`];
  const current=()=>storedMockupVideo(adminData.designs.find(design=>design.id===Number(form.elements.id.value)),product.slug);
  input.addEventListener('change',()=>{
   if(input.files[0])clear.checked=false;
   showMockupVideo(input,current());
  });
  clear.addEventListener('change',()=>{
   if(clear.checked)input.value='';
   showMockupVideo(input,current());
  });
 });
 form.elements.accepts_customer_image.addEventListener('change',()=>{syncCustomerPhotoSubject(form);const image=form.querySelector('[data-preview="mockup_poleras"] img');syncPersonalizationArrowPicker(form,image?.getAttribute('src')||'')});
 form.elements.customer_photo_subject.addEventListener('change',()=>syncCustomerPhotoSubject(form));
 form.addEventListener('change',event=>{
  const input=event.target;
  if(input.type!=='file')return;
  const file=input.files[0];
  const error=file&&(input.name.startsWith('mockup_video_')?catalogVideoFileError(file):validateArtwork(file,false));
  input.setCustomValidity(error||'');
  if(error)input.reportValidity();
 });
 form.onsubmit=event=>submitDesign(form,event);
}

function adminOrderStepper(order){const steps=orderSteps(order),current=orderProgressIndex(order.status,order);return `<ol class="admin-order-progress${order.status==='cancelled'?' is-cancelled':''}" style="--order-step-count:${steps.length}" aria-label="Avance del pedido">${steps.map((step,index)=>`<li class="${index<current?'complete':index===current?'current':''}"${index===current?' aria-current="step"':''}><span aria-hidden="true">${index<current?'✓':String(index+1).padStart(2,'0')}</span><strong>${safe(step.label)}</strong></li>`).join('')}</ol>`}
function orderCustomer(order){return order.shipping_address?.customer||{}}
function orderCustomerName(order){const customer=orderCustomer(order);return [customer.first_name,customer.last_name].filter(Boolean).join(' ')||'Cliente sin nombre'}
function orderDestination(order){const address=order.shipping_address||{};return address.fulfillment==='pickup'?'Retiro en tienda':[address.address,address.address_extra,address.commune,address.region].filter(Boolean).join(', ')||'Dirección pendiente'}
function orderCard(order){
 const items=order.order_items||[],units=items.reduce((sum,item)=>sum+item.quantity,0),isDemo=Boolean(order.price_snapshot?.demo),archived=Boolean(order.archived_at),overdue=isOrderOverdue(order)&&!archived,isLastOpened=String(order.id)===String(lastOpenedOrderId),trace=orderTraceability(order),search=[order.id,orderCustomerName(order),orderCustomer(order).email,orderCustomer(order).rut,order.status,order.request_details,trace.title,...items.map(item=>item.name_snapshot)].join(' ').toLowerCase();
 const traceBadge=trace.state==='recovered'?'<span class="admin-trace-badge is-recovered">Recuperado · revisar</span>':trace.state==='pending'||trace.state==='missing'?'<span class="admin-trace-badge is-pending">Personalización pendiente</span>':trace.state==='attached'?'<span class="admin-trace-badge is-attached">Adjuntos recibidos</span>':'';
 return `<article class="admin-kanban-card${overdue?' is-overdue':''}${archived?' is-archived':''}${isLastOpened?' is-last-opened':''}" data-admin-searchable="${safe(search)}"><div class="admin-kanban-card-top"><span class="admin-eyebrow">#${safe(order.id)}</span><div><span class="admin-source-pill" title="${safe(orderCardOriginLabel(order))}">${safe(orderCardOriginLabel(order))}</span>${isDemo?'<span class="admin-demo-pill">Simulado</span>':''}</div></div><h3>${safe(orderCustomerName(order))}</h3><div class="admin-kanban-card-type"><span>Tipo:</span> <strong>${safe(orderTypeLabel(order))}</strong></div>${traceBadge}<p>${['idea_request','whatsapp'].includes(order.source)?'Solicitud por WhatsApp':safe(order.shipping_address?.fulfillment==='pickup'?'Retiro en tienda':'Despacho')} · ${units} ${units===1?'unidad':'unidades'}</p><div class="admin-kanban-card-meta"><span class="admin-payment-badge is-${orderPaymentState(order)}">${paymentStateLabels[orderPaymentState(order)]}</span><strong>${(order.source==='idea_request'||order.request_type==='creative')&&order.status!=='quoted'?'Por definir':money(order.total_clp)}</strong></div>${overdue?'<span class="admin-overdue-label">⚠ Demorado · más de 24 h</span>':''}<small>${dateTime(order.created_at)}</small><button type="button" class="admin-card-open" data-open-order="${safe(order.id)}">Ver pedido <span>→</span></button></article>`;
}
function rememberOpenedOrder(orderId){lastOpenedOrderId=String(orderId);try{sessionStorage.setItem(LAST_OPENED_ORDER_KEY,lastOpenedOrderId)}catch{}root.querySelectorAll('.admin-kanban-card.is-last-opened').forEach(card=>card.classList.remove('is-last-opened'));root.querySelectorAll('[data-open-order]').forEach(button=>{if(String(button.dataset.openOrder)===lastOpenedOrderId)button.closest('.admin-kanban-card')?.classList.add('is-last-opened')})}
function orderHistoryMarkup(history,order){if(!history.length)return '';return `<section class="admin-order-history-wrap"><details class="admin-order-history-details"><summary>Historial de actividad <span>${history.length} ${history.length===1?'evento':'eventos'}</span></summary><ul class="admin-order-history">${history.map(item=>`<li><div><strong>${safe(orderStatusLabel(item.status,order))}</strong>${item.note?`<small>${safe(item.note)}</small>`:''}</div><time datetime="${safe(item.created_at)}">${date(item.created_at)} · ${new Date(item.created_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</time></li>`).join('')}</ul></details></section>`}
function orderTraceabilityMarkup(order){
 const trace=orderTraceability(order);
 if(!trace.personalized)return '';
 const attached=trace.state==='attached';
 const badge=attached?'Archivos recibidos':trace.state==='recovered'?'Requiere revisión':'Archivos pendientes';
 return `<details class="admin-order-traceability is-${safe(trace.state)}"${attached?'':' open'}>
  <summary><strong>Trazabilidad</strong><span class="admin-trace-badge is-${safe(trace.state)}">${badge}</span></summary>
  <div class="admin-order-trace-content">
   <h4>${safe(trace.title)}</h4>
   <p>${safe(trace.message)}</p>
   <dl><div><dt>Canal</dt><dd>${safe(trace.channel)}</dd></div>${trace.requestId?`<div><dt>ID de solicitud</dt><dd><code>${safe(trace.requestId)}</code></dd></div>`:''}${trace.recoveryReason?`<div><dt>Motivo registrado</dt><dd>${safe(trace.recoveryReason)}</dd></div>`:''}</dl>
  </div>
 </details>`;
}

function creativeRequestMarkup(order){
 if(order.request_type!=='creative')return '';
 const details=String(order.request_details||'Sin detalle').trim()||'Sin detalle';
 const previewLimit=420;
 const preview=details.length>previewLimit?details.slice(0,previewLimit).split(/\s+\S*$/)[0]:details;
 return `<section class="admin-creative-request admin-order-section" data-creative-request>
  <h3>Idea del cliente</h3>
  <p class="admin-creative-brief-preview">${safe(preview)}${preview===details?'':'…'}</p>
  ${preview===details?'':`<details class="admin-creative-brief"><summary>Ver indicaciones completas</summary><p>${safe(details)}</p></details>`}
  ${order.request_references?.length?`<div class="admin-creative-references"><h4>Referencias (${order.request_references.length})</h4>
   ${order.request_references.map((item,index)=>`<button type="button" class="admin-secondary" data-creative-reference="${index}" data-order-id="${safe(order.id)}">Abrir ${safe(item.name||'referencia')}</button>`).join('')}
  </div>`:''}
  ${order.quote_message?`<div class="admin-quote-saved"><strong>Cotización guardada · ${money(order.quoted_total_clp)}</strong><p>${safe(order.quote_message)}</p></div>`:''}
 </section>`;
}

function orderDetailMarkup(order){
 const address=order.shipping_address||{},customer=orderCustomer(order),items=order.order_items||[],payments=order.payments||[];
 const payment=payments.find(item=>item.provider==='mercado_pago')||payments.find(item=>item.provider==='transferencia_bancaria')||payments[0];
 const paymentState=orderPaymentState(order),archived=Boolean(order.archived_at);
 const canQuote=!archived&&order.request_type==='creative'&&['submitted','quoted'].includes(order.status);
 const next=archived||order.status==='draft'||canQuote?null:nextOrderStatus(order.status,order);
 const canRollBack=!archived&&!order.edit_pending_approval&&!['paid','submitted','draft','delivered','cancelled'].includes(order.status);
 const phone=String(customer.phone||'').replace(/[^\d+]/g,''),wa=String(customer.phone||'').replace(/\D/g,'');
 const history=[...(order.order_status_history||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const paymentWarning=payment&&[...paymentIssueStatuses,'rejected','cancelled'].includes(payment.status)
  ?`<p class="admin-payment-transfer-notice">Mercado Pago ${safe(paymentStatusLabel(payment.status).toLowerCase())}. No inicies producción${paymentIssueStatuses.has(payment.status)?' hasta resolver la incidencia':': pide al cliente que reintente'}.</p>`:'';
 const pendingEdit=Boolean(order.edit_pending_approval);
 const unsentEdit=!pendingEdit&&Number(order.order_edit_version||0)&&!order.order_edit_email_sent_at;
 const primaryAction=canQuote
  ?`<button type="button" class="admin-primary" data-quote-order>${order.status==='quoted'?'Editar cotización':'Responder con cotización'}</button>`
  :next?`<button type="button" class="admin-primary" data-order-id="${safe(order.id)}" data-next-status="${safe(next.status)}"${pendingEdit?' disabled':''}>${safe(next.adminAction)}</button>`:'';

 return `<header class="dialog-title">
  <div>
   <span class="admin-eyebrow">PEDIDO #${safe(order.id)}${archived?' · ARCHIVADO':''}</span>
   <h2 id="order-detail-title">${safe(orderCustomerName(order))}</h2>
   <p class="admin-order-created">${safe(orderCardOriginLabel(order))} · ${dateTime(order.created_at)}</p>
  </div>
  <button type="button" class="ds-icon-button close-button dialog-close" aria-label="Cerrar pedido"><span></span></button>
 </header>
 <div class="admin-order-body">
  <dl class="admin-order-overview">
   <div><dt>Estado del pedido</dt><dd>${safe(orderStatusLabel(order.status,order))}</dd></div>
   <div><dt>Pago</dt><dd><span class="admin-payment-badge is-${paymentState}">${paymentStateLabels[paymentState]}</span></dd></div>
   <div><dt>Total</dt><dd class="admin-order-overview-total">${money(order.total_clp)}</dd></div>
  </dl>
  <details class="admin-order-journey">
   <summary>Ver avance del pedido</summary>
   ${adminOrderStepper(order)}
  </details>
  ${technicalReviewMarkup(order)}
  ${pendingEdit&&!archived?`<div class="admin-order-edit-blocker"><strong>Cambios pendientes</strong><span>Aprueba o rechaza la edición para continuar.</span><button type="button" class="admin-secondary" data-review-order>Comparar cambios</button></div>`:''}
  <div class="admin-order-detail-grid">
   <div class="admin-order-column">
    ${creativeRequestMarkup(order)}
    <section class="admin-order-section admin-order-products">
     <h3>Productos <span>${items.length}</span></h3>
     ${items.map(item=>{
      const product=readableOrderItem(item);
      return `<div><span><strong>${safe(product.name)}</strong><small>${product.details?`${safe(product.details)} · `:''}${item.quantity} ${item.quantity===1?'unidad':'unidades'}${item.quality_review?' · Revisión técnica':''}</small></span><b>${money(item.line_total_clp)}</b></div>`;
     }).join('')||'<p>Sin productos registrados.</p>'}
     ${archived?'':`<a class="admin-order-semitone-link" href="${DTF_SEMITONE_URL}" target="_blank" rel="noreferrer">Preparar semitonos DTF <span aria-hidden="true">↗</span></a>`}
    </section>
   </div>
   <div class="admin-order-column">
    <section class="admin-order-section admin-order-customer">
     <h3>Cliente y entrega</h3>
     <dl class="admin-order-facts">
      <div><dt>Tipo de pedido</dt><dd>${safe(orderTypeLabel(order))}</dd></div>
      <div><dt>Email</dt><dd>${safe(customer.email||'No informado')}</dd></div>
      <div><dt>Teléfono</dt><dd>${safe(customer.phone||'No informado')}</dd></div>
      <div><dt>${address.fulfillment==='pickup'?'Entrega':'Dirección'}</dt><dd>${safe(orderDestination(order))}</dd></div>
      ${address.delivery_notes?`<div><dt>Indicaciones de entrega</dt><dd>${safe(address.delivery_notes)}</dd></div>`:''}
      ${address.notes?`<div><dt>Notas</dt><dd>${safe(address.notes)}</dd></div>`:''}
     </dl>
    </section>
    <section class="admin-order-section" data-order-charge>
     <h3>Cobro</h3>
     ${paymentWarning}
     <dl class="admin-order-facts">
      <div><dt>Subtotal</dt><dd>${money(order.subtotal_clp)}</dd></div>
      <div><dt>Despacho</dt><dd>${order.shipping_clp?money(order.shipping_clp):'Gratis'}</dd></div>
      ${order.discount_clp?`<div><dt>Descuento ${safe(order.coupon_code||'')}</dt><dd>−${money(order.discount_clp)}</dd></div>`:''}
      <div><dt>Registro de pago</dt><dd>${payment?`${safe(payment.provider)} · ${safe(paymentStatusLabel(payment.status))}`:'Sin registro de pago'}</dd></div>
     </dl>
    </section>
   </div>
  </div>
  ${orderPrintPlanMarkup(order,orderPrintAssetUrl)}
  ${orderTraceabilityMarkup(order)}
  ${orderHistoryMarkup(history,order)}
  ${order.order_edit_email_sent_at&&!pendingEdit?`<p class="admin-order-edit-receipt">Edición #${order.order_edit_version||1} enviada al cliente · ${date(order.order_edit_email_sent_at)}</p>`:''}
 </div>
 <footer class="dialog-actions admin-order-dialog-actions">
  <div class="admin-order-tools">${adminActions({id:'order-detail-actions',label:'Herramientas',items:`
   ${archived?'':`
    ${pendingEdit?'':`<button type="button" data-edit-order>Editar pedido</button>`}
    ${phone?`<a href="tel:${safe(phone)}">Llamar al cliente</a>`:''}
    ${wa?`<a href="https://wa.me/${safe(wa)}" target="_blank" rel="noreferrer">Abrir WhatsApp</a>`:''}
    ${customer.email?`<a href="mailto:${safe(customer.email)}">Redactar email al cliente</a>`:''}
    ${customer.email&&!pendingEdit?`<button type="button" ${unsentEdit?'data-approved-edit-email':'data-resend-email'}="${safe(order.id)}">${unsentEdit?'Enviar email de cambios':'Reenviar email'}</button>`:''}
    <button type="button" data-print-order>Imprimir etiqueta</button>
    ${canRollBack?`<button type="button" data-rollback-order="${safe(order.id)}">Volver a ingresado</button>`:''}
    <button type="button" data-archive-order="${safe(order.id)}">Archivar pedido</button>`}
   ${order.source==='manual'?`<button type="button" data-classify-manual-order>Cambiar tipo</button>`:''}
   ${archived?`<button type="button" data-restore-archived-order="${safe(order.id)}">Restaurar pedido</button>`:''}
  `})}</div>
  ${primaryAction?`<div class="admin-order-progress-actions"><div>${primaryAction}</div></div>`:''}
 </footer>`;
}

function manualItemMarkup(index){const productOptions=manualProductOptions.map(product=>`<option value="${product.id}">${product.label}</option>`).join('');const firstProduct=manualProductOptions[0];const sizeOptions=firstProduct.sizes.map(size=>`<option value="${size}">${size}</option>`).join('');const colorOptions=manualColorOptions.map(([color,label],colorIndex)=>`<label class="admin-manual-color" style="--sample-color:${color}"><input type="radio" name="item_color_${index}" value="${label}" ${colorIndex===0?'checked':''}><i aria-hidden="true"></i><span>${label}</span></label>`).join('');return `<article class="admin-manual-item" data-item-index="${index}"><div class="admin-manual-item-head"><strong>Producto ${index+1}</strong><button type="button" class="admin-danger-link" data-remove-item ${index===0?'hidden':''}>Quitar</button></div><div class="admin-form-grid"><label>Tipo de sustrato<select name="item_product_type">${productOptions}</select></label><label>Talla<select name="item_size">${sizeOptions}</select></label><fieldset class="admin-manual-colors admin-form-wide"><legend>Color del sustrato</legend><div>${colorOptions}</div></fieldset><label>Cantidad<input name="item_quantity" type="number" min="1" max="20" value="1" required></label><label>Precio unitario<input name="item_unit_price" type="number" min="0" step="10" required></label><label>Ubicación del estampado<select name="item_print_placement"><option value="front">Frente</option><option value="back">Espalda</option><option value="both">Frente y espalda</option><option value="none">Sin estampado</option></select></label><label>Detalle corto<input name="item_name" required placeholder="Ej. Nombre Emilia en arcoíris"></label><label class="admin-form-wide">Detalles del diseño<textarea name="item_design_details" rows="2" placeholder="Texto, colores, medidas, referencia o instrucciones para producción."></textarea></label></div></article>`}
function editOrderItemMarkup(item,index){return `<div class="admin-edit-order-item" data-edit-item-id="${safe(item.id||'')}" data-edit-item-index="${index}"><div class="admin-edit-order-item-head"><strong>Producto ${index+1}</strong><button type="button" class="admin-danger-link" data-remove-edit-item>Quitar</button></div><div class="admin-form-grid"><label>Detalle<input name="edit_item_name" value="${safe(item.name_snapshot||'')}" required></label><label>Cantidad<input name="edit_item_quantity" type="number" min="1" step="1" value="${item.quantity||1}" required></label><label>Precio unitario<input name="edit_item_price" type="number" min="0" step="1" value="${item.unit_price_clp||0}" required></label><label>Ubicación<select name="edit_item_print_sides"${item.print_configuration?.prints?.length||item.front_design_path||item.back_design_path||item.catalog_artwork_path?' disabled':''}><option value="front" ${item.print_sides==='front'?'selected':''}>Frente</option><option value="back" ${item.print_sides==='back'?'selected':''}>Espalda</option><option value="both" ${item.print_sides==='both'?'selected':''}>Frente y espalda</option></select></label></div></div>`}
function editOrderDialogMarkup(order){const address=order.shipping_address||{},customer=orderCustomer(order),items=order.order_items||[];return `<dialog class="admin-dialog admin-edit-order-dialog" id="edit-order-dialog"><form id="edit-order-form"><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · EDICIÓN</span><h2>Editar pedido</h2><p>Los cambios quedan pendientes hasta que los apruebes y envíes el email.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><fieldset class="admin-form-section"><legend>Cliente</legend><div class="admin-form-grid"><label>Nombre<input name="first_name" value="${safe(customer.first_name||'')}" required></label><label>Apellido<input name="last_name" value="${safe(customer.last_name||'')}"></label><label>Email<input name="email" type="email" value="${safe(customer.email||'')}" required></label><label>Teléfono<input name="phone" type="tel" value="${safe(customer.phone||'')}" required></label></div></fieldset><fieldset class="admin-form-section"><legend>Entrega</legend><div class="admin-form-grid"><label>Modalidad<select name="fulfillment"><option value="pickup" ${address.fulfillment==='pickup'?'selected':''}>Retiro en tienda</option><option value="delivery" ${address.fulfillment!=='pickup'?'selected':''}>Despacho</option></select></label><label>Región<input name="region" value="${safe(address.region||'')}" placeholder="Región"></label><label>Comuna<input name="commune" value="${safe(address.commune||'')}"></label><label>Dirección<input name="address" value="${safe(address.address||'')}"></label><label>Depto. / casa / oficina<input name="address_extra" value="${safe(address.address_extra||'')}"></label><label class="admin-form-wide">Indicaciones<textarea name="delivery_notes" rows="2">${safe(address.delivery_notes||'')}</textarea></label></div></fieldset><fieldset class="admin-form-section"><legend>Productos</legend><div id="edit-order-items">${items.map(editOrderItemMarkup).join('')}</div><button type="button" class="admin-secondary admin-add-item" id="add-edit-order-item">+ Agregar producto</button></fieldset><fieldset class="admin-form-section"><legend>Notas internas</legend><label>Notas<textarea name="notes" rows="3">${safe(address.notes||'')}</textarea></label></fieldset><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar cambios</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`}
function openOrderEditor(order){const existing=root.querySelector('#edit-order-dialog');existing?.remove();root.insertAdjacentHTML('beforeend',editOrderDialogMarkup(order));const dialog=root.querySelector('#edit-order-dialog'),form=dialog.querySelector('form'),items=dialog.querySelector('#edit-order-items');const wireItem=row=>row.querySelector('[data-remove-edit-item]')?.addEventListener('click',()=>{if(items.children.length>1)row.remove()});items.querySelectorAll('.admin-edit-order-item').forEach(wireItem);dialog.querySelector('#add-edit-order-item').onclick=()=>{const holder=document.createElement('div');holder.innerHTML=editOrderItemMarkup({},items.children.length);const row=holder.firstElementChild;items.append(row);wireItem(row)};dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();form.onsubmit=event=>saveOrderEdit(event,order);dialog.addEventListener('close',()=>dialog.remove(),{once:true});mountAdminOrderDisclosure(form,'edit');showOrderDialog(dialog)}
async function saveOrderEdit(event,order){event.preventDefault();const form=event.currentTarget,button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),rows=[...form.querySelectorAll('.admin-edit-order-item')];if(!rows.length){status.textContent='Agrega al menos un producto.';return}const items=rows.map(row=>({id:row.dataset.editItemId||null,name_snapshot:String(row.querySelector('[name="edit_item_name"]').value).trim(),quantity:Number(row.querySelector('[name="edit_item_quantity"]').value),unit_price_clp:Number(row.querySelector('[name="edit_item_price"]').value),print_sides:row.querySelector('[name="edit_item_print_sides"]').value,sku_snapshot:order.order_items.find(item=>String(item.id)===String(row.dataset.editItemId))?.sku_snapshot||'MANUAL-EDITADO'}));if(items.some(item=>!item.name_snapshot||item.quantity<1||item.unit_price_clp<0)){status.textContent='Revisa el nombre, cantidad y precio de cada producto.';return}button.disabled=true;button.textContent='Guardando…';const shippingAddress={...(order.shipping_address||{}),fulfillment:form.elements.fulfillment.value,region:String(form.elements.region.value).trim(),commune:String(form.elements.commune.value).trim(),address:String(form.elements.address.value).trim(),address_extra:String(form.elements.address_extra.value).trim(),delivery_notes:String(form.elements.delivery_notes.value).trim(),notes:String(form.elements.notes.value).trim(),customer:{first_name:String(form.elements.first_name.value).trim(),last_name:String(form.elements.last_name.value).trim(),email:String(form.elements.email.value).trim(),phone:String(form.elements.phone.value).trim()}},subtotal=items.reduce((sum,item)=>sum+item.quantity*item.unit_price_clp,0),total=subtotal+Number(order.shipping_clp||0)-Number(order.discount_clp||0),now=new Date().toISOString(),snapshot={shipping_address:order.shipping_address,items:order.order_items,subtotal_clp:order.subtotal_clp,shipping_clp:order.shipping_clp,discount_clp:order.discount_clp,total_clp:order.total_clp};const {error}=await supabase.from('orders').update({shipping_address:shippingAddress,subtotal_clp:subtotal,total_clp:total,edit_pending_approval:true,edit_pending_at:now,edit_pending_by:sessionUser?.id||null,edit_pending_snapshot:snapshot,updated_at:now}).eq('id',order.id);if(error){button.disabled=false;button.textContent='Guardar cambios';status.textContent=error.message;return}const keepIds=items.map(item=>item.id).filter(Boolean);const removed=order.order_items.filter(item=>item.id&&!keepIds.includes(String(item.id)));if(removed.length){const {error:removeError}=await supabase.from('order_items').delete().in('id',removed.map(item=>item.id));if(removeError){status.textContent=removeError.message;return}}for(const item of items){const payload={name_snapshot:item.name_snapshot,quantity:item.quantity,unit_price_clp:item.unit_price_clp,line_total_clp:item.quantity*item.unit_price_clp,print_sides:item.print_sides,sku_snapshot:item.sku_snapshot};const result=item.id?await supabase.from('order_items').update(payload).eq('id',item.id):await supabase.from('order_items').insert({...payload,order_id:order.id});if(result.error){status.textContent=result.error.message;return}}await supabase.from('order_status_history').insert({order_id:order.id,status:order.status,note:'Edición guardada por administración; pendiente de aprobación y envío al cliente.'});form.closest('dialog').close();await refreshData('Cambios guardados. Abre el pedido para comparar y aprobar la edición.')}
const editValue=value=>value===null||value===undefined||value===''?'—':safe(value)
function editAddressSummary(address={}){return [address.fulfillment==='pickup'?'Retiro en tienda':'Despacho',address.region,address.commune,address.address,address.address_extra].filter(Boolean).join(' · ')||'—'}
function editDiffRow(label,before,after,format=value=>editValue(value)){const changed=String(before??'')!==String(after??'');return `<div class="admin-edit-diff-row${changed?' is-changed':''}"><strong>${label}</strong><span>${format(before)}</span><span>${format(after)}</span></div>`}
function openEditApproval(order){const snapshot=order.edit_pending_snapshot||{},beforeCustomer=snapshot.shipping_address?.customer||{},afterCustomer=order.shipping_address?.customer||{},beforeItems=snapshot.items||[],afterItems=order.order_items||[];root.querySelector('#edit-approval-dialog')?.remove();const html=`<dialog class="admin-dialog admin-edit-approval-dialog" id="edit-approval-dialog"><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · REVISIÓN</span><h2>Comparar cambios</h2><p>Revisa exactamente qué cambiará antes de enviar la actualización al cliente.</p></div><button type="button" class="ds-icon-button close-button dialog-close" aria-label="Cerrar"><span></span></button></div><div class="admin-edit-approval-body"><div class="admin-edit-diff-legend"><span></span><span>Antes</span><span>Después</span></div><section class="admin-edit-diff-section"><h3>Cliente</h3>${editDiffRow('Nombre',`${beforeCustomer.first_name||''} ${beforeCustomer.last_name||''}`.trim(),`${afterCustomer.first_name||''} ${afterCustomer.last_name||''}`.trim())}${editDiffRow('Email',beforeCustomer.email,afterCustomer.email)}${editDiffRow('Teléfono',beforeCustomer.phone,afterCustomer.phone)}</section><section class="admin-edit-diff-section"><h3>Entrega</h3>${editDiffRow('Destino',editAddressSummary(snapshot.shipping_address),editAddressSummary(order.shipping_address))}${editDiffRow('Indicaciones',snapshot.shipping_address?.delivery_notes,order.shipping_address?.delivery_notes)}${editDiffRow('Notas',snapshot.shipping_address?.notes,order.shipping_address?.notes)}</section><section class="admin-edit-diff-section"><h3>Productos</h3><div class="admin-edit-diff-products">${Math.max(beforeItems.length,afterItems.length)?Array.from({length:Math.max(beforeItems.length,afterItems.length)},(_,index)=>{const before=beforeItems[index]||{},after=afterItems[index]||{};return `<div class="admin-edit-diff-product"><strong>Producto ${index+1}</strong>${editDiffRow('Detalle',before.name_snapshot,after.name_snapshot)}${editDiffRow('Cantidad',before.quantity,after.quantity)}${editDiffRow('Precio unitario',before.unit_price_clp,after.unit_price_clp,money)}${editDiffRow('Total línea',before.line_total_clp,after.line_total_clp,money)}</div>`}).join(''):'<p>No hay productos para comparar.</p>'}</div></section><section class="admin-edit-diff-section admin-edit-diff-total"><h3>Resumen</h3>${editDiffRow('Subtotal',snapshot.subtotal_clp,order.subtotal_clp,money)}${editDiffRow('Despacho',snapshot.shipping_clp,order.shipping_clp,money)}${editDiffRow('Descuento',snapshot.discount_clp,order.discount_clp,money)}${editDiffRow('Total',snapshot.total_clp,order.total_clp,money)}</section></div><div class="admin-edit-approval-options"><label class="admin-check"><input type="checkbox" data-send-edit-email-toggle checked><span>Enviar email al cliente</span></label><p>Podrás revisar el correo antes de enviarlo.</p></div><div class="dialog-actions admin-edit-approval-actions"><button type="button" class="admin-secondary" data-edit-again>Volver a editar</button><button type="button" class="admin-danger" data-reject-edit="${safe(order.id)}">Rechazar cambios</button><button type="button" class="admin-primary" data-approve-edit>Aprobar cambios</button></div></dialog>`;root.insertAdjacentHTML('beforeend',html);const dialog=root.querySelector('#edit-approval-dialog');dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('[data-edit-again]').onclick=()=>{dialog.close();openOrderEditor(order)};dialog.querySelector('[data-reject-edit]').onclick=event=>rejectOrderEdit(event.currentTarget);dialog.querySelector('[data-approve-edit]').onclick=event=>{const button=event.currentTarget;if(dialog.querySelector('[data-send-edit-email-toggle]').checked)return openOrderEmailPreview(order,'edit',button);return approveOrderEditWithoutEmail(order,button)};dialog.addEventListener('close',()=>dialog.remove(),{once:true});showOrderDialog(dialog)}
async function rejectOrderEdit(button){const order=adminData.orders.find(item=>String(item.id)===String(button.dataset.rejectEdit));if(!order)return;const snapshot=order.edit_pending_snapshot;if(!snapshot){toast('No encontramos la versión anterior para restaurar.');return}if(!await confirmOrderAction(root,{orderId:order.id,title:'Rechazar cambios',message:'Se restaurarán los datos anteriores del pedido.',action:'Rechazar cambios',danger:true}))return;button.disabled=true;button.textContent='Restaurando…';const {error:orderError}=await supabase.from('orders').update({shipping_address:snapshot.shipping_address,subtotal_clp:snapshot.subtotal_clp,shipping_clp:snapshot.shipping_clp,discount_clp:snapshot.discount_clp,total_clp:snapshot.total_clp,edit_pending_approval:false,edit_pending_at:null,edit_pending_by:null,edit_pending_snapshot:null,updated_at:new Date().toISOString()}).eq('id',order.id).eq('edit_pending_approval',true);if(orderError){button.disabled=false;button.textContent='Rechazar cambios';toast(orderError.message);return}const {error:deleteError}=await supabase.from('order_items').delete().eq('order_id',order.id);if(deleteError){toast(deleteError.message);return}const restored=(snapshot.items||[]).map(item=>({order_id:order.id,name_snapshot:item.name_snapshot,sku_snapshot:item.sku_snapshot,print_sides:item.print_sides,print_configuration:item.print_configuration||{},product_variant_id:item.product_variant_id,color_hex:item.color_hex,quality_review:item.quality_review,catalog_design_id:item.catalog_design_id,catalog_artwork_path:item.catalog_artwork_path,front_design_path:item.front_design_path,back_design_path:item.back_design_path,quantity:item.quantity,unit_price_clp:item.unit_price_clp,line_total_clp:item.line_total_clp}));if(restored.length){const {error:restoreError}=await supabase.from('order_items').insert(restored);if(restoreError){toast(restoreError.message);return}}await supabase.from('order_status_history').insert({order_id:order.id,status:order.status,note:'Edición rechazada por administración; se restauró la versión anterior.'});await refreshData('Cambios rechazados. Se restauró la versión anterior sin enviar email.')}
function emailRequestBody(order,kind,preview=false){const body={orderId:order.id,resend:true};if(kind==='payment'){body.resend=undefined;body.paymentEmail=true;body.paymentInstructions=order.payment_instructions}if(kind==='edit')body.orderEditEmail=true;if(kind==='survey')body.surveyEmail=true;if(preview)body.preview=true;return body}
async function emailActionError(error,data,fallback){
 const payload=await error?.context?.json?.().catch(()=>null);
 return data?.error||payload?.error||fallback;
}
async function sendOrderEmailAction(order,kind){const {data,error}=await supabase.functions.invoke('send-order-email',{body:emailRequestBody(order,kind)});if(error||data?.error){toast(await emailActionError(error,data,'No pudimos enviar el email.'));return false}if(kind==='survey'&&!data?.email?.sent){toast('El envío de correos todavía está pendiente de configuración.');return false}await refreshData(kind==='edit'?(data.email?.sent?'Edición aprobada y email enviado al cliente.':'Edición aprobada; email pendiente de configuración.'):kind==='payment'?(data.email?.sent?'Datos de pago enviados y registrados.':'Email pendiente de configuración.'):data.email?.sent?(kind==='survey'?'Encuesta enviada al cliente.':'Email reenviado al cliente.'):'Email pendiente de configuración.');return true}
async function loadOrderEmailPreview(body, {trigger, isCurrent = () => true} = {}) {
 const parent=trigger?.closest('dialog');
 if(trigger?.disabled)return null;
 if(trigger){trigger.disabled=true;trigger.setAttribute('aria-busy','true')}
 try{
  const {data,error}=await supabase.functions.invoke('send-order-email',{body});
  if(!isCurrent()||trigger&&!trigger.isConnected||parent&&!parent.open)return null;
  if(error||data?.error)return {errorMessage:await emailActionError(error,data,'No pudimos cargar la vista previa.')};
  return {data};
 }finally{
  if(trigger){
   trigger.removeAttribute('aria-busy');
   trigger.disabled=false;
   if(trigger.isConnected&&!trigger.closest('[popover]')&&(!parent||parent.open)&&document.activeElement===document.body){
    trigger.focus({preventScroll:true});
   }
  }
 }
}

function showOrderEmailPreview(order,{id,title,description,label,data,confirmAttribute,send}){
 if(root.querySelector(`#${id}[open]`))return;
 const email=data.email||{},dialog=document.createElement('dialog');
 dialog.id=id;
 dialog.className='admin-dialog admin-email-preview-dialog';
 dialog.innerHTML=`<header class="dialog-title">
  <div><span class="admin-eyebrow">PEDIDO #${safe(order.id)}</span><h2>${safe(title)}</h2>${description?`<p>${safe(description)}</p>`:''}</div>
  <button type="button" class="dialog-close" aria-label="Cerrar vista previa"></button>
 </header>
 <div class="admin-email-preview-meta">
  <div><span>Para</span><strong>${safe(data.recipient||orderCustomer(order).email||'Sin email')}</strong></div>
  <div><span>Asunto</span><strong>${safe(email.subject||'Sin asunto')}</strong></div>
 </div>
 <iframe class="admin-email-preview-frame admin-email-preview-live-frame" title="Contenido del email" sandbox=""></iframe>
 <footer class="dialog-actions admin-email-preview-actions">
  <button type="button" class="admin-secondary dialog-cancel">Volver</button>
  <button type="button" class="admin-primary" ${confirmAttribute}>${safe(label)}</button>
 </footer>`;
 root.append(dialog);
 dialog.querySelector('iframe').srcdoc=email.html||'<p>No hay contenido disponible.</p>';
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector(`[${confirmAttribute}]`).onclick=async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  button.textContent='Procesando…';
  dialog.setAttribute('aria-busy','true');
  try{
   if(await send()&&dialog.open)dialog.close();
  }finally{
   dialog.removeAttribute('aria-busy');
   button.disabled=false;
   button.textContent=label;
   if(dialog.open)button.focus();
  }
 };
 showOrderDialog(dialog);
}

async function openOrderEmailPreview(order,kind='resend',trigger){
 const preview=await loadOrderEmailPreview(emailRequestBody(order,kind,true),{
  trigger,isCurrent:()=>kind!=='survey'||Boolean(root.querySelector('#service-panel'))
 });
 if(!preview)return;
 if(preview.errorMessage){toast(preview.errorMessage);return}
 const label=kind==='payment'?'Enviar datos de pago':kind==='edit'?(order.edit_pending_approval?'Aprobar y enviar email':'Enviar email de cambios'):kind==='survey'?'Enviar encuesta':'Reenviar email';
 showOrderEmailPreview(order,{
  id:'order-email-preview-dialog',title:'Vista previa del email',description:'',
  label,data:preview.data,confirmAttribute:'data-confirm-email',send:()=>sendOrderEmailAction(order,kind)
 });
}

function manualOrderDialog(){return `<dialog class="admin-dialog admin-manual-dialog" id="manual-order-dialog"><form id="manual-order-form"><div class="dialog-title"><div><h2>Nuevo pedido manual</h2><p>Quedará en «Pedido ingresado» para su revisión.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><fieldset class="admin-form-section"><legend>1. Comprador</legend><div class="admin-form-grid"><label>Nombre<input name="first_name" required></label><label>Apellido<input name="last_name"></label><label>Email<input name="email" type="email" required></label><label>Teléfono<input name="phone" type="tel" required></label></div></fieldset><fieldset class="admin-form-section"><legend>2. Despacho o retiro</legend><div class="admin-form-grid"><label>Modalidad<select name="fulfillment"><option value="pickup">Retiro en tienda</option><option value="delivery">Despacho</option></select></label><label>Región${regionFilterHtml('manual-order-region')}</label><label>Comuna<input name="commune"></label><label>Dirección<input name="address"></label><label>Depto. / casa / oficina<input name="address_extra"></label><label class="admin-form-wide">Indicaciones de entrega<textarea name="delivery_notes" rows="2" placeholder="Referencia para encontrar la dirección o coordinar retiro."></textarea></label></div></fieldset><fieldset class="admin-form-section"><legend>3. Productos</legend><label class="admin-manual-order-type">Tipo de pedido<select name="order_type" required><option value="" selected disabled>Selecciona el tipo</option><option value="catalog">Catálogo</option><option value="artwork">Personalizado · diseño adjunto</option><option value="idea">Personalizado · idea</option></select></label><div id="manual-items">${manualItemMarkup(0)}</div><button type="button" class="admin-secondary admin-add-item" id="add-manual-item">+ Agregar producto</button></fieldset><fieldset class="admin-form-section"><legend>4. Datos de pago</legend><label class="admin-check"><input name="send_payment_email" type="checkbox" checked><span>Enviar datos de pago al crear el pedido</span></label><p class="admin-form-hint">Se registrará la fecha y la cuenta administradora cuando el proveedor confirme el envío.</p><div class="admin-payment-fields"><label class="admin-check"><input name="payment_transfer_enabled" type="checkbox" checked><span>Transferencia bancaria</span></label><div class="admin-form-grid"><label>Titular<input name="transfer_holder" placeholder="Nombre o razón social"></label><label>Banco<input name="transfer_bank"></label><label>Tipo de cuenta<input name="transfer_account_type" placeholder="Cuenta corriente"></label><label>Número de cuenta<input name="transfer_account_number"></label><label>RUT<input name="transfer_rut"></label><label>Email de transferencia<input name="transfer_email" type="email"></label></div><label class="admin-check"><input name="payment_mercado_pago_enabled" type="checkbox"><span>Link de pago Mercado Pago</span></label><label>Link de pago<input name="mercado_pago_url" type="url" placeholder="https://mpago.la/..."></label></div></fieldset><fieldset class="admin-form-section"><legend>5. Observaciones</legend><label>Notas del pedido<textarea name="notes" rows="3" placeholder="Acuerdos comerciales u otras notas internas."></textarea></label></fieldset><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Ingresar a revisión</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`}
async function exportAllOrders(button){
 button.disabled=true;
 button.setAttribute('aria-busy','true');
 button.textContent='Preparando Excel…';
 try{
  const orders=[];
  for(let from=0;;from+=ORDER_EXPORT_PAGE_SIZE){
   const {data,error}=await supabase.from('orders').select(ORDER_EXPORT_SELECT).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+ORDER_EXPORT_PAGE_SIZE-1);
   if(error)throw error;
   orders.push(...(data||[]));
   button.textContent=`Preparando Excel… ${orders.length} ${orders.length===1?'pedido':'pedidos'}`;
   if((data||[]).length<ORDER_EXPORT_PAGE_SIZE)break;
  }
  if(import.meta.env.DEV)orders.push(...readLocalOrders());
  const uniqueOrders=[...new Map(orders.map(order=>[String(order.id),order])).values()];
  const workbook=buildOrdersWorkbook(uniqueOrders);
  const file=new Blob([workbook],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(file),link=document.createElement('a');
  link.href=url;
  link.download=`droska-pedidos-${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
  toast(`${uniqueOrders.length} ${uniqueOrders.length===1?'pedido exportado':'pedidos exportados'} a Excel.`);
 }catch(error){
  console.error('No pudimos exportar los pedidos',error);
  toast('No pudimos descargar el Excel. Intenta nuevamente.');
 }finally{
  button.disabled=false;
  button.removeAttribute('aria-busy');
  button.textContent='Exportar Excel';
 }
}
function ordersView(){
 const orders=adminData.orders;
 const activeOrders=orders.filter(order=>!order.archived_at);
 const overdueCount=orders.filter(order=>!order.archived_at&&isOrderOverdue(order)).length;
 const columns=[['cart','En carrito',['cart','quote']],['incoming','Pedido ingresado',['incoming']],['processing','Preparando pedido',['processing']],['handoff','Listo para entrega / retiro',['handoff']],['completed','Pedido terminado',['completed']]];
 const action=`<button type="button" class="admin-primary" id="new-manual-order">${icon('plus')} Pedido manual</button>${adminActions({id:'order-actions',items:`<button type="button" id="open-archive-history">Pedidos archivados <span class="admin-archive-count">${adminData.archivedCount}</span></button><button type="button" id="export-orders">Exportar Excel</button>`})}`;
 const stageFilter=`<label class="admin-filter-field" for="admin-order-stage">Etapa del pedido<select id="admin-order-stage"><option value="">Todas las etapas</option>${columns.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>`;
 const board=columns.map(([id,label,stages])=>{
  const stageOrders=activeOrders.filter(order=>stages.includes(orderKanbanStage(order)));
  return `<section class="admin-kanban-column" data-order-stage="${id}"><header><h2>${label}</h2><span data-stage-count>${stageOrders.length}</span></header><div>${stageOrders.map(orderCard).join('')}<p class="admin-kanban-empty" hidden></p></div></section>`;
 }).join('');
 const content=`${pageHeading('OPERACIÓN','Pedidos.','Vista resumida por etapa. Abre un pedido para contactar, revisar datos, avanzar o imprimir su etiqueta.',action)}<section class="admin-orders-toolbar"><strong>${activeOrders.length} ${activeOrders.length===1?'pedido activo':'pedidos activos'}</strong><span>${activeOrders.filter(order=>order.source==='manual').length} manuales</span>${overdueCount?`<span class="admin-overdue-counter">⚠ ${overdueCount} ${overdueCount===1?'demorado':'demorados'}</span>`:''}</section><section class="admin-panel admin-order-filters" aria-label="Filtrar pedidos">${listSearch('Buscar pedido','N° de pedido, cliente, RUT o correo',stageFilter)}</section><section class="admin-kanban" aria-label="Pedidos por etapa">${board}</section><dialog class="admin-dialog admin-order-dialog" id="order-dialog" aria-labelledby="order-detail-title"><div id="order-dialog-content"></div></dialog><dialog class="admin-dialog admin-archive-history-dialog" id="archive-history-dialog" aria-labelledby="archive-history-title"><div class="admin-archive-history-content"><div class="dialog-title"><div><h2 id="archive-history-title">Pedidos archivados</h2></div><button type="button" class="ds-icon-button close-button dialog-close" aria-label="Cerrar historial"><span></span></button></div><div id="archive-history-filters" class="admin-archive-history-filters" hidden><label>Buscar pedido<input id="archive-search" type="search" placeholder="Nombre, RUT, correo o N° de pedido" autocomplete="off"></label><label>Estado<select id="archive-status"><option value="">Todos los estados</option></select></label><label>Pago<select id="archive-payment"><option value="">Todos los pagos</option><option value="unpaid">No pagado</option><option value="review">Pagado por revisar</option><option value="paid">Pagado</option></select></label><label>Desde<input id="archive-from" type="date"></label><label>Hasta<input id="archive-to" type="date"></label><button type="button" class="admin-secondary" id="archive-clear-filters">Limpiar</button></div><div id="archive-history-list" class="admin-archive-history-list"></div></div></dialog>${manualOrderDialog()}`;
 shell(content,'pedidos');
 root.querySelector('#admin-order-stage').onchange=()=>filterCurrentView(root.querySelector('#admin-search-input').value);
 filterCurrentView('');
 wireOrders();
}

async function openStatusChangePreview(order,button){
 const status=button.dataset.nextStatus;
 const preview=await loadOrderEmailPreview({orderId:order.id,status,preview:true},{trigger:button});
 if(!preview)return;
 if(preview.errorMessage){
  const confirmed=await confirmOrderAction(root,{
   orderId:order.id,title:button.textContent.trim(),
   message:`${preview.errorMessage} Puedes actualizar el estado sin revisar el correo.`,
   action:'Actualizar estado'
  });
  if(confirmed&&button.isConnected)await advanceOrder(button,true);
  return;
 }
 showOrderEmailPreview(order,{
  id:'order-status-email-preview-dialog',title:button.textContent.trim(),
  description:`El pedido pasará a «${orderStatusLabel(status,order)}» y se enviará este email al cliente.`,
  label:'Actualizar y enviar email',data:preview.data,confirmAttribute:'data-confirm-status-email',
  send:()=>advanceOrder(button,true)
 });
}
async function advanceOrder(button,confirmed=false){const order=adminData.orders.find(item=>String(item.id)===button.dataset.orderId),status=button.dataset.nextStatus,label=orderStatusLabel(status);if(!order)return;if(order.edit_pending_approval){toast('No puedes avanzar: hay cambios pendientes de revisión.');lockPendingOrderActions();return}if(status==='in_production'&&orderPaymentState(order)!=='paid'){toast('Confirma primero que recibiste el pago antes de preparar el pedido.');installPaymentGate();return}if(!confirmed){await openStatusChangePreview(order,button);return}button.disabled=true;button.textContent='Actualizando…';if(import.meta.env.DEV&&String(order.id).startsWith('LOCAL-')){const orders=readLocalOrders(),local=orders.find(item=>item.id===order.id);if(local){const now=new Date().toISOString();local.status=status;local.order_status_history=[...(local.order_status_history||[]),{id:`${order.id}-${now}`,status,note:'Estado actualizado en el panel local.',created_at:now}];localStorage.setItem(LOCAL_DEMO_ORDERS_KEY,JSON.stringify(orders));await refreshData(`${label} · actualización local.`);return true}}const {data,error}=await supabase.functions.invoke('update-order-status',{body:{orderId:order.id,status}});if(error||data?.error){button.disabled=false;button.textContent=nextOrderStatus(order.status,order)?.adminAction||'Reintentar';toast(data?.error||error?.message||'No pudimos actualizar el pedido.');return}await refreshData(data.email?.sent?`${label} · email enviado al cliente.`:`${label} · estado actualizado; email pendiente.`);return true}
async function resendOrderEmail(button){const order=adminData.orders.find(item=>String(item.id)===button.dataset.resendEmail);if(!order)return;await openOrderEmailPreview(order,'resend',button)}
async function sendPaymentEmail(button){const order=adminData.orders.find(item=>String(item.id)===button.dataset.sendPaymentEmail);if(!order)return;await openOrderEmailPreview(order,'payment',button)}
function paymentInstructionsDialogMarkup(order){const instructions=order.payment_instructions||{},transfer=instructions.transfer||{},hasTransfer=Boolean(instructions.transfer),hasMercado=Boolean(instructions.mercado_pago_url);return `<dialog class="admin-dialog admin-payment-dialog" id="payment-instructions-dialog"><form id="payment-instructions-form"><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · COBRO</span><h2>Configurar datos de pago</h2><p>Estos datos se usarán en la plantilla de cobro que verá el cliente.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><fieldset class="admin-form-section"><legend>Transferencia bancaria</legend><label class="admin-check"><input name="payment_transfer_enabled" type="checkbox" ${hasTransfer?'checked':''}><span>Incluir transferencia bancaria</span></label><div class="admin-payment-fields"><div class="admin-form-grid"><label>Titular<input name="transfer_holder" value="${safe(transfer.holder||'')}" placeholder="Nombre o razón social"></label><label>Banco<input name="transfer_bank" value="${safe(transfer.bank||'')}"></label><label>Tipo de cuenta<input name="transfer_account_type" value="${safe(transfer.account_type||'')}" placeholder="Cuenta corriente"></label><label>Número de cuenta<input name="transfer_account_number" value="${safe(transfer.account_number||'')}"></label><label>RUT<input name="transfer_rut" value="${safe(transfer.rut||'')}"></label><label>Email de transferencia<input name="transfer_email" type="email" value="${safe(transfer.email||'')}"></label></div></div></fieldset><fieldset class="admin-form-section"><legend>Mercado Pago</legend><label class="admin-check"><input name="payment_mercado_pago_enabled" type="checkbox" ${hasMercado?'checked':''}><span>Incluir link de pago Mercado Pago</span></label><label>Link de pago<input name="mercado_pago_url" type="url" value="${safe(instructions.mercado_pago_url||'')}" placeholder="https://mpago.la/..."></label></fieldset><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar datos de pago</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`}
function openPaymentInstructionsEditor(order){root.querySelector('#payment-instructions-dialog')?.remove();root.insertAdjacentHTML('beforeend',paymentInstructionsDialogMarkup(order));const dialog=root.querySelector('#payment-instructions-dialog'),form=dialog.querySelector('form');dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();form.onsubmit=async event=>{event.preventDefault();const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status'),transfer=form.elements.payment_transfer_enabled.checked?{holder:String(form.elements.transfer_holder.value||'').trim(),bank:String(form.elements.transfer_bank.value||'').trim(),account_type:String(form.elements.transfer_account_type.value||'').trim(),account_number:String(form.elements.transfer_account_number.value||'').trim(),rut:String(form.elements.transfer_rut.value||'').trim(),email:String(form.elements.transfer_email.value||'').trim()}:null,mercadoPago=form.elements.payment_mercado_pago_enabled.checked?String(form.elements.mercado_pago_url.value||'').trim():'';if(!transfer&&!mercadoPago){status.textContent='Incluye una transferencia o un link de Mercado Pago.';return}if(mercadoPago&&!/^https?:\/\//i.test(mercadoPago)){status.textContent='Ingresa un link válido de Mercado Pago.';return}button.disabled=true;button.textContent='Guardando…';const {error}=await supabase.from('orders').update({payment_instructions:{transfer,mercado_pago_url:mercadoPago||null},updated_at:new Date().toISOString()}).eq('id',order.id);if(error){button.disabled=false;button.textContent='Guardar datos de pago';status.textContent=error.message;return}dialog.close();await refreshData('Datos de pago guardados. Ahora puedes previsualizar y enviarlos.')};dialog.addEventListener('close',()=>dialog.remove(),{once:true});showOrderDialog(dialog);mountPaymentInstructionsDisclosure(form)}
function unlockPaymentInstructions(order){root.querySelector('#payment-auth-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='payment-auth-dialog';dialog.className='admin-dialog admin-payment-auth-dialog';dialog.innerHTML=`<form><div class="dialog-title"><div><span class="admin-eyebrow">DATOS DE PAGO · SEGURIDAD</span><h2>Confirmar identidad</h2><p>Ingresa la contraseña de tu cuenta para editar los datos bancarios.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-payment-auth-body"><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><p class="admin-form-status" role="alert"></p></div><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Continuar</button></div></form>`;root.append(dialog);const form=dialog.querySelector('form'),close=()=>{dialog.close();dialog.remove()};dialog.querySelector('.dialog-close').onclick=close;dialog.querySelector('.dialog-cancel').onclick=close;form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=form.querySelector('.admin-form-status'),password=String(form.elements.password.value||'');button.disabled=true;button.textContent='Verificando…';const {data:{user}}=await supabase.auth.getUser();const {error}=await authWithCaptcha(captchaToken=>supabase.auth.signInWithPassword({email:user?.email||'',password,options:{captchaToken}}));if(error){button.disabled=false;button.textContent='Continuar';status.textContent='La contraseña no es correcta.';form.elements.password.select();return}close();openPaymentInstructionsEditor(order)};dialog.addEventListener('close',()=>dialog.remove(),{once:true});showOrderDialog(dialog,{focus:form.elements.password})}
function enhancePaymentDialog(){const content=root.querySelector('#order-dialog-content');if(!content||content.dataset.paymentEnhanced)return;const match=content.dataset.orderId;const order=match&&adminData.orders.find(item=>String(item.id)===match),supportsPaymentInstructions=order?.source==='manual'||order?.price_snapshot?.provider==='bank_transfer';if(!order||!supportsPaymentInstructions)return;content.dataset.paymentEnhanced='true';const instructions=order.payment_instructions||{},transfer=instructions.transfer||{},hasPayment=Object.values(transfer).some(Boolean)||Boolean(instructions.mercado_pago_url),charge=content.querySelector('[data-order-charge]');if(!charge)return;const actions=document.createElement('div');actions.className='admin-payment-actions admin-payment-actions-inline';actions.innerHTML=`<button type="button" class="admin-secondary" data-edit-payment>${hasPayment?'Editar datos':'Incorporar datos de pago'}</button><button type="button" class="admin-secondary" data-send-payment-email="${safe(order.id)}" ${hasPayment&&orderCustomer(order).email?'':'disabled'}>${order.payment_email_sent_at?'Reenviar datos de pago':'Enviar datos de pago'}</button>`;charge.append(actions);actions.querySelector('[data-edit-payment]')?.addEventListener('click',()=>unlockPaymentInstructions(order));actions.querySelector('[data-send-payment-email]')?.addEventListener('click',event=>sendPaymentEmail(event.currentTarget))}
function lockPendingOrderActions(){const content=root.querySelector('#order-dialog-content');if(!content)return;const order=adminData.orders.find(item=>String(item.id)===content.dataset.orderId);if(!order?.edit_pending_approval)return;const next=content.querySelector('[data-next-status]'),payment=content.querySelector('[data-send-payment-email]');if(next){next.disabled=true;next.title='Hay cambios pendientes de revisión'}if(payment)payment.hidden=true}
root.addEventListener('click',event=>{const button=event.target.closest('[data-next-status],[data-resend-email],[data-send-payment-email]');if(!button)return;const content=button.closest('#order-dialog-content'),id=button.dataset.orderId||button.dataset.resendEmail||button.dataset.sendPaymentEmail||content?.dataset.orderId,order=id&&adminData.orders.find(item=>String(item.id)===String(id));if(order?.edit_pending_approval){event.preventDefault();event.stopImmediatePropagation();button.disabled=true;if(!button.matches('[data-next-status]'))button.hidden=true;toast('Primero debes comparar y aprobar o rechazar los cambios pendientes.')}});
async function approveOrderEditWithoutEmail(order,button){if(!await confirmOrderAction(root,{orderId:order.id,title:'Aprobar sin enviar email',message:'Los cambios quedarán aprobados. Podrás enviar el correo después desde Herramientas.',action:'Aprobar cambios'}))return;button.disabled=true;button.textContent='Aprobando…';const nextVersion=Number(order.order_edit_version||0)+1;const {error}=await supabase.from('orders').update({edit_pending_approval:false,edit_pending_at:null,edit_pending_by:null,edit_pending_snapshot:null,order_edit_version:nextVersion,order_edit_email_sent_at:null,order_edit_email_sent_by:null,updated_at:new Date().toISOString()}).eq('id',order.id).eq('edit_pending_approval',true);if(error){button.disabled=false;button.textContent='Aprobar cambios';toast(error.message);return}await supabase.from('order_status_history').insert({order_id:order.id,status:order.status,note:`Edición #${nextVersion} aprobada por administración; email pendiente de envío.`});await refreshData('Cambios aprobados. El email queda pendiente de envío.')}
function addTransferNoticeToPaymentDialog(){const content=root.querySelector('#order-dialog-content'),section=content?.querySelector('[data-order-charge]');if(!content||!section||section.querySelector('[data-transfer-notice]'))return;const match=content.dataset.orderId,order=match&&adminData.orders.find(item=>String(item.id)===match);if(!order?.payment_transfer_notice_at)return;const notice=document.createElement('p');notice.className='admin-payment-transfer-notice';notice.dataset.transferNotice='true';notice.textContent=`Cliente avisó que realizó la transferencia · ${date(order.payment_transfer_notice_at)}`;section.append(notice)}
async function confirmPayment(toggle){
 const order=adminData.orders.find(item=>String(item.id)===String(toggle.dataset.confirmPayment));
 if(!order)return;
 const revoking=!toggle.checked;
 if(revoking){
  toggle.checked=true;
  if(!await confirmOrderAction(root,{orderId:order.id,title:'Desmarcar pago',message:'El pedido volverá a Pedido ingresado. Esta acción no genera un reembolso.',action:'Desmarcar pago',danger:true}))return;
 }
 toggle.disabled=true;
 const {data,error}=await supabase.functions.invoke('update-order-status',{body:{orderId:order.id,...(revoking?{revokePayment:true}:{confirmPayment:true})}});
 if(error||data?.error){toggle.checked=revoking;toggle.disabled=false;normalizePaymentToggleCopy();toast(data?.error||error?.message||'No pudimos actualizar el pago.');return}
 await refreshData(revoking?'Pago desmarcado. El pedido volvió a Pedido ingresado.':data.email?.sent?'Pago confirmado. Email enviado al cliente.':'Pago confirmado. Email al cliente pendiente; revisa la configuración.');
}
function installPaymentGate(){const content=root.querySelector('#order-dialog-content');if(!content||content.dataset.paymentGateInstalled)return;const match=content.dataset.orderId,order=match&&adminData.orders.find(item=>String(item.id)===match),actions=content.querySelector('.admin-order-dialog-actions'),progress=actions?.querySelector('.admin-order-progress-actions'),next=progress?.querySelector('[data-next-status]');if(!order||order.archived_at||!actions||!progress||!next||next.dataset.nextStatus!=='in_production')return;content.dataset.paymentGateInstalled='true';const payment=(order.payments||[]).find(item=>item.provider==='mercado_pago'&&item.status==='approved')||(order.payments||[]).find(item=>item.provider==='transferencia_bancaria')||(order.payments||[]).find(item=>item.provider==='mercado_pago')||(order.payments||[])[0],paymentConfirmed=orderPaymentState(order)==='paid',paymentIssue=(order.payments||[]).find(item=>paymentIssueStatuses.has(item.status)),canConfirmTransfer=Boolean((order.payments||[]).find(item=>item.provider==='transferencia_bancaria')||order.payment_instructions?.transfer),onlineWaiting=payment?.provider==='mercado_pago'&&payment.status!=='approved'&&!canConfirmTransfer&&!paymentConfirmed;if(paymentIssue){content.dataset.paymentGateMode='payment-issue';const notice=document.createElement('p');notice.className='admin-payment-transfer-notice';notice.textContent=`Mercado Pago: ${paymentStatusLabel(paymentIssue.status)}. Resuelve la incidencia antes de iniciar producción.`;progress.prepend(notice);next.disabled=true;next.title='El pago tiene una incidencia activa.';return}if(onlineWaiting){content.dataset.paymentGateMode='automatic-pending';const notice=document.createElement('p');notice.className='admin-payment-transfer-notice';notice.textContent=payment.status==='rejected'||payment.status==='cancelled'?`Mercado Pago ${paymentStatusLabel(payment.status).toLowerCase()}. El cliente debe reintentar antes de iniciar producción.`:'Esperando la aprobación de Mercado Pago.';progress.prepend(notice);next.disabled=true;next.title='Espera la confirmación automática de Mercado Pago.';return}content.dataset.paymentGateMode='manual-confirmation';const toggleLabel=document.createElement('label');toggleLabel.className='admin-payment-toggle';toggleLabel.innerHTML=`<input type="checkbox" role="switch" aria-label="Pago confirmado del pedido #${safe(order.id)}" data-confirm-payment="${safe(order.id)}" ${paymentConfirmed?'checked':''} ${order.request_type==='creative'&&paymentConfirmed?'disabled title="La reversión de una solicitud creativa requiere revisión de administración"':''}><span><strong>${paymentConfirmed?'Pago confirmado':'Confirmar pago'}</strong><small>${paymentConfirmed?'Pago confirmado':'Confirma la transferencia antes de continuar'}</small></span>`;const toggle=toggleLabel.querySelector('input');toggle.addEventListener('change',()=>confirmPayment(toggle));progress.querySelector('div').prepend(toggleLabel);next.disabled=!paymentConfirmed;next.title=paymentConfirmed?'':'Confirma primero que recibiste la transferencia.';next.addEventListener('click',event=>{if(!toggle.checked){event.preventDefault();event.stopImmediatePropagation();toast('Confirma el pago antes de tomar el pedido.')}},true)}
function printOrderLabel(order){const customer=orderCustomer(order),units=(order.order_items||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0),created=order.created_at||order.submitted_at||new Date().toISOString(),popup=window.open('','_blank','width=760,height=720');if(!popup)return toast('Permite ventanas emergentes para imprimir.');popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta pedido ${safe(order.id)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#171914;font-family:Arial,Helvetica,sans-serif}body{padding:24px}.label{width:100mm;min-height:58mm;margin:0 auto;padding:5mm;border:1.5px solid #171914;background:#fff}.label-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8mm;align-items:start;padding-bottom:3mm;border-bottom:1px solid #777}.eyebrow{margin:0 0 1mm;font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#555}.sender-name{font-size:13px;font-weight:800;line-height:1.15}.sender-location{margin-top:1mm;font-size:8px;color:#444}.label-date{text-align:right;font-size:8px;line-height:1.35;white-space:nowrap}.label-date strong{display:block;font-size:10px}.recipient{padding:3.5mm 0 3mm}.recipient-name{margin:0 0 2.5mm;font-size:17px;line-height:1.05;font-weight:800;overflow-wrap:anywhere}.destination{margin:0;font-size:10px;line-height:1.3;font-weight:700;overflow-wrap:anywhere}.contact{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:2.5mm;font-size:8px;line-height:1.25;overflow-wrap:anywhere}.label-footer{display:flex;justify-content:space-between;gap:5mm;padding-top:3mm;border-top:1px solid #777;font-size:8px;font-weight:700;text-transform:uppercase}.label-footer span:last-child{text-align:right}@media print{@page{size:100mm 58mm;margin:0}body{padding:0}.label{width:100mm;min-height:58mm;margin:0;border:1px solid #171914}}</style></head><body><main class="label"><header class="label-header"><div><p class="eyebrow">Remitente</p><div class="sender-name">${safe(SHIPPING_SENDER.name)}</div><div class="sender-location">${safe(SHIPPING_SENDER.location)}</div></div><div class="label-date"><span>Pedido #${safe(order.id)}</span><strong>${safe(date(created))}</strong></div></header><section class="recipient"><p class="eyebrow">Destinatario</p><h1 class="recipient-name">${safe(orderCustomerName(order))}</h1><p class="destination">${safe(orderDestination(order))}</p><div class="contact"><span>${safe(customer.phone||'Sin teléfono')}</span><span>${safe(customer.email||'Sin email')}</span></div></section><footer class="label-footer"><span>${order.shipping_address?.fulfillment==='pickup'?'Retiro en tienda':'Despacho'}</span><span>${units} ${units===1?'unidad':'unidades'}</span></footer></main><script>window.print()<\/script></body></html>`);popup.document.close()}
function manualPaymentInstructions(form){const transfer=form.elements.payment_transfer_enabled.checked?{holder:String(form.elements.transfer_holder.value||'').trim(),bank:String(form.elements.transfer_bank.value||'').trim(),account_type:String(form.elements.transfer_account_type.value||'').trim(),account_number:String(form.elements.transfer_account_number.value||'').trim(),rut:String(form.elements.transfer_rut.value||'').trim(),email:String(form.elements.transfer_email.value||'').trim()}:null;const mercado=form.elements.payment_mercado_pago_enabled.checked?String(form.elements.mercado_pago_url.value||'').trim():'';return {transfer,mercado_pago_url:mercado||null}}
async function handleManualOrderWithPayment(event){event.preventDefault();event.stopImmediatePropagation();const form=event.target;const button=event.submitter||form.querySelector('[type="submit"]'),rows=[...form.querySelectorAll('.admin-manual-item')],paymentInstructions=manualPaymentInstructions(form),sendPaymentEmail=form.elements.send_payment_email.checked,transferValues=paymentInstructions.transfer?Object.values(paymentInstructions.transfer).filter(Boolean):[],hasPayment=transferValues.length>0||Boolean(paymentInstructions.mercado_pago_url);const status=form.querySelector('.admin-form-status');if(sendPaymentEmail&&!hasPayment){status.textContent='Agrega datos de transferencia o activa un link de Mercado Pago antes de enviar.';return}const items=rows.map(row=>{const product=manualProductOptions.find(item=>item.id===row.querySelector('[name="item_product_type"]').value),size=String(row.querySelector('[name="item_size"]').value),color=String(row.querySelector('input[type="radio"]:checked')?.value||''),placement=String(row.querySelector('[name="item_print_placement"]').value),quantity=Number(row.querySelector('[name="item_quantity"]').value),unitPrice=Number(row.querySelector('[name="item_unit_price"]').value),detail=String(row.querySelector('[name="item_name"]').value).trim(),designDetails=String(row.querySelector('[name="item_design_details"]').value||'').trim();return {product,size,color,placement,quantity,unitPrice,detail,designDetails}});if(!items.length||items.some(item=>!item.detail||item.quantity<1||item.unitPrice<0)){status.textContent='Completa cada producto antes de ingresar el pedido.';return}button.disabled=true;button.textContent='Ingresando…';const fulfillment=String(form.elements.fulfillment.value),notes=manualOrderNotes(form),deliveryNotes=String(form.elements.delivery_notes.value||'').trim(),total=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0),shippingAddress={fulfillment,customer:{first_name:String(form.elements.first_name.value).trim(),last_name:String(form.elements.last_name.value).trim(),email:String(form.elements.email.value).trim(),phone:String(form.elements.phone.value).trim()},region:String(form.elements.region.value).trim(),commune:String(form.elements.commune.value).trim(),address:String(form.elements.address.value).trim(),address_extra:String(form.elements.address_extra.value).trim(),delivery_notes:deliveryNotes,notes};const now=new Date().toISOString(),priceSnapshot={manual:true,on_hold:true,order_type:String(form.elements.order_type.value),items:items.map(item=>({substrate:item.product?.label||'Otro',size:item.size,color:item.color,print_placement:item.placement,design_details:item.designDetails}))};const {data:order,error}=await supabase.from('orders').insert({user_id:null,source:'manual',status:'submitted',subtotal_clp:total,shipping_clp:0,discount_clp:0,total_clp:total,shipping_address:shippingAddress,price_snapshot:priceSnapshot,payment_instructions:hasPayment?paymentInstructions:null,submitted_at:now}).select('id').single();if(error){button.disabled=false;button.textContent='Ingresar a revisión';status.textContent=error.message;return}const orderItems=items.map(item=>({order_id:order.id,name_snapshot:`${item.product?.label||'Producto manual'} · ${item.size} · ${item.color} · ${item.detail}`,sku_snapshot:`MANUAL-${slugify(item.product?.id||'otro')}-${slugify(item.size)}`,print_sides:item.placement==='none'?'front':item.placement,quantity:item.quantity,unit_price_clp:item.unitPrice,line_total_clp:item.quantity*item.unitPrice})),{error:itemError}=await supabase.from('order_items').insert(orderItems);if(itemError){await supabase.from('orders').delete().eq('id',order.id);button.disabled=false;button.textContent='Ingresar a revisión';status.textContent=itemError.message;return}await supabase.from('order_status_history').insert({order_id:order.id,status:'submitted',note:'Pedido manual ingresado y dejado en revisión del panel.'});const {data:emailData,error:emailError}=await supabase.functions.invoke('send-order-email',{body:{orderId:order.id,paymentEmail:sendPaymentEmail,paymentInstructions:hasPayment?paymentInstructions:null}});form.closest('dialog').close();await refreshData(emailError||emailData?.error?'Pedido manual ingresado en revisión. Email pendiente de configuración.':sendPaymentEmail?'Pedido ingresado y datos de pago enviados.':'Pedido manual ingresado en revisión y email enviado.')}
root.addEventListener('submit',event=>{if(event.target?.id==='manual-order-form'){event.preventDefault();event.stopImmediatePropagation();submitAdminFormDisclosure(event.target,event,handleManualOrderWithPayment)}},true)
async function submitManualOrder(event){event.preventDefault();const form=event.currentTarget,button=event.submitter,rows=[...form.querySelectorAll('.admin-manual-item')],fulfillment=String(form.elements.fulfillment.value),notes=String(form.elements.notes.value||'').trim(),deliveryNotes=String(form.elements.delivery_notes.value||'').trim();const items=rows.map(row=>{const product=manualProductOptions.find(item=>item.id===row.querySelector('[name="item_product_type"]').value),size=String(row.querySelector('[name="item_size"]').value),color=String(row.querySelector('input[type="radio"]:checked')?.value||''),placement=String(row.querySelector('[name="item_print_placement"]').value),quantity=Number(row.querySelector('[name="item_quantity"]').value),unitPrice=Number(row.querySelector('[name="item_unit_price"]').value),detail=String(row.querySelector('[name="item_name"]').value).trim(),designDetails=String(row.querySelector('[name="item_design_details"]').value||'').trim();return {product,size,color,placement,quantity,unitPrice,detail,designDetails}});if(!items.length||items.some(item=>!item.detail||item.quantity<1||item.unitPrice<0)){form.querySelector('.admin-form-status').textContent='Completa cada producto antes de ingresar el pedido.';return}button.disabled=true;button.textContent='Ingresando…';const total=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0),shippingAddress={fulfillment,customer:{first_name:String(form.elements.first_name.value).trim(),last_name:String(form.elements.last_name.value).trim(),email:String(form.elements.email.value).trim(),phone:String(form.elements.phone.value).trim()},region:String(form.elements.region.value).trim(),commune:String(form.elements.commune.value).trim(),address:String(form.elements.address.value).trim(),address_extra:String(form.elements.address_extra.value).trim(),delivery_notes:deliveryNotes,notes};const now=new Date().toISOString(),priceSnapshot={manual:true,on_hold:true,order_type:String(form.elements.order_type.value),items:items.map(item=>({substrate:item.product?.label||'Otro',size:item.size,color:item.color,print_placement:item.placement,design_details:item.designDetails}))};const {data:order,error}=await supabase.from('orders').insert({user_id:null,source:'manual',status:'submitted',subtotal_clp:total,shipping_clp:0,discount_clp:0,total_clp:total,shipping_address:shippingAddress,price_snapshot:priceSnapshot,submitted_at:now}).select('id').single();if(error){button.disabled=false;button.textContent='Ingresar a revisión';form.querySelector('.admin-form-status').textContent=error.message;return}const orderItems=items.map(item=>({order_id:order.id,name_snapshot:`${item.product?.label||'Producto manual'} · ${item.size} · ${item.color} · ${item.detail}`,sku_snapshot:`MANUAL-${slugify(item.product?.id||'otro')}-${slugify(item.size)}`,print_sides:item.placement==='none'?'front':item.placement,quantity:item.quantity,unit_price_clp:item.unitPrice,line_total_clp:item.quantity*item.unitPrice})),{error:itemError}=await supabase.from('order_items').insert(orderItems);if(itemError){await supabase.from('orders').delete().eq('id',order.id);button.disabled=false;button.textContent='Ingresar a revisión';form.querySelector('.admin-form-status').textContent=itemError.message;return}await supabase.from('order_status_history').insert({order_id:order.id,status:'submitted',note:'Pedido manual ingresado y dejado en revisión del panel.'});const {data:emailData,error:emailError}=await supabase.functions.invoke('send-order-email',{body:{orderId:order.id}});form.closest('dialog').close();await refreshData(emailError||emailData?.error?'Pedido manual ingresado en revisión. Email pendiente de configuración.':'Pedido manual ingresado en revisión y email enviado.')}
function openManualTypeEditor(order){
 const dialog=document.createElement('dialog');
 dialog.className='admin-dialog admin-manual-type-dialog';
 const current=order.price_snapshot?.order_type||'';
 dialog.innerHTML=`<form><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · MANUAL</span><h2>Tipo de pedido</h2><p>Clasifica este pedido para identificarlo en el tablero.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><label>Tipo<select name="order_type" required><option value="" ${current?'':'selected'} disabled>Selecciona el tipo</option><option value="catalog" ${current==='catalog'?'selected':''}>Catálogo</option><option value="artwork" ${current==='artwork'?'selected':''}>Personalizado · diseño adjunto</option><option value="idea" ${current==='idea'?'selected':''}>Personalizado · idea</option></select></label><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar tipo</button></div><p class="admin-form-status" role="alert"></p></form>`;
 root.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
 dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();
  const type=event.currentTarget.elements.order_type.value;
  if(!['catalog','artwork','idea'].includes(type))return;
  const button=event.submitter,status=dialog.querySelector('.admin-form-status');
  button.disabled=true;button.textContent='Guardando…';
  const {data,error}=await supabase.from('orders').update({price_snapshot:{...(order.price_snapshot||{}),order_type:type},updated_at:new Date().toISOString()}).eq('id',order.id).eq('source','manual').eq('updated_at',order.updated_at).select('id').maybeSingle();
  if(error||!data){button.disabled=false;button.textContent='Guardar tipo';status.textContent=error?.message||'El pedido cambió. Actualiza el panel e inténtalo nuevamente.';return}
  dialog.close();root.querySelector('#order-dialog')?.close();
  await refreshData('Tipo de pedido actualizado.');
  const updated=[...adminData.orders,...adminData.archivedRecent].find(item=>String(item.id)===String(order.id));
  if(updated)openOrderDetails(updated);
 };
 showOrderDialog(dialog);
}
function openOrderDetails(order){
 const index=adminData.orders.findIndex(item=>String(item.id)===String(order.id));
 if(index<0)adminData.orders.push(order);else adminData.orders[index]=order;
 const dialog=root.querySelector('#order-dialog'),content=root.querySelector('#order-dialog-content');
 content.dataset.orderId=order.id;
 delete content.dataset.paymentEnhanced;
 delete content.dataset.paymentGateInstalled;
 delete content.dataset.paymentGateMode;
 content.innerHTML=orderDetailMarkup(order);
 installPaymentGate();
 if(!order.archived_at)enhancePaymentDialog();
 addTransferNoticeToPaymentDialog();
 lockPendingOrderActions();
 const actions={
  '[data-next-status]':button=>advanceOrder(button),
  '[data-edit-order]':()=>openOrderEditor(order),
  '[data-review-order]':()=>openEditApproval(order),
  '[data-quote-order]':()=>openQuoteEditor(order),
  '[data-print-order]':()=>printOrderLabel(order),
  '[data-resend-email]':resendOrderEmail,
  '[data-approved-edit-email]':button=>openOrderEmailPreview(order,'edit',button),
  '[data-rollback-order]':rollbackOrder,
  '[data-archive-order]':archiveOrder,
  '[data-restore-archived-order]':restoreArchivedOrder,
  '[data-classify-manual-order]':()=>openManualTypeEditor(order)
 };
 for(const [selector,action] of Object.entries(actions)){
   content.querySelector(selector)?.addEventListener('click',event=>{
   const button=event.currentTarget;
   if(!button.closest('[popover]'))button.focus({preventScroll:true});
   action(button);
  });
 }
 showOrderDialog(dialog);
}

function archiveHistoryRow(order){return `<article class="admin-archive-history-row"><div><strong>#${safe(order.id)} · ${safe(orderCustomerName(order))}</strong><span>Tipo: ${safe(orderTypeLabel(order))} · ${safe(orderStatusLabel(archivedOrderStatus(order),order))} · Archivado ${dateTime(order.archived_at)} · ${money(order.total_clp)}</span><span class="admin-payment-badge is-${orderPaymentState(order)}">${paymentStateLabels[orderPaymentState(order)]}</span></div><button type="button" class="admin-secondary" data-archive-order-id="${safe(order.id)}" aria-label="Ver pedido #${safe(order.id)}">Ver pedido</button></article>`}
function wireArchiveHistory(){
 const dialog=root.querySelector('#archive-history-dialog');
 const list=dialog.querySelector('#archive-history-list');
 const filters=dialog.querySelector('#archive-history-filters');
 let requestId=0;
 async function loadHistory(){
  const currentRequest=++requestId;
  filters.hidden=true;
  list.innerHTML='<p class="admin-archive-history-message" role="status">Cargando historial…</p>';
  try{
   const archived=[];
   for(let from=0;;from+=ARCHIVE_HISTORY_PAGE_SIZE){
    const {data,error}=await supabase.from('orders').select(ADMIN_ORDER_SELECT).not('archived_at','is',null).order('archived_at',{ascending:false}).order('id',{ascending:false}).range(from,from+ARCHIVE_HISTORY_PAGE_SIZE-1);
    if(error)throw error;
    archived.push(...(data||[]));
    if((data||[]).length<ARCHIVE_HISTORY_PAGE_SIZE)break;
   }
   if(!dialog.isConnected||!dialog.open||requestId!==currentRequest)return;
   const localArchived=import.meta.env.DEV?readLocalOrders().filter(order=>order.archived_at):[];
   const all=[...localArchived,...archived].sort((a,b)=>new Date(b.archived_at)-new Date(a.archived_at));
   const statusSelect=filters.querySelector('#archive-status');
   const statuses=[...new Set(all.map(archivedOrderStatus).filter(Boolean))].sort((a,b)=>orderStatusLabel(a).localeCompare(orderStatusLabel(b),'es-CL'));
   statusSelect.innerHTML=`<option value="">Todos los estados</option>${statuses.map(status=>`<option value="${safe(status)}">${safe(orderStatusLabel(status))}</option>`).join('')}`;
   filters.querySelectorAll('input,select').forEach(input=>input.value='');
   filters.hidden=false;
   const render=()=>{
    const found=filterArchivedOrders(all,{query:filters.querySelector('#archive-search').value,status:statusSelect.value,payment:filters.querySelector('#archive-payment').value,from:filters.querySelector('#archive-from').value,to:filters.querySelector('#archive-to').value});
    list.innerHTML=`<p class="admin-archive-history-count" role="status">${found.length} de ${all.length} ${all.length===1?'pedido archivado':'pedidos archivados'}</p>${found.map(archiveHistoryRow).join('')||'<p class="admin-archive-history-message">No hay pedidos que coincidan con los filtros.</p>'}`;
   };
   filters.oninput=render;
   filters.querySelector('#archive-clear-filters').onclick=()=>{filters.querySelectorAll('input,select').forEach(input=>input.value='');render();filters.querySelector('#archive-search').focus()};
   render();
   list.onclick=event=>{const button=event.target.closest('[data-archive-order-id]');if(!button)return;const order=all.find(item=>String(item.id)===button.dataset.archiveOrderId);if(!order)return;button.focus({preventScroll:true});openOrderDetails(order)};
  }catch(error){
   if(!dialog.isConnected||!dialog.open||requestId!==currentRequest)return;
   console.error('No pudimos cargar los pedidos archivados',error);
   list.innerHTML='<div class="admin-archive-history-message"><p role="alert">No pudimos cargar el historial.</p><button type="button" class="admin-secondary">Reintentar</button></div>';
   list.querySelector('button').onclick=()=>{
    dialog.querySelector('h2').focus({preventScroll:true});
    loadHistory();
   };
  }
 }
 root.querySelector('#open-archive-history')?.addEventListener('click',()=>{
  showOrderDialog(dialog);
  loadHistory();
 });
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>requestId++);
}
function wireOrders(){root.querySelector('#export-orders').onclick=event=>exportAllOrders(event.currentTarget);root.querySelectorAll('[data-open-order]').forEach(button=>button.onclick=()=>{const order=[...adminData.orders,...adminData.archivedRecent].find(item=>String(item.id)===button.dataset.openOrder);if(order){button.focus({preventScroll:true});openOrderDetails(order)}});wireArchiveHistory();const manual=root.querySelector('#manual-order-dialog'),form=manual.querySelector('form'),items=root.querySelector('#manual-items');let nextManualItem=items.children.length;const setupItem=row=>{const productInput=row.querySelector('[name="item_product_type"]'),sizeInput=row.querySelector('[name="item_size"]');productInput.onchange=()=>{const product=manualProductOptions.find(item=>item.id===productInput.value);sizeInput.innerHTML=(product?.sizes||[]).map(size=>`<option value="${size}">${size}</option>`).join('')};row.querySelector('[data-remove-item]')?.addEventListener('click',()=>{row.remove();const remaining=[...items.children];remaining.forEach((item,index)=>{item.querySelector('strong').textContent=`Producto ${index+1}`;item.querySelector('[data-remove-item]').hidden=remaining.length===1})})};setupAdminRegionFilter(manual.querySelector('#manual-order-region'));setupItem(items.firstElementChild);root.querySelector('#new-manual-order').onclick=()=>{installManualChannelField();mountAdminOrderDisclosure(form,'manual');showOrderDialog(manual)};manual.querySelector('.dialog-close').onclick=()=>manual.close();manual.querySelector('.dialog-cancel').onclick=()=>manual.close();root.querySelector('#add-manual-item').onclick=()=>{const row=document.createElement('div');row.innerHTML=manualItemMarkup(nextManualItem++);const item=row.firstElementChild;items.append(item);setupItem(item)};form.onsubmit=submitManualOrder}

function supplierModels(){const models=new Map([['basic',{code:'basic',name:'Polera básica'}],['woman',{code:'woman',name:'Polera mujer'}],['over',{code:'over',name:'Polera oversize'}],['kid',{code:'kid',name:'Polera niño'}],['body',{code:'body',name:'Body bebé'}]]);for(const variant of adminData.variants){const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models;if(model?.code)models.set(model.code,model)}return [...models.values()]}
function supplierNumber(form,name,fallback=0){const value=Number(form.elements[name]?.value);return Number.isFinite(value)?Math.max(0,value):fallback}
function supplierCalculation(form){const garment=supplierNumber(form,'garment_cost_clp'),supplies=supplierNumber(form,'supplies_cost_clp'),sheet=supplierNumber(form,'dtf_sheet_cost_clp'),sheetWidth=supplierNumber(form,'dtf_sheet_width_cm',56)||56,sheetHeight=supplierNumber(form,'dtf_sheet_height_cm',100)||100,printWidth=supplierNumber(form,'print_width_cm',28)||28,printHeight=supplierNumber(form,'print_height_cm',35)||35,margin=supplierNumber(form,'margin_percent',150),vat=supplierNumber(form,'vat_percent',19);const dtf=sheet*(printWidth*printHeight)/(sheetWidth*sheetHeight),base=garment+supplies+dtf,net=Math.round(base*(1+margin/100)),iva=Math.round(net*vat/100);return {garment,supplies,dtf,base,net,iva,final:net+iva,margin,vat}}
function supplierFormMarkup(model){const saved=adminData.supplierCosts.find(item=>item.product_model_code===model.code)||{},hasVariants=adminData.variants.some(item=>(Array.isArray(item.product_models)?item.product_models[0]:item.product_models)?.code===model.code),value=(name,fallback)=>safe(saved[name]??fallback),calculated=saved.suggested_price_clp?money(saved.suggested_price_clp):'—';return `<form class="supplier-cost-card" data-supplier-form="${safe(model.code)}"><div class="supplier-card-head"><div><span class="admin-eyebrow">${safe(model.code)}</span><h2>${safe(model.name||model.code)}</h2></div><span class="status-pill ${saved.published_at?'is-active':'is-hidden'}">${saved.published_at?'Publicado':'Sin publicar'}</span></div><div class="admin-form-grid"><label>Costo polera / prenda<input name="garment_cost_clp" type="number" min="0" step="1" value="${value('garment_cost_clp',0)}" required><small>Valor neto pagado al proveedor.</small></label><label>Otros insumos<input name="supplies_cost_clp" type="number" min="0" step="1" value="${value('supplies_cost_clp',0)}"><small>Cuello, empaque u otros costos por unidad.</small></label><label>DTF por pliego<input name="dtf_sheet_cost_clp" type="number" min="0" step="1" value="${value('dtf_sheet_cost_clp',0)}" required></label><label>Margen deseado (%)<input name="margin_percent" type="number" min="0" step="1" value="${value('margin_percent',150)}" required></label><label>IVA (%)<input name="vat_percent" type="number" min="0" step="0.1" value="${value('vat_percent',19)}" required></label><div class="supplier-print-size"><span class="supplier-label">Pliego DTF (cm)</span><div><input aria-label="Ancho del pliego DTF" name="dtf_sheet_width_cm" type="number" min="0.1" step="0.1" value="${value('dtf_sheet_width_cm',56)}"><span>×</span><input aria-label="Alto del pliego DTF" name="dtf_sheet_height_cm" type="number" min="0.1" step="0.1" value="${value('dtf_sheet_height_cm',100)}"></div></div><div class="supplier-print-size"><span class="supplier-label">Impresión estimada por prenda (cm)</span><div><input aria-label="Ancho de impresión" name="print_width_cm" type="number" min="0.1" step="0.1" value="${value('print_width_cm',28)}"><span>×</span><input aria-label="Alto de impresión" name="print_height_cm" type="number" min="0.1" step="0.1" value="${value('print_height_cm',35)}"></div></div></div><div class="supplier-calculation" aria-live="polite"><div><span>Costo base</span><strong data-calc="base">—</strong></div><div><span>Valor neto con margen</span><strong data-calc="net">—</strong></div><div><span>IVA</span><strong data-calc="iva">—</strong></div><div class="supplier-total"><span>Precio sugerido final</span><strong data-calc="final">${calculated}</strong></div></div><div class="dialog-actions supplier-actions"><button type="button" class="admin-secondary" data-save-supplier="${safe(model.code)}">Guardar cálculo</button><button type="button" class="admin-primary" data-publish-supplier="${safe(model.code)}" ${hasVariants?'':'disabled'}>${hasVariants?'Aceptar y publicar precio':'Publica cuando existan variantes'}</button></div><p class="admin-form-status" role="alert"></p></form>`}
function suppliersView(){const models=supplierModels(),content=`${pageHeading('COSTOS Y PRECIOS','Insumos.','Registra tus costos netos, estima el consumo de DTF y define un margen. El precio sugerido incluye IVA.',`<span class="supplier-iva-note">IVA configurable por prenda · referencia Chile: 19%</span>`)}<section class="supplier-guide"><strong>Cómo se calcula</strong><span>costo de prenda + insumos + DTF proporcional al área impresa</span><b>→</b><span>neto con margen</span><b>→</b><span>precio final + IVA</span></section><div class="supplier-grid">${models.length?models.map(supplierFormMarkup).join(''):'<section class="admin-panel admin-empty"><strong>No encontramos modelos de prendas.</strong><p>Primero configura las variantes del catálogo.</p></section>'}</div>`;shell(content,'insumos');wireSuppliers()}
async function saveSupplier(form,publish){const modelCode=form.dataset.supplierForm,model=supplierModels().find(item=>item.code===modelCode),calc=supplierCalculation(form),button=form.querySelector(publish?'[data-publish-supplier]':'[data-save-supplier]'),status=form.querySelector('.admin-form-status');if(!model)return;button.disabled=true;button.textContent=publish?'Publicando…':'Guardando…';const payload={product_model_code:modelCode,product_name:model.name||modelCode,garment_cost_clp:Math.round(calc.garment),supplies_cost_clp:Math.round(calc.supplies),dtf_sheet_cost_clp:Math.round(supplierNumber(form,'dtf_sheet_cost_clp')),dtf_sheet_width_cm:supplierNumber(form,'dtf_sheet_width_cm',56),dtf_sheet_height_cm:supplierNumber(form,'dtf_sheet_height_cm',100),print_width_cm:supplierNumber(form,'print_width_cm',28),print_height_cm:supplierNumber(form,'print_height_cm',35),margin_percent:calc.margin,vat_percent:calc.vat,calculated_net_clp:calc.net,calculated_vat_clp:calc.iva,suggested_price_clp:calc.final,updated_at:new Date().toISOString(),published_at:publish?new Date().toISOString():(adminData.supplierCosts.find(item=>item.product_model_code===modelCode)?.published_at||null)};const {error}=await supabase.from('supplier_costs').upsert(payload,{onConflict:'product_model_code'});if(error){button.disabled=false;button.textContent=publish?'Aceptar y publicar precio':'Guardar cálculo';status.textContent=error.message;return}if(publish){const variants=adminData.variants.filter(item=>(Array.isArray(item.product_models)?item.product_models[0]:item.product_models)?.code===modelCode);for(const variant of variants){const result=await supabase.from('product_variants').update({price_clp:calc.final,updated_at:new Date().toISOString()}).eq('id',variant.id);if(result.error){button.disabled=false;button.textContent='Aceptar y publicar precio';status.textContent=result.error.message;return}}}await refreshData(publish?`Precio publicado para ${model.name||modelCode}.`:'Cálculo guardado.');}
function wireSuppliers(){root.querySelectorAll('[data-supplier-form]').forEach(form=>{const update=()=>{const calc=supplierCalculation(form);form.querySelector('[data-calc="base"]').textContent=money(calc.base);form.querySelector('[data-calc="net"]').textContent=money(calc.net);form.querySelector('[data-calc="iva"]').textContent=money(calc.iva);form.querySelector('[data-calc="final"]').textContent=money(calc.final)};form.querySelectorAll('input').forEach(input=>input.addEventListener('input',update));form.querySelector('[data-save-supplier]').onclick=()=>saveSupplier(form,false);form.querySelector('[data-publish-supplier]').onclick=()=>saveSupplier(form,true);update()})}

function supplierProductCalculation(product){const products=new Map((adminData.supplierProducts||[]).map(item=>[String(item.id),item])),lines=(adminData.supplierComponents||[]).filter(line=>String(line.principal_product_id)===String(product.id));return principalCalculation(product,lines,id=>products.get(String(id))||null)}
function supplierProductVariants(product){
 const size=adminData.productSizes.find(item=>String(item.id)===String(product.catalog_product_size_id));
 return supplierVariantsForPrice({...product,commercial_size:size?.size_code},adminData.variants,adminData.supplierVariantLinks,supplierProductCategory(product)?.slug);
}
function supplierProductCategory(product){return (adminData.supplierCategories||[]).find(category=>String(category.id)===String(product.category_id))}
function bodyPriceCreatesVariants(product){return supplierProductCategory(product)?.slug==='bodys'&&product.kind==='garment'&&Boolean(product.catalog_product_size_id)}
function totePriceCreatesVariants(product){return supplierProductCategory(product)?.slug==='tote-bag'&&product.kind==='garment'&&Boolean(product.catalog_product_size_id)}
function priceCreatesVariants(product){
 const category=supplierProductCategory(product)?.slug;
 return bodyPriceCreatesVariants(product)||totePriceCreatesVariants(product)||(['poleras','polera-mujer-basica','poleras-oversize','poleras-ninos'].includes(category)&&product.kind==='garment');
}
function supplierProductDisplayName(product){const name=String(product.name||'').trim()||'Insumo principal',category=String(supplierProductCategory(product)?.name||'').toLocaleLowerCase('es-CL');if(/body|bodys/.test(category)&&/^\d+\s*[-–]\s*\d+$/.test(name))return `Body bebé · ${name.replace('-', '–')} meses`;return name}
function supplierProductTypeLabel(product){const category=supplierProductCategory(product);if(category?.name)return category.name;return ({garment:'Prenda',acrylic:'Acrílico',magnet:'Imán'})[product.kind]||'Producto'}
function priceMetrics(product,calculation,price){const vat=Number(product.vat_percent??19),finalPrice=Math.max(0,Math.round(Number(price)||0)),net=Math.round(finalPrice/(1+vat/100)),gain=net-Math.round(calculation.base),percentage=calculation.base?gain/calculation.base*100:0;return {finalPrice,net,gain,percentage,vat}}
function priceWorkflowState({variants,confirmed,published,autoPublish=false}){if(!variants.length&&!autoPublish)return {filter:'review',label:'Sin variante',detail:'No hay una talla publicada que corresponda',action:'Revisar'};if(confirmed!==null&&variants.length&&variants.some(variant=>Number(variant.price_clp)!==Number(confirmed)))return {filter:'review',label:'Desincronizado',detail:'El precio guardado difiere de la tienda',action:'Corregir'};if(confirmed!==null)return {filter:'published',label:'Publicado',detail:'Precio actualizado automáticamente',action:'Editar'};if(published)return {filter:'review',label:'Revisar',detail:'Hay un precio en tienda',action:'Revisar'};return {filter:'review',label:'Definir precio',detail:'Aún no se publica',action:'Definir'}}
function legacyCompactPricesView(){
 const products=(adminData.supplierProducts||[]).filter(item=>['garment','acrylic','magnet'].includes(item.kind)),categories=adminData.supplierCategories||[],roots=categories.filter(category=>!category.parent_category_id),children=categories.filter(category=>category.parent_category_id)
 const prepared=products.map(product=>{const calculation=supplierProductCalculation(product),variants=supplierProductVariants(product),suggested=calculation.suggested,confirmed=product.confirmed_price_clp??null,published=variants.length?Math.min(...variants.map(variant=>Number(variant.price_clp)||0))||0:0;return {product,calculation,variants,suggested,confirmed,published}})
 const workflowState=entry=>priceWorkflowState({...entry,autoPublish:priceCreatesVariants(entry.product)}),reviewCount=prepared.filter(entry=>workflowState(entry).filter==='review').length,publishedCount=prepared.filter(entry=>workflowState(entry).filter==='published').length
 const row=entry=>{const {product,calculation,variants,suggested,confirmed,published}=entry,state=priceWorkflowState({variants,confirmed,published}),displayName=supplierProductDisplayName(product),typeLabel=supplierProductTypeLabel(product),price=published||confirmed||0,searchable=`${displayName} ${typeLabel} ${calculation.base} ${money(calculation.base)} ${suggested} ${money(suggested)} ${price} ${money(price)} ${state.label}`;return `<tr data-price-row="${safe(product.id)}" data-price-searchable="${safe(searchable.toLowerCase())}" data-price-state="${state.filter}"><td><strong>${safe(displayName)}</strong><small>${safe(typeLabel)}${variants.length?` · ${variants.length} variante${variants.length===1?'':'s'}`:' · Sin variantes'}</small></td><td>${money(calculation.base)}</td><td>${money(suggested)}</td><td>${price?money(price):'—'}</td><td><span class="status-pill ${state.filter==='published'?'is-active':'is-hidden'}">${safe(state.label)}</span></td><td><div class="row-actions"><details class="supplier-row-menu"><summary>Acciones</summary><div class="supplier-row-menu-items">${variants.length?`<button type="button" data-price-edit="${product.id}">Editar precio</button>`:'<a href="#productos">Vincular variante</a>'}</div></details></div></td></tr>`}
 const grouped=roots.map(parent=>{const rows=children.filter(child=>String(child.parent_category_id)===String(parent.id)).map(child=>{const entries=prepared.filter(entry=>String(entry.product.category_id)===String(child.id)).map(row).join('');return entries?`<tr class="supplier-subcategory-row" data-price-subcategory="${child.id}"><th colspan="6">${safe(child.name)}</th></tr>${entries}`:''}).join('');return rows?`<tr class="supplier-theme-row" data-price-theme="${parent.id}"><th colspan="6">${safe(parent.name)}</th></tr>${rows}`:''}).join('')
 const ungrouped=prepared.filter(entry=>!children.some(category=>String(category.id)===String(entry.product.category_id))).map(row).join('')
 const content=`${pageHeading('VENTAS','Precios.','Revisa los costos y publica el precio de venta de cada insumo principal.',`<a class="admin-secondary" href="#insumos">Ver insumos y recetas</a>`)}<section class="admin-panel supplier-compact-panel"><div class="admin-panel-head"><div><h2>Precios y publicación</h2><p>${prepared.length} productos · ${reviewCount} por revisar · ${publishedCount} publicados</p></div><label class="supplier-table-search"><span>Buscar producto</span><input type="search" data-price-search placeholder="Nombre, categoría o precio" autocomplete="off"></label></div>${prepared.length?`<div class="admin-table-wrap"><table class="admin-table supplier-compact-table"><thead><tr><th>Producto</th><th>Costo receta</th><th>Precio sugerido</th><th>En tienda</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${grouped}${ungrouped}</tbody></table></div><p class="supplier-search-empty" data-price-search-empty hidden>No encontramos productos que coincidan con la búsqueda.</p>`:'<div class="admin-empty"><strong>No hay insumos principales listos.</strong><p>Primero crea un principal en Insumos y completa su receta.</p></div>'}</section><dialog class="admin-dialog" id="price-edit-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">PRECIO DE VENTA</span><h2 data-price-title>Editar precio</h2><p data-price-description></p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-price-edit-grid"><label class="admin-price-input"><span>Precio a publicar</span><strong>IVA incluido</strong><input name="price" type="number" min="1" step="10" required></label><div class="admin-price-profit" aria-live="polite"><span>Margen con este precio</span><strong data-price-gain>—</strong><small data-price-gain-detail>—</small></div></div><button type="button" class="admin-secondary" data-price-use-suggested>Aplicar precio sugerido</button><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar y publicar</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`
 shell(content,'precios');wirePriceTable(prepared,children)
}
function legacyWirePriceTable(prepared,children){
 const search=root.querySelector('[data-price-search]'),empty=root.querySelector('[data-price-search-empty]'),tbody=root.querySelector('.supplier-compact-table tbody'),normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL')
 const filter=()=>{if(!tbody)return;const query=normalize(search?.value).trim(),isVisible=entry=>!tbody.querySelector(`[data-price-row="${CSS.escape(String(entry.product.id))}"]`)?.hidden;let visible=0;tbody.querySelectorAll('[data-price-row]').forEach(row=>{const matches=!query||normalize(row.dataset.priceSearchable).includes(query);row.hidden=!matches;if(matches)visible++});tbody.querySelectorAll('[data-price-subcategory]').forEach(row=>{const categoryId=row.dataset.priceSubcategory;row.hidden=!prepared.some(entry=>String(entry.product.category_id)===String(categoryId)&&isVisible(entry))});tbody.querySelectorAll('[data-price-theme]').forEach(row=>{const ids=children.filter(child=>String(child.parent_category_id)===String(row.dataset.priceTheme)).map(child=>String(child.id));row.hidden=!ids.some(id=>prepared.some(entry=>String(entry.product.category_id)===id&&isVisible(entry)))});if(empty)empty.hidden=visible>0}
 search?.addEventListener('input',filter)
 const dialog=root.querySelector('#price-edit-dialog'),form=dialog.querySelector('form'),input=form.elements.price,status=form.querySelector('.admin-form-status');let active=null
 const refresh=()=>{if(!active)return;const metrics=priceMetrics(active.product,active.calculation,input.value),label=`${metrics.gain>=0?'+':''}${money(metrics.gain)} · ${metrics.percentage.toFixed(1)}%`;form.querySelector('[data-price-gain]').textContent=label;form.querySelector('[data-price-gain-detail]').textContent=`Neto ${money(metrics.net)} − costo receta ${money(active.calculation.base)}`}
 root.querySelectorAll('[data-price-edit]').forEach(button=>button.onclick=()=>{active=prepared.find(entry=>String(entry.product.id)===String(button.dataset.priceEdit));if(!active)return;const initial=active.confirmed??(active.published||active.suggested);status.textContent='';form.querySelector('[data-price-title]').textContent=supplierProductDisplayName(active.product);form.querySelector('[data-price-description]').textContent=`Sugerido: ${money(active.suggested)} · costo receta: ${money(active.calculation.base)}.`;input.value=initial;refresh();dialog.showModal();input.focus();input.select()})
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();input.oninput=refresh;form.querySelector('[data-price-use-suggested]').onclick=()=>{if(!active)return;input.value=active.suggested;refresh();input.focus()}
 form.onsubmit=async event=>{event.preventDefault();if(!active)return;const price=Math.round(Number(input.value)),button=event.submitter;if(!Number.isFinite(price)||price<=0){status.textContent='Ingresa un precio mayor que cero.';return}button.disabled=true;button.textContent='Publicando…';const now=new Date().toISOString(),{error}=await supabase.from('supplier_products').update({confirmed_price_clp:price,price_confirmed_at:now,price_confirmed_by:sessionUser?.id||null,updated_at:now}).eq('id',active.product.id);if(error){button.disabled=false;button.textContent='Guardar y publicar';status.textContent=error.message;return}for(const variant of active.variants){const result=await supabase.from('product_variants').update({price_clp:price,updated_at:now}).eq('id',variant.id);if(result.error){button.disabled=false;button.textContent='Guardar y publicar';status.textContent=`El precio quedó guardado, pero no pudimos actualizar la variante ${variant.sku}.`;return}}dialog.close();await refreshData(`Precio publicado para ${active.product.name}.`)}
}
function variantModel(variant){return Array.isArray(variant?.product_models)?variant.product_models[0]:variant?.product_models}
function variantLabel(variant){const model=variantModel(variant);return `${model?.name||'Producto'} · talla ${variant.size||'Sin talla'} · ${variant.color_name||'Sin color'}`}
function variantSummary(variants){if(!variants.length)return 'Sin variantes vinculadas';const sizes=[...new Set(variants.map(variant=>variant.size).filter(Boolean))];return `${variants.length} variante${variants.length===1?'':'s'} · talla${sizes.length===1?'':'s'} ${sizes.join(', ')}`}
function compatibleVariants(product){
 const size=adminData.productSizes.find(item=>String(item.id)===String(product.catalog_product_size_id));
 return compatibleSupplierVariants({...product,commercial_size:size?.size_code},adminData.variants,supplierProductCategory(product)?.slug);
}
function pricesView(){
 const products=(adminData.supplierProducts||[]).filter(item=>['garment','acrylic','magnet'].includes(item.kind)),categories=adminData.supplierCategories||[],roots=categories.filter(category=>!category.parent_category_id),children=categories.filter(category=>category.parent_category_id)
 const prepared=products.map(product=>{const calculation=supplierProductCalculation(product),variants=supplierProductVariants(product),suggested=calculation.suggested,confirmed=product.confirmed_price_clp??null,published=variants.length?Math.min(...variants.map(variant=>Number(variant.price_clp)||0))||0:0,variantPersonalizationPrices=variants.map(variant=>Number(variant.personalization_base_price_clp)).filter(value=>Number.isInteger(value)&&value>0),personalizationBase=product.personalization_base_price_clp!=null&&Number.isInteger(Number(product.personalization_base_price_clp))&&Number(product.personalization_base_price_clp)>0?Number(product.personalization_base_price_clp):(variantPersonalizationPrices.length?variantPersonalizationPrices[0]:null);return {product,calculation,variants,suggested,confirmed,published,personalizationBase}})
 const workflowState=entry=>priceWorkflowState({...entry,autoPublish:priceCreatesVariants(entry.product)}),reviewCount=prepared.filter(entry=>workflowState(entry).filter==='review').length,publishedCount=prepared.filter(entry=>workflowState(entry).filter==='published').length
 const row=entry=>{
  const {product,calculation,variants,suggested,confirmed,published}=entry;
  const state=priceWorkflowState({variants,confirmed,published,autoPublish:priceCreatesVariants(product)});
  const displayName=supplierProductDisplayName(product),typeLabel=supplierProductTypeLabel(product);
  const vat=Number(product.vat_percent??19),minimum=minimumPriceWithVat(calculation.base,vat),personalizationLabel=entry.personalizationBase===null?'No definido':money(entry.personalizationBase);
  const storePrice=published||0,taxBasis=storePrice||suggested||0;
  const taxMetrics=taxBasis?priceMetrics(product,calculation,taxBasis):null;
  const taxIncluded=taxMetrics?taxMetrics.finalPrice-taxMetrics.net:0;
  const taxSource=storePrice?'del precio en tienda':'del sugerido';
  const searchable=`${displayName} ${typeLabel} ${variantSummary(variants)} ${minimum} ${money(minimum)} ${suggested} ${money(suggested)} ${storePrice} ${money(storePrice)} ${entry.personalizationBase||''} ${personalizationLabel} ${vat}% ${taxIncluded} ${money(taxIncluded)} ${state.label}`;
  return `<tr data-price-row="${safe(product.id)}" data-price-searchable="${safe(searchable.toLowerCase())}" data-price-state="${state.filter}" data-price-missing-base="${product.kind==='garment'&&entry.personalizationBase===null}"><td><strong>${safe(displayName)}</strong><small>${safe(typeLabel)} · ${safe(priceCreatesVariants(product)&&!variants.length?'Las variantes se crean al publicar':variantSummary(variants))}</small></td><td>${minimum?money(minimum):'—'}</td><td>${suggested?money(suggested):'—'}</td><td>${storePrice?money(storePrice):'—'}</td><td class="price-personalization-cell"><strong>${product.kind==='garment'?personalizationLabel:'No aplica'}</strong><small>${product.kind==='garment'?(entry.personalizationBase===null?'Usa catálogo como respaldo':'Base para pedidos personalizados'):'Este producto no admite personalización'}</small></td><td><strong>${taxBasis?money(taxIncluded):'—'}</strong><small>${taxBasis?`Incluido · ${vat}% · ${taxSource}`:'Sin precio'}</small></td><td><span class="status-pill ${state.filter==='published'?'is-active':'is-hidden'}">${safe(state.label)}</span></td><td>${variants.length||priceCreatesVariants(product)?`<button type="button" class="admin-secondary" data-price-edit="${product.id}" aria-label="${confirmed!==null?'Editar precios de':'Publicar precios de'} ${safe(displayName)}">${confirmed!==null?'Editar':'Publicar'}</button>`:'<a class="admin-secondary" href="#insumos">Revisar receta</a>'}</td></tr>`;
 }
 const categoryRows=category=>prepared.filter(entry=>String(entry.product.category_id)===String(category.id)).map(row).join('')
 const grouped=roots.map(parent=>children.filter(child=>String(child.parent_category_id)===String(parent.id)).map(child=>{const rows=categoryRows(child);return rows?`<tr class="supplier-subcategory-row" data-price-subcategory="${child.id}"><th colspan="8">${safe(parent.name)} <span aria-hidden="true">/</span> ${safe(child.name)}</th></tr>${rows}`:''}).join('')).join('')
 const nestedIds=new Set(children.map(category=>String(category.id))),ungrouped=prepared.filter(entry=>!nestedIds.has(String(entry.product.category_id))).map(row).join('')
 const missingBase=prepared.filter(entry=>entry.product.kind==='garment'&&entry.personalizationBase===null).length;
 const content=`<div class="admin-prices-page">${pageHeading('VENTAS','Precios.','Define tus precios de catálogo y personalización. Todos los valores incluyen IVA.',`<a class="admin-secondary" href="#insumos">Ver insumos y recetas <span aria-hidden="true">↗</span></a>`)}
 ${priceServicesMarkup()}
 <section id="price-products" class="admin-panel supplier-compact-panel price-products-panel" aria-labelledby="price-products-title">
 ${priceTableToolsMarkup({total:prepared.length,review:reviewCount,published:publishedCount,missingBase})}
 ${prepared.length?`<div class="admin-table-wrap" role="region" aria-label="Precios de productos, tabla desplazable" tabindex="0"><table class="admin-table supplier-compact-table price-publication-table"><thead><tr><th scope="col">Producto</th><th scope="col">Mínimo con IVA</th><th scope="col">Sugerido</th><th scope="col">Catálogo</th><th scope="col">Base personalizada</th><th scope="col">IVA incluido</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>${grouped}${ungrouped}</tbody></table></div><div class="supplier-search-empty" data-price-search-empty hidden><strong>No hay productos en esta vista.</strong><span>Prueba otra búsqueda o quita los filtros para ver todos los productos.</span><br><button type="button" class="price-reset" data-price-empty-reset>Limpiar filtros</button></div>`:'<div class="admin-empty"><strong>Aún no hay productos para publicar.</strong><p>Crea un insumo principal y completa su receta para definir su precio.</p><a class="admin-secondary" href="#insumos">Ir a insumos y recetas</a></div>'}${priceGuideMarkup()}</section></div><dialog class="admin-dialog" id="price-edit-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">PRECIO DE VENTA</span><h2 data-price-title>Editar precios</h2><p data-price-description></p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-price-edit-grid"><label class="admin-price-input"><span>Precio de catálogo</span><strong>IVA incluido</strong><input name="price" type="number" min="1" step="10" required><small>Se usa para diseños listos y compra de catálogo.</small></label><label class="admin-price-input" data-personalization-base-field><span>Base de personalización</span><strong>IVA incluido</strong><input name="personalization_base_price" type="number" min="1" step="10" placeholder="Sin definir"><small>Se usa para poleras, tote bags y bodys con diseño del cliente. El DTF/estampado se suma aparte.</small></label><div class="admin-price-profit" aria-live="polite"><span>Margen del precio de catálogo</span><strong data-price-gain>—</strong><small data-price-gain-detail>—</small></div></div><button type="button" class="admin-secondary" data-price-use-suggested>Aplicar sugerido al catálogo</button><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar precios</button></div><p class="admin-form-status" role="alert"></p></form></dialog><dialog class="admin-dialog" id="price-variant-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">VARIANTES PUBLICADAS</span><h2 data-price-variant-title>Vincular variantes</h2><p>Selecciona las variantes que deben recibir este mismo precio. Puedes marcar todos los colores de una talla.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><fieldset class="price-variant-list" data-price-variant-options><legend>Variantes en tienda</legend></fieldset><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar variantes</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`
 shell(content,'precios');
 root.querySelectorAll('[data-price-link]').forEach(button=>button.remove());
 wireReviewPrice();wirePrintPrices();wirePriceTable(prepared,children)
 root.querySelector('#price-variant-dialog')?.remove();
}
function wireReviewPrice(){
 const keys=['quality_review_fee_clp'];
 wirePriceSettingForm(root.querySelector('#admin-review-price-form'),{
  keys,
  read:()=>supabase.from('storefront_settings').select(keys.join(',')).eq('id',true).single(),
  write:values=>supabase.from('storefront_settings').update({...values,updated_at:new Date().toISOString()}).eq('id',true).select(keys.join(',')).single(),
  publishedLabel:values=>`Publicado: ${money(values.quality_review_fee_clp)} por producto.`,
 });
}
function wirePrintPrices(){
 const keys=['front_large_clp','front_pocket_clp','back_large_clp','arm_clp'];
 wirePriceSettingForm(root.querySelector('#admin-print-prices-form'),{
  keys,
  read:()=>supabase.from('storefront_settings').select(keys.join(',')).eq('id',true).single(),
  write:values=>supabase.from('storefront_settings').update({...values,updated_at:new Date().toISOString()}).eq('id',true).select(keys.join(',')).single(),
  publishedLabel:()=> 'Precios publicados.',
 });
}
function wirePriceTable(prepared,children){
 root.querySelector('#price-edit-dialog input[name="price"]')?.setAttribute('min','0');
 wirePriceFilters(root,prepared,children);
 const dialog=root.querySelector('#price-edit-dialog'),form=dialog.querySelector('form'),input=form.elements.price,personalizationInput=form.elements.personalization_base_price,status=form.querySelector('.admin-form-status'),variantDialog=root.querySelector('#price-variant-dialog'),variantForm=variantDialog?.querySelector('form'),variantOptions=variantForm?.querySelector('[data-price-variant-options]'),variantStatus=variantForm?.querySelector('.admin-form-status');let active=null,variantActive=null
 const refresh=()=>{if(!active)return;const metrics=priceMetrics(active.product,active.calculation,input.value),label=`${metrics.gain>=0?'+':''}${money(metrics.gain)} · ${metrics.percentage.toFixed(1)}%`;form.querySelector('[data-price-gain]').textContent=label;form.querySelector('[data-price-gain-detail]').textContent=`IVA incluido: ${money(metrics.finalPrice-metrics.net)} · margen calculado sobre costo neto`}
 root.querySelectorAll('[data-price-edit]').forEach(button=>button.onclick=()=>{active=prepared.find(entry=>String(entry.product.id)===String(button.dataset.priceEdit));if(!active)return;const initial=active.confirmed??(active.published||active.suggested);status.textContent='';form.querySelector('[data-price-title]').textContent=supplierProductDisplayName(active.product);form.querySelector('[data-price-description]').textContent=`${variantSummary(active.variants)} · sugerido con IVA: ${money(active.suggested)} · IVA: ${Number(active.product.vat_percent??19)}%.`;input.value=initial;refresh();dialog.showModal();input.focus();input.select()})
 root.querySelectorAll('[data-price-link]').forEach(button=>button.onclick=()=>{variantActive=prepared.find(entry=>String(entry.product.id)===String(button.dataset.priceLink));if(!variantActive)return;const selected=new Set(variantActive.variants.map(variant=>String(variant.id))),variants=(adminData.variants||[]).filter(variant=>variant.active).sort((a,b)=>variantLabel(a).localeCompare(variantLabel(b),'es-CL'));variantStatus.textContent='';variantForm.querySelector('[data-price-variant-title]').textContent=`Variantes de ${supplierProductDisplayName(variantActive.product)}`;variantOptions.innerHTML=variants.length?variants.map(variant=>`<label><input type="checkbox" name="variant" value="${safe(variant.id)}" ${selected.has(String(variant.id))?'checked':''}><span><strong>${safe(variantLabel(variant))}</strong><small>${safe(variant.sku)}</small></span></label>`).join(''):'<p>No hay variantes publicadas disponibles.</p>';variantDialog.showModal();variantOptions.querySelector('input')?.focus()})
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();input.oninput=refresh;form.querySelector('[data-price-use-suggested]').onclick=()=>{if(!active)return;input.value=active.suggested;refresh();input.focus()}
 root.querySelectorAll('[data-price-link]').forEach(button=>button.onclick=()=>{
  variantActive=prepared.find(entry=>String(entry.product.id)===String(button.dataset.priceLink));
  if(!variantActive)return;
  const selected=new Set(variantActive.variants.map(variant=>String(variant.id))),variants=compatibleVariants(variantActive.product).sort((a,b)=>variantLabel(a).localeCompare(variantLabel(b),'es-CL'));
  variantStatus.textContent='';
  variantForm.querySelector('[data-price-variant-title]').textContent=`Variantes que reciben el precio de ${supplierProductDisplayName(variantActive.product)}`;
  variantDialog.querySelector('.dialog-title p').textContent='Marca las variantes del mismo tipo de prenda. Al guardar, este precio se aplicará solo a las que marques.';
  variantOptions.innerHTML=variants.length?variants.map(variant=>`<label><input type="checkbox" name="variant" value="${safe(variant.id)}" ${selected.has(String(variant.id))?'checked':''}><span><strong>${safe(variantLabel(variant))}</strong><small>${safe(variant.sku)}</small></span></label>`).join(''):'<p>No hay variantes compatibles publicadas todavía.</p>';
  variantForm.querySelector('[type="submit"]').disabled=!variants.length;
  variantDialog.showModal();
  variantOptions.querySelector('input')?.focus();
 })
 if(variantDialog){variantDialog.querySelector('.dialog-close').onclick=()=>variantDialog.close();variantDialog.querySelector('.dialog-cancel').onclick=()=>variantDialog.close()}
 root.querySelectorAll('[data-price-edit]').forEach(button=>button.onclick=()=>{
  active=prepared.find(entry=>String(entry.product.id)===String(button.dataset.priceEdit));
  if(!active)return;
  const initial=active.confirmed??(active.published||active.suggested),target=active.variants[0];
  status.textContent='';
  form.querySelector('[data-price-title]').textContent=supplierProductDisplayName(active.product);
  form.querySelector('[data-price-description]').textContent=totePriceCreatesVariants(active.product)?'Al publicar, esta talla de Tote Bag estará disponible en todos sus colores habilitados. El cliente elegirá el color al comprar.':target?`Al guardar, este valor se aplicará automáticamente a las ${active.variants.length} variantes de esta talla.`:bodyPriceCreatesVariants(active.product)?'Al publicar, se crearán los colores activos de esta talla de Body.':priceCreatesVariants(active.product)?'Al publicar, se crearán o reactivarán los colores de esta talla y quedarán vinculados automáticamente.':'No encontramos una talla publicada que corresponda a este insumo.';
  input.value=initial;
  personalizationInput.value=active.product.kind==='garment'&&active.personalizationBase!==null?active.personalizationBase:'';
  form.querySelector('[data-personalization-base-field]').hidden=active.product.kind!=='garment';
  personalizationInput.disabled=active.product.kind!=='garment';
  refresh();
  dialog.showModal();
  input.focus();
  input.select();
 })
 if(variantForm)variantForm.onsubmit=async event=>{event.preventDefault();if(!variantActive)return;const button=event.submitter,ids=[...new FormData(variantForm).getAll('variant')].map(String);button.disabled=true;button.textContent='Guardando…';variantStatus.textContent='';const {error:deleteError}=await supabase.from('supplier_product_variants').delete().eq('supplier_product_id',variantActive.product.id);if(deleteError){button.disabled=false;button.textContent='Guardar variantes';variantStatus.textContent=deleteError.message;return}if(ids.length){const {error:insertError}=await supabase.from('supplier_product_variants').insert(ids.map(product_variant_id=>({supplier_product_id:variantActive.product.id,product_variant_id})));if(insertError){button.disabled=false;button.textContent='Guardar variantes';variantStatus.textContent=insertError.message;return}}variantDialog.close();await refreshData(`Variantes vinculadas para ${variantActive.product.name}.`)}
 form.onsubmit=async event=>{event.preventDefault();if(!active)return;const price=Math.round(Number(input.value)),personalizationValue=personalizationInput.disabled||String(personalizationInput.value).trim()===''?null:Math.round(Number(personalizationInput.value)),button=event.submitter;if(!Number.isFinite(price)||price<=0){status.textContent='Ingresa un precio de catálogo mayor que cero.';input.focus();return}if(personalizationValue!==null&&(!Number.isFinite(personalizationValue)||personalizationValue<=0)){status.textContent='La base de personalización debe ser mayor que cero o quedar vacía.';personalizationInput.focus();return}button.disabled=true;button.textContent='Guardando…';const {error}=await supabase.rpc('publish_supplier_product_price',{p_supplier_product_id:active.product.id,p_price_clp:price,p_personalization_base_price_clp:personalizationValue});if(error){button.disabled=false;button.textContent='Guardar precios';status.textContent=error.message;return}dialog.close();await refreshData(`Precios guardados para ${active.product.name}.`)}
}
function legacyPricesView(){
 const products=(adminData.supplierProducts||[]).filter(item=>['garment','acrylic','magnet'].includes(item.kind));
 const prepared=products.map(product=>{const calculation=supplierProductCalculation(product),variants=supplierProductVariants(product),suggested=calculation.suggested,confirmed=product.confirmed_price_clp??null,published=variants.length?Math.min(...variants.map(variant=>Number(variant.price_clp)||0))||0:0;return {product,calculation,variants,suggested,confirmed,published}});
 const reviewCount=prepared.filter(item=>item.confirmed===null).length,publishedCount=prepared.filter(item=>item.confirmed!==null).length;
 const rows=prepared.map(({product,calculation,variants,suggested,confirmed,published})=>{
  const initial=confirmed??(published||suggested),metrics=priceMetrics(product,calculation,initial),state=priceWorkflowState({variants,confirmed,published}),displayName=supplierProductDisplayName(product),typeLabel=supplierProductTypeLabel(product),variantText=variants.length?`${variants.length} ${variants.length===1?'variante disponible':'variantes disponibles'}`:'Sin variantes vinculadas';
  const priceLabel=published?money(published):'—',gainLabel=`${metrics.gain>=0?'+':''}${money(metrics.gain)} · ${metrics.percentage.toFixed(1)}%`;
  return `<details class="admin-price-card${variants.length?'':' is-unlinked'}" data-price-row="${safe(product.id)}" data-price-state="${state.filter}"><summary class="admin-price-summary"><div class="admin-price-product"><span class="admin-eyebrow">${safe(typeLabel)}${product.model_code?` · ${safe(product.model_code)}`:''}</span><h2>${safe(displayName)}</h2><p>${safe(variantText)}</p></div><div class="admin-price-summary-values"><span><small>Costo receta</small><strong>${money(calculation.base)}</strong></span><span><small>Sugerido</small><strong>${money(suggested)}</strong></span><span><small>En tienda</small><strong>${priceLabel}</strong></span><span class="is-gain"><small>Margen actual</small><strong data-price-gain-summary>${gainLabel}</strong></span></div><div class="admin-price-status"><span class="status-pill ${state.filter==='published'?'is-active':'is-hidden'}" data-price-status>${state.label}</span><small>${state.detail}</small></div><span class="admin-price-row-action">${state.action}<i aria-hidden="true">›</i></span><span class="admin-price-chevron" aria-hidden="true">⌄</span></summary><div class="admin-price-details"><div class="admin-price-detail-head"><div><span class="admin-eyebrow">DECISIÓN DE PRECIO</span><h3>${safe(displayName)}</h3><p>El precio sugerido considera ${Number(product.margin_percent)||0}% de margen e IVA ${Number(product.vat_percent)||19}%.</p></div><button type="button" class="admin-secondary" data-use-suggested>Aplicar sugerido ${money(suggested)}</button></div><div class="admin-price-edit-grid"><label class="admin-price-input"><span>Precio a publicar</span><strong>IVA incluido</strong><input data-price-value aria-label="Precio a publicar para ${safe(displayName)}" type="number" min="1" step="10" value="${initial}"></label><div class="admin-price-profit" aria-live="polite"><span>Margen con este precio</span><strong data-price-gain>${gainLabel}</strong><small data-price-gain-detail>Neto ${money(metrics.net)} − costo receta ${money(calculation.base)}</small></div></div>${variants.length?'':`<div class="admin-price-blocker" role="status"><span><strong>Primero vincula una variante</strong><small>Este precio se puede preparar, pero no aparecerá en la tienda hasta conectar este producto.</small></span><a href="#productos">Ir a productos →</a></div>`}<div class="admin-price-actions"><button type="button" class="admin-primary" data-confirm-price ${variants.length?'':'disabled'}>${variants.length?'Guardar y publicar':'Faltan variantes'}</button></div><p class="admin-form-status" data-price-status-message role="alert"></p></div></details>`;
 }).join('');
 const content=`${pageHeading('VENTAS','Precios.','Revisa lo que está en tienda y define los precios que faltan publicar.',`<a class="admin-secondary" href="#insumos">Ver insumos y recetas</a>`)}<section class="admin-price-toolbar" aria-label="Filtros de precios"><div><strong>${prepared.length} ${prepared.length===1?'producto':'productos'}</strong><span>${reviewCount} por revisar · ${publishedCount} publicados</span></div><div class="admin-price-filters" role="group" aria-label="Filtrar precios"><button type="button" class="is-active" data-price-filter="all" aria-pressed="true">Todos <b>${prepared.length}</b></button><button type="button" data-price-filter="review" aria-pressed="false">Por revisar <b>${reviewCount}</b></button><button type="button" data-price-filter="published" aria-pressed="false">Publicados <b>${publishedCount}</b></button></div></section><section class="admin-price-list">${rows||'<section class="admin-panel admin-empty"><strong>No hay insumos principales listos.</strong><p>Primero crea un principal en Insumos y completa su receta.</p></section>'}<p class="admin-price-filter-empty" data-price-filter-empty hidden>No hay productos en este filtro.</p></section>`;
 shell(content,'precios');wirePrices();
}
function wirePrices(){
 root.querySelectorAll('[data-price-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.priceFilter;root.querySelectorAll('[data-price-filter]').forEach(control=>{const active=control===button;control.classList.toggle('is-active',active);control.setAttribute('aria-pressed',String(active))});let visible=0;root.querySelectorAll('[data-price-row]').forEach(row=>{const matches=filter==='all'||row.dataset.priceState===filter;row.hidden=!matches;if(matches)visible+=1});const empty=root.querySelector('[data-price-filter-empty]');if(empty)empty.hidden=Boolean(visible)}));
 root.querySelectorAll('[data-price-row]').forEach(row=>{const product=adminData.supplierProducts.find(item=>String(item.id)===row.dataset.priceRow),calculation=product&&supplierProductCalculation(product),input=row.querySelector('[data-price-value]'),gain=row.querySelector('[data-price-gain]'),summaryGain=row.querySelector('[data-price-gain-summary]'),detail=row.querySelector('[data-price-gain-detail]'),message=row.querySelector('[data-price-status-message]'),refresh=()=>{const metrics=priceMetrics(product,calculation,input.value),value=`${metrics.gain>=0?'+':''}${money(metrics.gain)} · ${metrics.percentage.toFixed(1)}%`;gain.textContent=value;if(summaryGain)summaryGain.textContent=value;gain.dataset.negative=metrics.gain<0?'true':'false';if(summaryGain)summaryGain.dataset.negative=metrics.gain<0?'true':'false';detail.textContent=`Neto ${money(metrics.net)} − costo receta ${money(calculation.base)}`};input.addEventListener('input',refresh);row.querySelector('[data-use-suggested]').onclick=()=>{input.value=calculation.suggested;refresh();input.focus()};row.querySelector('[data-confirm-price]').onclick=async event=>{const button=event.currentTarget,price=Math.round(Number(input.value));message.textContent='';if(!Number.isFinite(price)||price<=0){message.textContent='Ingresa un precio mayor que cero.';return}button.disabled=true;button.textContent='Publicando…';const now=new Date().toISOString(),{error}=await supabase.from('supplier_products').update({confirmed_price_clp:price,price_confirmed_at:now,price_confirmed_by:sessionUser?.id||null,updated_at:now}).eq('id',product.id);if(error){button.disabled=false;button.textContent='Guardar y publicar';message.textContent=error.message;return}const variants=supplierProductVariants(product);for(const variant of variants){const result=await supabase.from('product_variants').update({price_clp:price,updated_at:now}).eq('id',variant.id);if(result.error){button.disabled=false;button.textContent='Guardar y publicar';message.textContent=`El precio quedó guardado, pero no pudimos actualizar la variante ${variant.sku}.`;return}}await refreshData(`Precio publicado para ${product.name}.`) };refresh()});
}

function couponLabel(coupon){return coupon.kind==='percent'?`${coupon.value}%`:`${money(coupon.value)}`}
function couponsView(){const rows=adminData.coupons.map(coupon=>`<tr data-admin-searchable="${safe(`${coupon.code} ${coupon.description||''}`.toLowerCase())}"><td><strong>${safe(coupon.code)}</strong><small>${safe(coupon.description||'Sin descripción')}</small></td><td>${couponLabel(coupon)}</td><td>${money(coupon.min_subtotal_clp)}</td><td>${coupon.used_count}${coupon.max_uses?` / ${coupon.max_uses}`:''}</td><td><span class="status-pill ${coupon.active?'is-active':'is-hidden'}">${coupon.active?'Activo':'Pausado'}</span></td><td><button type="button" class="admin-secondary" data-toggle-coupon="${coupon.id}">${coupon.active?'Pausar':'Activar'}</button></td></tr>`).join('');const action=`<button class="admin-primary" type="button" id="new-coupon">${icon('plus')} Nuevo cupón</button>`;const content=`${pageHeading('VENTAS','Cupones.','Crea descuentos con vigencia, compra mínima y límite de usos.',action)}<section class="admin-panel admin-list-panel" aria-label="Cupones">${rows?`${listSearch('Buscar cupón','Código o descripción')}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Código</th><th>Descuento</th><th>Compra mínima</th><th>Usos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div>${searchEmpty}`:'<p class="admin-empty">Aún no hay cupones.</p>'}</section><dialog class="admin-dialog" id="coupon-dialog"><form id="coupon-form"><div class="dialog-title"><div><span class="admin-eyebrow">DESCUENTO</span><h2>Nuevo cupón</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><label>Código<input name="code" required minlength="3" maxlength="32" placeholder="BIENVENIDA10"></label><label>Descripción<input name="description" maxlength="100"></label><div class="admin-form-grid"><label>Tipo<select name="kind"><option value="percent">Porcentaje</option><option value="fixed">Monto fijo</option></select></label><label>Valor<input name="value" type="number" min="1" required></label><label>Compra mínima<input name="min_subtotal_clp" type="number" min="0" value="0"></label><label>Máximo de usos<input name="max_uses" type="number" min="1" placeholder="Sin límite"></label><label>Inicio<input name="starts_at" type="datetime-local"></label><label>Fin<input name="ends_at" type="datetime-local"></label></div><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Crear cupón</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;shell(content,'cupones');wireCoupons();filterCurrentView('')}
function wireCoupons(){const dialog=root.querySelector('#coupon-dialog'),form=root.querySelector('#coupon-form');root.querySelector('#new-coupon').onclick=()=>{unmountAdminFormDisclosure(form);dialog.showModal();mountCouponDisclosure(form)};dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.querySelector('.dialog-cancel').onclick=()=>dialog.close();root.querySelectorAll('[data-toggle-coupon]').forEach(button=>button.onclick=async()=>{const coupon=adminData.coupons.find(item=>String(item.id)===button.dataset.toggleCoupon);const {error}=await supabase.from('coupons').update({active:!coupon.active,updated_at:new Date().toISOString()}).eq('id',coupon.id);if(error)return toast(error.message);await refreshData('Cupón actualizado.')});form.onsubmit=async event=>{event.preventDefault();const data=adminFormData(form),button=event.submitter||form.querySelector('[type="submit"]'),payload={code:String(data.get('code')).trim().toUpperCase().replace(/\s+/g,'-'),description:String(data.get('description')).trim()||null,kind:String(data.get('kind')),value:Number(data.get('value')),min_subtotal_clp:Number(data.get('min_subtotal_clp')||0),max_uses:data.get('max_uses')?Number(data.get('max_uses')):null,starts_at:data.get('starts_at')?new Date(String(data.get('starts_at'))).toISOString():null,ends_at:data.get('ends_at')?new Date(String(data.get('ends_at'))).toISOString():null,active:true};button.disabled=true;const {error}=await supabase.from('coupons').insert(payload);if(error){button.disabled=false;form.querySelector('.admin-form-status').textContent=error.code==='23505'?'Ese código ya existe.':error.message;return}dialog.close();await refreshData('Cupón creado.')}}
function readThemePreference(){try{return localStorage.getItem(THEME_STORAGE_KEY)==='light'?'light':'dark'}catch{return'dark'}}
function readAdminThemePreference(){try{return localStorage.getItem(ADMIN_THEME_STORAGE_KEY)==='dark'?'dark':'light'}catch{return'light'}}
function wireThemePreference(){
 const preferences=[
  {id:'admin-storefront-theme-dark',key:THEME_STORAGE_KEY,theme:readThemePreference(),status:'admin-storefront-theme-status',message:'La tienda pública usará modo'},
  {id:'admin-panel-theme-dark',key:ADMIN_THEME_STORAGE_KEY,theme:readAdminThemePreference(),status:'admin-panel-theme-status',message:'Administración usa modo'}
 ];
 for(const preference of preferences){
  const control=root.querySelector(`#${preference.id}`),status=root.querySelector(`#${preference.status}`);
  if(!control)continue;
  const state=control.closest('.admin-theme-setting')?.querySelector('small');
  control.checked=preference.theme==='dark';
  control.onchange=()=>{
   const theme=control.checked?'dark':'light';
   try{localStorage.setItem(preference.key,theme)}catch{}
   if(preference.key===ADMIN_THEME_STORAGE_KEY)document.documentElement.classList.toggle('admin-theme-dark',theme==='dark');
   if(state)state.textContent=theme==='dark'?'Activo':'Inactivo';
   if(status)status.textContent=`${preference.message} ${theme==='dark'?'oscuro':'claro'}.`;
  };
 }
}
function wireEmailPreview(){const disclosure=root.querySelector('#admin-email-preview');if(!disclosure)return;disclosure.addEventListener('toggle',()=>{if(!disclosure.open||disclosure.dataset.loaded==='true')return;const slot=disclosure.querySelector('.admin-email-preview-slot');slot.innerHTML='<iframe class="admin-email-preview-frame" src="/email-preview.html" title="Vista previa de plantillas de email"></iframe>';disclosure.dataset.loaded='true'})}
function emailTemplatesView(){
 const theme=readThemePreference();
 const content=`${pageHeading('CONFIGURACIÓN','Configuración de la tienda.','Administra lo que ven tus clientes y revisa las comunicaciones del pedido.')}<section class="admin-panel admin-settings-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">CONTACTO Y AVISOS</span><h2>Información pública</h2><p>Estos cambios aparecen en la tienda y en las páginas del catálogo al volver a cargarlas.</p></div></div><form id="admin-store-settings" class="admin-settings-form" aria-busy="true"><fieldset disabled><div class="admin-settings-grid"><label>WhatsApp de contacto <small>Con código de país. Ejemplo: 56912345678.</small><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required value="${defaultStoreSettings.whatsapp_number}"></label><label>Correo de contacto <small>Opcional; aparecerá en el pie de página.</small><input name="support_email" type="email" autocomplete="email" placeholder="hola@droska.cl"></label></div><label class="admin-settings-check"><input name="announcement_enabled" type="checkbox" checked> Mostrar aviso superior</label><label>Texto del aviso <input name="announcement_text" type="text" maxlength="100" required value="${safe(defaultStoreSettings.announcement_text)}"></label><div class="admin-settings-actions"><button class="admin-primary" type="submit">Guardar cambios</button><span class="admin-settings-unsaved" id="admin-settings-unsaved" hidden>Hay cambios sin guardar</span></div></fieldset><p id="admin-settings-status" class="admin-form-status" role="status" aria-live="polite">Cargando configuración…</p><button id="admin-settings-retry" class="admin-secondary" type="button" hidden>Reintentar</button></form></section><section class="admin-panel admin-theme-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">APARIENCIA</span><h2>Modo de color en este navegador</h2><p>La preferencia es local. Se aplica al abrir la tienda pública desde este dispositivo.</p></div><label class="admin-theme-setting"><span><strong>Modo oscuro</strong><small>${theme==='dark'?'Activo':'Inactivo'}</small></span><input id="admin-theme-dark" type="checkbox" ${theme==='dark'?'checked':''} aria-label="Activar modo oscuro en este navegador"><i aria-hidden="true"></i></label></div><p id="admin-theme-status" class="admin-form-status" role="status" aria-live="polite"></p></section><section class="admin-panel admin-settings-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">OPERACIÓN</span><h2>Gestionar ventas</h2><p>Los precios, cupones y pedidos tienen sus propios controles y permisos.</p></div></div><nav class="admin-settings-links" aria-label="Configuración de ventas"><a class="admin-secondary" href="#precios">Precios</a><a class="admin-secondary" href="#cupones">Cupones</a><a class="admin-secondary" href="#pedidos">Pedidos y pagos</a></nav></section><section class="admin-panel admin-settings-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">COMUNICACIONES INTERNAS</span><h2>Avisos de pedidos</h2><p>El equipo recibe avisos de nuevos pedidos. El envío requiere Resend configurado en el servidor.</p></div></div><form id="admin-notification-settings" class="admin-settings-form" aria-busy="true"><fieldset disabled><label class="admin-settings-check"><input name="enabled" type="checkbox" checked> Enviar avisos internos</label><label>Correo destinatario <small>Si queda vacío, se usa el correo definido en el servidor.</small><input name="recipient_email" type="email" autocomplete="email" placeholder="equipo@droska.cl"></label><div class="admin-settings-actions"><button class="admin-primary" type="submit">Guardar avisos</button></div></fieldset><p class="admin-form-status" role="status" aria-live="polite">Cargando avisos…</p><button class="admin-secondary" type="button" data-notification-retry hidden>Reintentar</button></form></section><section class="admin-panel admin-email-preview-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">COMUNICACIONES</span><h2>Plantillas de email</h2><p>Vista de revisión. El envío automático depende de la configuración segura del servidor.</p></div><a class="admin-secondary" href="/email-preview.html" target="_blank" rel="noreferrer">Abrir aparte ↗</a></div><details class="admin-email-disclosure" id="admin-email-preview"><summary><span><strong>Vista temporal de plantillas</strong><small>Revísala solo cuando la necesites.</small></span><b>Ver plantillas <i aria-hidden="true">↓</i></b></summary><div class="admin-email-preview-slot"></div></details></section>`;
 shell(content,'configuracion');wireThemePreference();wireEmailPreview();wireStoreSettings();wireAdminNotifications();
}
function settingsView(){
 const theme=readThemePreference();
 const adminTheme=readAdminThemePreference();
 const viewStore=`<a class="admin-secondary" href="/" target="_blank" rel="noreferrer">Ver tienda ↗</a>`;
 const content=`${pageHeading('CONFIGURACIÓN','Configuración.','Edita solo lo que necesitas y guarda cada grupo con claridad.',viewStore)}<nav class="admin-config-nav" aria-label="Secciones de configuración"><a href="#config-store">Tienda pública</a><a href="#config-appearance">Apariencia</a><a href="#config-team">Equipo</a><a href="#config-system">Sistema</a></nav><div class="admin-config-layout"><section id="config-store" class="admin-panel admin-settings-panel admin-settings-panel--public"><div class="admin-panel-head"><div><span class="admin-eyebrow">TIENDA PÚBLICA</span><h2>Lo que ven y usan tus clientes</h2><p>Contacto, compra, portada y avisos. Abre únicamente la sección que quieras cambiar.</p></div><span class="admin-config-tag">Publicado</span></div><form id="admin-store-settings" class="admin-settings-form" aria-busy="true"><fieldset disabled><div class="admin-settings-grid"><label>WhatsApp de contacto <small>Incluye 56 y los nueve dígitos.</small><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" required value="${defaultStoreSettings.whatsapp_number}"></label><label>Correo de contacto <small>Opcional; aparece en el pie de página.</small><input name="support_email" type="email" autocomplete="email" placeholder="hola@droska.cl"></label></div><div class="admin-setting-option"><label class="admin-settings-check"><input name="announcement_enabled" type="checkbox" checked> Mostrar aviso superior</label><small>Una frase breve que acompaña la parte superior de la tienda.</small></div><label>Texto del aviso <input name="announcement_text" type="text" maxlength="100" required value="${safe(defaultStoreSettings.announcement_text)}"></label><div class="admin-settings-actions"><button class="admin-primary" type="submit">Guardar cambios</button><span class="admin-settings-unsaved" id="admin-settings-unsaved" hidden>Hay cambios sin guardar</span></div></fieldset><p id="admin-settings-status" class="admin-form-status" role="status" aria-live="polite">Cargando configuración…</p><button id="admin-settings-retry" class="admin-secondary" type="button" hidden>Reintentar</button></form></section><section id="config-appearance" class="admin-panel admin-theme-panel admin-settings-panel--appearance"><div class="admin-panel-head"><div><span class="admin-eyebrow">APARIENCIA</span><h2>Modo de color</h2><p>Estas preferencias se guardan solo en este navegador.</p></div></div><div class="admin-theme-options"><div class="admin-theme-preference"><div><strong>Tienda pública</strong><p>Se aplica al abrir o recargar la tienda.</p></div><label class="admin-theme-setting"><span><strong>Oscuro</strong><small>${theme==='dark'?'Activo':'Inactivo'}</small></span><input id="admin-storefront-theme-dark" type="checkbox" ${theme==='dark'?'checked':''} aria-label="Modo oscuro de la tienda pública"><i aria-hidden="true"></i></label><p id="admin-storefront-theme-status" class="admin-form-status" role="status" aria-live="polite"></p></div><div class="admin-theme-preference"><div><strong>Administración</strong><p>Cambia este panel al instante.</p></div><label class="admin-theme-setting"><span><strong>Oscuro</strong><small>${adminTheme==='dark'?'Activo':'Inactivo'}</small></span><input id="admin-panel-theme-dark" type="checkbox" ${adminTheme==='dark'?'checked':''} aria-label="Modo oscuro de Administración"><i aria-hidden="true"></i></label><p id="admin-panel-theme-status" class="admin-form-status" role="status" aria-live="polite"></p></div></div></section></div><section id="config-system" class="admin-panel admin-settings-panel admin-settings-panel--seo"><div class="admin-panel-head"><div><span class="admin-eyebrow">SISTEMA</span><h2>Catálogo SEO</h2><p>Regenera las fichas, URLs y sitemap del catálogo publicado.</p></div><span class="admin-config-tag">Manual</span></div><div class="admin-settings-actions"><button id="admin-rebuild-catalog" class="admin-secondary" type="button">Regenerar páginas SEO</button></div><p id="admin-rebuild-catalog-status" class="admin-form-status" role="status" aria-live="polite">Sin regeneraciones en curso.</p></section><section id="config-team" class="admin-panel admin-settings-panel admin-settings-panel--notifications"><div class="admin-panel-head"><div><span class="admin-eyebrow">EQUIPO</span><h2>Avisos de pedidos</h2><p>Recibe un correo cuando entre un pedido nuevo.</p></div><span class="admin-config-tag">Interno</span></div><form id="admin-notification-settings" class="admin-settings-form admin-notification-form" aria-busy="true"><fieldset disabled><div class="admin-notification-row"><div><label class="admin-settings-check"><input name="enabled" type="checkbox" checked> Enviar avisos internos</label><small>Requiere el remitente de Resend configurado en el servidor.</small></div><label>Destinatario <input name="recipient_email" type="email" autocomplete="email" placeholder="equipo@droska.cl"><small>Vacío: se usa el correo del servidor.</small></label></div><div class="admin-settings-actions"><button class="admin-primary" type="submit">Guardar avisos</button><span class="admin-settings-unsaved" data-notification-unsaved hidden>Hay cambios sin guardar</span></div></fieldset><p class="admin-form-status" role="status" aria-live="polite">Cargando avisos…</p><button class="admin-secondary" type="button" data-notification-retry hidden>Reintentar</button></form></section><section class="admin-panel admin-settings-panel admin-settings-panel--operations"><div class="admin-panel-head"><div><span class="admin-eyebrow">VENTAS</span><h2>Accesos operativos</h2><p>Las tareas frecuentes viven en su propia vista.</p></div></div><nav class="admin-config-actions" aria-label="Configuración de ventas"><a href="#precios"><strong>Precios</strong><span>Publica valores y revisa márgenes.</span><i aria-hidden="true">→</i></a><a href="#cupones"><strong>Cupones</strong><span>Crea y pausa descuentos.</span><i aria-hidden="true">→</i></a><a href="#pedidos"><strong>Pedidos y pagos</strong><span>Revisa cobros y producción.</span><i aria-hidden="true">→</i></a></nav></section><section class="admin-panel admin-email-preview-panel"><div class="admin-panel-head"><div><span class="admin-eyebrow">CLIENTES</span><h2>Plantillas de email</h2><p>Comprueba el mensaje antes de necesitarlo.</p></div><a class="admin-secondary" href="/email-preview.html" target="_blank" rel="noreferrer">Abrir aparte ↗</a></div><details class="admin-email-disclosure" id="admin-email-preview"><summary><span><strong>Vista previa de plantillas</strong><small>Se carga solo al abrirla.</small></span><b>Ver plantillas <i aria-hidden="true">↓</i></b></summary><div class="admin-email-preview-slot"></div></details></section>`;
 shell(content,'configuracion');wireThemePreference();wireEmailPreview();wireStoreSettings();wireAdminNotifications();wireCatalogRebuild();
}

function wireStoreSettings(){return bindStoreSettings({root,adminData,supabase,catalogMockupPhoto,collectionName})}
function wireAdminNotifications(){return bindAdminNotifications({root,supabase})}

function plannedView(route){const label=routes.find(([id])=>id===route)?.[2]||'Sección';const content=`${pageHeading('PRÓXIMA ETAPA',`${label}.`,'La estructura ya está preparada. Activaremos esta vista en una siguiente etapa sin mezclarla con el trabajo actual.')}<section class="admin-panel admin-empty"><strong>${label} todavía no está habilitada.</strong><p>Por ahora puedes trabajar en Resumen, Catálogo y Pedidos.</p><a class="admin-secondary" href="#resumen">Volver al resumen</a></section>`;shell(content,route)}
function customerServiceView(){
 renderCustomerService({
  root,shell,pageHeading,supabase,toast,
  localOrders:import.meta.env.DEV?readLocalOrders():[],
  async openOrder(id){
   if(id.startsWith('LOCAL-')){
    const order=readLocalOrders().find(item=>String(item.id)===id);
    if(order&&root.querySelector('#service-panel'))openOrderDetails(order);
    return;
   }
   const {data,error}=await supabase.from('orders').select(ADMIN_ORDER_SELECT).eq('id',id).maybeSingle();
   if(!root.querySelector('#service-panel'))return;
   if(error||!data){toast('No pudimos abrir el pedido. Intenta nuevamente.');return}
   openOrderDetails(data);
  },
  previewEmail:order=>openOrderEmailPreview(order,'survey'),
 });
}
let customerAccounts=[];
async function loadCustomerAccounts(){const {data,error}=await supabase.functions.invoke('admin-customer-accounts',{body:{action:'list'}});if(error||data?.error)throw new Error(data?.error||error?.message||'No pudimos cargar las cuentas.');customerAccounts=data.accounts||[]}
function customersView(){const rows=customerAccounts.filter(account=>account.id!==sessionUser.id).map(account=>`<tr data-admin-searchable="${safe(`${account.email} ${account.full_name} ${account.phone}`.toLowerCase())}"><td><strong>${safe(account.full_name||'Sin nombre')}</strong><small>${safe(account.email)}</small></td><td>${safe(account.phone||'Sin teléfono')}</td><td>${date(account.created_at)}</td><td>${account.last_sign_in_at?date(account.last_sign_in_at):'Nunca'}</td><td><button type="button" class="admin-secondary admin-danger-link" data-delete-account="${safe(account.id)}">Eliminar cuenta</button></td></tr>`).join('');const content=`${pageHeading('CUENTAS','Clientes.','Elimina una cuenta y todos sus datos, incluyendo pedidos, diseños guardados y perfil.')}${rows?`<section class="admin-panel admin-list-panel" aria-label="Clientes">${listSearch('Buscar cliente','Nombre, correo o teléfono')}<div class="admin-table-wrap"><table class="admin-table admin-customers-table"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Registro</th><th>Último acceso</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div>${searchEmpty}</section>`:'<section class="admin-panel admin-empty"><strong>No hay cuentas de clientes.</strong><p>Las cuentas nuevas aparecerán aquí.</p></section>'}<dialog class="admin-dialog admin-confirm-dialog" id="delete-account-dialog"><form method="dialog"><div class="dialog-title"><div><span class="admin-eyebrow">ACCIÓN PERMANENTE</span><h2>Eliminar cuenta</h2></div><button type="button" class="dialog-close" data-delete-account-cancel aria-label="Cerrar">×</button></div><p>Eliminarás <strong data-delete-account-email></strong> y todos sus datos: perfil, pedidos, pagos, carro y archivos guardados. Esta acción no se puede deshacer.</p><input type="hidden" name="user_id"><div class="dialog-actions"><button type="button" class="admin-secondary" data-delete-account-cancel>Cancelar</button><button type="submit" class="admin-danger">Eliminar todo</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;shell(content,'clientes');wireCustomers();filterCurrentView('')}
function wireCustomers(){const dialog=root.querySelector('#delete-account-dialog'),form=dialog.querySelector('form');root.querySelectorAll('[data-delete-account]').forEach(button=>button.onclick=()=>{const account=customerAccounts.find(item=>item.id===button.dataset.deleteAccount);if(!account)return;form.elements.user_id.value=account.id;dialog.querySelector('[data-delete-account-email]').textContent=account.email;dialog.showModal();dialog.querySelector('[data-delete-account-cancel]').focus()});dialog.querySelectorAll('[data-delete-account-cancel]').forEach(button=>button.onclick=()=>dialog.close());form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=form.querySelector('.admin-form-status'),userId=form.elements.user_id.value;button.disabled=true;button.textContent='Eliminando…';const {data,error}=await supabase.functions.invoke('admin-customer-accounts',{body:{action:'delete',userId}});if(error||data?.error){button.disabled=false;button.textContent='Eliminar todo';status.textContent=data?.error||error?.message||'No pudimos eliminar la cuenta.';return}dialog.close();await refreshCustomers(`Cuenta eliminada · ${data.orders} pedidos y ${data.files} archivos borrados.`)}}
async function refreshCustomers(message=''){try{await loadCustomerAccounts();customersView();if(message)toast(message)}catch(error){toast(error.message)}}
function render(){const route=currentRoute();if(route==='resumen')summaryView();else if(route==='productos')productsView();else if(route==='categorias')categoriesView();else if(route==='colecciones')collectionsView();else if(route==='tallas')sizesView();else if(route==='disenos')designsView();else if(route==='pedidos')ordersView();else if(route==='inventario')inventoryView();else if(route==='insumos')renderSupplierProducts({root,adminData,supabase,icon,refreshData,toast,models:supplierModels(),shell});else if(route==='precios')pricesView();else if(route==='cupones')couponsView();else if(route==='servicio-cliente')customerServiceView();else if(route==='clientes')customersView();else if(route==='configuracion')settingsView();else plannedView(route)}
async function requestCatalogRebuild(){
 if(import.meta.env.DEV)return {queued:false,local:true};
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw new Error('La sesión venció. Vuelve a ingresar.');
 const response=await fetch('/api/rebuild-catalog',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.error||'No se pudo iniciar la regeneración SEO.');
 return payload;
}
function wireCatalogRebuild(){
 const button=root.querySelector('#admin-rebuild-catalog'),status=root.querySelector('#admin-rebuild-catalog-status');
 if(!button||!status)return;
 const setStatus=(message,state)=>{status.textContent=message;status.dataset.state=state};
 setStatus('Listo para regenerar cuando lo necesites.','ready');
 button.onclick=async()=>{
  button.disabled=true;
  button.setAttribute('aria-busy','true');
  button.textContent='Regenerando…';
  setStatus('Solicitando la regeneración del catálogo SEO…','progress');
  try{
   const rebuild=await requestCatalogRebuild();
   setStatus(rebuild.local?'En desarrollo no se publica una ficha estática. Revisa la ruta con Vite.':(rebuild.message||'Regeneración SEO en curso.'),'success');
  }catch(error){
   setStatus(error.message||'No se pudo iniciar la regeneración SEO.','error');
  }finally{
   button.disabled=false;
   button.removeAttribute('aria-busy');
   button.textContent='Regenerar páginas SEO';
  }
 };
}
async function refreshData(message,catalogChanged=false){
 adminData=await readAdminData();render();if(message)toast(message);
 if(!catalogChanged)return;
 try{const rebuild=await requestCatalogRebuild();if(rebuild.queued)toast('Cambio guardado · actualizando páginas SEO.');}
 catch(error){console.error(error);toast('Cambio guardado · publicación SEO pendiente.');}
}
function watchNewOrders(){if(adminOrdersChannel)supabase.removeChannel(adminOrdersChannel);let refreshing=false;const refreshFromPayment=async message=>{if(refreshing||(currentRoute()==='servicio-cliente'&&root.querySelector('dialog[open]')))return;refreshing=true;try{await refreshData(message)}finally{refreshing=false}};adminOrdersChannel=supabase.channel('admin-orders-and-payments').on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'},()=>refreshFromPayment('Llegó un nuevo pedido.')).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders'},()=>refreshFromPayment('El estado de un pedido se actualizó.')).on('postgres_changes',{event:'INSERT',schema:'public',table:'payments'},()=>refreshFromPayment('Se registró un pago.')).on('postgres_changes',{event:'UPDATE',schema:'public',table:'payments'},()=>refreshFromPayment('El estado de un pago se actualizó.')).subscribe()}
function scrollToConfigurationSection(){
 const anchor=location.hash.slice(1);
 if(!configurationAnchors.has(anchor))return false;
 const section=root.querySelector(`#${anchor}`);
 if(!section)return false;
 section.tabIndex=-1;
 section.focus({preventScroll:true});
 section.scrollIntoView();
 return true;
}
async function boot(){if(await handlePasswordRecovery())return;loadingView();const {data:{user}}=await supabase.auth.getUser();if(!user)return loginView();const {data:isAdmin,error}=await supabase.rpc('is_admin');if(error||!isAdmin)return deniedView();sessionUser=user;try{await ensureBaseCatalog();adminData=await readAdminData();if(currentRoute()==='clientes')await loadCustomerAccounts();render();scrollToConfigurationSection();watchNewOrders()}catch(error){root.innerHTML=`<section class="admin-login"><h1>No pudimos cargar el panel.</h1><p class="admin-notice admin-error" role="alert">${safe(error.message)}</p><button class="admin-secondary" id="admin-retry">Reintentar</button></section>`;root.querySelector('#admin-retry').onclick=boot}}
window.addEventListener('hashchange',async()=>{
 if(!adminData||scrollToConfigurationSection())return;
 const route=currentRoute();
 if(route==='clientes'){
  try{await loadCustomerAccounts()}catch(error){toast(error.message);return}
  if(currentRoute()!==route)return;
 }
 render();
 if(!scrollToConfigurationSection())focusPageHeading();
});
boot();
async function rollbackOrder(button){const order=adminData.orders.find(item=>String(item.id)===String(button.dataset.rollbackOrder));if(!order||order.edit_pending_approval)return;if(!await confirmOrderAction(root,{orderId:order.id,title:'Volver a Pedido ingresado',message:'El pedido regresará a la columna Pedido ingresado del tablero.',action:'Devolver pedido'}))return;button.disabled=true;button.textContent='Devolviendo…';if(import.meta.env.DEV&&String(order.id).startsWith('LOCAL-')){const orders=readLocalOrders(),local=orders.find(item=>item.id===order.id);if(local){const now=new Date().toISOString();local.status='paid';local.order_status_history=[...(local.order_status_history||[]),{id:`${order.id}-${now}`,status:'paid',note:'Pedido devuelto a Pedido ingresado.',created_at:now}];localStorage.setItem(LOCAL_DEMO_ORDERS_KEY,JSON.stringify(orders));await refreshData('Pedido devuelto a Pedido ingresado.');return}}const {data,error}=await supabase.functions.invoke('update-order-status',{body:{orderId:order.id,status:'paid',rollback:true}});if(error||data?.error){button.disabled=false;button.textContent='Volver a ingresado';toast(data?.error||error?.message||'No pudimos devolver el pedido.');return}await refreshData('Pedido devuelto a Pedido ingresado.')}
async function archiveOrder(button){const order=adminData.orders.find(item=>String(item.id)===String(button.dataset.archiveOrder));if(!order||order.archived_at)return;if(!await confirmOrderAction(root,{orderId:order.id,title:'Archivar pedido',message:'El pedido pasará al historial de archivados. El cliente no recibirá una notificación.',action:'Archivar pedido'}))return;button.disabled=true;button.setAttribute('aria-busy','true');const now=new Date().toISOString();if(import.meta.env.DEV&&String(order.id).startsWith('LOCAL-')){const orders=readLocalOrders(),local=orders.find(item=>item.id===order.id);if(local){local.archived_at=now;local.archived_by=sessionUser?.id||null;local.archived_from_status=local.status;local.order_status_history=[...(local.order_status_history||[]),{id:`${order.id}-${now}`,status:local.status,note:'Pedido archivado por administración. No se notificó al cliente.',created_at:now}];localStorage.setItem(LOCAL_DEMO_ORDERS_KEY,JSON.stringify(orders));await refreshData('Pedido archivado sin notificar al cliente.');return}}const {data:archived,error}=await supabase.from('orders').update({archived_at:now,archived_by:sessionUser?.id||null,archived_from_status:order.status,updated_at:now}).eq('id',order.id).is('archived_at',null).select('id,archived_at').maybeSingle();if(error){button.disabled=false;button.removeAttribute('aria-busy');toast(`No pudimos archivar el pedido: ${error.message}`);return}if(!archived){button.disabled=false;button.removeAttribute('aria-busy');toast('El pedido ya fue archivado o cambió en otra sesión. Actualiza el panel e inténtalo nuevamente.');return}const {error:historyError}=await supabase.from('order_status_history').insert({order_id:order.id,status:order.status,note:'Pedido archivado por administración. No se notificó al cliente.'});if(historyError){console.error('No se pudo registrar el historial del archivado',historyError);toast('Pedido archivado. No se pudo registrar el detalle en el historial.')}await refreshData('Pedido archivado sin notificar al cliente.')}
async function restoreArchivedOrder(button){const order=adminData.orders.find(item=>String(item.id)===String(button.dataset.restoreArchivedOrder));if(!order?.archived_at)return;const previous=order.archived_from_status||'paid';if(!await confirmOrderAction(root,{orderId:order.id,title:'Restaurar pedido',message:`El pedido volverá a «${orderStatusLabel(previous,order)}».`,action:'Restaurar pedido'}))return;button.disabled=true;button.textContent='Restaurando…';const now=new Date().toISOString();if(import.meta.env.DEV&&String(order.id).startsWith('LOCAL-')){const orders=readLocalOrders(),local=orders.find(item=>item.id===order.id);if(local){local.status=previous;local.archived_at=null;local.archived_by=null;local.archived_from_status=null;local.order_status_history=[...(local.order_status_history||[]),{id:`${order.id}-${now}`,status:previous,note:'Pedido restaurado desde Archivado por administración.',created_at:now}];localStorage.setItem(LOCAL_DEMO_ORDERS_KEY,JSON.stringify(orders));await refreshData('Pedido restaurado a su estado anterior.');return}}const {error}=await supabase.from('orders').update({status:previous,archived_at:null,archived_by:null,archived_from_status:null,updated_at:now}).eq('id',order.id).not('archived_at','is',null);if(error){button.disabled=false;button.textContent='Restaurar pedido';toast(error.message);return}await supabase.from('order_status_history').insert({order_id:order.id,status:previous,note:'Pedido restaurado desde Archivado por administración.'});await refreshData('Pedido restaurado a su estado anterior.')}
function normalizePaymentToggleCopy(){root.querySelectorAll('.admin-payment-toggle').forEach(toggle=>{const input=toggle.querySelector('input[data-confirm-payment]'),strong=toggle.querySelector('strong');if(!input||!strong)return;const label=input.checked?'Pago confirmado':'Confirmar pago';if(strong.textContent!==label)strong.textContent=label})}
root.addEventListener('change',event=>{if(event.target.matches('.admin-payment-toggle input[data-confirm-payment]'))normalizePaymentToggleCopy()});
const paymentToggleCopyObserver=new MutationObserver(normalizePaymentToggleCopy);paymentToggleCopyObserver.observe(root,{childList:true,subtree:true});
function installAdminIconTooltips(){root.querySelectorAll('.admin-icon-action[aria-label]').forEach(control=>{control.dataset.tooltip=control.getAttribute('aria-label')})}
const adminIconTooltipObserver=new MutationObserver(installAdminIconTooltips);adminIconTooltipObserver.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label']});installAdminIconTooltips();
root.addEventListener('click',event=>{const button=event.target.closest('[data-open-order]');if(button)rememberOpenedOrder(button.dataset.openOrder)},true);

function technicalReviewMarkup(order){
 const items=order.order_items||[],required=items.filter(item=>item.quality_review).length,archived=Boolean(order.archived_at);
 const summary=required?`${required} ${required===1?'producto pendiente':'productos pendientes'} antes de producir`:'Sin revisión pendiente';
 return `<section class="admin-technical-review" data-technical-review>
  <div><h3>Revisión técnica</h3><p>${safe(summary)}</p></div>
  ${!archived&&items.length?`<button type="button" class="admin-secondary" data-edit-technical-review="${safe(order.id)}">Editar revisión</button>`:''}
 </section>`;
}
function technicalReviewDialogMarkup(order){
 const items=order.order_items||[];
 return `<dialog class="admin-dialog admin-technical-review-dialog" id="technical-review-dialog"><form><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · ANTES DE PRODUCCIÓN</span><h2>Revisión técnica</h2><p>Marca los productos cuyo archivo debe revisarse antes de enviarlo a producción.</p></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><div class="admin-technical-review-fields">${items.map((item,index)=>`<label class="admin-technical-review-item"><input type="checkbox" data-technical-review-item="${safe(item.id)}" ${item.quality_review?'checked':''}><span><strong>Producto ${index+1} · ${safe(item.name_snapshot)}</strong><small>${safe(item.print_sides||'Frente')} · ${item.quantity||1} ${item.quantity===1?'unidad':'unidades'}</small></span></label>`).join('')||'<p>No hay productos en este pedido.</p>'}</div><p class="admin-technical-review-note">Este control organiza la producción. Los precios se editan por separado en el pedido.</p><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar revisión</button></div><p class="admin-form-status" role="alert"></p></form></dialog>`;
}
function openTechnicalReviewEditor(order){
 root.querySelector('#technical-review-dialog')?.remove();
 root.insertAdjacentHTML('beforeend',technicalReviewDialogMarkup(order));
 const dialog=root.querySelector('#technical-review-dialog'),form=dialog.querySelector('form'),close=()=>dialog.close();
 dialog.querySelector('.dialog-close').onclick=close;
 dialog.querySelector('.dialog-cancel').onclick=close;
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=event.submitter||form.querySelector('[type="submit"]'),status=form.querySelector('.admin-form-status');
  const changes=[...form.querySelectorAll('[data-technical-review-item]')].map(input=>({id:input.dataset.technicalReviewItem,qualityReview:input.checked})).filter(change=>{
   const original=(order.order_items||[]).find(item=>String(item.id)===String(change.id));
   return Boolean(original?.quality_review)!==change.qualityReview;
  });
  if(!changes.length){close();return}
  button.disabled=true;button.textContent='Guardando…';
  for(const change of changes){
   const {error}=await supabase.from('order_items').update({quality_review:change.qualityReview}).eq('id',change.id).eq('order_id',order.id);
   if(error){button.disabled=false;button.textContent='Guardar revisión';status.textContent=error.message;return}
  }
  const required=changes.filter(change=>change.qualityReview).length,cleared=changes.length-required;
  const parts=[required&&`${required} ${required===1?'producto marcado':'productos marcados'}`,cleared&&`${cleared} ${cleared===1?'marca retirada':'marcas retiradas'}`].filter(Boolean).join(' · ');
  await supabase.from('order_status_history').insert({order_id:order.id,status:order.status,note:`Revisión técnica actualizada por administración${parts?`: ${parts}.`:'.'}`});
  close();
  await refreshData('Revisión técnica guardada antes de producción.');
 };
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 showOrderDialog(dialog);
}
root.addEventListener('click',event=>{
 const trigger=event.target.closest('[data-edit-technical-review]');
 if(!trigger)return;
 const order=adminData?.orders.find(item=>String(item.id)===String(trigger.dataset.editTechnicalReview));
 if(order){trigger.focus({preventScroll:true});openTechnicalReviewEditor(order)}
});

function orderPrintAssetUrl(path){
 if(path?.startsWith('local:')){
  const design=baseDesigns.find(item=>`local:${item.id}`===path);
  return design?artworkUrl(design):'';
 }
 return catalogAssetUrl(path);
}

// A private original is signed when the operator opens it.
root.addEventListener('click',async event=>{
 const button=event.target.closest('[data-print-file]');
 if(!button)return;
 const tab=window.open('about:blank','_blank');
 if(!tab){toast('Permite ventanas emergentes para abrir el diseño.');return}
 tab.opener=null;button.disabled=true;
 try{
  const {data,error}=await supabase.functions.invoke('private-design-storage',{body:{action:'sign-download',path:button.dataset.printFile}});
  if(error||!data?.url)throw new Error('No pudimos descargar el diseño.');
  tab.location.replace(data.url);
 }catch{tab.close();toast('No pudimos descargar el diseño.')}finally{button.disabled=false}
});

function openQuoteEditor(order){
 root.querySelector('#quote-editor-dialog')?.remove();
 const dialog=document.createElement('dialog');dialog.id='quote-editor-dialog';dialog.className='admin-dialog';
 dialog.innerHTML=`<form><div class="dialog-title"><div><span class="admin-eyebrow">PEDIDO #${safe(order.id)} · COTIZACIÓN</span><h2>${order.status==='quoted'?'Editar cotización':'Responder cotización'}</h2></div><button type="button" class="dialog-close" aria-label="Cerrar">×</button></div><fieldset class="admin-form-section"><legend>Propuesta para el cliente</legend><label>Detalle de la propuesta<textarea name="quote_message" rows="7" required placeholder="Ej. Incluye diseño de una tinta al frente, dos rondas de cambios y preparación para impresión.">${safe(order.quote_message||'')}</textarea></label><label>Valor total de la propuesta<input name="quoted_total_clp" type="number" min="1" step="1" required value="${Number(order.quoted_total_clp||order.total_clp||0)||''}"><small>Valor en pesos chilenos. Incluye el despacho acordado, si corresponde. Explica la entrega en el detalle.</small></label></fieldset><div class="dialog-actions"><button type="button" class="admin-secondary dialog-cancel">Cancelar</button><button type="submit" class="admin-primary">Guardar cotización</button></div><p class="admin-form-status" role="alert"></p></form>`;
 root.append(dialog);const form=dialog.querySelector('form'),close=()=>{dialog.close();dialog.remove()};dialog.querySelector('.dialog-close').onclick=close;dialog.querySelector('.dialog-cancel').onclick=close;
 form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=form.querySelector('.admin-form-status'),message=String(form.elements.quote_message.value||'').trim(),total=Math.round(Number(form.elements.quoted_total_clp.value));if(!message||!Number.isFinite(total)||total<=0){status.textContent='Completa el detalle y un valor válido.';return}button.disabled=true;button.textContent='Guardando…';const now=new Date().toISOString();const {data:{user}}=await supabase.auth.getUser();const {data:updatedQuote,error}=await supabase.from('orders').update({status:'quoted',quote_message:message,quoted_total_clp:total,quoted_at:now,quoted_by:user?.id||null,subtotal_clp:total,shipping_clp:0,discount_clp:0,total_clp:total,updated_at:now,price_snapshot:{...(order.price_snapshot||{}),quote_message:message,quoted_total_clp:total,quote_pending:false}}).eq('id',order.id).eq('request_type','creative').in('status',['submitted','quoted']).select('id').maybeSingle();if(error||!updatedQuote){button.disabled=false;button.textContent='Guardar cotización';status.textContent=error?.message||'La solicitud cambió. Actualiza el panel antes de cotizar.';return}const item=order.order_items?.[0];if(item){const updated=await supabase.from('order_items').update({name_snapshot:'Diseño personalizado cotizado',unit_price_clp:total,line_total_clp:total}).eq('id',item.id);if(updated.error){button.disabled=false;button.textContent='Guardar cotización';status.textContent='La cotización se guardó, pero el detalle falló. Vuelve a guardar para reintentar.';return}}if(order.status==='quoted')await supabase.from('order_status_history').insert({order_id:order.id,status:'quoted',note:`Cotización actualizada a ${money(total)}.`});const {data:emailData,error:emailError}=await supabase.functions.invoke('send-order-email',{body:{orderId:order.id,resend:true}});close();await refreshData(emailError||emailData?.error||!emailData?.email?.sent?'Cotización guardada. El correo no salió; abre el pedido para reenviarlo.':'Cotización guardada y enviada al cliente.')};
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 showOrderDialog(dialog);
}

root.addEventListener('click',async event=>{
 const button=event.target.closest('[data-creative-reference]');if(!button)return;
 const order=adminData?.orders.find(item=>String(item.id)===button.dataset.orderId),reference=order?.request_references?.[Number(button.dataset.creativeReference)];
 if(!reference?.path){toast('Esta solicitud antigua no tiene una imagen adjunta.');return}
 const tab=window.open('about:blank','_blank');if(!tab){toast('Permite ventanas emergentes para abrir la referencia.');return}
 tab.opener=null;button.disabled=true;
 const {data,error}=await supabase.functions.invoke('private-design-storage',{body:{action:'sign-download',path:reference.path}});
 button.disabled=false;
 if(error||!data?.url){tab.close();toast('No pudimos abrir la referencia. Intenta nuevamente.');return}
 tab.location.replace(data.url);
});

function installManualChannelField(){const form=document.querySelector('#manual-order-form'),grid=form?.querySelector('.admin-form-section .admin-form-grid');if(!form||!grid||form.elements.channel)return;grid.insertAdjacentHTML('beforeend','<label>Canal de origen<select name="channel"><option value="whatsapp">WhatsApp</option><option value="web">Web</option><option value="instagram">Instagram</option><option value="other">Otro</option></select></label>')}
function manualChannelName(value){return {whatsapp:'WhatsApp',web:'Web',instagram:'Instagram',other:'Otro'}[value]||'Otro'}
function manualOrderNotes(form){const channel=manualChannelName(form.elements.channel?.value),notes=String(form.elements.notes?.value||'').replace(/^Canal de origen:.*(?:\n\n|\n|$)/,'').trim();return [`Canal de origen: ${channel}`,notes].filter(Boolean).join('\n\n')}


function colorNameForHex(value){const normalized=String(value||'').toLowerCase();return manualColorOptions.find(([hex])=>hex.toLowerCase()===normalized)?.[1]||'Color personalizado'}
function readableOrderItem(item){
 const variant=adminData.variants.find(candidate=>candidate.sku===item.sku_snapshot);
 const model=Array.isArray(variant?.product_models)?variant.product_models[0]:variant?.product_models;
 const parts=String(item.name_snapshot||'').split(' · ');
 const [product,size,color]=parts.length>=3?parts:[parts[0]];
 const design=variant?parts.slice(1).join(' · '):parts.slice(3).join(' · ');
 const name=variant?[model?.name||product,design==='personalizada'?'':design].filter(Boolean).join(' · '):item.name_snapshot;
 const placement=item.print_configuration||item.print_sides?printConfigurationLabel(item.print_configuration,item.print_sides):'';
 const colorName=item.color_hex?colorNameForHex(item.color_hex):variant?.color_name||color;
 return {
  name:name||'Producto',
  details:[variant?.size||size?`Talla ${variant?.size||size}`:'',colorName?`Color ${colorName}`:'',placement].filter(Boolean).join(' · ')
 };
}
