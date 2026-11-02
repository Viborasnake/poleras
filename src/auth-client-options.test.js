import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_AUTH_STORAGE_KEY,STOREFRONT_AUTH_STORAGE_KEY,adminAuthOptions,localSignOutOptions,storefrontAuthOptions} from './auth-client-options.js';

test('storefront and admin keep independent persisted sessions',()=>{
 assert.notEqual(STOREFRONT_AUTH_STORAGE_KEY,ADMIN_AUTH_STORAGE_KEY);
 assert.equal(storefrontAuthOptions.storageKey,STOREFRONT_AUTH_STORAGE_KEY);
 assert.equal(adminAuthOptions.storageKey,ADMIN_AUTH_STORAGE_KEY);
 assert.equal(storefrontAuthOptions.persistSession,true);
 assert.equal(adminAuthOptions.persistSession,true);
 assert.deepEqual(localSignOutOptions,{scope:'local'});
});

test('only the storefront consumes authentication redirects',()=>{
 assert.equal(storefrontAuthOptions.detectSessionInUrl,true);
 assert.equal(adminAuthOptions.detectSessionInUrl,false);
});
