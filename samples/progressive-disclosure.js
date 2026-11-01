import {steps,labels,names,initialState,options,choose,complete,price,restoreDraft,reconcile} from './progressive-disclosure-state.js';
let state=initialState(),view='progressive';
const $=selector=>document.querySelector(selector);
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const descriptions={product:'Elige qué quieres personalizar.',model:'¿Cómo te gusta el calce?',size:'Elige tu talla.',color:'Un último toque de color.',side:'¿Dónde va tu diseño?'};
const detail={unisex:'Básica u oversize · Desde $15.990',woman:'Calce femenino · Desde $15.990',basic:'Calce clásico · $15.990',over:'Calce holgado · $21.990',S:'Talla de muestra',M:'Talla de muestra',L:'Talla de muestra',XL:'Talla de muestra',beige:'Tela de muestra',black:'Tela de muestra',front:'Estampado incluido',back:'Estampado incluido'};
function focusTarget(selector){const target=$(selector);if(!target)return;target.focus({preventScroll:true});const rect=target.getBoundingClientRect();if(rect.top<12||rect.bottom>innerHeight-20)target.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function render(focus){
  const total=state.confirmed.length,ready=complete(state),amount=price(state);
  $('#studio-title').textContent=state.pet?'Tu selección está lista.':state.active?descriptions[state.active]:'Así será tu próxima favorita.';
  $('#progress-label').textContent=state.pet?'02 · Tu mascota':`${total} de 5 decisiones listas`;
  $('#progress-fill').style.width=`${total/5*100}%`;
  $('#notice').textContent=state.message;
  $('#notice').hidden=!state.message;
  $('#sample-form').hidden=state.pet;$('#pet-step').hidden=!state.pet;
  $('#decisions').innerHTML=steps.map((key,index)=>{
    const done=state.confirmed.includes(key),active=state.active===key,opts=options(state,key),single=done&&opts.length===1&&state.status==='ready';
    const open=(view==='full'||active)&&!single;
    const unlocked=steps.slice(0,index).every(item=>state.confirmed.includes(item));
    const content=state.status!=='ready'&&active?`<div class="scenario-state"><strong>${state.status==='error'?'No pudimos cargar las opciones.':state.status==='loading'?'Preparando opciones…':'No hay variantes disponibles.'}</strong><p>${state.status==='empty'?'Esta combinación no se puede continuar.':'Tu selección se conserva.'}</p><button type="button" data-retry class="secondary">${state.status==='loading'?'Completar carga simulada':'Reintentar con datos de muestra'}</button></div>`:`<fieldset ${!unlocked||state.status!=='ready'?'disabled':''}><legend class="sr-only">${labels[key]}</legend><div class="choices">${opts.map(value=>`<button type="button" class="choice ${done&&state.values[key]===value?'selected':''}" data-key="${key}" data-value="${value}" aria-pressed="${done&&state.values[key]===value}"><span>${names[value]}${done&&state.values[key]===value?' ✓':''}</span><small>${detail[value]}</small></button>`).join('')}</div></fieldset>`;
    return `<section class="decision ${active?'is-active':''} ${done?'is-complete':''}"><div class="decision-heading"><span class="number" aria-hidden="true">${done?'✓':String(index+1).padStart(2,'0')}</span><div><h3 id="heading-${key}" tabindex="-1">${labels[key]}</h3><p>${done?`${names[state.values[key]]}${single?' · Única opción':''}`:active?'Elige una opción para continuar':'Pendiente'}</p></div>${done&&!single?`<button class="edit" type="button" data-edit="${key}" aria-label="Editar ${labels[key].toLowerCase()}" aria-expanded="${open}" aria-controls="panel-${key}">${active?'Cerrar':'Editar'}</button>`:''}</div><div class="decision-panel" id="panel-${key}" ${open?'':'hidden'}>${open?content:''}</div></section>`;
  }).join('');
  $('#price').textContent=amount===null?'Desde $15.990':money(amount);
  $('#price-help').textContent=amount===null?'Confirma producto, modelo, talla y color para ver el importe exacto de muestra.':'Producto y estampado incluidos · Importe de demostración';
  $('#continue').disabled=!ready;
  $('#memory').textContent=state.draft?'Borrador ficticio revalidado. Selección solo en esta muestra.':'Selección solo en esta muestra. Sin guardado remoto.';
  $('#preview-selection').textContent=state.confirmed.includes('product')?`${names[state.values.product]}${state.confirmed.includes('model')?` · ${names[state.values.model]}`:''}`:'Tu próxima favorita';
  $('.garment').classList.toggle('black-shirt',state.confirmed.includes('color')&&state.values.color==='black');
  $('#pet-summary').innerHTML=steps.map(key=>`<div><dt>${labels[key]}</dt><dd>${names[state.values[key]]||'Pendiente'}</dd></div>`).join('');
  if(focus)focusTarget(focus);
}
$('#decisions').addEventListener('click',event=>{
  const choice=event.target.closest('[data-key]'),edit=event.target.closest('[data-edit]');
  if(choice&&choose(state,choice.dataset.key,choice.dataset.value))render(state.active?`#heading-${state.active}`:'#continue');
  if(edit){state.active=state.active===edit.dataset.edit?(steps.find(key=>!state.confirmed.includes(key))||null):edit.dataset.edit;render(`[data-edit="${edit.dataset.edit}"]`);}
  if(event.target.closest('[data-retry]')){state.status='ready';reconcile(state);state.message='Opciones de muestra disponibles otra vez. Tu selección se conserva.';render(state.active?`#heading-${state.active}`:'#continue');}
});
$('#sample-form').addEventListener('submit',event=>{event.preventDefault();if(!complete(state))return;state.pet=true;state.message='Selección conservada. Este siguiente paso es una simulación.';render('#pet-step');});
$('#return').onclick=()=>{state.pet=false;state.message='Volviste a tu selección. Puedes editar cualquier decisión.';render('#continue');};
$('#view').onchange=event=>{view=event.target.value;render();};
$('#theme').onchange=event=>document.documentElement.dataset.theme=event.target.value;
document.querySelectorAll('[data-scenario]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.scenario;
  if(action==='reset')state=initialState();
  else if(action==='draft')state=restoreDraft();
  else {state.pet=false;state.status=action;state.active=steps.find(key=>!state.confirmed.includes(key))||'color';state.message='Escenario de evaluación activo. Usa el control de recuperación del bloque abierto.';}
  render(state.active?`#heading-${state.active}`:'#continue');
});
render();
