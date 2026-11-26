export const MAX_PIXELS = 40_000_000

export function printSize(widthCm: number, ratio: number, dpi: number, padding = 0) {
  if (![widthCm, ratio, dpi].every(Number.isFinite) || widthCm <= 0 || ratio <= 0 || dpi < 72 || dpi > 1200) {
    throw new Error('Introduce un ancho mayor que cero y una resolución válida.')
  }
  const contentWidth = Math.max(1, Math.round(widthCm / 2.54 * dpi))
  const width = contentWidth + padding * 2
  const height = Math.max(1, Math.round(contentWidth / ratio)) + padding * 2
  if (width > 12000 || height > 12000 || width * height > MAX_PIXELS) {
    throw new Error('El tamaño supera 40 megapíxeles o 12.000 px por lado. Reduce los centímetros o los ppp.')
  }
  return { width, height, widthCm: width / dpi * 2.54, heightCm: height / dpi * 2.54 }
}

const pngSignature = new Uint8Array([137,80,78,71,13,10,26,10])
const crcTable = Uint32Array.from({length:256}, (_, byte) => {
  let crc = byte
  for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  return crc
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(data.length + 12)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(Array.from(type, char => char.charCodeAt(0)), 4)
  chunk.set(data, 8)
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, -4)))
  return chunk
}

function pngDpiChunk(dpi: number) {
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 1200) throw new Error('Resolución PNG inválida.')
  const data = new Uint8Array(9)
  const view = new DataView(data.buffer)
  view.setUint32(0, Math.round(dpi / .0254))
  view.setUint32(4, Math.round(dpi / .0254))
  data[8] = 1
  return pngChunk('pHYs', data)
}

const srgbChunk = pngChunk('sRGB', new Uint8Array([0]))

function chunks(bytes: Uint8Array) {
  if (bytes.length < 33 || pngSignature.some((v, i) => v !== bytes[i])) throw new Error('PNG inválido.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const result: { start: number; end: number; type: string }[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + length + 12
    if (end > bytes.length) throw new Error('PNG incompleto.')
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) throw new Error('PNG con error de integridad.')
    result.push({ start: offset, end, type })
    offset = end
  }
  if (offset !== bytes.length || result[0]?.type !== 'IHDR' || result.at(-1)?.type !== 'IEND') throw new Error('Estructura PNG inválida.')
  return result
}

// Canvas normally emits 96 DPI. Write explicit physical resolution without
// modifying IDAT pixels or the alpha channel, replacing any existing pHYs.
export function withPngDpi(bytes: Uint8Array, dpi: number) {
  const chunk = pngDpiChunk(dpi)
  const parts = chunks(bytes)
  const size = 8 + chunk.length + parts.filter(p => p.type !== 'pHYs').reduce((n, p) => n + p.end - p.start, 0)
  const result = new Uint8Array(size)
  result.set(bytes.subarray(0, 8))
  let offset = 8
  for (const p of parts) {
    if (p.type === 'pHYs') continue
    result.set(bytes.subarray(p.start, p.end), offset)
    offset += p.end - p.start
    if (p.type === 'IHDR') { result.set(chunk, offset); offset += chunk.length }
  }
  return result
}

// Only for pixels already rendered into an sRGB canvas, not arbitrary source files.
export function withCanvasPrintProfile(bytes:Uint8Array,dpi:number) {
  const tagged=withPngDpi(bytes,dpi)
  const parts=chunks(tagged).filter(p=>!['sRGB','iCCP','gAMA','cHRM','cICP','mDCV','cLLI'].includes(p.type))
  const result=new Uint8Array(8+srgbChunk.length+parts.reduce((n,p)=>n+p.end-p.start,0))
  result.set(tagged.subarray(0,8));let offset=8
  for(const p of parts){result.set(tagged.subarray(p.start,p.end),offset);offset+=p.end-p.start;if(p.type==='IHDR'){result.set(srgbChunk,offset);offset+=srgbChunk.length}}
  return result
}

// Each RGBA scanline starts with filter byte 0. All IDAT chunks carry parts
// of the same zlib stream, so the strip boundaries are invisible to decoders.
export async function encodeRgbaPng(width: number, height: number, dpi: number, scanlines: ReadableStream<Uint8Array<ArrayBuffer>>) {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 6], 8)

  const parts: BlobPart[] = [pngSignature, pngChunk('IHDR', header), srgbChunk, pngDpiChunk(dpi)]
  const compressed = scanlines.pipeThrough(new CompressionStream('deflate'))
  const reader = compressed.getReader()
  try {
    for (;;) {
      const {done, value} = await reader.read()
      if (done) break
      parts.push(pngChunk('IDAT', value))
    }
    parts.push(pngChunk('IEND', new Uint8Array()))
    return new Blob(parts, {type:'image/png'})
  } finally {
    await reader.cancel()
  }
}

export function resolutionCheck(item:{naturalWidth:number;naturalHeight:number;widthCm:number;heightCm:number},dpi:number) {
  const width=Math.round(item.widthCm/2.54*dpi),height=Math.round(item.heightCm/2.54*dpi)
  return {width,height,effectiveDpi:item.naturalWidth/item.widthCm*2.54,
    matches:width===item.naturalWidth&&height===item.naturalHeight}
}

export function inspectPng(bytes: Uint8Array) {
  const parts = chunks(bytes)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const phys = parts.find(p => p.type === 'pHYs')
  return {
    width: view.getUint32(16), height: view.getUint32(20), colorType: bytes[25],
    profile: parts.some(p=>p.type==='sRGB')?'sRGB':parts.some(p=>p.type==='iCCP')?'ICC':'sin etiqueta',
    dpi: phys && bytes[phys.start + 16] === 1 ? view.getUint32(phys.start + 8) * .0254 : 0,
    dpiY: phys && bytes[phys.start + 16] === 1 ? view.getUint32(phys.start + 12) * .0254 : 0,
  }
}
