// Only generated previews belong here; editorial photos never need an artwork download.
export function previewKey(design, productSlug, artwork) {
  return JSON.stringify([productSlug, artwork, design.sampleColor]);
}

export function needsGeneratedPreview(design, key, cache) {
  return design.active !== false && !design.featuredPhoto && cache.get(design.id) !== key;
}
