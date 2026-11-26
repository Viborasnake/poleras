export type PackItem = { id: string; widthCm: number; heightCm: number; quantity: number }
export type Placement = { id: string; x: number; y: number; width: number; height: number; rotated: boolean }
type Rect = { x:number; y:number; w:number; h:number }
type Layout = {placements: Placement[]; missing: number; usedHeight: number}
type PlacementRule = 'short-side' | 'bottom-left' | 'area' | 'upright'
const placementRules: PlacementRule[] = ['short-side', 'bottom-left', 'area', 'upright']
const intersects = (a:Rect,b:Rect) => a.x < b.x+b.w-1e-8 && a.x+a.w > b.x+1e-8 && a.y < b.y+b.h-1e-8 && a.y+a.h > b.y+1e-8
const contains = (a:Rect,b:Rect) => a.x <= b.x+1e-8 && a.y <= b.y+1e-8 && a.x+a.w >= b.x+b.w-1e-8 && a.y+a.h >= b.y+b.h-1e-8

export function pack(items: PackItem[], width: number, height: number, gap: number, rotate: boolean, optimize = false) {
  if (![width,height,gap].every(Number.isFinite) || width <= 0 || height <= 0 || gap < 0) throw new Error('Dimensiones de plancha inválidas.')
  const expanded = items.flatMap(item => {
    if (![item.widthCm,item.heightCm,item.quantity].every(Number.isFinite) || item.widthCm <= 0 || item.heightCm <= 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 200) throw new Error('Cada diseño necesita tamaño positivo y entre 1 y 200 copias.')
    return Array.from({length:item.quantity}, () => item)
  })
  if (expanded.length > 200) throw new Error('Máximo 200 copias por plancha.')
  // Try several deterministic orders and placement rules. A single greedy
  // choice can strand space even when every copy fits in another arrangement.
  const orders = [
    [...expanded].sort((a,b)=>b.widthCm*b.heightCm-a.widthCm*a.heightCm),
    [...expanded].sort((a,b)=>Math.max(b.heightCm,b.widthCm)-Math.max(a.heightCm,a.widthCm)),
    [...expanded].sort((a,b)=>b.heightCm-a.heightCm),
    [...expanded].sort((a,b)=>b.widthCm-a.widthCm),
    [...expanded].sort((a,b)=>Math.min(b.heightCm,b.widthCm)-Math.min(a.heightCm,a.widthCm)),
    expanded,
  ]
  function attempt(order:PackItem[], rule:PlacementRule, limit:number): Layout {
    // Occupied rectangles include a trailing gap; the outer bin needs only
    // one deducted margin so designs can reach the right/bottom inner edge.
    const free: Rect[] = [{x:gap,y:gap,w:width-gap,h:limit-gap}]
    const placements: Placement[] = []
    let missing = 0
    for (const item of order) {
      const variants = [{w:item.widthCm,h:item.heightCm,rotated:false}, ...(rotate && item.widthCm !== item.heightCm ? [{w:item.heightCm,h:item.widthCm,rotated:true}] : [])]
      const choices: {freeIndex:number;w:number;h:number;rotated:boolean;short:number;long:number}[] = []
      free.forEach((rect,freeIndex) => variants.forEach(v => {
        const rw=v.w+gap,rh=v.h+gap
        if(rw<=rect.w+1e-8 && rh<=rect.h+1e-8) choices.push({freeIndex,...v,short:Math.min(rect.w-rw,rect.h-rh),long:Math.max(rect.w-rw,rect.h-rh)})
      }))
      if (!choices.length) { missing++; continue }
      choices.sort((a,b)=> {
        const ar=free[a.freeIndex],br=free[b.freeIndex]
        if(rule==='upright') return Number(a.rotated)-Number(b.rotated) || (ar.y+a.h)-(br.y+b.h) || ar.x-br.x
        if(rule==='bottom-left') return (ar.y+a.h)-(br.y+b.h) || ar.x-br.x || a.short-b.short
        if(rule==='area') return (ar.w*ar.h-(a.w+gap)*(a.h+gap))-(br.w*br.h-(b.w+gap)*(b.h+gap)) || a.short-b.short
        return a.short-b.short || a.long-b.long
      })
      const choice=choices[0], rect=free[choice.freeIndex], placed:Rect={x:rect.x,y:rect.y,w:choice.w+gap,h:choice.h+gap}
      const next:Rect[]=[]
      for(const candidate of free) {
        if(!intersects(candidate,placed)){next.push(candidate);continue}
        if(candidate.x < placed.x) next.push({x:candidate.x,y:candidate.y,w:placed.x-candidate.x,h:candidate.h})
        if(candidate.x+candidate.w > placed.x+placed.w) next.push({x:placed.x+placed.w,y:candidate.y,w:candidate.x+candidate.w-(placed.x+placed.w),h:candidate.h})
        if(candidate.y < placed.y) next.push({x:candidate.x,y:candidate.y,w:candidate.w,h:placed.y-candidate.y})
        if(candidate.y+candidate.h > placed.y+placed.h) next.push({x:candidate.x,y:placed.y+placed.h,w:candidate.w,h:candidate.y+candidate.h-(placed.y+placed.h)})
      }
      free.splice(0,free.length,...next.filter(r=>r.w>1e-7&&r.h>1e-7).filter((r,i,all)=>!all.some((other,j)=>i!==j&&contains(other,r)&&(!contains(r,other)||j<i))))
      placements.push({id:item.id,x:rect.x,y:rect.y,width:choice.w,height:choice.h,rotated:choice.rotated})
    }
    return {placements,missing,usedHeight: placements.length ? Math.max(...placements.map(p=>p.y+p.height)) + gap : 0}
  }
  let best: Layout = {placements: [], missing: expanded.length, usedHeight: 0}
  let bestOrder = expanded
  let bestRule: PlacementRule = 'short-side'
  function tryLayout(order: PackItem[], rule: PlacementRule, limit: number) {
    const candidate = attempt(order, rule, limit)
    if (candidate.missing < best.missing || (candidate.missing === best.missing && candidate.usedHeight + 1e-8 < best.usedHeight)) {
      best = candidate
      bestOrder = order
      bestRule = rule
    }
    return candidate
  }

  for (const order of orders) {
    for (const rule of placementRules) tryLayout(order, rule, height)
  }
  const standard = best

  if (optimize && expanded.length > 1) {
    const byAspect = [...expanded].sort((a,b) => a.widthCm / a.heightCm - b.widthCm / b.heightCm)
    const byPerimeter = [...expanded].sort((a,b) => b.widthCm + b.heightCm - a.widthCm - a.heightCm)
    const additionalOrders = [byAspect, [...byAspect].reverse(), byPerimeter, [...orders[0]].reverse()]
    for (const order of additionalOrders) {
      for (const rule of placementRules) tryLayout(order, rule, height)
    }

    if (best.missing === 0) {
      // Packing in a shorter bin changes which gaps the placement rules prefer.
      const paddedArea = expanded.reduce((area,item) => area + (item.widthCm + gap) * (item.heightCm + gap), 0)
      let minimumTrialHeight = gap + paddedArea / (width - gap)
      for (let step = 0; step < 6 && best.usedHeight - minimumTrialHeight > 0.01; step++) {
        const limit = (minimumTrialHeight + best.usedHeight) / 2
        const first = tryLayout(bestOrder, bestRule, limit)
        if (first.missing === 0) continue
        const second = tryLayout(orders[0], 'bottom-left', limit)
        if (second.missing === 0) continue
        const third = tryLayout(byPerimeter, 'short-side', limit)
        if (third.missing > 0) minimumTrialHeight = limit
      }
    }
  }

  return {...best, improved: best !== standard}
}
