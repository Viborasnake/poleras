import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoreSettings, validateStoreSettings } from './store-settings.js';

test('normaliza contacto y aviso para guardar',()=>{
  const settings=normalizeStoreSettings({whatsapp_number:'+56 9 6521 7926',support_email:' HOLA@DROSKA.CL ',announcement_enabled:false,announcement_text:'  Envío a Chile  ',announcement_origin_text:'  Hecho en Chile  '});
  assert.deepEqual(settings,{storefront_layout:'classic',whatsapp_number:'56965217926',support_email:'hola@droska.cl',catalog_purchase_method:'cart',personalized_purchase_method:'cart',hero_catalog_design_ids:[],announcement_enabled:false,announcement_text:'Envío a Chile',announcement_origin_text:'Hecho en Chile'});
  assert.equal(validateStoreSettings(settings),'');
});

test('normaliza la selección editorial de tres mockups',()=>{
  const settings=normalizeStoreSettings({hero_catalog_design_ids:['8',8,'12','invalido',31,44]});
  assert.deepEqual(settings.hero_catalog_design_ids,[8,12,31]);
  assert.equal(validateStoreSettings(settings),'');
  assert.match(validateStoreSettings(normalizeStoreSettings({hero_catalog_design_ids:[8,12]})),/tres mockups/);
});

test('rechaza contacto y aviso inválidos',()=>{
  assert.match(validateStoreSettings(normalizeStoreSettings({whatsapp_number:'123'})),/WhatsApp/);
  assert.match(validateStoreSettings(normalizeStoreSettings({support_email:'mal'})),/correo/);
  assert.match(validateStoreSettings(normalizeStoreSettings({announcement_text:'  '})),/aviso/);
  assert.match(validateStoreSettings(normalizeStoreSettings({announcement_origin_text:'x'.repeat(101)})),/segundo texto/);
});
