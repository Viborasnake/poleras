// State is separate from field values: a prefilled value is not a confirmed choice.
export function createDisclosureState(saved) {
 return {version:1,confirmed:saved?.version===1&&saved.confirmed&&typeof saved.confirmed==='object'?{...saved.confirmed}:{},active:null,message:'',focus:null};
}
export function reconcileDisclosure(state,steps,{ready=true}={}) {
 // A network failure is not evidence that previously chosen values are invalid.
 if(!ready){
  const pending=steps.find(step=>!Object.hasOwn(state.confirmed,step.id))?.id||steps[0]?.id||null;
  state.unavailable=true;state.active=state.active||pending;
  return {complete:false,pending,lost:[]};
 }
 if(state.unavailable){state.unavailable=false;state.active=null;}
 const lost=[];
 for(const key of Object.keys(state.confirmed))if(!steps.some(step=>step.id===key))delete state.confirmed[key];
 let preceding=true;
 for(const step of steps){
  if(Object.hasOwn(state.confirmed,step.id)&&(!step.valid||state.confirmed[step.id]!==step.value)){
   delete state.confirmed[step.id];lost.push(step.title);
  }
  if(ready&&preceding&&step.single&&step.valid)state.confirmed[step.id]=step.value;
  preceding=preceding&&Object.hasOwn(state.confirmed,step.id);
 }
 const pending=steps.find(step=>!Object.hasOwn(state.confirmed,step.id));
 if(!state.active||!steps.some(step=>step.id===state.active)||steps.some(step=>step.id===state.active&&step.single&&Object.hasOwn(state.confirmed,step.id))||lost.length)state.active=pending?.id||null;
 if(lost.length)state.message=`Revisa ${lost.join(', ').toLocaleLowerCase('es-CL')}. Conservamos las selecciones compatibles.`;
 return {complete:ready&&!pending,pending:pending?.id||null,lost};
}
export function confirmDisclosure(state,steps,id,{ready=true}={}) {
 const index=steps.findIndex(step=>step.id===id),step=steps[index];
 if(!ready||!step?.valid||steps.slice(0,index).some(item=>!Object.hasOwn(state.confirmed,item.id)))return false;
 state.confirmed[id]=step.value;state.active=null;state.message='';
 const result=reconcileDisclosure(state,steps,{ready});
 if(!result.lost.length)state.message=`${step.title}: ${step.summary}. ${result.pending?'Continúa con la siguiente decisión.':'Tu selección está lista.'}`;
 state.focus=result.pending||'next';return true;
}
let disclosureFocusFromKeyboard=false,disclosureFocusTracking=false;
function trackDisclosureFocusModality(){
 if(disclosureFocusTracking||typeof document==='undefined')return;
 disclosureFocusTracking=true;
 document.addEventListener('keydown',()=>{disclosureFocusFromKeyboard=true},{capture:true});
 document.addEventListener('pointerdown',()=>{disclosureFocusFromKeyboard=false},{capture:true});
}
export function focusDisclosure(element,{align='nearest'}={}){
 if(!element)return;
 trackDisclosureFocusModality();
 element.toggleAttribute?.('data-disclosure-silent-focus',!disclosureFocusFromKeyboard);
 element.addEventListener?.('blur',()=>element.removeAttribute?.('data-disclosure-silent-focus'),{once:true});
 element.focus({preventScroll:true});
 const bounds=element.getBoundingClientRect();
 const studio=element.closest('#studio');
 const scroller=studio?.classList.contains('is-request-mode')?studio.querySelector('.studio-body'):element.closest('.studio-controls');
 const clip=scroller?.getBoundingClientRect();
 if(align==='start'||bounds.top<(clip?.top??0)+12||bounds.bottom>Math.min(innerHeight,clip?.bottom??innerHeight)-12)element.scrollIntoView({block:align,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
// Moves existing nodes rather than cloning them, preserving input and file state.
export function mountDisclosure({container,state,steps,ready=true,onEdit=()=>{},idPrefix='disclosure',multiple=false}){
 if(multiple&&!state.expanded)state.expanded={};
 container.classList.add('ds-disclosure-group');
 const entries=steps.map((step,index)=>{
  const node=step.node;if(!node)return null;
  const panel=document.createElement('fieldset');panel.className='ds-disclosure-panel';panel.id=`${idPrefix}-${step.id}-panel`;
  const legend=document.createElement('legend');legend.className='ds-disclosure-legend';legend.textContent=step.title;panel.append(legend);
  while(node.firstChild)panel.append(node.firstChild);
  node.classList.add('ds-disclosure');
  const header=document.createElement('div');header.className='ds-disclosure-head';
  const number=document.createElement('span');number.className='ds-disclosure-number';
  const copy=document.createElement('div'),heading=document.createElement('h3'),summary=document.createElement('p');
  heading.textContent=step.title;heading.tabIndex=-1;heading.id=`${idPrefix}-${step.id}-heading`;
  copy.append(heading,summary);header.append(number,copy);
  const edit=document.createElement('button');edit.type='button';edit.className='ds-disclosure-edit';edit.setAttribute('aria-label',`Editar ${step.title.toLocaleLowerCase('es-CL')}`);edit.setAttribute('aria-controls',panel.id);edit.dataset.disclosureEdit=step.id;
  edit.onclick=()=>{
   if(multiple){
    const open=Boolean(state.expanded[step.id]);
    if(open)delete state.expanded[step.id];else state.expanded[step.id]=true;
    state.active=null;
   }else state.active=state.active===step.id?reconcileDisclosure(state,steps,{ready}).pending:step.id;
   state.focus=`edit:${step.id}`;onEdit();
  };header.append(edit);
  if(!step.preserveSelection&&!Object.hasOwn(state.confirmed,step.id))panel.querySelectorAll('.selected,.chosen,[aria-pressed="true"]').forEach(control=>{control.classList.remove('selected','chosen');if(control.hasAttribute('aria-pressed'))control.setAttribute('aria-pressed','false')});
  node.append(header,panel);return {step,node,panel,number,heading,summary,edit,index};
 }).filter(Boolean);
 const status=document.createElement('p');status.className='ds-disclosure-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');container.prepend(status);
 const update=()=>{
  const result=reconcileDisclosure(state,steps,{ready});
  for(const {step,node,panel,number,summary,edit,index} of entries){
   const done=Object.hasOwn(state.confirmed,step.id),active=state.active===step.id||Boolean(multiple&&state.expanded[step.id]);
   node.classList.toggle('is-active',active);node.classList.toggle('is-complete',done);
   if(active)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
   panel.hidden=!active;panel.disabled=!active;number.textContent=done?'✓':String(index+1).padStart(2,'0');
   if(done){number.removeAttribute('aria-hidden');number.setAttribute('role','img');number.setAttribute('aria-label','Completado')}else{number.setAttribute('aria-hidden','true');number.removeAttribute('role');number.removeAttribute('aria-label')}
   summary.textContent=done?`${step.summary}${step.single?` · ${step.singleLabel||'Única opción'}`:''}`:active?(step.instruction||'Elige una opción para continuar'):'Pendiente';
   edit.hidden=!done||Boolean(step.single);edit.textContent=active?'Cerrar':'Editar';edit.setAttribute('aria-expanded',String(active));
  }
  status.textContent=state.message||'Al elegir una opción, se abre la siguiente decisión. Puedes editar lo anterior.';
  return result;
 };
 const setExpanded=ids=>{if(!multiple)return update();state.expanded=Object.fromEntries(ids.filter(id=>steps.some(step=>step.id===id)).map(id=>[id,true]));state.active=null;return update()};
 return {...update(),update,entries,status,setExpanded,expandedIds:()=>multiple?Object.keys(state.expanded):[]};
}
