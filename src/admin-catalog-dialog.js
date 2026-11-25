import {escapeHtml} from './admin-ui.js';

export function catalogDialogMarkup({
 id, formId, className, title, context = '', body, submit, danger = false, discard = false, workflow = false,
}){
 return `<dialog id="${id}" class="admin-dialog admin-catalog-dialog ${className}" aria-labelledby="${id}-title" ${discard?'data-explicit-dismiss':''}>
  <form ${formId?`id="${formId}"`:''}>
   <header class="dialog-title">
    <div><h2 id="${id}-title">${title}</h2><p data-catalog-dialog-context ${context?'':'hidden'}>${context}</p></div>
    <button type="button" class="dialog-close" aria-label="Cerrar"></button>
   </header>
   <div class="admin-catalog-dialog-body">${body}</div>
   <footer class="admin-catalog-dialog-footer">
    <p class="admin-form-status" role="status"></p>
    <div class="dialog-actions">
     ${workflow?'<p data-catalog-workflow-status></p>':''}
     <button type="button" class="admin-secondary dialog-cancel" ${danger?'autofocus':''}>Cancelar</button>
     <button type="submit" class="${danger?'admin-danger':'admin-primary'}">${submit}</button>
    </div>
    ${discard?`<div class="admin-catalog-discard" hidden>
     <p tabindex="-1">¿Descartar los cambios sin guardar?</p>
     <div class="dialog-actions">
      <button type="button" class="admin-secondary" data-keep-catalog-draft>Seguir editando</button>
      <button type="button" class="admin-danger" data-discard-catalog-draft>Descartar cambios</button>
     </div>
    </div>`:''}
   </footer>
  </form>
 </dialog>`;
}

export function openCatalogDialog(dialog,trigger){
 trigger?.focus({preventScroll:true});
 dialog.querySelector('.admin-catalog-dialog-body').scrollTop=0;
 const status=dialog.querySelector('.admin-form-status');
 status.textContent='';
 delete status.dataset.tone;
 dialog.showModal();
}

export function confirmCatalogDiscard(dialog,hasChanges){
 const prompt=dialog.querySelector('.admin-catalog-discard');
 const body=dialog.querySelector('.admin-catalog-dialog-body');
 const actions=prompt.previousElementSibling;
 let previousFocus;
 function resume(){
  prompt.hidden=true;
  body.inert=false;
  actions.hidden=false;
  if(previousFocus instanceof HTMLElement)previousFocus.focus({preventScroll:true});
 }
 dialog.addEventListener('dialog-dismiss',event=>{
  if(!prompt.hidden){event.preventDefault();resume();return}
  if(!hasChanges())return;
  event.preventDefault();
  previousFocus=document.activeElement;
  actions.hidden=true;
  body.inert=true;
  prompt.hidden=false;
  prompt.querySelector('p').focus();
 });
 prompt.querySelector('[data-keep-catalog-draft]').onclick=resume;
 prompt.querySelector('[data-discard-catalog-draft]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{if(!prompt.hidden)resume()});
}

export async function performCatalogDialogAction(form,{message,pendingLabel,action}){
 const dialog=form.closest('dialog');
 if(dialog.getAttribute('aria-busy')==='true')return;
 const body=form.querySelector('.admin-catalog-dialog-body');
 const status=form.querySelector('.admin-form-status');
 const buttons=[...form.querySelectorAll('.dialog-close,.dialog-cancel,[type="submit"]')];
 const submit=buttons.find(button=>button.type==='submit');
 const label=submit.textContent;
 const focused=document.activeElement;
 dialog.setAttribute('aria-busy','true');
 body.inert=true;
 buttons.forEach(button=>button.disabled=true);
 submit.textContent=pendingLabel;
 status.textContent=message;
 status.dataset.tone='busy';
 try{await action()}
 catch(error){status.textContent=error.message;status.dataset.tone='error'}
 finally{
  dialog.removeAttribute('aria-busy');
  body.inert=false;
  buttons.forEach(button=>button.disabled=false);
  submit.textContent=label;
  if(dialog.open&&focused instanceof HTMLElement)focused.focus({preventScroll:true});
 }
}

export function catalogFileField({name,label,output='Sin archivo',disabled=false}){
 const id=`catalog-file-${name}`;
 return `<label class="admin-file admin-catalog-file">
  <span>${escapeHtml(label)}</span>
  <span class="admin-catalog-file-line">
   <span class="admin-catalog-file-picker"><span data-catalog-file-action aria-hidden="true">Elegir archivo</span>
    <input type="file" name="${name}" accept="image/png,image/jpeg,image/webp" aria-label="${escapeHtml(label)}"
      aria-describedby="${id}" ${disabled?'disabled':''}>
   </span>
   <output id="${id}">${output}</output>
  </span>
 </label>`;
}

export function setCatalogFileStatus(input,text,hasFile){
 const label=input.closest('label');
 label.querySelector('output').textContent=text;
 label.querySelector('[data-catalog-file-action]').textContent=hasFile?'Reemplazar':'Elegir archivo';
}
