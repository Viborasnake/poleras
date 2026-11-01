const manualTypes = new Map([
  ['catalog', 'Catálogo'],
  ['artwork', 'Personalizado · diseño adjunto'],
  ['idea', 'Personalizado · idea'],
]);

const flowTypes = new Map([
  ['catalog_design', 'Catálogo · diseño'],
  ['people_base', 'Personas · diseño tal cual'],
  ['own_artwork', 'Personalizado · diseño adjunto'],
  ['people_personalization', 'Personalizado · personas'],
  ['pet_personalization', 'Personalizado · mascotas'],
  ['idea', 'Personalizado · idea'],
  ['mixed', 'Mixto · más de un flujo'],
]);

export function orderTypeLabel(order) {
  const explicitFlow = order.price_snapshot?.flow_type;
  if (flowTypes.has(explicitFlow)) return flowTypes.get(explicitFlow);
  if (order.request_type === 'creative' || order.source === 'idea_request') return 'Personalizado · idea';
  if (order.price_snapshot?.purchase_type === 'personalized') return 'Personalizado · archivo por WhatsApp';
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
