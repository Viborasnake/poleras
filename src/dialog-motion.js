const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const closingDialogs=new WeakSet();

export function closeDialogWithMotion(dialog){
 if(!dialog?.open||dialog.getAttribute('aria-busy')==='true'||closingDialogs.has(dialog)){return}
 if(reducedMotion.matches){dialog.close();return}
 closingDialogs.add(dialog);dialog.classList.add('ds-dialog-closing');
 window.setTimeout(()=>{dialog.classList.remove('ds-dialog-closing');closingDialogs.delete(dialog);dialog.close()},450);
}

document.addEventListener('cancel',event=>{
 const dialog=event.target;
 if(!(dialog instanceof HTMLDialogElement)||!dialog.open||reducedMotion.matches)return;
 event.preventDefault();closeDialogWithMotion(dialog);
},true);

document.addEventListener('click',event=>{
 const target=event.target instanceof Element?event.target:null;
 const dialog=target?.closest('dialog');
 if(!dialog?.open)return;
 const closesDialog=target===dialog||target.closest('[data-close],[data-commerce-close],[data-size-close],.dialog-close,.dialog-cancel,.catalog-dialog-close,.mp-payment-close,.fullscreen-viewer-close');
 if(!closesDialog)return;
 event.preventDefault();event.stopImmediatePropagation();closeDialogWithMotion(dialog);
},true);
