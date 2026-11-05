import {confirmDisclosure,mountDisclosure,focusDisclosure} from './progressive-disclosure.js';

export function fieldSnapshot(node){
 return JSON.stringify([...node.querySelectorAll('input,select,textarea')].filter(field=>!['file','password','hidden','button','submit'].includes(field.type)).map((field,index)=>[field.name||field.id||field.dataset.petValue||index,['radio','checkbox'].includes(field.type)?field.checked:field.value]));
}
export function conciseSummary(value,limit=160){const text=String(value);return text.length>limit?`${text.slice(0,limit-1)}…`:text;}
export function fieldSummary(node,{limit=160}={}){
 const text= [...node.querySelectorAll('input,select,textarea')].filter(field=>!['file','password','hidden','button','submit'].includes(field.type)&&(!['checkbox','radio'].includes(field.type)||field.checked)).map(field=>field.tagName==='SELECT'?field.selectedOptions[0]?.textContent:field.value.trim()).filter(Boolean).join(' · ')||'Sin información adicional';
 return conciseSummary(text,limit);
}
function withEnabledPanel(panel,callback){const disabled=panel.disabled;panel.disabled=false;try{return callback()}finally{panel.disabled=disabled}}
function invalidField(panel){
 return withEnabledPanel(panel,()=>[...panel.querySelectorAll('input,select,textarea')].find(field=>!field.disabled&&(!field.validity.valid||field.required&&field.type!=='file'&&!['checkbox','radio'].includes(field.type)&&!field.value.trim())));
}
// Fields stay mounted while typing. Only explicit confirmation advances a block.
export function mountFormDisclosure({container,state,steps,finalButton,form=finalButton?.closest('form'),review=null,prefix='form-flow',busy=()=>false,onConfirm=()=>{},onChange=()=>{},autoFocus=true,multiple=false,reviewOnFinal=false}){
 const abort=new AbortController(),signal=abort.signal;
 const firstVisit=!state.active&&!Object.keys(state.confirmed).length;
 const definitions=steps.map(step=>({...step,single:typeof step.single==='function'?step.single():step.single,preserveSelection:true,instruction:step.instruction||'Completa y confirma para continuar',value:String(step.value?step.value():fieldSnapshot(step.node)),summary:String(step.summary?step.summary():fieldSummary(step.node)),valid:!invalidField(step.node)&&(!step.valid||step.valid())}));
 const view=mountDisclosure({container,state,steps:definitions,idPrefix:prefix,multiple,onEdit:()=>{refresh();focusPending()}});
 let destroyed=false;
 const read=()=>{
  definitions.forEach((definition,index)=>{const step=steps[index],panel=view.entries.find(entry=>entry.step.id===step.id)?.panel;
   definition.single=typeof step.single==='function'?step.single():step.single;
   definition.value=String(step.value?step.value():fieldSnapshot(step.node));
   definition.summary=String(step.summary?step.summary():fieldSummary(step.node));
   definition.valid=Boolean(panel&&!invalidField(panel)&&(!step.valid||step.valid()));
  });
 };
 function refresh(){
  if(destroyed)return {complete:false};
  read();const result=view.update(),blocked=busy();
  if(!state.message){view.status.textContent='Completa cada bloque y pulsa Continuar. Puedes editar las respuestas anteriores.';view.status.dataset.tone='hint'}else view.status.dataset.tone='status';
  finalButton.disabled=blocked||!reviewOnFinal&&!result.complete;
  if(review)review.hidden=!result.complete;
  for(const entry of view.entries){entry.panel.disabled=entry.panel.hidden||blocked;entry.edit.disabled=blocked;const button=entry.panel.querySelector('[data-disclosure-continue]');if(button)button.disabled=blocked;}
  if(blocked){view.status.textContent='Espera un momento. Estamos preparando los datos.';view.status.dataset.tone='busy'}
  onChange({...result,busy:blocked});return {...result,complete:result.complete&&!blocked};
 }
 function focusPending({reveal=false}={}){
  const target=state.focus;state.focus=null;if(!target)return;
  const fallback=state.active?container.querySelector(`#${prefix}-${state.active}-heading`):finalButton;
  const requested=target==='next'?(finalButton.disabled?fallback:finalButton):target.startsWith('edit:')?container.querySelector(`[data-disclosure-edit="${target.slice(5)}"]`):container.querySelector(`#${prefix}-${target}-heading`);
  focusDisclosure(requested||fallback,{align:reveal?'start':'nearest'});
 }
 function confirm(id){
  refresh();const entry=view.entries.find(item=>item.step.id===id);if(!entry||busy())return false;
  if(!entry.step.valid){state.active=id;refresh();const field=invalidField(entry.panel);if(field){field.focus();if(field.required&&field.type!=='file'&&!['checkbox','radio'].includes(field.type)&&field.value&&!field.value.trim())field.setCustomValidity('Completa este dato para continuar.');field.reportValidity();}else{view.status.textContent=steps.find(step=>step.id===id)?.error||'Revisa este bloque antes de continuar.';view.status.dataset.tone='error';focusDisclosure(entry.heading)}return false;}
  if(!confirmDisclosure(state,definitions,id))return false;
  refresh();focusPending({reveal:true});onConfirm(id);return true;
 }
 function guardFinal(event){
  const result=refresh();
  if(result.complete)return true;
  event?.preventDefault();event?.stopImmediatePropagation();state.active=result.pending||state.active;state.focus=state.active;refresh();focusPending({reveal:true});return false;
 }
 function prepareReview(event){
  if(!reviewOnFinal||busy())return;
  read();const result=view.update();if(result.complete)return;
  if(!definitions.every(step=>step.valid))return;
  for(const step of definitions)confirmDisclosure(state,definitions,step.id);
  refresh();event.preventDefault();event.stopImmediatePropagation();
  focusDisclosure(review?.querySelector('h3')||review||finalButton,{align:'start'});
 }
 for(const entry of view.entries){
  const source=steps.find(step=>step.id===entry.step.id);
  if(!source.choice){const button=document.createElement('button');button.type='button';button.className='ds-secondary-button ds-disclosure-continue';button.dataset.disclosureContinue=entry.step.id;button.textContent=source.continueLabel||'Continuar';button.onclick=()=>confirm(entry.step.id);entry.panel.append(button);}
 }
 container.addEventListener('input',event=>{if(event.target.matches('input,textarea,select'))event.target.setCustomValidity('');refresh()},{signal});
 container.addEventListener('change',()=>refresh(),{signal});
 finalButton.addEventListener('click',prepareReview,{capture:true,signal});
 finalButton.addEventListener('click',guardFinal,{capture:true,signal});
 form?.addEventListener('submit',guardFinal,{capture:true,signal});
 refresh();if(autoFocus&&firstVisit&&!state.focus)state.focus=state.active;focusPending();
 return {refresh,confirm,guardFinal,isComplete:()=>refresh().complete,setExpanded:ids=>{view.setExpanded(ids);return refresh()},expandedIds:view.expandedIds,destroy:()=>{destroyed=true;abort.abort()}};
}
