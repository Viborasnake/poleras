import test from 'node:test';
import assert from 'node:assert/strict';
import {garmentPrintLayers,createPrintLayerCollection} from './garment-print-layers.js';

test('ambos brazos generan dos estampados sin reemplazar frente o espalda',()=>{
 const layers=garmentPrintLayers({printLayers:[{id:'front',image:'front.png',placement:'center'},{id:'back',image:'back.png',placement:'center'},{id:'arm',image:'arm.png',placement:'sleeve_both'}]});
 assert.deepEqual(layers.map(item=>item.id),['front','back','arm:sleeve_left','arm:sleeve_right']);
 assert.equal(layers[2].image,layers[3].image);
 assert.equal(garmentPrintLayers({printLayers:[],image:'stale.png'}).length,0);
 assert.equal(garmentPrintLayers({image:'catalog.png'}).length,1);
});
test('añadir y editar conserva las otras mallas y sus texturas',async()=>{
 const built=[],removed=[];
 const prints=createPrintLayerCollection({build:async layer=>{built.push(layer.id);return {...layer}},attach:()=>{},dispose:resource=>removed.push(resource.id)});
 const front={id:'front',image:'a'},back={id:'back',image:'b'};
 await prints.update([front],{});const first=prints.entries.get('front').resource;
 await prints.update([front,back],{});assert.equal(prints.entries.get('front').resource,first);
 await prints.update([front,{...back,image:'b2'}],{});
 assert.equal(prints.entries.get('front').resource,first);assert.deepEqual(built,['front','back','back']);assert.deepEqual(removed,['back']);
 await prints.update([front],{});assert.deepEqual(removed,['back','back']);
 prints.dispose();assert.deepEqual(removed,['back','back','front']);
});
test('una carga atrasada no revive un estampado quitado ni reemplaza el nuevo',async()=>{
 const loaders=new Map(),attached=[],removed=[];
 const prints=createPrintLayerCollection({build:layer=>new Promise(resolve=>loaders.set(layer.image,()=>resolve(layer))),attach:resource=>attached.push(resource.image),dispose:resource=>removed.push(resource.image)});
 const first=prints.update([{id:'front',image:'old'}],{});
 const second=prints.update([{id:'front',image:'new'}],{});
 loaders.get('new')();await second;loaders.get('old')();await first;
 assert.deepEqual(attached,['new']);assert.deepEqual(removed,['old']);
 const late=prints.update([{id:'arm',image:'late'}],{});await prints.update([],{});loaders.get('late')();await late;
 assert.deepEqual(attached,['new']);assert.equal(prints.entries.size,0);assert.ok(removed.includes('late'));
});
