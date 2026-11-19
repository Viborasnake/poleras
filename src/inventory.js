export const INVENTORY_STORAGE_KEY='droska-admin-inventory';
export const inventoryToday=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const inventoryText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es-CL');
const limits={name:100,brand:80,color:50,size:30,location:100,notes:300};
export function validateInventoryItem(input){
 if(!input||typeof input!=='object')throw new Error('El registro de inventario no es válido.');
 const item={};
 for(const [key,max] of Object.entries(limits)){
  item[key]=String(input[key]??'').trim();
  if(item[key].length>max)throw new Error(`El campo ${key} supera el largo permitido.`);
 }
 if(!item.name||!item.brand||!item.color||!item.location)throw new Error('Completa producto, marca, color y ubicación.');
 for(const key of ['price','quantity']){
  const value=input[key];item[key]=Number(value);
  if(value===null||value===undefined||String(value).trim()===''||!Number.isSafeInteger(item[key])||item[key]<0)throw new Error(key==='price'?'Ingresa un precio entero de cero o más pesos.':'Ingresa una cantidad entera de cero o más unidades.');
 }
 if(!Number.isSafeInteger(item.price*item.quantity))throw new Error('El valor total supera el monto permitido.');
 item.date=String(input.date??'');
 const parsed=new Date(`${item.date}T12:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==item.date||item.date>inventoryToday())throw new Error('Ingresa una fecha de ingreso válida, hasta hoy.');
 return item;
}
export function parseInventory(raw){
 if(raw===null)return [];
 let items;try{items=JSON.parse(raw)}catch{throw new Error('El inventario guardado no se puede leer. Descarga una copia de los datos antes de recuperarlo.');}
 if(!Array.isArray(items))throw new Error('El formato del inventario guardado no es válido.');
 const ids=new Set();
 return items.map(input=>{
  const item=validateInventoryItem(input),id=String(input.id??'');
  if(!id||ids.has(id))throw new Error('El inventario contiene identificadores inválidos o repetidos.');
  ids.add(id);return {...item,id,updated_at:String(input.updated_at??'')};
 });
}
export function inventoryStore(storage){
 const read=()=>{try{return parseInventory(storage.getItem(INVENTORY_STORAGE_KEY))}catch(error){throw new Error(error.message||'No pudimos leer el inventario de este navegador.')}};
 const write=items=>{try{storage.setItem(INVENTORY_STORAGE_KEY,JSON.stringify(items))}catch{throw new Error('No pudimos guardar. Revisa el espacio y los permisos del navegador; tus cambios siguen en el formulario.')}};
 return {
  read,
  save(draft,previous=null){
   const item=validateInventoryItem(draft),items=read();
   if(previous){
    const current=items.find(row=>row.id===previous.id);
    if(!current||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('Este registro cambió en otra pestaña. Cierra y vuelve a abrirlo para editar la versión actual.');
   }
   const record={...item,id:previous?.id||globalThis.crypto.randomUUID(),updated_at:new Date().toISOString()};
   write(previous?items.map(row=>row.id===previous.id?record:row):[record,...items]);return record;
  },
  remove(previous){
   const items=read(),current=items.find(row=>row.id===previous.id);
   if(!current||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('Este registro cambió en otra pestaña. Actualiza el inventario antes de eliminarlo.');
   write(items.filter(row=>row.id!==previous.id));
  },
  restore(raw){
   let backup;try{backup=JSON.parse(raw)}catch{throw new Error('Selecciona un respaldo JSON válido.');}
   const restored=parseInventory(JSON.stringify(Array.isArray(backup)?backup:backup?.format==='droska-inventory'&&backup.version===1?backup.items:null));
   const items=read(),known=new Map(items.map(row=>[row.id,row]));let added=0;
   for(const row of restored){
    if(known.has(row.id)){if(JSON.stringify(known.get(row.id))!==JSON.stringify(row))throw new Error('El respaldo tiene versiones distintas de registros existentes. No se modificó el inventario.');continue;}
    known.set(row.id,row);added++;
   }
   write([...known.values()]);return added;
  }
 };
}
export function inventoryRows(items,{query='',brand='',color='',location='',stock='',sort='date_desc'}={}){
 const words=inventoryText(query).split(/\s+/).filter(Boolean),[field,direction]=sort.split('_');
 return items.filter(item=>words.every(word=>inventoryText([item.name,item.brand,item.color,item.size,item.location,item.notes,item.price,item.date].join(' ')).includes(word))&&['brand','color','location'].every(key=>!({brand,color,location}[key])||inventoryText(item[key])===inventoryText({brand,color,location}[key]))&&(!stock||(stock==='available'?item.quantity>0:item.quantity===0))).sort((a,b)=>{
  const result=['price','quantity'].includes(field)?a[field]-b[field]:String(a[field]??'').localeCompare(String(b[field]??''),'es-CL',{numeric:true,sensitivity:'base'});
  return result*(direction==='desc'?-1:1)||a.name.localeCompare(b.name,'es-CL')||a.id.localeCompare(b.id);
 });
}
export function inventoryBackup(items){return JSON.stringify({format:'droska-inventory',version:1,exported_at:new Date().toISOString(),items},null,2)}
export function inventoryCsv(items){
 const cell=value=>`"${String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
 return '\uFEFF'+[['Producto','Marca','Color','Talla','Precio unitario CLP','Cantidad','Fecha de ingreso','Ubicación','Notas'],...items.map(row=>['name','brand','color','size','price','quantity','date','location','notes'].map(key=>row[key]))].map(row=>row.map(cell).join(';')).join('\r\n');
}
