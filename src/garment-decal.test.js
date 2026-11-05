import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrintableFacing, printPlacementCoordinates, printVisibilityForFacing, responsiveCameraDistance } from './garment.js';

test('el estampado frontal no se proyecta sobre paneles laterales',()=>{
  assert.equal(isPrintableFacing(.92),true);
  assert.equal(isPrintableFacing(.52),true);
  assert.equal(isPrintableFacing(.51),false);
  assert.equal(isPrintableFacing(.15),false);
});

test('el estampado trasero usa la orientación inversa',()=>{
  assert.equal(isPrintableFacing(-.9,true),true);
  assert.equal(isPrintableFacing(-.4,true),false);
  assert.equal(isPrintableFacing(.9,true),false);
});

test('el estampado desaparece antes de llegar al perfil de la polera',()=>{
  assert.equal(printVisibilityForFacing(1),1);
  assert.equal(printVisibilityForFacing(.42),1);
  assert.equal(printVisibilityForFacing(.16),0);
  assert.equal(printVisibilityForFacing(0),0);
  assert.equal(printVisibilityForFacing(-1),0);
  assert.ok(printVisibilityForFacing(.3)>0);
  assert.ok(printVisibilityForFacing(.3)<1);
});

test('el hero móvil aleja la cámara para mantener la polera completa',()=>{
 assert.equal(responsiveCameraDistance(4.75,1.2,true),4.75);
 assert.ok(responsiveCameraDistance(4.75,.67,true)>6.3);
 assert.equal(responsiveCameraDistance(4.75,.67,false),4.75);
});

test('las ubicaciones opcionales permiten solo movimientos pequeños',()=>{
 const chest=printPlacementCoordinates('chest_left',.2,1,-1);
 assert.ok(Math.abs(chest.x-(-.21))<.0001);
 assert.ok(Math.abs(chest.y-.55)<.0001);
 const bounded=printPlacementCoordinates('center',.2,99,99);
 assert.ok(Math.abs(bounded.x-.14)<.0001);
 assert.ok(Math.abs(bounded.y-.06)<.0001);
});
