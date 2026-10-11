const manualTypes = new Map([
  ['catalog', 'Catálogo'],
  ['artwork', 'Personalizado · diseño adjunto'],
  ['idea', 'Personalizado · idea'],
]);

export function orderTypeLabel(order) {
  if (order.request_type === 'creative' || order.source === 'idea_request') return 'Personalizado · idea';
  if (order.source === 'manual') return manualTypes.get(order.price_snapshot?.order_type) || 'Sin registrar';

  let catalog = false;
  let artwork = false;
  let artworkPending = false;
  for (const item of order.order_items || []) {
    if (item.front_design_path || item.back_design_path) artwork = true;
    else if (item.catalog_design_id) catalog = true;
    else if (/personalizad[oa]/i.test(item.name_snapshot || '')) artworkPending = true;
  }

  if (catalog && (artwork || artworkPending)) return 'Mixto · catálogo y diseño';
  if (artwork) return 'Personalizado · diseño adjunto';
  if (artworkPending) return 'Personalizado · diseño pendiente';
  if (catalog) return 'Catálogo';
  return 'Sin registrar';
}
