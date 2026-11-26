import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pack} from './packing.ts'
test('uses the full inner sheet including trailing margins',()=>{
  const result=pack([{id:'exact',widthCm:57,heightCm:99,quantity:1}],58,100,.5,false)
  assert.equal(result.missing,0)
  assert.equal(result.usedHeight,100)
})
test('fits mixed poster sizes from the gang sheet without resizing',()=>{
  const items=[{id:'a',widthCm:25,heightCm:37.51,quantity:2},{id:'b',widthCm:25,heightCm:37.57,quantity:1},{id:'c',widthCm:19.7,heightCm:35.01,quantity:2}]
  const result=pack(items,58,100,.5,true)
  assert.equal(result.missing,0)
  assert.equal(result.placements.length,5)
  for(const p of result.placements) {
    assert.ok(p.x>=.5 && p.y>=.5 && p.x+p.width<=57.5+1e-8 && p.y+p.height<=99.5+1e-8)
  }
  for(let i=0;i<result.placements.length;i++)for(let j=i+1;j<result.placements.length;j++){
    const a=result.placements[i],b=result.placements[j]
    assert.ok(a.x+a.width+.5<=b.x+1e-8||b.x+b.width+.5<=a.x+1e-8||a.y+a.height+.5<=b.y+1e-8||b.y+b.height+.5<=a.y+1e-8)
  }
})
test('gang sheet copies respect margins, bounds and do not overlap',()=>{
  const result=pack([{id:'a',widthCm:10,heightCm:15,quantity:8},{id:'b',widthCm:6,heightCm:4,quantity:6}],58,100,.5,true)
  assert.equal(result.missing,0);assert.equal(result.placements.length,14)
  for(const p of result.placements){assert.ok(p.x>=.5&&p.y>=.5&&p.x+p.width<=57.5&&p.y+p.height<=99.5)}
  for(let i=0;i<result.placements.length;i++)for(let j=i+1;j<result.placements.length;j++){
    const a=result.placements[i],b=result.placements[j]
    assert.ok(a.x+a.width+.5<=b.x||b.x+b.width+.5<=a.x||a.y+a.height+.5<=b.y||b.y+b.height+.5<=a.y)
  }
})
test('unfitted copies are counted and invalid quantities rejected',()=>{
  assert.equal(pack([{id:'x',widthCm:20,heightCm:20,quantity:2}],10,10,0,true).missing,2)
  assert.throws(()=>pack([{id:'x',widthCm:2,heightCm:2,quantity:1.5}],10,10,0,true))
})
test('mixed designs reuse side gaps instead of stopping at the first row',()=>{
  const result=pack([{id:'large',widthCm:30,heightCm:35,quantity:2},{id:'small',widthCm:12,heightCm:12,quantity:5}],58,100,.5,true)
  assert.equal(result.missing,0)
  assert.equal(result.placements.length,7)
})

test('optimization uses less length while preserving dimensions, copies and gaps', () => {
  const items = [
    {id:'a', widthCm:21, heightCm:39, quantity:2},
    {id:'b', widthCm:18, heightCm:16, quantity:1},
    {id:'c', widthCm:15, heightCm:21, quantity:3},
    {id:'d', widthCm:18, heightCm:10, quantity:1},
    {id:'e', widthCm:27, heightCm:15, quantity:2},
  ]
  const original = structuredClone(items)
  const gap = 0.5
  const standard = pack(items, 58, 100, gap, false)
  const optimized = pack(items, 58, 100, gap, false, true)
  assert.equal(standard.missing, 0)
  assert.equal(optimized.missing, 0)
  assert.equal(optimized.improved, true)
  assert.ok(optimized.usedHeight <= standard.usedHeight - 10)
  assert.deepEqual(items, original)
  assert.deepEqual(pack(items, 58, 100, gap, false, true), optimized)
  for (const item of items) {
    const copies = optimized.placements.filter(placement => placement.id === item.id)
    assert.equal(copies.length, item.quantity)
    for (const copy of copies) {
      assert.equal(copy.width, item.widthCm)
      assert.equal(copy.height, item.heightCm)
      assert.equal(copy.rotated, false)
      assert.ok(copy.x >= gap && copy.y >= gap)
      assert.ok(copy.x + copy.width + gap <= 58 && copy.y + copy.height + gap <= 100)
    }
  }
  for (const [index, a] of optimized.placements.entries()) {
    for (const b of optimized.placements.slice(index + 1)) {
      assert.ok(a.x+a.width+gap<=b.x || b.x+b.width+gap<=a.x || a.y+a.height+gap<=b.y || b.y+b.height+gap<=a.y)
    }
  }
})

test('optimization prioritizes fitting more pieces over shortening a partial layout', () => {
  const items = [
    {id:'a', widthCm:9, heightCm:27, quantity:3},
    {id:'b', widthCm:28, heightCm:36, quantity:2},
    {id:'c', widthCm:31, heightCm:25, quantity:1},
    {id:'d', widthCm:18, heightCm:22, quantity:2},
    {id:'e', widthCm:37, heightCm:7, quantity:2},
  ]
  assert.equal(pack(items, 58, 100, 0.5, false).missing, 1)
  assert.equal(pack(items, 58, 100, 0.5, false, true).missing, 0)
})

test('optimization respects rotation and keeps an already efficient layout', () => {
  const items = [{id:'a', widthCm:6, heightCm:4, quantity:2}]
  assert.equal(pack(items, 4, 12, 0, false, true).missing, 2)
  const standard = pack(items, 4, 12, 0, true)
  assert.equal(standard.missing, 0)
  assert.ok(standard.placements.every(placement => placement.rotated))
  assert.deepEqual(pack(items, 4, 12, 0, true, true), standard)
})
