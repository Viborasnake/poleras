// Expand a two-sleeve order into two render instances of the same file.
export function garmentPrintLayers(state){
 const layers=Array.isArray(state.printLayers)?state.printLayers:[{id:'artwork',image:state.image,side:state.printSide||'front',placement:state.printPlacement||'center',scale:state.printScale||1,offsetX:state.printOffsetX||0,offsetY:state.printOffsetY||0}];
 return layers.filter(layer=>layer.image).flatMap(layer=>layer.placement==='sleeve_both'
  ? ['sleeve_left','sleeve_right'].map(placement=>({...layer,id:`${layer.id}:${placement}`,placement}))
  : [layer]);
}

// Each layer owns its pending load and resources. A late texture must never
// revive a removed layer or overwrite a newer version of that layer.
export function createPrintLayerCollection({build,attach,dispose,onError=()=>{}}){
 const entries=new Map();let closed=false;
 return {
  entries,
  async update(layers,context){
   if(closed)return;
   const wanted=new Set(layers.map(layer=>layer.id));
   for(const [id,entry] of entries)if(!wanted.has(id)){entries.delete(id);if(entry.resource)dispose(entry.resource);}
   await Promise.all(layers.map(async layer=>{
    const key=JSON.stringify([layer,context]);let entry=entries.get(layer.id);
    if(entry?.key===key)return entry.pending;
    const previous=entry?.resource;
    entry={key,resource:previous};entries.set(layer.id,entry);
    entry.pending=(async()=>{
     try{
      const resource=await build(layer,context);
      if(closed||entries.get(layer.id)!==entry){dispose(resource);return;}
      if(previous)dispose(previous);
      entry.resource=resource;attach(resource,layer);
     }catch(error){
      if(!closed&&entries.get(layer.id)===entry){entry.key=null;onError(error);}
     }
    })();
    return entry.pending;
   }));
  },
  dispose(){closed=true;for(const entry of entries.values())if(entry.resource)dispose(entry.resource);entries.clear();}
 };
}
