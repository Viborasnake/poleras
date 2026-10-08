import test from 'node:test'
import assert from 'node:assert/strict'
import { costPerUnit, dtfYield, principalCalculation, recipeLineCost, sortSupplierProducts } from './admin-supplier-products.js'

test('prorratea un pack por cantidad',()=>{
 assert.equal(costPerUnit({unit_cost_clp:5000,purchase_quantity:100}),50)
 assert.equal(recipeLineCost({}, {unit_cost_clp:5000,purchase_quantity:100}, {quantity:2,costing_rule:'per_unit'}),100)
})

test('prorratea DTF por piezas que caben en el pliego',()=>{
 const principal={print_width_cm:28,print_height_cm:40}
 const dtf={unit_cost_clp:14280,purchase_quantity:1,sheet_width_cm:56,sheet_height_cm:100}
 assert.equal(dtfYield(principal,dtf),4)
 assert.equal(recipeLineCost(principal,dtf,{quantity:1,costing_rule:'dtf_yield'}),3570)
})

test('suma varios secundarios al costo del principal',()=>{
 const principal={unit_cost_clp:3990,purchase_quantity:1,other_cost_clp:0,margin_percent:50,vat_percent:19,print_width_cm:28,print_height_cm:40}
 const components={1:{unit_cost_clp:14280,purchase_quantity:1,sheet_width_cm:56,sheet_height_cm:100},2:{unit_cost_clp:3000,purchase_quantity:100}}
 const result=principalCalculation(principal,[{component_product_id:1,quantity:1,costing_rule:'dtf_yield'},{component_product_id:2,quantity:2,costing_rule:'per_unit'}],id=>components[id])
 assert.equal(result.base,7620)
 assert.equal(result.suggested,13990)
})

test('prioriza el orden manual del insumo y conserva un desempate estable por nombre',()=>{
 const products=[{name:'Niño',sort_order:20},{name:'Básica',sort_order:10},{name:'Oversize',sort_order:20}]
 assert.deepEqual(products.sort(sortSupplierProducts).map(item=>item.name),['Básica','Niño','Oversize'])
})
