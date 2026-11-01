import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStorefrontLayout,loadStorefrontSettings} from './storefront-layout.js';
import {defaultStoreSettings,fetchStoreSettings,saveStoreSettings} from './store-settings.js';

test('classic remains the default and public URLs cannot override the admin selection',()=>{
  for(const settings of [undefined,{}, {storefront_layout:null},{storefront_layout:'unknown'}])assert.equal(resolveStorefrontLayout(settings),'classic');
  assert.equal(resolveStorefrontLayout({storefront_layout:'classic'},{search:'?preview-layout=drop-wall'}),'classic');
  assert.equal(resolveStorefrontLayout({storefront_layout:'drop-wall'},{search:'?preview-layout=classic'}),'drop-wall');
  assert.equal(resolveStorefrontLayout({}, {development:true,search:'?preview-layout=drop-wall'}),'drop-wall');
  assert.equal(resolveStorefrontLayout({storefront_layout:'drop-wall'}, {development:true,search:'?preview-layout=classic'}),'classic');
});

test('unavailable or slow settings fall back to classic without hanging the home',async()=>{
  const failed=await loadStorefrontSettings(()=>Promise.reject(new Error('offline')),{fallback:defaultStoreSettings});
  assert.equal(failed.storefront_layout,'classic');
  let aborted=false;
  const timedOut=await loadStorefrontSettings(signal=>new Promise(()=>{signal.addEventListener('abort',()=>aborted=true)}),{timeoutMs:5,fallback:{...defaultStoreSettings,storefront_layout:'drop-wall'}});
  assert.equal(aborted,true);
  assert.equal(timedOut.storefront_layout,'classic');
  const settings={...defaultStoreSettings,storefront_layout:'drop-wall'};
  assert.equal(await loadStorefrontSettings(()=>Promise.resolve(settings)),settings);
});

function settingsClient({legacy=false,forbidden=false}={}){
  let row={...defaultStoreSettings,catalog_purchase_method:'whatsapp'};
  return {from(table){assert.equal(table,'storefront_settings');let update=null,columns='';const query={
    update(value){update=value;return query},select(value){columns=value;return query},eq(key,value){assert.equal(key,'id');assert.equal(value,true);return query},
    async single(){
      if(update&&forbidden)return {error:{message:'Permission denied',code:'42501'}};
      if(legacy&&columns.includes('storefront_layout'))return {error:{message:'column storefront_settings.storefront_layout does not exist',code:'42703'}};
      if(update)row={...row,...update};
      return {data:{...row,storefront_layout:legacy?undefined:row.storefront_layout}};
    },
  };return query}};
}

test('saved layout survives a fresh fetch and can revert without altering purchase settings',async()=>{
  const client=settingsClient();
  assert.equal((await fetchStoreSettings(client)).storefront_layout,'classic');
  const enabled=await saveStoreSettings(client,{...await fetchStoreSettings(client),storefront_layout:'drop-wall'});
  assert.equal(enabled.storefront_layout,'drop-wall');
  assert.equal((await fetchStoreSettings(client)).storefront_layout,'drop-wall');
  await saveStoreSettings(client,{...enabled,storefront_layout:'classic'});
  const reverted=await fetchStoreSettings(client);
  assert.equal(reverted.storefront_layout,'classic');
  assert.equal(reverted.catalog_purchase_method,'whatsapp');
});

test('old schemas retain real purchase settings and denied saves are not reported as success',async()=>{
  const legacy=await fetchStoreSettings(settingsClient({legacy:true}));
  assert.equal(legacy.storefront_layout,'classic');
  assert.equal(legacy.catalog_purchase_method,'whatsapp');
  await assert.rejects(saveStoreSettings(settingsClient({forbidden:true}),defaultStoreSettings),error=>error.code==='42501');
});
