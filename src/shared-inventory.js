import {INVENTORY_STORAGE_KEY, inventoryProduct, inventoryRecord, inventoryShirtName, parseInventory, parseInventoryBackup} from './inventory.js';

const migrationKey=`${INVENTORY_STORAGE_KEY}-shared-v1`;
const pageSize=500;

export function sharedInventoryStore(client,storage,products){
 const table=()=>client.from('admin_inventory_lots');
 const columns='id,lot,revision';
 let rows=new Map();
 let notice='',localBackup=null;

 async function load(){
  const current=new Map();
  let after=null;
  while(true){
   let query=table().select(columns).eq('deleted',false).order('id').limit(pageSize);
   if(after!==null)query=query.gt('id',after);
   const {data,error}=await query;
   if(error)throw new Error(error.message);
   for(const row of data)current.set(row.id,row);
   if(data.length<pageSize)break;
   after=data.at(-1).id;
  }
  rows=current;
 }

 async function importLocal(){
  let raw,items;
  try{
   if(storage.getItem(migrationKey))return;
   raw=storage.getItem(INVENTORY_STORAGE_KEY);
   items=parseInventory(raw);
  }catch{
   localBackup=raw;
   if(raw)notice='El respaldo de este navegador necesita revisión. Puedes descargarlo desde Más acciones.';
   return;
  }
  if(!items.length)return;
  const records=items.map(lot=>{
   const product=inventoryProduct(lot,products);
   if(!product||product.slug==='poleras')lot.name=inventoryShirtName(lot.name);
   return {id:lot.id,lot};
  });
  const {error}=await table().upsert(records,{onConflict:'id',ignoreDuplicates:true});
  if(error)throw new Error(`No pudimos sincronizar los lotes de este navegador. ${error.message}`);
  try{storage.setItem(migrationKey,'1')}catch{/* A later retry keeps the same lot IDs. */}
  notice='Los lotes de este navegador ya están disponibles en el inventario compartido.';
 }

 async function update(previous,changes){
  const {data,error}=await table().update({...changes,revision:crypto.randomUUID()})
   .eq('id',previous.id).eq('revision',rows.get(previous.id).revision).eq('deleted',false)
   .select(columns).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Este lote cambió en otro dispositivo. Recarga el inventario y vuelve a intentarlo.');
  return data;
 }

 return {
  get notice(){return notice},
  get localBackup(){return localBackup},
  async open(){await importLocal();await load()},
  read:()=>[...rows.values()].map(row=>row.lot),
  async save(draft,previous=null){
   const lot=inventoryRecord(draft,previous);
   if(previous)rows.set(lot.id,await update(previous,{lot}));
   else{
    const {data,error}=await table().insert({id:lot.id,lot}).select(columns).single();
    if(error)throw new Error(error.message);
    rows.set(lot.id,data);
   }
   return lot;
  },
  async remove(previous){
   await update(previous,{deleted:true,lot:{id:previous.id}});
   rows.delete(previous.id);
  },
  async restore(raw){
   const lots=parseInventoryBackup(raw);
   const {data,error}=await client.rpc('restore_admin_inventory_lots',{lots});
   if(error)throw new Error(error.message);
   await load();
   return data;
  },
 };
}
