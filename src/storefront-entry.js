import {fetchStoreSettings,defaultStoreSettings} from './store-settings.js';
import {resolveStorefrontLayout,loadStorefrontSettings} from './storefront-layout.js';
import {supabase,initializeStorefront} from './storefront-runtime.js';

async function start(){
  const settings=await loadStorefrontSettings(signal=>fetchStoreSettings(supabase,{signal}),{fallback:defaultStoreSettings});
  const layout=resolveStorefrontLayout(settings,{development:import.meta.env.DEV,search:location.search});
  document.documentElement.classList.toggle('preload-drop-wall',layout==='drop-wall');
  // Cache only the loading illustration; the actual layout always comes from settings.
  try{localStorage.setItem('droska-skeleton-layout',layout)}catch{}
  initializeStorefront(settings,layout);
  await import('./main.js');
}
void start().catch(error=>{
  console.error('No pudimos iniciar la tienda:',error);
  const loader=document.querySelector('#site-preloader');
  if(loader){loader.removeAttribute('aria-hidden');loader.innerHTML='<p>No pudimos abrir la tienda. <a href="">Volver a intentar</a></p>'}
});
