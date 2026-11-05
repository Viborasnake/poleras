import {PRINT_SIZE_SCALE,normalizePrintSideConfiguration} from '../supabase/functions/_shared/print-configuration.js';

// La foto de referencia se conserva en petRequest; el visor muestra el arte
// elegido del catálogo hasta que el equipo prepare la personalización final.
export function studioPreviewState(state, placeholderImage) {
 const sideImage = state.images?.[state.printSide] || '';
 const placeholder = !sideImage && state.isDefault && !state.catalogDesign;
 const printConfiguration=normalizePrintSideConfiguration(state.printConfigurations?.[state.printSide],state.printSide);
 return {
  ...state,
  image: state.mode === 'ready' ? sideImage || (placeholder ? placeholderImage : '') : '',
  assessment: state.assessments?.[state.printSide] || state.assessment,
  printPlacement: printConfiguration.placement,
  printScale: printConfiguration.scale || PRINT_SIZE_SCALE[printConfiguration.size],
  printOffsetX: printConfiguration.offsetX,
  printOffsetY: printConfiguration.offsetY,
 };
}
