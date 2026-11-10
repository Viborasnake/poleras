import test from 'node:test';
import assert from 'node:assert/strict';
import {studioPreviewState} from './studio-preview.js';

test('cambiar de ubicación o añadir una vacía conserva todos los archivos del visor',()=>{
 const state={mode:'ready',printSide:'front',printSides:['front','back'],images:{front:'front.png',back:'back.png'},additionalPrints:[{id:'arm',side:'front',image:'arm.png',configuration:{placement:'sleeve_both',size:'pocket'}},{id:'pocket',side:'front',image:'',configuration:{placement:'chest_left',size:'pocket'}}]};
 for(const activePrintId of [null,'arm','pocket']){
  const preview=studioPreviewState({...state,activePrintId},'placeholder');
  assert.deepEqual(preview.printLayers.map(item=>item.image),['front.png','back.png','arm.png']);
  assert.equal(preview.printLayers[2].placement,'sleeve_both');
 }
});

for (const subject of ['pets', 'people']) {
 test(`conserva el estampado de catálogo al personalizar ${subject}`, () => {
  const state = {mode:'ready',catalogDesign:'Diseño elegido',catalogDesignCustomerImage:true,customerPhotoSubject:subject,printSide:'front',images:{front:'/arte.webp'},petRequest:{url:'/foto-cliente.jpg'}};
  assert.equal(studioPreviewState(state, '/placeholder.svg').image, '/arte.webp');
  assert.equal(studioPreviewState({...state,printSide:'back',images:{back:'/arte-tote.webp'}}, '/placeholder.svg').image, '/arte-tote.webp');
  assert.equal(state.petRequest.url, '/foto-cliente.jpg');
 });
}
test('archivo propio reemplaza el marcador y respeta el lado seleccionado', () => {
 const state = {mode:'ready',isDefault:true,printSide:'front',images:{}};
 assert.equal(studioPreviewState(state, '/placeholder.svg').image, '/placeholder.svg');
 assert.equal(studioPreviewState({...state,images:{front:'blob:archivo'}}, '/placeholder.svg').image, 'blob:archivo');
 assert.equal(studioPreviewState({...state,isDefault:false,printSide:'back',images:{front:'blob:archivo'}}, '/placeholder.svg').image, '');
});
test('un catálogo sin arte no se sustituye por el marcador de diseño propio', () => {
 assert.equal(studioPreviewState({mode:'ready',catalogDesign:'Elegido',isDefault:true,images:{},printSide:'front'}, '/placeholder.svg').image, '');
});
test('la vista usa posición, tamaño y movimiento de la cara activa', () => {
 const preview=studioPreviewState({mode:'ready',isDefault:false,printSide:'front',images:{front:'/arte.webp'},printConfigurations:{front:{placement:'chest_left',size:'pocket',scale:.55,offsetX:1,offsetY:-2}}},'/placeholder.svg');
 assert.deepEqual({placement:preview.printPlacement,scale:preview.printScale,x:preview.printOffsetX,y:preview.printOffsetY},{placement:'chest_left',scale:.55,x:1,y:-2});
});
