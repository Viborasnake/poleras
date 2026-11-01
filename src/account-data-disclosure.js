import {fieldSnapshot,fieldSummary} from './form-disclosure.js';
import {focusDisclosure} from './progressive-disclosure.js';

// Existing profile sections are independent: changing a phone never requires
// confirming an unchanged address. Values stay mounted until the explicit save.
export function mountAccountDataDisclosure({form,regions,communesForRegion,samePlace}){
 const button=form.querySelector('[type="submit"]'),abort=new AbortController(),signal=abort.signal;
 const status=document.createElement('p');status.className='ds-disclosure-status';status.setAttribute('role','status');form.prepend(status);
 const region=form.elements.region,commune=form.elements.commune,address=form.elements.address;
 const initialRegion=region.value,initialCommune=commune.value;
 const choices=document.createElement('datalist');choices.id='account-commune-options';commune.setAttribute('list',choices.id);commune.after(choices);
 const original=fieldSnapshot(form);let active=null,busy=false;
 const sections=[...form.querySelectorAll(':scope > fieldset')].map((panel,index)=>{
  const title=panel.querySelector('legend').textContent,id=`account-section-${index}`;
  const wrapper=document.createElement('section');wrapper.className='ds-disclosure account-data-section';panel.before(wrapper);
  const head=document.createElement('div');head.className='ds-disclosure-head';
  const copy=document.createElement('div'),heading=document.createElement('h3'),summary=document.createElement('p');heading.textContent=title;heading.tabIndex=-1;copy.append(heading,summary);
  const edit=document.createElement('button');edit.type='button';edit.className='ds-disclosure-edit';edit.textContent='Editar';edit.setAttribute('aria-label',`Editar ${title.toLocaleLowerCase('es-CL')}`);edit.setAttribute('aria-controls',id);head.append(copy,edit);
  const done=document.createElement('button');done.type='button';done.className='ds-secondary-button ds-disclosure-continue';done.textContent='Revisar cambios';
  panel.id=id;panel.classList.add('ds-disclosure-panel');panel.append(done);wrapper.append(head,panel);
  const item={panel,wrapper,heading,summary,edit,done,title,confirmed:fieldSnapshot(panel)};
  edit.onclick=()=>{if(busy)return;if(active&&fieldSnapshot(active.panel)!==active.confirmed){status.textContent='Pulsa Revisar cambios antes de editar otra sección.';focusDisclosure(active.heading);return}active=item;refresh();focusDisclosure(heading)};
  done.onclick=()=>{if(finish(item)){refresh();focusDisclosure(edit)}};return item;
 });
 function allowedRegion(){return regions.some(name=>samePlace(name,region.value))}
 function allowedCommune(){return allowedRegion()&&communesForRegion(region.value).some(name=>samePlace(name,commune.value))}
 function dependencies(){
  commune.disabled=!allowedRegion();address.disabled=!allowedCommune();
  const available=allowedRegion()?communesForRegion(region.value):[];if(choices.dataset.region!==region.value){choices.replaceChildren(...available.map(name=>{const option=document.createElement('option');option.value=name;return option}));choices.dataset.region=region.value}
  const changed=region.value!==initialRegion||commune.value!==initialCommune;
  region.setCustomValidity((region.value||changed&&address.value)&&!allowedRegion()?'Selecciona una región de la lista.':'');
  commune.setCustomValidity(changed&&commune.value&&!allowedCommune()?'Selecciona una comuna de la región elegida.':'');
  if(address.value&&changed&&!allowedCommune())commune.setCustomValidity('Selecciona una región y comuna para esta dirección.');
 }
 function invalid(item){
  const disabled=item.panel.disabled;item.panel.disabled=false;
  const field=[...item.panel.querySelectorAll('input,select,textarea')].find(field=>!field.disabled&&(!field.validity.valid||field.required&&!field.value.trim()));item.panel.disabled=disabled;return field;
 }
 function finish(item){
  dependencies();const field=invalid(item);
  if(field){active=item;refresh();field.focus();field.reportValidity();status.textContent=`Revisa ${item.title.toLocaleLowerCase('es-CL')} antes de continuar.`;return false}
  item.confirmed=fieldSnapshot(item.panel);active=null;status.textContent='Cambios revisados. Pulsa Guardar mis datos para guardarlos en tu cuenta.';return true;
 }
 function refresh(){
  dependencies();for(const item of sections){const open=active===item;item.panel.hidden=!open;item.panel.disabled=!open||busy;item.edit.disabled=busy;item.edit.hidden=open;item.edit.setAttribute('aria-expanded',String(open));item.wrapper.classList.toggle('is-active',open);item.done.disabled=busy;item.summary.textContent=fieldSummary(item.panel)||'Sin datos';}
  button.disabled=busy||Boolean(active)||fieldSnapshot(form)===original;
 }
 function guardSubmit(event){
  dependencies();if(busy||active||sections.some(item=>item.confirmed!==fieldSnapshot(item.panel))){event.preventDefault();status.textContent='Revisa los cambios de la sección abierta antes de guardar.';return false}
  const pending=sections.find(invalid);if(pending){event.preventDefault();active=pending;refresh();invalid(pending)?.reportValidity();focusDisclosure(pending.heading);return false}return true;
 }
 function serialize(){
  const fields=[...form.querySelectorAll('fieldset,input,textarea,select')],saved=fields.map(field=>field.disabled);fields.forEach(field=>field.disabled=false);
  try{return new FormData(form)}finally{fields.forEach((field,index)=>field.disabled=saved[index])}
 }
 form.addEventListener('input',event=>{event.target.setCustomValidity?.('');refresh()},{signal});
 form.addEventListener('change',()=>refresh(),{signal});
 // Region search widgets dispatch change after committing a result. A different
 // region invalidates an incompatible commune, without discarding the address.
 region.addEventListener('change',()=>{if(!allowedRegion()||!communesForRegion(region.value).some(name=>samePlace(name,commune.value)))commune.value='';refresh()},{signal});
 refresh();status.textContent='Edita una sección a la vez. Guardar mis datos confirma los cambios en tu cuenta.';
 return {guardSubmit,serialize,setBusy:value=>{busy=value;if(busy){form.setAttribute('aria-busy','true');status.textContent='Guardando los cambios en tu cuenta…'}else{form.removeAttribute('aria-busy');status.textContent='Puedes revisar y volver a guardar los cambios.'}refresh()},destroy:()=>abort.abort()};
}
