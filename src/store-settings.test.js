import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoreSettings, validateStoreSettings } from './store-settings.js';

test('normaliza contacto y aviso para guardar',()=>{
  const settings=normalizeStoreSettings({whatsapp_number:'+56 9 6521 7926',support_email:' HOLA@DROSKA.CL ',announcement_enabled:false,announcement_text:'  Envío a Chile  '});
  assert.deepEqual(settings,{whatsapp_number:'56965217926',support_email:'hola@droska.cl',announcement_enabled:false,announcement_text:'Envío a Chile'});
  assert.equal(validateStoreSettings(settings),'');
});

test('rechaza contacto y aviso inválidos',()=>{
  assert.match(validateStoreSettings(normalizeStoreSettings({whatsapp_number:'123'})),/WhatsApp/);
  assert.match(validateStoreSettings(normalizeStoreSettings({support_email:'mal'})),/correo/);
  assert.match(validateStoreSettings(normalizeStoreSettings({announcement_text:'  '})),/aviso/);
});
