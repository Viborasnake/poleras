export const DEFAULT_CATALOG_PRINT_LAYOUT = Object.freeze({ size: 1, x: 0, y: 0 });

export function normalizeCatalogPrintLayout(value) {
  const number = (key, min, max, fallback) => {
    const raw = value?.[key];
    const parsed = raw === '' || raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.round(Math.max(min, Math.min(max, parsed)) * 100) / 100 : fallback;
  };
  return { size: number('size', .6, 1.15, 1), x: number('x', -.3, .3, 0), y: number('y', -.3, .3, 0) };
}

export function catalogPrintLayoutFor(design, product) {
  return normalizeCatalogPrintLayout((design?.printLayouts || design?.print_layouts)?.[product]);
}
