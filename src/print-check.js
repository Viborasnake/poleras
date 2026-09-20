// Provisional workshop settings; confirm with the printer before production.
export const PRINT_POLICY = { widthCm: 28, heightCm: 40, minPpi: 150, maxBytes: 50 * 1024 * 1024 };
export const REVIEW_FEE_CLP = null; // Not priced yet; never interpret as free or paid.
export const PRINT_EXTRAS_CLP = Object.freeze({ front: 0, back: 0, both: 3990 });
export const QUALITY_ADJUSTMENT_CLP = 4990;
export function checkResolution(width, height, policy = PRINT_POLICY) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { qualifies: false, reason: 'No se pudieron determinar las dimensiones.' };
  const cmPerPixel = Math.min(policy.widthCm / width, policy.heightCm / height);
  const ppi = 2.54 / cmPerPixel;
  return { qualifies: ppi >= policy.minPpi, width, height, ppi, printWidth: width * cmPerPixel, printHeight: height * cmPerPixel,
    reason: ppi >= policy.minPpi ? 'La resolución alcanza el mínimo configurado.' : 'La resolución es insuficiente para el tamaño de impresión configurado.' };
}
export function paymentBreakdown(total, paidReviewCredit) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(paidReviewCredit) || paidReviewCredit < 0 || paidReviewCredit > total) throw new Error('Importes inválidos');
  const depositDue = Math.max(0, Math.ceil(total / 2) - paidReviewCredit);
  return { total, reviewCredit: paidReviewCredit, depositDue, balanceDue: total - paidReviewCredit - depositDue };
}
export function orderTotal(basePrice, printChoice, extras = 0) {
  if (!Number.isSafeInteger(basePrice) || basePrice < 0 || !Number.isSafeInteger(extras) || extras < 0 || !(printChoice in PRINT_EXTRAS_CLP)) throw new Error('Pedido inválido');
  const print = PRINT_EXTRAS_CLP[printChoice];
  return { base: basePrice, print, extras, total: basePrice + print + extras };
}
