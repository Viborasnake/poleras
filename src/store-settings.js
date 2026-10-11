export const defaultStoreSettings=Object.freeze({
  whatsapp_number:'56965217926',
  support_email:'',
  announcement_enabled:true,
  announcement_text:'De tu cabeza a tu polera. Así de simple.'
});

export function normalizeStoreSettings(value={}){
  const number=String(value.whatsapp_number??defaultStoreSettings.whatsapp_number).replace(/\D/g,'');
  const email=String(value.support_email??'').trim().toLowerCase();
  const text=String(value.announcement_text??defaultStoreSettings.announcement_text).trim();
  return {
    whatsapp_number:number,
    support_email:email,
    announcement_enabled:value.announcement_enabled!==false,
    announcement_text:text
  };
}

export function validateStoreSettings(settings){
  if(!/^56\d{9}$/.test(settings.whatsapp_number))return 'Ingresa un WhatsApp chileno con 56 y nueve dígitos.';
  if(settings.support_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.support_email))return 'Ingresa un correo de contacto válido.';
  if(settings.announcement_text.length>100)return 'El aviso puede tener hasta 100 caracteres.';
  if(settings.announcement_enabled&&!settings.announcement_text)return 'Escribe el aviso o desactívalo.';
  return '';
}

export async function fetchStoreSettings(client){
  const {data,error}=await client.from('storefront_settings').select('whatsapp_number,support_email,announcement_enabled,announcement_text').eq('id',true).single();
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
  });
}
