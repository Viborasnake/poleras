import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntroTurn,introTurnAngle,INTRO_TURN_DURATION} from './intro-turn.js';

test('giro introductorio dura menos de un segundo y vuelve al frente',()=>{
 const angles=[],queue=[];let clock=0;
 const controller=createIntroTurn({turn:angle=>angles.push(angle),now:()=>clock,request:callback=>{queue.push(callback);return queue.length},cancel:()=>{}});
 assert.equal(controller.start(),true);assert.equal(controller.start(),false);
 clock=INTRO_TURN_DURATION/4;queue.shift()(clock);assert.ok(Math.abs(angles.at(-1))<.3);
 clock=INTRO_TURN_DURATION/2;queue.shift()(clock);assert.ok(angles.at(-1)>0);
 clock=INTRO_TURN_DURATION;queue.shift()(clock);assert.equal(angles.at(-1),0);assert.equal(controller.active,false);
 assert.ok(introTurnAngle(INTRO_TURN_DURATION/2)>0);
});

test('cancelar evita que una carga tardía inicie el giro',()=>{
 const queue=[],angles=[];let reduced=false;
 const controller=createIntroTurn({turn:angle=>angles.push(angle),request:callback=>{queue.push(callback);return 1},cancel:()=>{},reducedMotion:()=>reduced});
 assert.equal(controller.start(),true);controller.cancel();queue.shift()?.(300);assert.equal(angles.length,1);
 assert.equal(controller.start(),false);controller.reset();reduced=true;assert.equal(controller.start(),false);
});
