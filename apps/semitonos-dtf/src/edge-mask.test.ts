import {test} from 'node:test'
import assert from 'node:assert/strict'
import {applyEdgeMask,edgeMaskStyles} from './edge-mask.ts'

function rectangle(width=160,height=120,left=12,top=8,right=147,bottom=111) {
  const data=new Uint8ClampedArray(width*height*4)
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)data.set([210,90,50,255],(y*width+x)*4)
  return data
}
const alpha=(data:Uint8ClampedArray,x:number,y:number,width=160)=>data[(y*width+x)*4+3]

test('each mask cuts visible artwork bounds and preserves its center and canvas',()=>{
  assert.equal(edgeMaskStyles.length,18)
  const signatures=new Set<string>()
  for(const style of edgeMaskStyles){
    const data=rectangle()
    applyEdgeMask(data,160,120,{style:style.id,sizeMm:3,dpi:150,solidAlpha:true})
    assert.equal(data.length,160*120*4)
    assert.equal(alpha(data,80,60),255,style.id)
    assert.equal(alpha(data,0,0),0,style.id)
    assert.equal(alpha(data,80,8),0,style.id)
    const signature=Array.from({length:136},(_,x)=>{
      let y=8
      while(y<60&&!alpha(data,x+12,y))y++
      return y
    }).join(',')
    signatures.add(signature)
    for(let i=3;i<data.length;i+=4)assert.ok(data[i]===0||data[i]===255,style.id)
  }
  assert.equal(signatures.size,edgeMaskStyles.length)
})
test('selected sides and transparent padding are respected',()=>{
  const data=rectangle()
  applyEdgeMask(data,160,120,{style:'torn',sizeMm:4,dpi:150,sides:[true,false,false,false],solidAlpha:true})
  assert.equal(alpha(data,80,8),0)
  assert.equal(alpha(data,147,60),255)
  assert.equal(alpha(data,80,111),255)
  assert.equal(alpha(data,12,60),255)
})
test('no mask leaves bytes unchanged and soft mode can produce partial alpha',()=>{
  const original=rectangle()
  const none=original.slice()
  applyEdgeMask(none,160,120,{style:'none',sizeMm:5,dpi:300})
  assert.deepEqual(none,original)
  const soft=original.slice()
  applyEdgeMask(soft,160,120,{style:'scallop',sizeMm:4,dpi:150,solidAlpha:false})
  assert.ok(soft.some((value,index)=>index%4===3&&value>0&&value<255))
})
test('mask details keep their physical scale between 150 and 300 DPI',()=>{
  for(const {id} of edgeMaskStyles){
    const standard=rectangle()
    const high=rectangle(320,240,24,16,295,223)
    for(const [data,dpi] of [[standard,150],[high,300]] as const){
      applyEdgeMask(data,160*dpi/150,120*dpi/150,{style:id,sizeMm:3,dpi,solidAlpha:true})
    }
    let differences=0
    for(let y=8;y<28;y++)for(let x=32;x<=127;x++){
      if(alpha(standard,x,y)!==alpha(high,x*2,y*2,320))differences++
    }
    assert.ok(differences<40,`${id}: ${differences} differences across 1,920 samples`)
  }
})
