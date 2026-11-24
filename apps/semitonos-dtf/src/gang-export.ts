import type {Placement} from './packing.ts'
import {encodeRgbaPng, inspectPng, resolutionCheck, withCanvasPrintProfile} from './print.ts'

export const MAX_GANG_WIDTH_CM = 300
export const MAX_GANG_SIDE_PX = Math.round(MAX_GANG_WIDTH_CM / 2.54 * 600)
export const MAX_GANG_PIXELS = 600_000_000

export function gangPrintSize(widthCm: number, heightCm: number, dpi: number) {
  const width = Math.round(widthCm / 2.54 * dpi)
  const height = Math.round(heightCm / 2.54 * dpi)
  return {
    width, height,
    tooBig: width > MAX_GANG_SIDE_PX || height > MAX_GANG_SIDE_PX || width * height > MAX_GANG_PIXELS,
  }
}

type PrintAsset = Parameters<typeof resolutionCheck>[0] & {id: string; img: CanvasImageSource}
type PrintPlacement = {img: CanvasImageSource; x: number; y: number; width: number; height: number; rotated: boolean}

function drawPlacement(ctx: CanvasRenderingContext2D, placement: PrintPlacement, offsetX = 0, offsetY = 0) {
  const {img, width, height, rotated} = placement
  const x = placement.x - offsetX
  const y = placement.y - offsetY
  if (rotated) ctx.setTransform(0, 1, -1, 0, x + height, y)
  else ctx.setTransform(1, 0, 0, 1, x, y)
  ctx.drawImage(img, 0, 0, width, height)
}

async function canvasPng(width: number, height: number, dpi: number, placements: PrintPlacement[]) {
  const canvas = document.createElement('canvas')
  try {
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', {colorSpace:'srgb'})!
    ctx.imageSmoothingEnabled = false
    for (const placement of placements) drawPlacement(ctx, placement)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('El navegador no pudo exportar la plancha.')), 'image/png')
    })
    const bytes = withCanvasPrintProfile(new Uint8Array(await blob.arrayBuffer()), dpi)
    const check = inspectPng(bytes)
    if (check.width !== width || check.height !== height || Math.abs(check.dpi-dpi) > .02 || Math.abs(check.dpiY-dpi) > .02 || check.profile !== 'sRGB') {
      throw new Error('La exportación no coincide con las medidas.')
    }
    return new Blob([bytes], {type:'image/png'})
  } finally {
    canvas.width = canvas.height = 1
  }
}

async function tiledPng(width: number, height: number, dpi: number, placements: PrintPlacement[]) {
  const tileWidth = Math.min(4096, width)
  const bandHeight = Math.min(64, height)
  const stride = width * 4 + 1
  const canvas = document.createElement('canvas')
  canvas.width = tileWidth
  canvas.height = bandHeight
  const ctx = canvas.getContext('2d', {colorSpace:'srgb', willReadFrequently:true})!
  ctx.imageSmoothingEnabled = false
  const bounds = placements.map(placement => ({
    ...placement,
    right: placement.x + (placement.rotated ? placement.height : placement.width),
    bottom: placement.y + (placement.rotated ? placement.width : placement.height),
  }))

  let y = 0
  const blankBand = new Uint8Array(stride * bandHeight)
  const scanlines = new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      const rows = Math.min(bandHeight, height - y)
      const inBand = bounds.filter(p => p.y < y + rows && p.bottom > y)
      const band = inBand.length ? new Uint8Array(stride * rows) : blankBand.subarray(0, stride * rows)
      for (let x = 0; inBand.length && x < width; x += tileWidth) {
        const cols = Math.min(tileWidth, width - x)
        const inTile = inBand.filter(p => p.x < x + cols && p.right > x)
        if (!inTile.length) continue
        ctx.resetTransform()
        ctx.clearRect(0, 0, cols, rows)
        for (const placement of inTile) drawPlacement(ctx, placement, x, y)
        const {data} = ctx.getImageData(0, 0, cols, rows)
        const rowBytes = cols * 4
        for (let row = 0; row < rows; row++) {
          band.set(data.subarray(row * rowBytes, (row + 1) * rowBytes), row * stride + 1 + x * 4)
        }
      }
      controller.enqueue(band)
      y += rows
      if (y === height) controller.close()
      // Yield periodically so the editor remains usable during a large export.
      else if (y % (8 * bandHeight) === 0) await new Promise(resolve => setTimeout(resolve, 0))
    },
  })
  try {
    return await encodeRgbaPng(width, height, dpi, scanlines)
  } finally {
    canvas.width = canvas.height = 1
  }
}

export async function exportGangPng(width: number, height: number, dpi: number, layout: Placement[], items: PrintAsset[]) {
  const assets = new Map(items.map(item => [item.id, item]))
  const placements = layout.map(({id, x, y, rotated}) => {
    const item = assets.get(id)!
    const {width, height} = resolutionCheck(item, dpi)
    return {img:item.img, x:Math.round(x / 2.54 * dpi), y:Math.round(y / 2.54 * dpi), width, height, rotated}
  })

  if (width <= 16_000 && height <= 16_000 && width * height <= 100_000_000) {
    try {
      return await canvasPng(width, height, dpi, placements)
    } catch (error) {
      if (typeof CompressionStream !== 'function') throw error
    }
  }
  if (typeof CompressionStream !== 'function') throw new Error('Para exportar esta plancha grande, abre el editor en un navegador actualizado.')
  return tiledPng(width, height, dpi, placements)
}
