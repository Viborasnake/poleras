import {INVENTORY_SUGGESTION_FIELDS,inventorySuggestions} from './inventory.js';

// Suggestions are read from saved inventory, including zero-stock lots. Drafts
// do not become history until the user saves the complete form.
export function bindInventorySuggestions(form,read){
 const entries=[];
 for(const name of INVENTORY_SUGGESTION_FIELDS){
  const input=form.elements.namedItem(name),label=input.closest('label');
  const box=document.createElement('output');box.id=`inventory-${name}-suggestions`;box.className='inventory-suggestions';box.hidden=true;
  box.setAttribute('role','listbox');box.setAttribute('aria-label',`Valores guardados para ${label.firstChild.textContent.trim()}`);box.setAttribute('aria-live','off');
  const hint=document.createElement('small');hint.id=`inventory-${name}-hint`;hint.textContent='Usa un valor guardado o escribe uno nuevo.';
  input.autocomplete='off';input.setAttribute('aria-label',label.firstChild.textContent.trim());input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-describedby',hint.id);input.removeAttribute('list');
  label.append(box,hint);const entry={input,box,hint,options:[],index:-1};entries.push(entry);
  function highlight(){
   [...box.children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===entry.index)));
   if(entry.index<0)input.removeAttribute('aria-activedescendant');
   else{input.setAttribute('aria-activedescendant',box.children[entry.index].id);box.children[entry.index].scrollIntoView({block:'nearest'})}
  }
  function close(){box.hidden=true;input.setAttribute('aria-expanded','false');entry.index=-1;input.removeAttribute('aria-activedescendant')}
  entry.close=close;
  function show(){
   entries.filter(other=>other!==entry).forEach(other=>other.close());
   let records;try{records=read()}catch{hint.textContent='No pudimos consultar los valores guardados.';close();return}
   const values=Object.fromEntries(INVENTORY_SUGGESTION_FIELDS.map(field=>[field,form.elements.namedItem(field).value]));
   values.model_code=form.elements.namedItem('model_code')?.value||'';
   values.product_type_id=form.elements.namedItem('product_type_id')?.value||'';
   entry.options=inventorySuggestions(records,name,values);entry.index=-1;box.replaceChildren();input.removeAttribute('aria-activedescendant');
   hint.textContent=entry.options.length?`${entry.options.length} ${entry.options.length===1?'valor guardado':'valores guardados'}. Puedes elegir o escribir uno nuevo.`:'Sin coincidencias guardadas. Puedes escribir un valor nuevo.';
   for(const [index,option] of entry.options.entries()){
    const row=document.createElement('span');row.id=`${box.id}-${index}`;row.className='inventory-suggestion';row.setAttribute('role','option');row.setAttribute('aria-selected','false');
    const text=document.createElement('span'),detail=document.createElement('small');text.textContent=option.value;detail.textContent=option.contextual?'Coincide con esta prenda':'Guardado anteriormente';row.append(text,detail);box.append(row);
    row.addEventListener('pointerdown',event=>{event.preventDefault()});
    row.addEventListener('click',event=>{event.preventDefault();choose(index)});
   }
   box.hidden=!entry.options.length;input.setAttribute('aria-expanded',String(!box.hidden));
  }
  function choose(index){
   const option=entry.options[index];if(!option)return;
   input.value=option.value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();input.focus();
  }
  input.addEventListener('focus',show);input.addEventListener('input',show);input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
   if(event.isComposing)return;
   if(event.key==='Escape'&&!box.hidden){event.preventDefault();event.stopPropagation();close();return}
   if(event.key==='Tab'){close();return}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if(box.hidden)show();if(!entry.options.length)return;
    entry.index=event.key==='ArrowDown'?(entry.index+1)%entry.options.length:(entry.index<0?entry.options.length-1:(entry.index-1+entry.options.length)%entry.options.length);highlight();
   }else if(event.key==='Enter'&&!box.hidden){
    // Enter never submits or advances the progressive form while choosing.
    event.preventDefault();event.stopPropagation();if(entry.index>=0)choose(entry.index);else close();
   }
  });
 }
 const closeAll=()=>entries.forEach(entry=>entry.close());
 form.addEventListener('click',event=>{if(!entries.some(entry=>entry.input.closest('label').contains(event.target)))closeAll()});
 form.closest('dialog')?.addEventListener('close',closeAll);
 return {close:closeAll};
}
