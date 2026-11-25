import {normalizePrintConfiguration,printSideConfigurationLabel} from '../supabase/functions/_shared/print-configuration.js';
import {POLERA_PRINT_LOCATIONS} from '../supabase/functions/_shared/catalog-polera-prints.js';
import {escapeHtml as safe} from './admin-ui.js';

const points={
 center:[60,71],
 upper_back:[60,47],
 chest_left:[43,52],
 chest_right:[77,52],
 sleeve_left:[21,41],
 sleeve_right:[99,41],
};
const sideNames={front:'Frente',back:'Espalda'};
const garmentOutlines={
 shirt:{
  front:'M43 17 29 21 8 42 23 59 33 52 33 105 87 105 87 52 97 59 112 42 91 21 77 17 Q60 36 43 17 Z',
  back:'M43 17 29 21 8 42 23 59 33 52 33 105 87 105 87 52 97 59 112 42 91 21 77 17 Q60 23 43 17 Z',
 },
 body:{
  front:'M43 17 29 21 10 62 23 70 34 51 33 83 Q43 84 50 107 H70 Q77 84 87 83 L86 51 97 70 110 62 91 21 77 17 Q60 36 43 17 Z',
  back:'M43 17 29 21 10 62 23 70 34 51 33 83 Q43 84 50 107 H70 Q77 84 87 83 L86 51 97 70 110 62 91 21 77 17 Q60 23 43 17 Z',
 },
 tote:{front:'M27 43 H93 L90 105 H30 Z M43 43 V29 A17 17 0 0 1 77 29 V43'},
};

export function orderPrintPlan(item){
 const printSides=item.print_sides||'front',configuration=normalizePrintConfiguration(item.print_configuration,printSides);
 const rawPrints=Array.isArray(item.print_configuration?.prints)?item.print_configuration.prints:[];
 const prints=configuration.prints||Object.entries(configuration).map(([side,print])=>({side,...print}));
 const seen=new Set();
 return prints.map((print,index)=>{
  const raw=rawPrints[index];
  const catalogPath=raw?.catalogArtworkPath||(index===0?item.catalog_artwork_path:null);
  const legacyPath=print.side==='back'?item.back_design_path:item.front_design_path;
  const privatePath=print.designPath||(!seen.has(print.side)?legacyPath:null);
  seen.add(print.side);
  const location=Object.values(POLERA_PRINT_LOCATIONS).find(entry=>entry.placement===print.placement&&entry.side===print.side);
  const label=location&&location.size===print.size&& !print.offsetX&&!print.offsetY
   ?location.label:`${sideNames[print.side]} · ${printSideConfigurationLabel(print,print.side)}`;
  const placements=print.placement==='sleeve_both'?['sleeve_left','sleeve_right']:[print.placement];
  return {
   ...print,number:index+1,label,catalogPath,privatePath,
   fileName:print.fileName||(catalogPath||privatePath)?.split('/').at(-1),
   markers:placements.map(placement=>{
    const [x,y]=points[placement]||points.center;
    return [x+print.offsetX*2,y+print.offsetY*2];
   }),
  };
 });
}

function sideDiagram(side,prints,shape){
 const markers=prints.filter(print=>print.side===side).flatMap(print=>print.markers.map(([x,y])=>
  `<g><circle cx="${x}" cy="${y}" r="8"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${print.number}</text></g>`));
 return `<figure><svg viewBox="0 0 120 116" aria-hidden="true" focusable="false"><path d="${shape}"/>${markers.join('')}</svg><figcaption>${sideNames[side]}${markers.length?'':' · Sin estampado'}</figcaption></figure>`;
}

export function orderPrintPlanMarkup(order,assetUrl){
 if(!order.order_items?.length)return '';
 const items=order.order_items.map(item=>({item,prints:orderPrintPlan(item)}));
 const estimated=order.price_snapshot?.estimated_print_extra_clp;
 const estimate=order.request_type==='creative'&&Number.isSafeInteger(estimated)&&estimated>0
  ?`<p>Recargo estimado por estampados adicionales: ${safe(new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(estimated))} por unidad.</p>`:'';
 const articles=items.map(({item,prints})=>{
  const name=item.name_snapshot||'Producto';
  const kind=/tote/i.test(name)?'tote':/body/i.test(name)?'body':'shirt';
  const heading=`<h4>${safe(name)} <span>· ${safe(item.quantity||1)} u.</span></h4>`;
  const hasPlacement=Object.keys(item.print_configuration||{}).length||prints.some(print=>print.catalogPath||print.privatePath);
  if(order.request_type==='creative'&&!item.product_variant_id&&!order.price_snapshot?.product_selection&&!hasPlacement){
   return `<article>${heading}<p>Ubicaciones por definir en la cotización.</p></article>`;
  }
  const diagrams=Object.entries(garmentOutlines[kind]).map(([side,shape])=>sideDiagram(side,prints,shape)).join('');
  const rows=prints.map(print=>{
   const url=print.catalogPath?assetUrl(print.catalogPath):'';
   const pending=order.request_type==='creative'?'Arte de producción pendiente':order.source==='whatsapp'?'Archivo pendiente de WhatsApp':'Archivo sin asociar';
   const file=/^(https:\/\/|data:image\/svg\+xml[,;])/i.test(url)?
    `<a class="admin-secondary" href="${safe(url)}" target="_blank" rel="noopener" aria-label="Abrir archivo ${print.number}, ${safe(print.label)}">Abrir archivo</a>`:
    print.privatePath?`<button type="button" class="admin-secondary" data-print-file="${safe(print.privatePath)}" aria-label="Abrir archivo ${print.number}, ${safe(print.label)}">Abrir archivo</button>`:
     `<small class="admin-print-file-pending">${pending}</small>`;
   return `<li><span class="admin-print-number" aria-hidden="true">${print.number}</span><div class="admin-print-file-copy"><strong>${safe(print.label)}</strong>${print.fileName?`<small class="admin-print-filename" title="${safe(print.fileName)}">${safe(print.fileName)}</small>`:''}${file}</div></li>`;
  }).join('');
  return `<article>${heading}<div class="admin-print-plan-item"><div class="admin-print-diagrams">${diagrams}</div><ol aria-label="Archivos por ubicación">${rows}</ol></div></article>`;
 }).join('');
 const hasSideSpecificPrints=items.some(({prints})=>prints.some(print=>/^(chest_|sleeve_)/.test(print.placement)));
 const sideNote=hasSideSpecificPrints?' Izquierda y derecha se leen mirando la prenda de frente.':'';
 return `<section class="admin-print-plan" aria-labelledby="admin-print-plan-title"><h3 id="admin-print-plan-title">Planimetría de estampado</h3><p>Cada número vincula una ubicación con su archivo.${sideNote}</p>${estimate}${articles}</section>`;
}
