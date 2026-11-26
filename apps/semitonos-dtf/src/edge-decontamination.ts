import {rasterizeBrushSegment, type CanvasPoint} from './brush-geometry.ts'
import {maxSelectionBrushSize, maxSelectionStrokes} from './color-range.ts'
import type {CropRect} from './crop.ts'

export type EdgeRepairStroke = {from: CanvasPoint; to: CanvasPoint; radius: number}
export const fullArtwork: CropRect = {x:0,y:0,width:1,height:1}

export function normalizedArtwork(crop: CropRect | null, width: number, height: number): CropRect {
  return crop ? {x:crop.x/width,y:crop.y/height,width:crop.width/width,height:crop.height/height} : fullArtwork
}

export function validEdgeRepair(value: unknown): value is EdgeRepairStroke[] {
  const validPoint = (p: CanvasPoint | undefined) => !!p && [p.x,p.y].every(n=>Number.isFinite(n) && n>=0 && n<=1)
  return Array.isArray(value) && value.length<=maxSelectionStrokes && value.every((stroke: EdgeRepairStroke) => stroke
    && validPoint(stroke.from) && validPoint(stroke.to) && Number.isFinite(stroke.radius)
    && stroke.radius>0 && stroke.radius<=maxSelectionBrushSize/2)
}

const referenceAlpha = 248
const searchRadius = 24
const offsets: {dx:number;dy:number;distance:number}[] = []
for (let dy=-searchRadius; dy<=searchRadius; dy++) {
  for (let dx=-searchRadius; dx<=searchRadius; dx++) {
    const distance = dx*dx+dy*dy
    if (distance && distance<=searchRadius*searchRadius) offsets.push({dx,dy,distance})
  }
}
offsets.sort((a,b)=>a.distance-b.distance)

// Keep the sample on the same strand when two edges almost touch.
function hasVisiblePath(data: Uint8ClampedArray, width: number, x: number, y: number, dx: number, dy: number) {
  const steps = Math.max(Math.abs(dx),Math.abs(dy))
  for (let step=1; step<steps; step++) {
    const sx=x+Math.round(dx*step/steps), sy=y+Math.round(dy*step/steps)
    if (!data[(sy*width+sx)*4+3]) return false
  }
  return true
}

export function decontaminateEdges(data: Uint8ClampedArray, width: number, height: number, strokes?: EdgeRepairStroke[], artwork=fullArtwork) {
  if (!strokes?.length) return data
  const bitmap = {width,height}
  const visited = new Uint8Array(width*height)
  const toCrop = ({x,y}: CanvasPoint)=>({x:(x-artwork.x)/artwork.width,y:(y-artwork.y)/artwork.height})
  let result = data

  for (const stroke of strokes) {
    rasterizeBrushSegment(toCrop(stroke.from),toCrop(stroke.to),2*stroke.radius*width/artwork.width,bitmap,bitmap,(x,y)=>{
      const pixel = y*width+x, i=pixel*4, alpha=data[i+3]
      if (!alpha || alpha>=referenceAlpha || visited[pixel]) return
      visited[pixel] = 1
      for (const {dx,dy} of offsets) {
        const sx=x+dx, sy=y+dy
        if (sx<0 || sx>=width || sy<0 || sy>=height) continue
        const sample=(sy*width+sx)*4
        if (data[sample+3]<referenceAlpha || !hasVisiblePath(data,width,x,y,dx,dy)) continue
        // Fade the correction into the solid interior while keeping alpha intact.
        const t=Math.min(1,(referenceAlpha-alpha)/32)
        const strength=t*t*(3-2*t)
        if (result===data) result=new Uint8ClampedArray(data)
        for (let channel=0; channel<3; channel++) result[i+channel]=data[i+channel]+(data[sample+channel]-data[i+channel])*strength
        break
      }
    })
  }
  return result
}
