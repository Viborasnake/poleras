import './design-system.css';
import './design-system-page.css';
import './accessibility.css';

// Los especímenes explican estados; no deben sumar controles falsos al orden de tabulación.
document.querySelectorAll(
  '.ds-cta-system button, .ds-button-library button, .ds-button-library a, .ds-patterns-showcase button, .ds-patterns-showcase input, .ds-overlay-showcase button, .ds-overlay-showcase input',
).forEach((control)=>{ control.tabIndex=-1; });

// Los acordeones sí son especímenes interactivos: conservan teclado y permiten
// una sola respuesta abierta por grupo, incluso sin soporte para details[name].
document.querySelectorAll('[data-exclusive-accordion]').forEach((group)=>{
  group.querySelectorAll('details').forEach((item)=>{
    item.addEventListener('toggle',()=>{
      if(!item.open) return;
      group.querySelectorAll('details[open]').forEach((other)=>{
        if(other!==item) other.open=false;
      });
    });
  });
});

const searchInput=document.querySelector('#ds-product-search');
const searchResult=document.querySelector('#ds-search-result');
const searchItems=[...document.querySelectorAll('#ds-search-results li')];
searchInput?.addEventListener('input',()=>{
  const query=searchInput.value.trim().toLocaleLowerCase('es');
  const visible=searchItems.filter((item)=>{
    const matches=item.textContent.toLocaleLowerCase('es').includes(query);
    item.hidden=!matches;
    return matches;
  });
  searchResult.textContent=query?`${visible.length} ${visible.length===1?'resultado':'resultados'} para “${searchInput.value.trim()}”.`:'Escribe para filtrar los resultados.';
});
const filter=document.querySelector('#ds-product-filter');
filter?.addEventListener('change',()=>{
  const message={all:'Mostrando todos los modelos.',adult:'Mostrando Básica y Over.',kid:'Mostrando Kid.'};
  document.querySelector('#ds-filter-result').textContent=message[filter.value];
});
const range=document.querySelector('#ds-quantity-range');
range?.addEventListener('input',()=>{document.querySelector('#ds-range-output').value=range.value;});
const dropzone=document.querySelector('#ds-dropzone');
const fileInput=document.querySelector('#ds-file-input');
const fileStatus=document.querySelector('#ds-file-status');
const showFile=(file)=>{
  if(!file) return;
  const validType=['image/png','image/jpeg','application/pdf'].includes(file.type);
  if(!validType||file.size>50*1024*1024){fileStatus.textContent='Usa PNG, JPG o PDF de hasta 50 MB.';return;}
  fileStatus.textContent=`Archivo listo: ${file.name}`;
};
fileInput?.addEventListener('change',()=>showFile(fileInput.files?.[0]));
dropzone?.addEventListener('dragover',(event)=>{event.preventDefault();dropzone.classList.add('is-dragover');});
dropzone?.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragover'));
dropzone?.addEventListener('drop',(event)=>{
  event.preventDefault();
  dropzone.classList.remove('is-dragover');
  showFile(event.dataTransfer?.files?.[0]);
});

// The color chapter reads from governance to implementation. Keep the official
// pairs before the exploratory scales regardless of authoring/HMR order.
const contrastForegrounds=[
  ['Texto primario','--ds-text-primary'],
  ['Texto secundario','--ds-text-secondary'],
  ['Texto terciario','--ds-text-tertiary'],
  ['Texto acento','--ds-text-accent'],
  ['Texto inverso','--ds-text-inverse'],
  ['Enlace','--ds-color-link'],
  ['Foco','--ds-focus-ring'],
  ['Borde control','--ds-border-control'],
  ['Ícono','--ds-icon-default'],
  ['Ícono muted','--ds-icon-muted'],
];
const contrastBackgrounds=[
  ['Page','--ds-surface-page'],
  ['Raised','--ds-surface-raised'],
  ['Subtle','--ds-surface-subtle'],
  ['Disabled','--ds-surface-disabled'],
  ['Ink','--ds-brand-primary'],
  ['Pink','--ds-brand-accent'],
  ['Lilac','--ds-brand-secondary'],
  ['Lime','--ds-color-lime'],
  ['Success','--ds-feedback-success'],
  ['Warning','--ds-feedback-warning'],
  ['Danger','--ds-feedback-danger'],
  ['Info','--ds-feedback-info'],
];

// Resolve custom properties through the browser instead of walking var() strings.
// During Vite HMR the JS module can run in the brief instant before its CSS is
// reattached; the transparent result below lets the renderer wait and retry.
const colorProbe=document.createElement('i');
colorProbe.hidden=true;
document.body.append(colorProbe);
const resolveColor=(token)=>{
  colorProbe.style.backgroundColor='transparent';
  colorProbe.style.backgroundColor=`var(${token})`;
  const value=getComputedStyle(colorProbe).backgroundColor;
  return value==='rgba(0, 0, 0, 0)'||value==='transparent'?'':value;
};
const rgb=(color)=>{
  if(color.startsWith('#')){
    const hex=color.slice(1);
    const normalized=hex.length===3?[...hex].map((digit)=>digit+digit).join(''):hex.slice(0,6);
    return [0,2,4].map((index)=>Number.parseInt(normalized.slice(index,index+2),16));
  }
  return (color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
};
const luminance=(color)=>{
  const channels=rgb(color).map((value)=>{
    const channel=value/255;
    return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
  });
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};
const contrast=(first,second)=>{
  const values=[luminance(first),luminance(second)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};

const matrixHead=document.querySelector('#ds-contrast-head');
const matrixBody=document.querySelector('#ds-contrast-body');
const matrixSummary=document.querySelector('#ds-contrast-summary');
const renderContrastMatrix=(attempt=0)=>{
  if(!matrixHead||!matrixBody) return;
  const tokens=[...contrastForegrounds,...contrastBackgrounds].map(([,token])=>token);
  const colors=new Map(tokens.map((token)=>[token,resolveColor(token)]));
  if([...colors.values()].some((color)=>rgb(color).length!==3)){
    if(attempt<120) requestAnimationFrame(()=>renderContrastMatrix(attempt+1));
    else matrixSummary.textContent='No fue posible leer los tokens de color activos.';
    return;
  }

  matrixHead.querySelectorAll('th:not(:first-child)').forEach((cell)=>cell.remove());
  matrixBody.replaceChildren();
  contrastBackgrounds.forEach(([label,token])=>{
    const th=document.createElement('th');
    th.scope='col';
    th.innerHTML=`<span class="ds-color-dot" style="--dot:${colors.get(token)}"></span><b>${label}</b>`;
    matrixHead.append(th);
  });
  const totals={aa:0,ui:0,fail:0};
  contrastForegrounds.forEach(([label,token])=>{
    const row=document.createElement('tr');
    const heading=document.createElement('th');
    heading.scope='row';
    heading.innerHTML=`<span class="ds-color-dot" style="--dot:${colors.get(token)}"></span><b>${label}</b>`;
    row.append(heading);
    contrastBackgrounds.forEach(([backgroundLabel,backgroundToken])=>{
      const ratio=contrast(colors.get(token),colors.get(backgroundToken));
      const level=ratio>=4.5?'aa':ratio>=3?'ui':'fail';
      totals[level]+=1;
      const cell=document.createElement('td');
      cell.dataset.level=level;
      cell.setAttribute('aria-label',`${label} sobre ${backgroundLabel}: ${ratio.toFixed(2)} a 1, ${level==='aa'?'AA':level==='ui'?'solo UI o texto grande':'no aprobada'}`);
      cell.innerHTML=`<strong>${ratio.toFixed(1)}</strong><span>${level==='aa'?'AA':level==='ui'?'UI':'NO'}</span>`;
      row.append(cell);
    });
    matrixBody.append(row);
  });
  matrixSummary.innerHTML=`<span><b>${totals.aa}</b> pares AA</span><span><b>${totals.ui}</b> pares solo UI/texto grande</span><span><b>${totals.fail}</b> pares no aprobados</span><small>La matriz se recalcula automáticamente si cambia un token.</small>`;
};
renderContrastMatrix();
