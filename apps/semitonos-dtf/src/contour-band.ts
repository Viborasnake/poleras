import {createDotThreshold, type HalftoneSettings} from './halftone.ts'
import {connectedExterior} from './white-background.ts'

export const maxContourWidth = 20
export type ContourBand = {side: 'inside' | 'outside'; widthPx: number; softness: number; flow: number}
export const defaultContourBand: ContourBand = {side: 'inside', widthPx: 8, softness: 100, flow: 70}

export function contourPadding({enabled, contourBand}: {enabled: boolean; contourBand?: ContourBand}) {
  return enabled && contourBand?.side === 'outside' ? contourBand.widthPx : 0
}

export function validContourBand(value: unknown): value is ContourBand {
  if (!value || typeof value !== 'object') return false
  const {side, widthPx, softness, flow} = value as ContourBand
  return (side === 'inside' || side === 'outside') && Number.isInteger(widthPx) && widthPx >= 1 && widthPx <= maxContourWidth
    && Number.isInteger(softness) && softness >= 0 && softness <= 100
    && Number.isInteger(flow) && flow >= 0 && flow <= 100
}

export function padRgba(data: Uint8ClampedArray, width: number, height: number, padding: number) {
  if (!padding) return data
  const stride = (width + padding * 2) * 4
  const padded = new Uint8ClampedArray(stride * (height + padding * 2))
  for (let y = 0; y < height; y++) {
    padded.set(data.subarray(y * width * 4, (y + 1) * width * 4), (y + padding) * stride + padding * 4)
  }
  return padded
}

const sampleAngles = Array.from({length:16},(_,i)=>{
  const angle=(i + .5) * Math.PI / 8
  return [Math.cos(angle),Math.sin(angle)]
})

/** Screen only the exterior perimeter. Enclosed transparent holes are left alone. */
export function applyContourBand(data: Uint8ClampedArray, width: number, height: number, band: ContourBand, settings: HalftoneSettings, padding: number) {
  const result = padRgba(data, width, height, padding)
  width += 2 * padding
  height += 2 * padding
  const outside = band.side === 'outside'
  const exterior = connectedExterior(width,height,pixel => result[pixel * 4 + 3] === 0)
  const visible = (pixel: number) => result[pixel * 4 + 3] !== 0
  const isSeed = outside ? visible : (pixel: number) => exterior[pixel] !== 0
  const radius = band.widthPx
  const radiusSquared = radius * radius
  const threshold = createDotThreshold(settings)
  const middleDensity = Math.min(1, .5 * (settings.size / 100) ** 2)
  const softness = band.softness / 100
  const flow = band.flow / 100
  const sampleRadius = Math.max(3,Math.min(10,radius * .6))
  const shapeSamples = sampleAngles.map(([x,y])=>[x*sampleRadius,y*sampleRadius])

  function flowingWidth(x:number,y:number) {
    let artwork = 0
    for (const [dx,dy] of shapeSamples) {
      const sx = Math.round(x+dx), sy = Math.round(y+dy)
      if (sx>=0 && sx<width && sy>=0 && sy<height && !exterior[sy*width+sx]) artwork++
    }
    // Straight edges divide the sample ring in two. Convex tips and concave
    // turns unbalance it, so the band narrows in either kind of corner.
    const turn = Math.min(1,Math.max(0,(Math.abs(artwork-8)-1)/3))
    const taper = turn * turn * (3 - 2 * turn)
    return Math.max(1,radius * (1 - .7 * flow * taper))
  }

  // Keep only the nearest horizontal displacement. Distances beyond the
  // narrow band cannot contribute, so a signed byte per pixel is enough.
  const horizontal = new Int8Array(width * height).fill(127)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let seedX = -radius - 1
    for (let x = 0; x < width; x++) {
      if (isSeed(row + x)) seedX = x
      if (x - seedX <= radius) horizontal[row + x] = seedX - x
    }
    seedX = width + radius
    for (let x = width - 1; x >= 0; x--) {
      if (isSeed(row + x)) seedX = x
      if (seedX - x <= radius && seedX - x < Math.abs(horizontal[row + x])) horizontal[row + x] = seedX - x
    }
  }

  // Each candidate row contributes a parabola of squared distance along a
  // column. Its lower envelope gives the exact nearest seed in linear time.
  const sites = new Int32Array(height)
  const starts = new Float64Array(height)
  for (let x = 0; x < width; x++) {
    let count = 0
    for (let y = 0; y < height; y++) {
      const dx = horizontal[y * width + x]
      if (Math.abs(dx) > radius) continue
      let crossing = -Infinity
      while (count) {
        const previous = sites[count - 1]
        const prevDx = horizontal[previous * width + x]
        crossing = (y*y + dx*dx - previous*previous - prevDx*prevDx) / (2 * (y - previous))
        if (crossing > starts[count - 1]) break
        count--
      }
      sites[count] = y
      starts[count] = count === 0 ? -Infinity : crossing
      count++
    }

    let nearest = 0
    for (let y = 0; y < height; y++) {
      const pixel = y * width + x
      if (outside ? !exterior[pixel] : !visible(pixel)) continue
      while (nearest + 1 < count && starts[nearest + 1] < y) nearest++
      let seedY = count ? sites[nearest] : -1
      let seedX = count ? x + horizontal[seedY * width + x] : x
      let distanceSquared = count ? (seedX - x)**2 + (seedY - y)**2 : Infinity
      if (!outside) {
        const edgeDistance = Math.min(x + 1,width - x,y + 1,height - y)
        if (edgeDistance**2 < distanceSquared) {
          distanceSquared = edgeDistance**2
          seedX = edgeDistance === x + 1 ? -1 : edgeDistance === width - x ? width : x
          seedY = seedX !== x ? y : edgeDistance === y + 1 ? -1 : height
        }
      }
      if (distanceSquared > radiusSquared) continue

      const distance = Math.sqrt(distanceSquared)
      const localWidth = flow && radius > 1 ? flowingWidth(seedX+(x-seedX)*.5/distance,seedY+(y-seedY)*.5/distance) : radius
      if (distance > localWidth) continue
      const progress = (distance - .5) / localWidth
      const towardsSolid = outside ? 1 - progress : progress
      const ramp = towardsSolid * towardsSolid * (3 - 2 * towardsSolid)
      const faded = ramp < .5 ? middleDensity * ramp * 2 : middleDensity + (1 - middleDensity) * (ramp * 2 - 1)
      const coverage = middleDensity + (faded - middleDensity) * softness
      const target = pixel * 4
      if (coverage <= threshold(x - padding,y - padding)) {
        if (!outside) result.fill(0,target,target + 4)
      } else if (outside) {
        const source = (seedY * width + seedX) * 4
        result[target] = result[source]
        result[target + 1] = result[source + 1]
        result[target + 2] = result[source + 2]
        result[target + 3] = 255
      }
    }
  }
  return result
}
