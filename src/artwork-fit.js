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

// 100% means the largest visually safe chest placement for the artwork's shape.
// Tall poster-like pieces need more breathing room than compact or horizontal marks.
export function automaticPrintScale(aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  if (aspect < .5) return .74;
  if (aspect < .72) return .82;
  if (aspect < .9) return .91;
  return 1;
}
