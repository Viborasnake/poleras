import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCT_COLORS,DEFAULT_PRODUCT_COLOR_CODES,activeProductColorCodes,activeProductColorHexes,incompatibleDesignColorProducts,invalidDesignProductColors,productColorAvailability,productColorGroups} from './product-colors.js';

test('el catálogo maestro conserva códigos y tonos únicos',()=>{
 assert.equal(PRODUCT_COLORS.length,26);
 assert.equal(new Set(PRODUCT_COLORS.map(color=>color.code)).size,PRODUCT_COLORS.length);
 assert.equal(new Set(PRODUCT_COLORS.map(color=>color.hex)).size,PRODUCT_COLORS.length);
 assert.ok(PRODUCT_COLORS.every(color=>/^#[0-9a-f]{6}$/.test(color.hex)));
 assert.deepEqual(productColorGroups().map(group=>group.id),['neutral','blue','green','purple','red','warm','brown']);
});

test('las disponibilidades iniciales corresponden a cada familia solicitada',()=>{
 assert.deepEqual(DEFAULT_PRODUCT_COLOR_CODES.poleras,['white','black','beige','dark_blue','dark_green','dark_coffee','red']);
 assert.deepEqual(DEFAULT_PRODUCT_COLOR_CODES.bodys,['white','black','dark_blue','dark_coffee','red']);
 assert.deepEqual(DEFAULT_PRODUCT_COLOR_CODES.totebags,['beige']);
});

test('detecta los colores activos por familia sin mezclar modelos',()=>{
 const variants=[
  {active:true,color_hex:'#FFFFFF',product_models:{code:'basic',active:true}},
  {active:true,color_hex:'#202124',product_models:{code:'woman',active:true}},
  {active:true,color_hex:'#C73532',product_models:{code:'body',active:true}},
  {active:true,color_hex:'#D9C7A4',product_models:{code:'tote',active:true}},
  {active:false,color_hex:'#24452F',product_models:{code:'basic',active:true}},
 ];
 assert.deepEqual(activeProductColorCodes(variants,'poleras'),['white','black']);
 assert.deepEqual(activeProductColorCodes(variants,'bodys'),['red']);
 assert.deepEqual(activeProductColorCodes(variants,'totebags'),['beige']);
 assert.deepEqual(activeProductColorCodes(variants,'afiches'),[]);
 assert.deepEqual(activeProductColorHexes(variants,['poleras','bodys']),['#ffffff','#202124','#c73532']);
 assert.deepEqual(activeProductColorHexes(variants,'totebags'),['#d9c7a4']);
 assert.deepEqual(activeProductColorHexes(variants,['afiches']),[]);
});

test('detecta productos vinculados que desaparecerían por falta de colores compatibles',()=>{
 const variants=[
  {active:true,color_hex:'#FFFFFF',product_models:{code:'basic',active:true}},
  {active:true,color_hex:'#C73532',product_models:{code:'body',active:true}},
  {active:true,color_hex:'#D9C7A4',product_models:{code:'tote',active:true}},
 ];
 assert.deepEqual(incompatibleDesignColorProducts(variants,['poleras','bodys','totebags'],['#c79a2b']),['poleras','bodys']);
 assert.deepEqual(incompatibleDesignColorProducts(variants,['poleras','bodys','totebags'],['#ffffff','#c73532']),[]);
 assert.deepEqual(incompatibleDesignColorProducts(variants,['totebags'],['#c79a2b']),[]);
 assert.deepEqual(incompatibleDesignColorProducts(variants,['poleras'],null),[]);
});

test('valida el subconjunto independiente de cada producto, incluida la totebag',()=>{
 const variants=[
  {active:true,color_hex:'#FFFFFF',product_models:{code:'basic',active:true}},
  {active:true,color_hex:'#C73532',product_models:{code:'body',active:true}},
  {active:true,color_hex:'#D9C7A4',product_models:{code:'tote',active:true}},
 ];
 assert.deepEqual(productColorAvailability(variants,'totebags').map(color=>color.code),['beige']);
 assert.deepEqual(invalidDesignProductColors(variants,{poleras:['#ffffff'],bodys:[],totebags:['#d9c7a4']},['poleras','bodys','totebags']),['bodys']);
 assert.deepEqual(invalidDesignProductColors(variants,{poleras:['#c79a2b'],totebags:['#202124']},['poleras','totebags']),['poleras','totebags']);
});
