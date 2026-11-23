export const INVENTORY_STORAGE_KEY='droska-admin-inventory';
export const inventoryToday=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const inventoryText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es-CL');
export const INVENTORY_MODELS=[{code:'basic',name:'Unisex'},{code:'over',name:'Oversize'},{code:'woman',name:'Mujer'},{code:'kid',name:'Niños'},{code:'body',name:'Body bebé'},{code:'tote',name:'Tote bag'},{code:'other',name:'Otro modelo'}];
export const inventoryModelLabel=item=>INVENTORY_MODELS.find(model=>model.code===item.model_code)?.name||'Sin modelo';
export const inventoryModelOptions=product=>product?.slug==='poleras'?INVENTORY_MODELS.slice(0,4):[];
export function inventoryProduct(item,products=[]){
 if(item.product_type_id){
  const current=products.find(product=>String(product.id)===String(item.product_type_id));
  return current||{id:item.product_type_id,name:item.product_type_name||'Producto anterior',slug:item.product_type_slug||'',missing:true};
 }
 // Old versions stored garment models, not catalog products. Preserve those
 // explicit model selections and resolve only their known parent family.
 const slug=({basic:'poleras',over:'poleras',woman:'poleras',kid:'poleras',body:'bodys',tote:'totebags'})[item.model_code];
 return slug?products.find(product=>product.slug===slug)||null:null;
}
export const inventoryProductType=(item,products=[])=>inventoryProduct(item,products)?.name||'Sin clasificar';
export function inventoryShirtName(value){
 const original=String(value??'').trim(),cleaned=original.replace(/^poleras?\b[\s·:–—-]+/i,'').trim();
 return cleaned||original;
}
export const INVENTORY_DEFAULT_GROUP='name-brand';
export function inventoryGroups(items,groupBy=INVENTORY_DEFAULT_GROUP,products=[]){
 const groups=new Map();
 const byNameBrand=groupBy===INVENTORY_DEFAULT_GROUP;
 for(const item of items){
  let key,name,order;
  if(byNameBrand){
   key=JSON.stringify([item.name,item.brand].map(value=>inventoryText(value).replace(/\s+/g,' ')));
   name=`${item.name} · ${item.brand}`;
  }else if(groupBy==='none'){
   key='all';name='Todos los lotes';order=0;
  }else{
   const product=inventoryProduct(item,products),id=String(product?.id||'');
   key=groupBy==='model'?JSON.stringify([id,item.model_code||'']):id;
   name=`${product?.name||'Sin clasificar'}${product?.missing?' (eliminado)':''}${groupBy==='model'&&product?.slug==='poleras'?` · ${inventoryModelLabel(item)}`:''}`;
   const index=products.findIndex(row=>String(row.id)===id);
   order=index<0?Infinity:index;
  }
  if(!groups.has(key))groups.set(key,{key,code:`g-${groups.size}`,name,items:[],units:0,value:0,order});
  const group=groups.get(key);group.items.push(item);group.units+=item.quantity;group.value+=item.price*item.quantity;
 }
 const result=[...groups.values()];
 return byNameBrand
  ?result.sort((a,b)=>a.name.localeCompare(b.name,'es-CL',{numeric:true,sensitivity:'base'}))
  :result.sort((a,b)=>a.order-b.order);
}
export const INVENTORY_SUGGESTION_FIELDS=['name','brand','color','size','location'];
export function inventorySuggestions(items,field,values={}){
 if(!INVENTORY_SUGGESTION_FIELDS.includes(field))return [];
 const dependencies={name:['brand'],brand:['name'],color:['name','brand'],size:['name','brand','color'],location:['name','brand','color','size']}[field];
 const context=['product_type_id','model_code',...dependencies].filter(key=>inventoryText(values[key]));
 const words=inventoryText(values[field]).split(/\s+/).filter(Boolean),options=new Map();
 for(const item of items){
  const value=String(item[field]??'').trim(),key=inventoryText(value);
  if(!key||!words.every(word=>key.includes(word)))continue;
  const contextual=context.length>0&&context.every(name=>inventoryText(item[name])===inventoryText(values[name]));
  const previous=options.get(key);
  if(previous){previous.count++;previous.contextual||=contextual}
  else options.set(key,{value,count:1,contextual});
 }
 const query=inventoryText(values[field]);
 return [...options.values()].sort((a,b)=>Number(b.contextual)-Number(a.contextual)||Number(inventoryText(b.value).startsWith(query))-Number(inventoryText(a.value).startsWith(query))||b.count-a.count||a.value.localeCompare(b.value,'es-CL',{numeric:true,sensitivity:'base'}));
}
const limits={name:100,brand:80,color:50,size:30,location:100,notes:300};
export function validateInventoryItem(input){
 if(!input||typeof input!=='object')throw new Error('El registro de inventario no es válido.');
 const item={};
 item.model_code=String(input.model_code??'').trim();
 if(item.model_code&&!INVENTORY_MODELS.some(type=>type.code===item.model_code))throw new Error('Selecciona un modelo válido.');
 for(const key of ['product_type_id','product_type_name','product_type_slug']){
  item[key]=String(input[key]??'').trim();
  if(item[key].length>120)throw new Error('La referencia de producto no es válida.');
 }
 if(item.product_type_slug==='poleras'&&item.model_code&&!inventoryModelOptions({slug:'poleras'}).some(model=>model.code===item.model_code))throw new Error('El modelo no corresponde a Poleras.');
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
export function parseInventoryBackup(raw){
 let backup;try{backup=JSON.parse(raw)}catch{throw new Error('Selecciona un respaldo JSON válido.');}
 return parseInventory(JSON.stringify(Array.isArray(backup)?backup:backup?.format==='droska-inventory'&&backup.version===1?backup.items:null));
}
export function inventoryRecord(draft,previous){
 const item=validateInventoryItem(draft);
 if(item.product_type_slug==='poleras')item.name=inventoryShirtName(item.name);
 return {...item,id:previous?.id||globalThis.crypto.randomUUID(),updated_at:new Date().toISOString()};
}
export function inventoryStore(storage){
 const read=()=>{try{return parseInventory(storage.getItem(INVENTORY_STORAGE_KEY))}catch(error){throw new Error(error.message||'No pudimos leer el inventario de este navegador.')}};
 const write=items=>{try{storage.setItem(INVENTORY_STORAGE_KEY,JSON.stringify(items))}catch{throw new Error('No pudimos guardar. Revisa el espacio y los permisos del navegador; tus cambios siguen en el formulario.')}};
 return {
  read,
  removeShirtPrefixes(products=[]){
   // Update only names and their timestamps, retaining every other stored field.
   const raw=storage.getItem(INVENTORY_STORAGE_KEY),items=parseInventory(raw),changes=new Map();
   for(const item of items){
    const product=inventoryProduct(item,products),name=inventoryShirtName(item.name);
    if((!product||product.slug==='poleras')&&name!==item.name)changes.set(item.id,name);
   }
   if(!changes.size)return 0;
   const now=new Date().toISOString();
   write(JSON.parse(raw).map(item=>changes.has(String(item.id))?{...item,name:changes.get(String(item.id)),updated_at:now}:item));
   return changes.size;
  },
  save(draft,previous=null){
   const record=inventoryRecord(draft,previous),items=read();
   if(previous){
    const current=items.find(row=>row.id===previous.id);
    if(!current||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('Este registro cambió en otra pestaña. Cierra y vuelve a abrirlo para editar la versión actual.');
   }
   write(previous?items.map(row=>row.id===previous.id?record:row):[record,...items]);return record;
  },
  remove(previous){
   const items=read(),current=items.find(row=>row.id===previous.id);
   if(!current||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('Este registro cambió en otra pestaña. Actualiza el inventario antes de eliminarlo.');
   write(items.filter(row=>row.id!==previous.id));
  },
  restore(raw){
   const restored=parseInventoryBackup(raw);
   const items=read(),known=new Map(items.map(row=>[row.id,row]));let added=0;
   for(const row of restored){
    if(known.has(row.id)){if(JSON.stringify(known.get(row.id))!==JSON.stringify(row))throw new Error('El respaldo tiene versiones distintas de registros existentes. No se modificó el inventario.');continue;}
    known.set(row.id,row);added++;
   }
   write([...known.values()]);return added;
  }
 };
}
export function inventoryRows(items, filters={}, products=[]){
 const {query='',notesQuery='',stock='',product_type_id='',model_code='',sort='date_desc',
  priceMin='',priceMax='',quantityMin='',quantityMax='',dateFrom='',dateTo=''}=filters;
 const words=inventoryText(query).split(/\s+/).filter(Boolean),[field,direction]=sort.split('_');
 const notesTerm=inventoryText(notesQuery);
 const terms=['brand','color','size','location'].filter(key=>filters[key]).map(key=>[key,inventoryText(filters[key])]);
 const within=(value,min,max)=>(min===''||value>=min)&&(max===''||value<=max);
 return items.filter(item=>{
  const product=inventoryProduct(item,products);
  if(product_type_id&&(product_type_id==='unclassified'?product:String(product?.id)!==product_type_id))return false;
  if(model_code&&(model_code==='unclassified'?item.model_code:item.model_code!==model_code))return false;
  if(stock&&(stock==='available'?item.quantity<=0:item.quantity!==0))return false;
  if(!within(item.price,priceMin,priceMax)||!within(item.quantity,quantityMin,quantityMax)||!within(item.date,dateFrom,dateTo))return false;
  if(!terms.every(([key,term])=>term==='__no_size__'&&key==='size'?!item.size:inventoryText(item[key])===term))return false;
  if(notesTerm&&!inventoryText(item.notes).includes(notesTerm))return false;
  if(!words.length)return true;
  const searchable=inventoryText([product?.name||'Sin clasificar',inventoryModelLabel(item),item.name,item.brand,item.color,item.size,item.location,item.notes,item.price,item.date].join(' '));
  return words.every(word=>searchable.includes(word));
 }).sort((a,b)=>{
  const result=['price','quantity'].includes(field)?a[field]-b[field]:String(a[field]??'').localeCompare(String(b[field]??''),'es-CL',{numeric:true,sensitivity:'base'});
  return result*(direction==='desc'?-1:1)||a.name.localeCompare(b.name,'es-CL')||a.id.localeCompare(b.id);
 });
}
export function inventoryBackup(items){return JSON.stringify({format:'droska-inventory',version:1,exported_at:new Date().toISOString(),items},null,2)}
export function inventoryCsv(items,products=[]){
 const cell=value=>`"${String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
 return '\uFEFF'+[['Producto','Modelo','Nombre / referencia','Marca','Color','Talla','Precio unitario CLP','Cantidad','Fecha de ingreso','Ubicación','Notas'],...items.map(row=>[inventoryProductType(row,products),inventoryModelLabel(row),...['name','brand','color','size','price','quantity','date','location','notes'].map(key=>row[key])])].map(row=>row.map(cell).join(';')).join('\r\n');
}
