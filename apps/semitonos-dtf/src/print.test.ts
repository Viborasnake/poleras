import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deflateSync,inflateSync} from 'node:zlib'
import {encodeRgbaPng,printSize,withPngDpi,inspectPng,withCanvasPrintProfile,resolutionCheck} from './print.ts'
import {gangPrintSize} from './gang-export.ts'
import {presetPrintWidth, printWidthGroups} from './print-width-presets.ts'
function crc(bytes:Uint8Array){let v=~0;for(const b of bytes){v^=b;for(let k=0;k<8;k++)v=(v>>>1)^(-(v&1)&0xedb88320)}return (~v)>>>0}
function chunk(type:string,data:Uint8Array){const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length);b.write(type,4);b.set(data,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
const pixels=Buffer.from([0,255,0,0,0,0,255,0,255]) // one transparent and one opaque pixel
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',new Uint8Array())])
test('physical size uses DPI, proportional height and nearest pixel',()=>{
  assert.deepEqual(printSize(25.4,2,300),{width:3000,height:1500,widthCm:25.4,heightCm:12.7})
  assert.equal(printSize(30,2/3,300).height,5315)
  assert.equal(printSize(1024*4/300*2.54,2/3,300).height,6144)
  for(const n of [0,-1,NaN,Infinity,10000])assert.throws(()=>printSize(n,1,300))
})
test('tote presets fit portrait and landscape artwork within their dimensions', () => {
  const toteGroup = printWidthGroups.find(({label}) => label === 'Tote bags')
  assert.ok(toteGroup)
  assert.deepEqual(toteGroup.options.map(({width, height}) => [width, height]), [[30, 30], [35, 40], [45, 50]])
  for (const option of toteGroup.options) {
    assert.ok(option.height)
    assert.equal(presetPrintWidth(option, 2), option.width)
    assert.equal(presetPrintWidth(option, 0.5), option.height / 2)
    assert.equal(presetPrintWidth(option, option.width / option.height), option.width)
  }
})
test('shirt presets keep their print widths for portrait artwork', () => {
  assert.deepEqual(printWidthGroups.slice(0, 3).map(({options}) => options.map(option => presetPrintWidth(option, 0.5))), [
    [26, 27, 29, 29, 29],
    [21, 23, 26, 28, 29],
    [26, 28, 29, 29, 29],
  ])
})
test('PNG metadata supports 150/300/600 ppp without touching RGBA pixels',()=>{
  for(const dpi of [150,300,600]){
    const out=withPngDpi(png,dpi),info=inspectPng(out)
    assert.equal(info.width,2);assert.equal(info.height,1);assert.equal(info.colorType,6)
    assert.ok(Math.abs(info.dpi-dpi)<.02);assert.ok(Math.abs(info.dpiY-dpi)<.02)
    const b=Buffer.from(out),p=b.indexOf('IDAT'),len=b.readUInt32BE(p-4)
    assert.deepEqual(inflateSync(b.subarray(p+4,p+4+len)),pixels)
  }
})
test('existing DPI is replaced, corrupt PNG rejected',()=>{
  const out=withPngDpi(withPngDpi(png,96),300)
  assert.equal(Buffer.from(out).toString('latin1').split('pHYs').length-1,1)
  const bad=out.slice();bad[17]^=1;assert.throws(()=>inspectPng(bad))
})
test('sRGB print exports preserve pixels and replace conflicting profile labels',()=>{
 const profiled=Buffer.concat([png.subarray(0,33),chunk('iCCP',new Uint8Array([1,2,3])),png.subarray(33)])
 for(const dpi of [150,300,600]){
  const out=withCanvasPrintProfile(withCanvasPrintProfile(profiled,150),dpi)
  assert.equal(inspectPng(out).profile,'sRGB')
  assert.ok(Math.abs(inspectPng(out).dpiY-dpi)<.02)
  const b=Buffer.from(out),p=b.indexOf('IDAT'),length=b.readUInt32BE(p-4)
  assert.deepEqual(inflateSync(b.subarray(p+4,p+4+length)),pixels)
  assert.equal(b.includes(Buffer.from('iCCP')),false)
  assert.equal(b.toString('latin1').split('sRGB').length-1,1)
 }
})
test('all cross-DPI handoffs and changed print sizes require resampling warning',()=>{
 for(const source of [150,300,600])for(const target of [150,300,600]){
  const item={naturalWidth:source*10,naturalHeight:source*5,widthCm:25.4,heightCm:12.7}
  assert.equal(resolutionCheck(item,target).matches,source===target)
  assert.equal(resolutionCheck({...item,widthCm:50.8,heightCm:25.4},source).matches,false)
 }
 const item={naturalWidth:2953,naturalHeight:4430,widthCm:2953/300*2.54,heightCm:4430/300*2.54}
 assert.equal(resolutionCheck(item,300).matches,true)
})

test('Gang Sheet supports a 300 cm print side at 300 ppp and blocks oversized output', () => {
  assert.deepEqual(gangPrintSize(300, 130, 300), {width:35433, height:15354, tooBig:false})
  assert.deepEqual(gangPrintSize(58, 300, 300), {width:6850, height:35433, tooBig:false})
  assert.equal(gangPrintSize(300, 5, 600).tooBig, false)
  assert.equal(gangPrintSize(300, 300, 300).tooBig, true)
  assert.equal(gangPrintSize(1, 301, 600).tooBig, true)
})

test('streamed PNG preserves alpha, physical dimensions, and sRGB across bands', async () => {
  const transparent = new Uint8Array(pixels.length)
  const rows = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(Uint8Array.from(pixels))
      controller.enqueue(transparent)
      controller.close()
    },
  })
  const blob = await encodeRgbaPng(2, 2, 300, rows)
  const bytes = Buffer.from(await blob.arrayBuffer())
  const info = inspectPng(bytes)
  assert.equal(info.width, 2)
  assert.equal(info.height, 2)
  assert.equal(info.colorType, 6)
  assert.equal(info.profile, 'sRGB')
  assert.ok(Math.abs(info.dpi - 300) < .02)
  assert.ok(Math.abs(info.dpiY - 300) < .02)
  const compressed: Buffer[] = []
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      compressed.push(bytes.subarray(offset + 8, offset + 8 + length))
    }
    offset += length + 12
  }
  assert.deepEqual(inflateSync(Buffer.concat(compressed)), Buffer.concat([pixels, transparent]))
})
