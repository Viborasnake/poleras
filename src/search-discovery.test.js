import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSearchEntries,readRecentDesigns,rememberRecentDesign} from './search-discovery.js';
const entries=[
  {design:{id:'old',name:'Gato',featured:true,createdAt:'2026-01-01',acceptsCustomerImage:true},collection:{id:'pets',label:'Mascotas',category:'pets'},productSlugs:['poleras']},
  {design:{id:'new',name:'Ave',createdAt:'2026-10-22'},collection:{id:'birds',label:'Aves',category:'birds'},productSlugs:['totebags']},
  {design:{id:'unknown',name:'Juego'},collection:{id:'games',label:'Juegos',category:'games',featured:true},productSlugs:['poleras','totebags']},
];
test('explorer combines topic, product and search without leaking unrelated cards',()=>{
  assert.deepEqual(selectSearchEntries(entries,{product:'totebags',topic:'birds'}).map(e=>e.design.id),['new']);
  assert.equal(selectSearchEntries(entries,{query:'gato',product:'totebags'}).length,0);
  assert.deepEqual(selectSearchEntries(entries,{view:'custom'}).map(e=>e.design.id),['old']);
  assert.deepEqual(selectSearchEntries(entries,{view:'featured'}).map(e=>e.design.id),['old','unknown']);
});
test('new arrivals use actual publication dates; recent views use actual view order',()=>{
  assert.deepEqual(selectSearchEntries(entries,{view:'new'}).map(e=>e.design.id),['new','old']);
  assert.deepEqual(selectSearchEntries(entries,{view:'recent',recentIds:['removed','unknown','old']}).map(e=>e.design.id),['unknown','old']);
  assert.equal(selectSearchEntries(entries,{view:'recent'}).length,0);
});
test('recent history deduplicates, caps storage and tolerates unavailable or malformed storage',()=>{
  let value='not-json';const storage={getItem:()=>value,setItem:(_,next)=>value=next};
  assert.deepEqual(readRecentDesigns(storage),[]);
  const ids=rememberRecentDesign(['old','new'],'new',storage);
  assert.deepEqual(ids,['new','old']);assert.deepEqual(readRecentDesigns(storage),ids);
  assert.equal(rememberRecentDesign(Array.from({length:15},(_,i)=>String(i)),'new',storage).length,12);
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  assert.deepEqual(readRecentDesigns(denied),[]);assert.deepEqual(rememberRecentDesign([],'new',denied),['new']);
});
