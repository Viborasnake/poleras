// La foto de referencia se conserva en petRequest; el visor muestra el arte
// elegido del catálogo hasta que el equipo prepare la personalización final.
export function studioPreviewState(state, placeholderImage) {
 const sideImage = state.images?.[state.printSide] || '';
 const placeholder = !sideImage && state.isDefault && !state.catalogDesign;
 return {
  ...state,
  image: state.mode === 'ready' ? sideImage || (placeholder ? placeholderImage : '') : '',
  assessment: state.assessments?.[state.printSide] || state.assessment,
 };
}
