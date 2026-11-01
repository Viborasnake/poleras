export const steps = ['product', 'model', 'size', 'color', 'side'];
export const labels = {product:'Producto',model:'Modelo',size:'Talla',color:'Color',side:'Ubicación'};
export const names = {unisex:'Polera unisex',woman:'Polera mujer',basic:'Básica',over:'Oversize',S:'Pequeña',M:'Mediana',L:'Grande',XL:'XL',beige:'Beige',black:'Negro',front:'Frente',back:'Espalda'};
export function initialState() { return {values:{product:'unisex',model:'basic',size:'M',color:'beige',side:'front'},confirmed:[],active:'product',status:'ready',pet:false,draft:false,message:''}; }
export function options(state, key) {
  const v=state.values;
  if(key==='product')return ['unisex','woman'];
  if(key==='model')return v.product==='woman'?['basic']:['basic','over'];
  if(key==='size')return v.model==='over'?['L','XL']:['S','M','L'];
  if(key==='color')return v.model==='over'?['beige','black']:['beige'];
  return ['front','back'];
}
export function validVariant(state) { return state.status==='ready' && steps.slice(0,4).every(key=>state.confirmed.includes(key)&&options(state,key).includes(state.values[key])); }
export function complete(state) {return validVariant(state)&&state.confirmed.includes('side');}
export function price(state) {return validVariant(state)?(state.values.model==='over'?21990:15990):null;}
export function reconcile(state) {
  let predecessors=true;
  for(const key of steps){
    const opts=options(state,key);
    if(!opts.includes(state.values[key])){state.values[key]=null;state.confirmed=state.confirmed.filter(item=>item!==key);}
    if(predecessors && opts.length===1 && state.status==='ready'){
      state.values[key]=opts[0];if(!state.confirmed.includes(key))state.confirmed.push(key);
    }
    predecessors=predecessors && state.confirmed.includes(key);
  }
  state.active=steps.find(key=>!state.confirmed.includes(key))||null;
  return state;
}
export function choose(state,key,value){
  if(state.status!=='ready'||!options(state,key).includes(value)||!steps.slice(0,steps.indexOf(key)).every(item=>state.confirmed.includes(item)))return false;
  state.values[key]=value;
  if(!state.confirmed.includes(key))state.confirmed.push(key);
  const confirmedBefore=[...state.confirmed];reconcile(state);
  const lost=confirmedBefore.filter(item=>!state.confirmed.includes(item));
  state.message=lost.length?`Tu cambio requiere revisar: ${lost.map(item=>labels[item].toLowerCase()).join(', ')}. Conservamos las selecciones compatibles.`:`${labels[key]}: ${names[value]}. ${state.active?`Ahora elige ${labels[state.active].toLowerCase()}.`:'Tu selección está lista para revisar.'}`;
  return true;
}
export function restoreDraft(){
  const state=initialState();state.values={product:'unisex',model:'over',size:'M',color:'beige',side:'back'};state.confirmed=[...steps];state.draft=true;reconcile(state);
  state.message='Borrador ficticio recuperado y revalidado: Mediana no existe en Oversize. Elige otra talla; conservamos color y ubicación.';return state;
}
