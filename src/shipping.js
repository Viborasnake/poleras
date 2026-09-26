const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Cotizador explícito para la demo. La función de servidor repite estas reglas
// y recalcula el importe antes de registrar el pedido.
export function quoteShipping(fulfillment, region = '', quantity = 1) {
  if (fulfillment === 'pickup') return { amount: 0, label: 'Retiro coordinado · gratis' };
  const place = normalize(region);
  let base = 7990;
  if (place.includes('metropolitana')) base = 3990;
  else if (place.includes('valparaiso') || place.includes("o'higgins")) base = 4990;
  else if (['coquimbo', 'maule', 'nuble', 'biobio'].some(name => place.includes(name))) base = 5990;
  else if (['araucania', 'rios', 'lagos'].some(name => place.includes(name))) base = 6990;
  const extraGarments = Math.max(0, Math.floor(Number(quantity) || 1) - 1);
  return { amount: base + extraGarments * 1000, label: 'Despacho a domicilio' };
}
