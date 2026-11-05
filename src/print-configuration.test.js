import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePrintConfiguration, normalizePrintSideConfiguration, printConfigurationCount, printConfigurationLabel} from '../supabase/functions/_shared/print-configuration.js'

test('print configuration keeps safe per-side placement, size and bounded movement', () => {
  assert.deepEqual(normalizePrintConfiguration({front:{placement:'chest_left',size:'pocket',offsetX:7,offsetY:-1}}, 'front'), {
    front:{placement:'chest_left',size:'pocket',scale:.55,offsetX:2,offsetY:-1},
  })
})

test('back configuration rejects chest-only placement and ignores unused sides', () => {
  assert.deepEqual(normalizePrintConfiguration({front:{placement:'sleeve_left'},back:{placement:'chest_right',size:'small'}}, 'back'), {
    back:{placement:'center',size:'small',scale:.85,offsetX:0,offsetY:0},
  })
})

test('print configuration has production-readable labels', () => {
  const value={front:normalizePrintSideConfiguration({placement:'sleeve_right',size:'pocket',offsetY:1},'front')}
  assert.equal(printConfigurationLabel(value,'front'),'Frente: Manga derecha · Bolsillo · posición ajustada')
})

test('additive composition keeps independent back, pocket and sleeve artwork', () => {
  const value=normalizePrintConfiguration({prints:[
    {id:'primary-back',side:'back',placement:'center',size:'large',fileName:'espalda.webp',designPath:'user/back/a.webp'},
    {id:'extra-pocket',side:'front',placement:'chest_left',size:'pocket',fileName:'logo.webp',designPath:'user/front/b.webp'},
    {id:'extra-sleeve',side:'front',placement:'sleeve_right',size:'small',fileName:'manga.webp',designPath:'user/front/c.webp'},
  ]},'both')
  assert.equal(value.prints.length,3)
  assert.equal(value.prints[1].placement,'chest_left')
  assert.equal(value.prints[2].designPath,'user/front/c.webp')
  assert.equal(printConfigurationCount(value,'both'),3)
  assert.match(printConfigurationLabel(value,'both'),/Espalda: Centro/)
  assert.match(printConfigurationLabel(value,'both'),/Frente: Pecho izquierdo/)
  assert.match(printConfigurationLabel(value,'both'),/Frente: Manga derecha/)
})
