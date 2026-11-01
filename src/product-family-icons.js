const silhouettes = {
  men: '<path d="m16 8-10 6 5 10 5-3v19h24V21l5 3 5-10-10-6h-7c0 6-10 6-10 0Z"/>',
  women: '<path d="m18 8-10 6 5 9 5-3 2 10-4 10h24l-4-10 2-10 5 3 5-9-10-6h-5c0 6-10 6-10 0Z"/>',
  kids: '<path d="m19 12-9 5 4 8 5-3v15h18V22l5 3 4-8-9-5h-4c0 5-10 5-10 0Z"/><path d="m25 26 3 3 3-3"/>',
  body: '<path d="m18 8-10 6 5 9 5-3v9c0 5 6 5 6 11h8c0-6 6-6 6-11v-9l5 3 5-9-10-6h-5c0 6-10 6-10 0Z"/><path d="M23 35h10m-7 3v1m4-1v1"/>',
  tote: '<path d="M12 18h32l3 23H9l3-23Z"/><path d="M21 22V13a7 7 0 0 1 14 0v9"/>',
};

export function productFamilyIcon(family) {
  const shape = silhouettes[family];
  return shape ? `<svg class="product-family-icon" viewBox="0 0 56 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>` : '';
}
