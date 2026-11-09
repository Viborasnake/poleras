// Provisional workshop settings; confirm with the printer before production.
import {printPrice} from '../supabase/functions/_shared/print-pricing.js';
export const PRINT_POLICY = { widthCm: 28, heightCm: 40, minPpi: 150, maxBytes: 12 * 1024 * 1024 };
// Fallback used until the public storefront settings load. The live value is managed in Admin.
export const REVIEW_FEE_CLP = 4990;
export const PRINT_EXTRAS_CLP = Object.freeze({ front: 0, back: 0, both: 3990 });
export const QUALITY_ADJUSTMENT_CLP = REVIEW_FEE_CLP;
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
export function orderTotal(basePrice, printChoice, extras = 0, printCount = printChoice === 'both' ? 2 : 1, configuration = null, prices = null) {
  if (!Number.isSafeInteger(basePrice) || basePrice < 0 || !Number.isSafeInteger(extras) || extras < 0 || !(printChoice in PRINT_EXTRAS_CLP) || !Number.isInteger(printCount) || printCount < 0 || printCount > 4) throw new Error('Pedido inválido');
  const print = configuration ? printPrice(configuration, printChoice, prices || undefined) : Math.max(0, printCount - 1) * PRINT_EXTRAS_CLP.both;
  return { base: basePrice, print, extras, total: basePrice + print + extras };
}
