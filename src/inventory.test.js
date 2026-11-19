import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStore,inventoryRows,inventoryToday,inventoryBackup,inventoryCsv,parseInventory,validateInventoryItem,inventorySuggestions} from './inventory.js';

const draft={name:'Polera básica',brand:'Gildan',color:'Azul',size:'M',price:5000,quantity:4,date:'2026-01-01',location:'Estante 2',notes:'Algodón'};
function setup(raw=null){let value=raw;return {getItem:()=>value,setItem:(_,next)=>{value=next},raw:()=>value};}
test('crear, editar, recargar, respaldar y restaurar conservan todos los campos',()=>{
 const storage=setup(),store=inventoryStore(storage),first=store.save(draft);
 const second=store.save({...draft,quantity:0,notes:'Se agotaron'},first);
 assert.equal(inventoryStore(storage).read()[0].quantity,0);
 assert.equal(second.id,first.id);
 const backup=inventoryBackup(store.read());store.remove(second);assert.deepEqual(store.read(),[]);
 assert.equal(store.restore(backup),1);assert.deepEqual(store.read(),[second]);assert.equal(store.restore(backup),0);
});
test('un inventario ilegible o mal formado nunca se reemplaza por un registro vacío',()=>{
 for(const raw of ['{','{}','[null]',JSON.stringify([{...draft,id:'one'},{...draft,id:'one'}])]){
  const storage=setup(raw),store=inventoryStore(storage);assert.throws(()=>store.read());assert.throws(()=>store.save(draft));assert.equal(storage.raw(),raw);
 }
});
test('un cambio posterior en otra pestaña bloquea edición y eliminación de la versión anterior',()=>{
 const storage=setup(),store=inventoryStore(storage),first=store.save(draft);
 store.save({...draft,quantity:9},first);
 assert.throws(()=>store.save({...draft,quantity:2},first),/otra pestaña/);
 assert.throws(()=>store.remove(first),/otra pestaña/);assert.equal(store.read()[0].quantity,9);
});
test('el respaldo no pisa versiones distintas ni importa parcialmente',()=>{
 const store=inventoryStore(setup()),first=store.save(draft);
 const backup=inventoryBackup([{...first,id:'nuevo'}, {...first,quantity:90}]);
 assert.throws(()=>store.restore(backup),/versiones distintas/);assert.deepEqual(store.read(),[first]);
 assert.throws(()=>store.restore('{"version":99}'));
});
test('precio y cantidad exigen enteros; fechas reales hasta hoy y textos obligatorios',()=>{
 for(const change of [{price:''},{price:null},{quantity:1.5},{price:-1},{quantity:Infinity},{quantity:Number.MAX_SAFE_INTEGER},{date:'2026-02-30'},{date:'9999-01-01'},{brand:'   '}])assert.throws(()=>validateInventoryItem({...draft,...change}));
 assert.equal(validateInventoryItem({...draft,quantity:0,price:0}).price,0);
 assert.equal(inventoryToday(new Date('2026-11-19T01:00:00Z')),'2026-11-18');
});
test('búsqueda sin tildes, filtros combinados y orden numérico preservan los datos de origen',()=>{
 const rows=[{...draft,id:'a'},{...draft,id:'b',quantity:0,price:1000,location:'Estante 10'},{...draft,id:'c',brand:'Otra',color:'Negro',price:9000}];
 const before=JSON.stringify(rows);
 assert.deepEqual(inventoryRows(rows,{query:'algodon azul',brand:'GILDAN',color:'azul',location:'estante 2',stock:'available'}).map(row=>row.id),['a']);
 assert.deepEqual(inventoryRows(rows,{sort:'price_asc'}).map(row=>row.id),['b','a','c']);
 assert.deepEqual(inventoryRows(rows,{stock:'empty'}).map(row=>row.id),['b']);assert.equal(JSON.stringify(rows),before);
});
test('falla de escritura se informa y mantiene el inventario anterior',()=>{
 const initial=JSON.stringify([{...draft,id:'a'}]);const store=inventoryStore({getItem:()=>initial,setItem:()=>{throw new Error('QuotaExceededError')}});
 assert.throws(()=>store.save(draft),/No pudimos guardar/);assert.deepEqual(store.read(),parseInventory(initial));
});
test('CSV conserva caracteres, comillas y saltos de línea, y neutraliza fórmulas',()=>{
 const csv=inventoryCsv([{...draft,name:'=HYPERLINK("url")',notes:'Línea 1\nLínea 2; algodón'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""url"")"'));assert.ok(csv.includes('"Línea 1\nLínea 2; algodón"'));
});
test('sugiere valores guardados tras recargar, incluidos lotes sin stock',()=>{
 const storage=setup(),store=inventoryStore(storage);store.save({...draft,name:'Dogo Premium',brand:'Roly',quantity:0});
 const reloaded=inventoryStore(storage).read();
 for(const [field,value] of [['name','Dogo Premium'],['brand','Roly'],['color','Azul'],['size','M'],['location','Estante 2']])assert.equal(inventorySuggestions(reloaded,field)[0].value,value);
});
test('filtra sugerencias sin tildes ni mayúsculas y elimina duplicados',()=>{
 const items=[{...draft,color:'Azul océano'},{...draft,color:'azul oceano'},{...draft,color:'Azul marino'}, {...draft,color:'Negro'}];
 const suggestions=inventorySuggestions(items,'color',{color:'OCEANO'});
 assert.equal(suggestions.length,1);assert.equal(suggestions[0].value,'Azul océano');assert.equal(suggestions[0].count,2);
 assert.deepEqual(inventorySuggestions(items,'color',{color:'un color nuevo'}),[]);
});
test('prioriza sugerencias del producto y marca escritos, conservando otras opciones',()=>{
 const items=[{...draft,name:'Dogo',brand:'Roly',color:'Rojo',size:'XL'},{...draft,name:'Otro',brand:'Gildan',color:'Negro',size:'S'},{...draft,name:'Otro',brand:'Gildan',color:'Negro',size:'M'}];
 assert.equal(inventorySuggestions(items,'brand',{name:'dogo'})[0].value,'Roly');
 assert.equal(inventorySuggestions(items,'color',{name:'Dogo',brand:'roly'})[0].value,'Rojo');
 assert.equal(inventorySuggestions(items,'size',{name:'Dogo',brand:'Roly',color:'Rojo'})[0].value,'XL');
 assert.equal(inventorySuggestions(items,'color',{name:'Nuevo producto'}).length,2);
 assert.deepEqual(inventorySuggestions(items,'price'),[]);
});
