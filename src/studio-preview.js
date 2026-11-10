import {PRINT_SIZE_SCALE,normalizePrintSideConfiguration} from '../supabase/functions/_shared/print-configuration.js';

// La foto de referencia se conserva en petRequest; el visor muestra el arte
// elegido del catálogo hasta que el equipo prepare la personalización final.
export function studioPreviewState(state, placeholderImage) {
 const extra=state.additionalPrints?.find(item=>item.id===state.activePrintId);
 const side=extra?.side||state.printSide;
 const sideImage = extra?extra.image||'':state.images?.[side] || '';
 const primarySides=state.kind==='tote'?['front']:Array.isArray(state.printSides)?state.printSides:Object.keys(state.images||{});
 const printLayers=state.mode==='ready'?[
  ...primarySides.map(side=>({id:`primary-${side}`,side,image:state.images?.[side]||'',...normalizePrintSideConfiguration(state.printConfigurations?.[side],side)})),
  ...(state.additionalPrints||[]).map(item=>({id:item.id,side:item.side,image:item.image||'',...normalizePrintSideConfiguration(item.configuration,item.side)})),
 ].filter(item=>item.image):[];
 const placeholder = !printLayers.length && !sideImage && state.isDefault && !state.catalogDesign;
 const printConfiguration=normalizePrintSideConfiguration(extra?.configuration||state.printConfigurations?.[side],side);
 if(placeholder&&state.mode==='ready')printLayers.push({id:'placeholder',side:side||'front',image:placeholderImage,...printConfiguration});
 return {
  ...state,
  printLayers,
  image: state.mode === 'ready' ? sideImage || (placeholder ? placeholderImage : '') : '',
  assessment: extra?.assessment || state.assessments?.[side] || state.assessment,
  printPlacement: printConfiguration.placement,
  printScale: printConfiguration.scale || PRINT_SIZE_SCALE[printConfiguration.size],
  printOffsetX: printConfiguration.offsetX,
  printOffsetY: printConfiguration.offsetY,
 };
}
