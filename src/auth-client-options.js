export const STOREFRONT_AUTH_STORAGE_KEY='droska-storefront-auth';
export const ADMIN_AUTH_STORAGE_KEY='droska-admin-auth';

export const storefrontAuthOptions={
 storageKey:STOREFRONT_AUTH_STORAGE_KEY,
 persistSession:true,
 autoRefreshToken:true,
 detectSessionInUrl:true,
};

export const adminAuthOptions={
 storageKey:ADMIN_AUTH_STORAGE_KEY,
 persistSession:true,
 autoRefreshToken:true,
 detectSessionInUrl:false,
};

export const localSignOutOptions=Object.freeze({scope:'local'});
