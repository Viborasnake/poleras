import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCatalog} from './catalog-search.js';
const entries=[
  {design:{id:'bird',name:'Siete colores',caption:'Ave chilena'},collection:{label:'Aves Ukiyo-E'},category:'Fauna',products:['Poleras','Totebags']},
  {design:{id:'pet',name:'La Playera',acceptsCustomerImage:true},collection:{label:'Tu mascota'},category:'Mascotas',products:['Poleras','Bodys']},
  {design:{id:'anime',name:'Guerrera del fuego'},collection:{label:'Retro Anime'},category:'Anime',products:['Poleras']},
  {design:{id:'exact',name:'Anime'},collection:{label:'Originales'},products:['Poleras']},
];
const ids=query=>searchCatalog(entries,query).map(entry=>entry.design.id);
test('search ranks exact names before matching collections and handles accents',()=>{
  assert.deepEqual(ids('ánime'),['exact','anime']);
  assert.deepEqual(ids('siete COLORES'),['bird']);
});
test('search matches topics, compatible products, personalization and pet aliases',()=>{
  assert.deepEqual(ids('fauna'),['bird']);
  assert.deepEqual(ids('tote'),['bird']);
  assert.deepEqual(ids('diseño para perros'),['pet']);
  assert.deepEqual(ids('personalizable'),['pet']);
  assert.deepEqual(ids('gatos'),['pet']);
  assert.deepEqual(ids('regalo para alguien que ama los gatos'),['pet']);
});
test('small typos are tolerated without returning unrelated matches',()=>{
  assert.deepEqual(ids('guerrra'),['anime']);
  assert.deepEqual(ids('ornitorrinco'),[]);
  assert.deepEqual(ids('fauna body'),[]);
});
test('gift suggestions and empty queries explore the existing catalogue only',()=>{
  assert.equal(ids('regalos').length,4);
  assert.equal(ids('cumpleaños').length,4);
  assert.equal(ids('').length,4);
  assert.equal(entries[0].design.id,'bird');
});
