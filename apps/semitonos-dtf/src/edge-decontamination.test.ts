import assert from 'node:assert/strict'
import {test} from 'node:test'
import {decontaminateEdges, normalizedArtwork, type EdgeRepairStroke} from './edge-decontamination.ts'
import {garmentPresets} from './garment-presets.ts'
import {processImage} from './process-image.ts'

const width=12
const cream=[240,216,180,255]
const dark=[32,24,18,255]
const halo=[90,90,90,112]
const clear=[0,0,0,0]
const sample=(data:Uint8ClampedArray,x:number)=>Array.from(data.subarray(x*4,x*4+4))
const tap=(x:number,radius=1): EdgeRepairStroke=>{
  const point={x:(x+.5)/width,y:.5}
  return {from:point,to:point,radius:radius/width}
}

test('repair takes local foreground RGB and changes only painted semitransparent pixels',()=>{
  const input=new Uint8ClampedArray([clear,cream,halo,halo,clear,dark,halo,clear,clear,clear,clear,clear].flat())
  const out=decontaminateEdges(input,width,1,[tap(2,.75),tap(6,.75)])
  assert.deepEqual(sample(out,2),[...cream.slice(0,3),112])
  assert.deepEqual(sample(out,6),[...dark.slice(0,3),112])
  assert.deepEqual(sample(out,1),cream)
  assert.deepEqual(sample(out,3),halo)
  assert.deepEqual(sample(out,4),clear)
  assert.deepEqual(sample(input,2),halo)
})

test('repair skips reference colors across a transparent gap and fades near opaque pixels',()=>{
  const nearOpaque=[100,100,100,232]
  const input=new Uint8ClampedArray([cream,nearOpaque,halo,halo,clear,dark,clear,halo,clear,clear,clear,clear].flat())
  const out=decontaminateEdges(input,width,1,[tap(2,2),tap(7,.75)])
  assert.deepEqual(sample(out,1),[170,158,140,232])
  assert.deepEqual(sample(out,3),[...cream.slice(0,3),112])
  assert.deepEqual(sample(out,7),halo)
})

test('the saved stroke stays aligned after a crop and preserves continuous output alpha',()=>{
  const input=new Uint8ClampedArray([clear,cream,halo,clear].flat())
  const area=normalizedArtwork({x:4,y:0,width:4,height:1},width,1)
  const settings={...garmentPresets.darkOriginal.values,edgeRepair:[tap(6,.75)],separateBackground:true}
  const {data,background}=processImage(input,4,1,settings,undefined,true,0,area)
  const expected=[...cream.slice(0,3),112]
  assert.deepEqual(sample(data,2),expected)
  assert.deepEqual(sample(background!,2),expected)
  assert.deepEqual(sample(data,3),clear)
})

test('repair does not bring back pixels removed by the background selection',()=>{
  const input=new Uint8ClampedArray([clear,cream,[0,0,0,112],clear].flat())
  const area=normalizedArtwork({x:4,y:0,width:4,height:1},width,1)
  const settings={...garmentPresets.darkOriginal.values,background:'black' as const,tolerance:5,
    edgeRepair:[tap(6,.75)],separateBackground:true}
  const {data,background}=processImage(input,4,1,settings,undefined,true,0,area)
  assert.deepEqual(sample(data,2),clear)
  assert.deepEqual(sample(background!,2),clear)
})
