export const defaultStoreSettings=Object.freeze({
  storefront_layout:'classic',
  whatsapp_number:'56965217926',
  support_email:'',
  catalog_purchase_method:'cart',
  personalized_purchase_method:'cart',
  hero_catalog_design_ids:[],
  announcement_enabled:true,
  announcement_text:'🛍️ ¡Compra por WhatsApp disponible!',
  announcement_origin_text:'Hecho a tu pinta, en 🇨🇱 Chile.'
});

export function normalizeStoreSettings(value={}){
  const number=String(value.whatsapp_number??defaultStoreSettings.whatsapp_number).replace(/\D/g,'');
  const email=String(value.support_email??'').trim().toLowerCase();
  const text=String(value.announcement_text??defaultStoreSettings.announcement_text).trim();
  const originText=String(value.announcement_origin_text??defaultStoreSettings.announcement_origin_text).trim();
  const heroCatalogDesignIds=[...new Set((Array.isArray(value.hero_catalog_design_ids)?value.hero_catalog_design_ids:[])
    .map(Number)
    .filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,3);
  return {
    storefront_layout:value.storefront_layout==='drop-wall'?'drop-wall':'classic',
    whatsapp_number:number,
    support_email:email,
    catalog_purchase_method:value.catalog_purchase_method==='whatsapp'?'whatsapp':'cart',
    personalized_purchase_method:value.personalized_purchase_method==='whatsapp'?'whatsapp':'cart',
    hero_catalog_design_ids:heroCatalogDesignIds,
    announcement_enabled:value.announcement_enabled!==false,
    announcement_text:text,
    announcement_origin_text:originText
  };
}

export function validateStoreSettings(settings){
  if(!/^56\d{9}$/.test(settings.whatsapp_number))return 'Ingresa un WhatsApp chileno con 56 y nueve dígitos.';
  if(settings.support_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.support_email))return 'Ingresa un correo de contacto válido.';
  if(settings.announcement_text.length>100)return 'El aviso puede tener hasta 100 caracteres.';
  if(settings.announcement_origin_text.length>100)return 'El segundo texto del aviso puede tener hasta 100 caracteres.';
  if(settings.announcement_enabled&&!settings.announcement_text)return 'Escribe el aviso o desactívalo.';
  if(settings.hero_catalog_design_ids.length&&settings.hero_catalog_design_ids.length!==3)return 'Elige exactamente tres mockups o deja la selección automática.';
  return '';
}

export const storeSettingsColumns='storefront_layout,whatsapp_number,support_email,catalog_purchase_method,personalized_purchase_method,hero_catalog_design_ids,announcement_enabled,announcement_text,announcement_origin_text';

export async function fetchStoreSettings(client,{signal}={}){
  const read=columns=>{
    const query=client.from('storefront_settings').select(columns).eq('id',true).single();
    return signal?query.abortSignal(signal):query;
  };
  let {data,error}=await read(storeSettingsColumns);
  // A rolling deployment may reach a database that does not have the new column yet.
  // Retain its real contact and purchase settings while falling back to classic.
  if(error&&['42703','PGRST204'].includes(error.code)&&error.message?.includes('storefront_layout')){
    ({data,error}=await read(storeSettingsColumns.replace('storefront_layout,','')));
  }
  if(error)throw error;
  return normalizeStoreSettings(data);
}

export async function saveStoreSettings(client,value){
  const settings=normalizeStoreSettings(value),message=validateStoreSettings(settings);
  if(message)throw new Error(message);
  const {data,error}=await client.from('storefront_settings').update({...settings,updated_at:new Date().toISOString()}).eq('id',true).select(storeSettingsColumns).single();
  if(error)throw error;
  return normalizeStoreSettings(data);
}

export function applyStoreSettings(settings,scope=document){
  scope.querySelectorAll('[data-store-whatsapp]').forEach(link=>{link.href=`https://wa.me/${settings.whatsapp_number}`});
  scope.querySelectorAll('[data-store-support-email]').forEach(link=>{
    link.href=settings.support_email?`mailto:${settings.support_email}`:'';
    link.textContent=settings.support_email;
    link.hidden=!settings.support_email;
  });
  scope.querySelectorAll('[data-store-announcement]').forEach(element=>{
    element.hidden=!settings.announcement_enabled;
    const message=element.querySelector('[data-store-announcement-text]');
    if(message)message.textContent=settings.announcement_text;
    const origin=element.querySelector('[data-store-announcement-origin]');
    if(origin)origin.textContent=settings.announcement_origin_text;
  });
}
