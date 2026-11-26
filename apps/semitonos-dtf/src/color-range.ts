import {rasterizeBrushSegment} from './brush-geometry.ts'

export type SelectionStroke={x:number;y:number;toX:number;toY:number;radius:number;erase:boolean}
export type ColorRange = {colors:string[]; tolerance:number; softness:number;useColors?:boolean;strokes?:SelectionStroke[]}
export const defaultColorRange:ColorRange = {colors:['#ffffff'],tolerance:8,softness:4}
export const maxSelectionBrushSize = 120
export const maxSelectionStrokes = 20000

export function validColorRange(value:unknown):value is ColorRange {
  if(!value||typeof value!=='object')return false
  const v=value as ColorRange
  return Array.isArray(v.colors)&&(v.colors.length>0||v.useColors===false)&&v.colors.length<=8
    &&v.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))
    &&[v.tolerance,v.softness].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)
    &&(v.useColors===undefined||typeof v.useColors==='boolean')
    &&(v.strokes===undefined||(Array.isArray(v.strokes)&&v.strokes.length<=maxSelectionStrokes&&v.strokes.every(s=>s&&typeof s.erase==='boolean'&&[s.x,s.y,s.toX,s.toY].every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&Number.isFinite(s.radius)&&s.radius>0&&s.radius<=maxSelectionBrushSize/2)))
}

// Rasterize normalized brush segments once per render, independent of output
// resolution. 0 = no override, 1 = erase selection, 2 = add selection.
export function selectionBrushMask(range:ColorRange,width:number,height:number){
  if(!range.strokes?.length)return null
  const mask=new Uint8Array(width*height)
  const bitmap={width,height}
  for(const s of range.strokes){
    rasterizeBrushSegment(s,{x:s.toX,y:s.toY},s.radius * width * 2,bitmap,bitmap,(x,y)=>{
      mask[y*width+x]=s.erase?1:2
    })
  }
  return mask
}
export function selectionCoverage(range:ColorRange,retention:number,override:number=0){
  return override===2?1:override===1?0:range.useColors===false?0:1-retention
}

// RGB maximum-channel distance: tolerance is a percentage of 255, not an
// emulation of Adobe's proprietary Color Range scale. Compile once per frame.
export function colorRangeRetention(range:ColorRange) {
  if(!range.colors.length)return ()=>1
  const colors=range.colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)))
  const radius=range.tolerance*2.55, feather=range.softness*2.55
  return (r:number,g:number,b:number)=>{
    let distance=255
    for(const c of colors)distance=Math.min(distance,Math.max(Math.abs(r-c[0]),Math.abs(g-c[1]),Math.abs(b-c[2])))
    if(distance<=radius)return 0
    if(!feather||distance>=radius+feather)return 1
    const t=(distance-radius)/feather
    return t*t*(3-2*t)
  }
}
