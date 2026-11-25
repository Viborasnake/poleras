export type CanvasPoint = { x: number; y: number }
type CanvasSize = { width: number; height: number }

export function canvasPoint(rect: CanvasSize & { left: number; top: number }, clientX: number, clientY: number): CanvasPoint | null {
  if (!rect.width || !rect.height) return null
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  return x >= 0 && x < 1 && y >= 0 && y < 1 ? { x, y } : null
}

export function brushFootprint(point: CanvasPoint, diameter: number, display: CanvasSize, bitmap: CanvasSize) {
  return {
    x: point.x * bitmap.width,
    y: point.y * bitmap.height,
    radiusX: diameter / 2 * bitmap.width / display.width,
    radiusY: diameter / 2 * bitmap.height / display.height,
  }
}
