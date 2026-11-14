const sizeCollator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
const garmentOrder=['XS','S','M','L','XL','XXL'];
const toteOrder=['S','M','L'];
const namedSizes={S:'Pequeña',M:'Mediana',L:'Grande'};
const catalogKey=(kind,size)=>`${kind==='kids'?'kid':kind}:${size}`;

export function createProductSizeCatalog(rows=[]){
 const catalog=new Map();
 for(const row of rows){
  const model=String(row.model_code||'').trim(),size=String(row.size_code||'').trim();
  if(!model||!size)continue;
  catalog.set(`${model}:${size}`,{label:String(row.label||'').trim()||size,sortOrder:Number(row.sort_order)||0});
 }
 return catalog;
}

export function productSizeLabel(catalog,kind,size){
 const configured=catalog.get(catalogKey(kind,size))?.label;
 if(configured)return configured;
 return ['basic','over','woman','tote'].includes(kind)?namedSizes[size]||size:size;
}

export function sortProductSizes(catalog,kind,available){
 const fallbackOrder=kind==='tote'?toteOrder:['basic','over','woman'].includes(kind)?garmentOrder:[];
 return [...available].sort((a,b)=>{
  const aConfigured=catalog.get(catalogKey(kind,a)),bConfigured=catalog.get(catalogKey(kind,b));
  if(aConfigured&&bConfigured&&aConfigured.sortOrder!==bConfigured.sortOrder)return aConfigured.sortOrder-bConfigured.sortOrder;
  const aIndex=fallbackOrder.indexOf(a),bIndex=fallbackOrder.indexOf(b);
  if(aIndex!==-1||bIndex!==-1)return (aIndex===-1?Infinity:aIndex)-(bIndex===-1?Infinity:bIndex);
  return sizeCollator.compare(a,b);
 });
}
