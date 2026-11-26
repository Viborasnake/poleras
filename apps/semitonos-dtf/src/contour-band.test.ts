import {test} from 'node:test'
import assert from 'node:assert/strict'
import {appendContourStroke,defaultContourBand,maxContourWidth} from './contour-band.ts'
import {garmentPresets} from './garment-presets.ts'
import {processImage} from './process-image.ts'
import type {Settings} from './App'

const width=96, height=96
const color=[70,100,155,255]
const settings: Settings & {dpi:number}={
  ...garmentPresets.default.values, size:100, lpi:50, angle:25, shape:'square', dpi:300,
  background:'none', edgeMask:'none', edgeMaskSizeMm:5, edgeSides:[true,true,true,true], trimMm:0, featherMm:0, cornerRadiusMm:0,
}

function picture(left=22) {
  const data=new Uint8ClampedArray(4*width*height)
  for(let y=22;y<74;y++)for(let x=left;x<74;x++){
    if(x>44&&x<53&&y>44&&y<53)continue
    data.set(color,(y*width+x)*4)
  }
  return data
}

function pixel(data: Uint8ClampedArray,x:number,y:number,padding=0) {
  const offset=((y+padding)*(width+padding*2)+x+padding)*4
  return Array.from(data.subarray(offset,offset+4))
}

function inkIn(data: Uint8ClampedArray, padding: number, x0: number, y0: number, x1: number, y1: number) {
  let count=0
  for (let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixel(data,x,y,padding)[3])count++
  return count
}

test('inward contour follows the visible silhouette at one output pixel', () => {
  const original=picture()
  const data=processImage(original,width,height,{...settings,contourBand:{...defaultContourBand,widthPx:1}}).data
  assert.ok(inkIn(data,0,22,35,23,60)>0)
  assert.ok(inkIn(data,0,22,35,23,60)<25)
  for (let y=30;y<66;y++)for (let x=23;x<66;x++) assert.deepEqual(pixel(data,x,y),pixel(original,x,y))
  assert.deepEqual(pixel(data,21,40),[0,0,0,0])
})

test('outward contour retains the art and closed holes and extends a flush edge into the new margin', () => {
  const original=picture(0), padding=maxContourWidth
  const contourBand={...defaultContourBand,side:'outside' as const,widthPx:padding,softness:0,flow:0}
  const data=processImage(original,width,height,{...settings,contourBand},undefined,false,padding).data
  assert.equal(data.length,(width+2*padding)*(height+2*padding)*4)
  for (let y=22;y<74;y++)for (let x=0;x<74;x++)assert.deepEqual(pixel(data,x,y,padding),pixel(original,x,y))
  assert.ok(inkIn(data,padding,-60,35,-58,60)>0)
  assert.deepEqual(pixel(data,135,42,padding),[0,0,0,0])
  assert.deepEqual([...new Set(data.filter((_,i)=>i%4===3))].sort((a,b)=>a-b),[0,255])
})

test('flow tapers a corner while leaving a continuous edge at full width', () => {
  const input=picture(), padding=16
  const contourBand={...defaultContourBand,side:'outside' as const,widthPx:padding,softness:45,flow:0}
  const uniform=processImage(input,width,height,{...settings,contourBand},undefined,false,padding).data
  const flowing=processImage(input,width,height,{...settings,contourBand:{...contourBand,flow:100}},undefined,false,padding).data
  assert.ok(inkIn(flowing,padding,10,10,22,22)<inkIn(uniform,padding,10,10,22,22)/2)
  assert.equal(inkIn(flowing,padding,42,10,54,22),inkIn(uniform,padding,42,10,54,22))
})

test('softening graduates the dot coverage from transparency to solid ink', () => {
  const contourBand={...defaultContourBand,widthPx:12,flow:0}
  const data=processImage(picture(),width,height,{...settings,contourBand}).data
  const nearEdge=inkIn(data,0,22,34,26,62)
  const nearSolid=inkIn(data,0,30,34,34,62)
  assert.ok(nearEdge>0 && nearSolid>nearEdge*3)
  assert.equal(inkIn(data,0,34,34,36,62),56)
})

test('widening brush overrides taper only under the stroke', () => {
  const input=picture(), padding=16
  const contourBand={...defaultContourBand,side:'outside' as const,widthPx:padding,softness:45,flow:100}
  const normal=processImage(input,width,height,{...settings,contourBand},undefined,false,padding).data
  const point={x:(14+padding)/(width+2*padding),y:(14+padding)/(height+2*padding)}
  const painted=appendContourStroke(contourBand,[{from:point,to:point}],'widen',24,width+2*padding,{width:width+2*padding,height:height+2*padding},padding)
  const result=processImage(input,width,height,{...settings,contourBand:painted},undefined,false,padding).data
  assert.ok(inkIn(result,padding,10,10,22,22)>inkIn(normal,padding,10,10,22,22))
  assert.equal(inkIn(result,padding,42,10,54,22),inkIn(normal,padding,42,10,54,22))
})

test('exclusion keeps original artwork solid and follows the outline when padding changes', () => {
  const input=picture(0), padding=20
  const contourBand={...defaultContourBand,side:'outside' as const,widthPx:padding,softness:0,flow:0}
  const point={x:(-6+padding)/(width+2*padding),y:(44+padding)/(height+2*padding)}
  const painted=appendContourStroke(contourBand,[{from:point,to:point}],'exclude',14,width+2*padding,{width:width+2*padding,height:height+2*padding},padding)
  const larger={...painted,widthPx:60}
  const before=processImage(input,width,height,{...settings,contourBand:{...contourBand,widthPx:60}},undefined,false,60).data
  const after=processImage(input,width,height,{...settings,contourBand:larger},undefined,false,60).data
  assert.ok(inkIn(before,60,-9,41,-3,47)>0)
  assert.equal(inkIn(after,60,-9,41,-3,47),0)
  assert.deepEqual(pixel(after,0,44,60),color)

  const inside={...contourBand,side:'inside' as const,softness:100}
  const atEdge={x:3/width,y:44/height}
  const protectedBand=appendContourStroke(inside,[{from:atEdge,to:atEdge}],'exclude',14,width,{width,height},0)
  const protectedImage=processImage(input,width,height,{...settings,contourBand:protectedBand}).data
  assert.equal(inkIn(protectedImage,0,0,41,6,47),36)
})
