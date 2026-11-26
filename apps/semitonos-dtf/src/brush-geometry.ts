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

export function positionBrushCursor(element: HTMLElement | null, point: CanvasPoint | null, display?: CanvasSize) {
  if (!element) return
  if (element.hidden === !!point) element.hidden = !point
  if (point && display) {
    element.style.transform = `translate3d(${point.x * display.width}px, ${point.y * display.height}px, 0) translate(-50%, -50%)`
  }
}

export function drawBrushSegment(ctx: CanvasRenderingContext2D, from: CanvasPoint, to: CanvasPoint, diameter: number, display: CanvasSize) {
  const x = from.x * display.width, y = from.y * display.height
  ctx.save()
  ctx.scale(ctx.canvas.width / display.width,ctx.canvas.height / display.height)
  ctx.beginPath()
  if (from.x === to.x && from.y === to.y) {
    ctx.arc(x,y,diameter / 2,0,2 * Math.PI)
    ctx.fill()
  } else {
    ctx.lineCap = 'round'
    ctx.lineWidth = diameter
    ctx.moveTo(x,y)
    ctx.lineTo(to.x * display.width,to.y * display.height)
    ctx.stroke()
  }
  ctx.restore()
}

export function rasterizeBrushSegment(from: CanvasPoint, to: CanvasPoint, diameter: number, display: CanvasSize, bitmap: CanvasSize, paint: (x:number,y:number)=>void) {
  const {x:ax,y:ay,radiusX,radiusY} = brushFootprint(from,diameter,display,bitmap)
  const dx = to.x * bitmap.width - ax, dy = to.y * bitmap.height - ay
  const sx = dx / radiusX, sy = dy / radiusY
  const lengthSquared = sx*sx + sy*sy
  const clamp = (value:number) => Math.max(0,Math.min(1,value))
  const top = Math.max(0,Math.floor(Math.min(ay,ay+dy)-radiusY))
  const bottom = Math.min(bitmap.height,Math.ceil(Math.max(ay,ay+dy)+radiusY))
  for (let y = top; y < bottom; y++) {
    // Restrict a long diagonal stroke to pixels near the segment on this row.
    const t0 = dy ? clamp((y + .5 - ay - radiusY) / dy) : 0
    const t1 = dy ? clamp((y + .5 - ay + radiusY) / dy) : 1
    const left = Math.max(0,Math.floor(ax + Math.min(dx*t0,dx*t1) - radiusX))
    const right = Math.min(bitmap.width,Math.ceil(ax + Math.max(dx*t0,dx*t1) + radiusX))
    for (let x = left; x < right; x++) {
      const px = (x + .5 - ax) / radiusX, py = (y + .5 - ay) / radiusY
      const t = lengthSquared ? clamp((px*sx + py*sy) / lengthSquared) : 0
      if ((px-t*sx)**2 + (py-t*sy)**2 <= 1) paint(x,y)
    }
  }
}
