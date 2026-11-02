import {createClient} from '@supabase/supabase-js';
import {defaultStoreSettings} from './store-settings.js';
import {localSignOutOptions,storefrontAuthOptions} from './auth-client-options.js';

export {localSignOutOptions};

export const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://dgndcklmmnnxyqfmnckh.supabase.co';
export const supabase=createClient(SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_J2zSgCPaW1rENVCdEuYGNQ_62EhSxtS',{auth:storefrontAuthOptions});
export let initialStoreSettings={...defaultStoreSettings};
export let useDropWall=false;

export function initializeStorefront(settings,layout){
  initialStoreSettings=settings;
  useDropWall=layout==='drop-wall';
}
