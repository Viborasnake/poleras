import {POLERA_PRINT_LOCATIONS,normalizePoleraPrints,poleraPrintsOverlap} from '../supabase/functions/_shared/catalog-polera-prints.js';
import {catalogAssetUrl} from './catalog.js';

const locations=Object.entries(POLERA_PRINT_LOCATIONS);

export function poleraPrintFields(mainUpload){
 return `<div data-polera-prints hidden>
  <fieldset class="admin-polera-primary">
   <legend>Estampado principal</legend>
   <label>Ubicación del archivo principal<select name="polera_primary_print" disabled>${locations.map(([key,location])=>`<option value="${key}">${location.label}</option>`).join('')}</select></label>
   ${mainUpload}
   <div data-primary-mockup></div>
  </fieldset>
  <fieldset class="admin-polera-extras">
   <legend>Estampados adicionales</legend>
   <p>El precio de catálogo incluye una aplicación. Los recargos se editan en Productos → Precios → Servicios y estampados.</p>
   <p>Izquierda y derecha se leen mirando la polera de frente. Ambos brazos usa el mismo arte en ambas mangas.</p>
   <p data-print-selection-status role="status"></p>
  ${locations.map(([key,location])=>`<section data-polera-print="${key}">
   <label class="admin-check" data-print-toggle><input type="checkbox" name="polera_additional_print" value="${key}" disabled><span>Agregar ${location.label.toLowerCase()}</span></label>
   <label class="admin-file" data-print-upload hidden><span>Archivo para ${location.label.toLowerCase()}</span><input type="file" name="polera_print_${key}" accept="image/png,image/jpeg,image/webp" disabled><output>Ningún archivo seleccionado.</output></label>
   <div class="design-file-preview" data-art-preview hidden><img alt="Archivo para ${location.label.toLowerCase()}"></div>
   <div data-print-mockup="${key}" hidden>
    <label class="admin-file"><span>Mockup de ${location.label.toLowerCase()} (opcional)</span><input type="file" name="polera_mockup_${key}" accept="image/png,image/jpeg,image/webp" disabled><output>Ningún archivo seleccionado.</output></label>
    <label class="admin-check" hidden><input type="checkbox" name="clear_polera_mockup_${key}" disabled><span>Quitar mockup guardado</span></label>
    <div class="design-file-preview" hidden><img alt="Mockup de ${location.label.toLowerCase()}"></div>
   </div>
  </section>`).join('')}
  </fieldset>
 </div>`;
}

function updateFilePreview(input,preview,cleared=false){
 const file=input.files[0],path=input.dataset.currentArtwork;
 const output=input.closest('label').querySelector('output'),image=preview.querySelector('img');
 if(image.getAttribute('src')?.startsWith('blob:'))URL.revokeObjectURL(image.src);
 output.textContent=cleared?'Se quitará este mockup.':file?file.name:path?'Archivo actual conservado. Puedes reemplazarlo.':'Ningún archivo seleccionado.';
 const url=cleared?'':file?URL.createObjectURL(file):catalogAssetUrl(path);
 if(url)image.src=url;else image.removeAttribute('src');
 preview.hidden=input.disabled||!url;
}

export function syncPoleraPrintFields(form,changed){
 const container=form.querySelector('[data-polera-prints]');
 if(!container)return;
 const enabled=Boolean(form.querySelector('[name="design_products"][value="poleras"]')?.checked);
 const primary=form.elements.polera_primary_print;
 const primaryMockup=container.querySelector('[data-primary-mockup]'),removed=[];
 container.hidden=!enabled;primary.disabled=!enabled;
 for(const section of container.querySelectorAll('[data-polera-print]')){
  const location=section.dataset.poleraPrint,check=section.querySelector('[type="checkbox"]'),file=section.querySelector('[type="file"]');
  const conflictsPrimary=poleraPrintsOverlap(location,primary.value),isPrimary=location===primary.value;
  if(check.checked&&(conflictsPrimary||(changed?.checked&&changed!==check&&poleraPrintsOverlap(location,changed.value)))){
   check.checked=false;removed.push(POLERA_PRINT_LOCATIONS[location].label);
  }
  section.hidden=conflictsPrimary&&!isPrimary;
  section.querySelector('[data-print-toggle]').hidden=conflictsPrimary;
  check.disabled=!enabled||conflictsPrimary;
  file.disabled=check.disabled||!check.checked;
  file.required=!file.disabled&&!file.dataset.currentArtwork;
  file.closest('label').hidden=file.disabled;
  const art=section.querySelector('[data-art-preview]');art.hidden=file.disabled||!art.querySelector('img').getAttribute('src');
  const mockup=container.querySelector(`[data-print-mockup="${location}"]`),photo=mockup.querySelector('[type="file"]'),clear=mockup.querySelector('[type="checkbox"]');
  const destination=isPrimary?primaryMockup:section;
  if(mockup.parentElement!==destination)destination.append(mockup);
  mockup.hidden=!enabled||!isPrimary&&!check.checked;
  photo.disabled=mockup.hidden;
  clear.disabled=photo.disabled||!photo.dataset.currentArtwork;
  clear.closest('label').hidden=clear.disabled;
  const photoPreview=mockup.querySelector('.design-file-preview');photoPreview.hidden=photo.disabled||!photoPreview.querySelector('img').getAttribute('src');
 }
 const status=container.querySelector('[data-print-selection-status]');
 status.textContent=removed.length?`Quitamos ${removed.join(' y ')} de los adicionales porque coincide con la ubicación que elegiste.`:'';
}

export function initializePoleraPrintFields(form,design){
 const {primary,additional,mockups}=normalizePoleraPrints(design?.polera_prints);
 if(!form.elements.polera_primary_print)return;
 form.elements.polera_primary_print.value=primary;
 for(const section of form.querySelectorAll('[data-polera-print]')){
  const path=additional[section.dataset.poleraPrint]||'';
  section.querySelector('[type="checkbox"]').checked=Boolean(path);
  const upload=section.querySelector('[type="file"]');
  upload.dataset.currentArtwork=path;
  updateFilePreview(upload,section.querySelector('[data-art-preview]'));
  const mockup=form.querySelector(`[data-print-mockup="${section.dataset.poleraPrint}"]`),photo=mockup.querySelector('[type="file"]');
  photo.dataset.currentArtwork=mockups[section.dataset.poleraPrint]||'';
  updateFilePreview(photo,mockup.querySelector('.design-file-preview'));
 }
 syncPoleraPrintFields(form);
}

export function wirePoleraPrintFields(form){
 const container=form.querySelector('[data-polera-prints]');
 if(!container)return;
 container.addEventListener('change',event=>{
  const field=event.target;
  const mockup=field.closest('[data-print-mockup]');
  if(mockup){
   const input=mockup.querySelector('[type="file"]'),clear=mockup.querySelector('[type="checkbox"]');
   if(field===input&&input.files[0])clear.checked=false;
   if(field===clear&&clear.checked)input.value='';
   updateFilePreview(input,mockup.querySelector('.design-file-preview'),clear.checked);
  }else if(field.matches('[name^="polera_print_"]')){
   updateFilePreview(field,field.closest('[data-polera-print]').querySelector('[data-art-preview]'));
  }else if(field.matches('[name="polera_primary_print"],[name="polera_additional_print"]')){
   syncPoleraPrintFields(form,field.type==='checkbox'?field:null);
  }
 });
}
