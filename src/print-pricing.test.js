import test from 'node:test'
import assert from 'node:assert/strict'
import {printPrice} from '../supabase/functions/_shared/print-pricing.js'

test('front format and optional arm and back use their configured rates', () => {
  const rates={front_large_clp:6100,front_pocket_clp:3100,back_large_clp:6200,arm_clp:3200}
  assert.equal(printPrice({front:{placement:'center',size:'large'}},'front',rates),6100)
  assert.equal(printPrice({front:{placement:'chest_left',size:'pocket'}},'front',rates),3100)
  assert.equal(printPrice({prints:[
    {side:'front',placement:'center',size:'large'},
    {side:'front',placement:'sleeve_right',size:'pocket'},
    {side:'back',placement:'center',size:'large'},
  ]},'both',rates),15500)
})
