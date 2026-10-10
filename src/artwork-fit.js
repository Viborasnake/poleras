export function visibleAlphaBounds(pixels, width, height, threshold = 12) {
  if (!pixels || width < 1 || height < 1) return null;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

// Sample the left and right visible edges across the drawing, including its
// highest and lowest rows. These points let the viewer fit irregular artwork
// against the actual garment instead of treating every file as a rectangle.
export function visibleAlphaEdgeSamples(pixels, width, height, threshold = 8, rowCount = 20) {
  if (!pixels || width < 1 || height < 1) return [];
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let left = width, right = -1;
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (right >= left) rows.push({ y, left, right });
  }
  if (!rows.length) return [];
  const samples = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = rows[Math.round(index * (rows.length - 1) / Math.max(1, rowCount - 1))];
    const v = (row.y + .5) / height;
    samples.push({ u: (row.left + .5) / width, v });
    if (row.right !== row.left) samples.push({ u: (row.right + .5) / width, v });
  }
  return samples;
}

// Tall poster-like pieces retain a narrow safety margin at the base scale.
export function automaticPrintScale(aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  if (aspect < .5) return .82;
  if (aspect < .72) return .88;
  if (aspect < .9) return .95;
  return 1;
}
