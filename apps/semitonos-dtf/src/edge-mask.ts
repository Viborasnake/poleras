export const edgeMaskFamilies = [
  {id:'organic',name:'Orgánicas'},
  {id:'texture',name:'Texturizadas'},
  {id:'geometric',name:'Geométricas'},
] as const

export const edgeMaskStyles = [
  {id:'torn',name:'Papel rasgado',family:'organic'},
  {id:'ink',name:'Tinta orgánica',family:'organic'},
  {id:'scallop',name:'Ondas',family:'organic'},
  {id:'flame',name:'Llamas',family:'organic'},
  {id:'drip',name:'Gotas de tinta',family:'organic'},
  {id:'smoke',name:'Humo',family:'organic'},
  {id:'brush',name:'Pincel seco',family:'texture'},
  {id:'grunge',name:'Desgastado',family:'texture'},
  {id:'watercolor',name:'Acuarela',family:'texture'},
  {id:'splatter',name:'Salpicado',family:'texture'},
  {id:'deckle',name:'Papel fibroso',family:'texture'},
  {id:'rock',name:'Piedra quebrada',family:'texture'},
  {id:'zigzag',name:'Dientes',family:'geometric'},
  {id:'pixel',name:'Píxel roto',family:'geometric'},
  {id:'bevel',name:'Esquinas biseladas',family:'geometric'},
  {id:'stamp',name:'Estampilla',family:'geometric'},
  {id:'steps',name:'Escalonado',family:'geometric'},
  {id:'stitch',name:'Festón',family:'geometric'},
] as const

export type EdgeMaskStyle = 'none' | (typeof edgeMaskStyles)[number]['id']
export const isEdgeMaskStyle = (value: unknown): value is EdgeMaskStyle => value === 'none' || edgeMaskStyles.some(style => style.id === value)

type Options = {style:EdgeMaskStyle; sizeMm:number; dpi:number; sides?:boolean[]; solidAlpha?:boolean}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
const hash=(n:number)=>{const v=Math.sin(n*127.1+78.233)*43758.5453;return v-Math.floor(v)}
const noise=(t:number,seed:number)=>{const a=Math.floor(t),f=t-a,u=f*f*(3-2*f);return hash(a+seed)*(1-u)+hash(a+seed+1)*u}
const wave=(t:number)=>.5+.5*Math.cos(t)
const pulse=(t:number)=>1-Math.abs((t%2+2)%2-1)

function profile(style:EdgeMaskStyle,t:number,side:number,fromCorner:number):number {
  const n=(frequency:number,seed:number)=>noise(t*frequency,seed+side*101)
  switch(style){
    case 'torn': return .29+.41*n(.045,11)+.23*n(.28,17)+.07*n(1.1,23)
    case 'brush': return .18+.38*n(.027,31)+.17*n(.16,37)+.27*n(.75,43)
    case 'grunge': return .19+.31*n(.04,51)+.31*n(.3,57)+.19*n(1.2,61)
    case 'ink': return .38+.35*n(.018,71)+.16*Math.sin(t*.13+side)+.1*n(.4,73)
    case 'watercolor': return .26+.35*n(.025,81)+.22*n(.1,83)+.17*n(.55,89)
    case 'splatter': return .13+.3*n(.035,91)+.49*n(.38,97)
    case 'zigzag': return .2+.65*pulse(t*.11)
    case 'scallop': return .3+.5*wave(t*.13+side*.8)
    case 'flame': return .16+.78*Math.pow(wave(t*.082+side*.7+n(.015,113)*1.5),4)*(.55+.45*n(.025,111))
    case 'pixel': return .18+.72*hash(Math.floor(t/7)+side*101+121)
    case 'drip': return .18+.73*Math.pow(wave(t*.105+side+n(.018,131)*3),6)*(.62+.38*n(.055,137))
    case 'smoke': return .17+.54*wave(t*.059+side+n(.022,141)*3.5)+.24*n(.135,147)
    case 'deckle': return .2+.29*n(.056,151)+.22*n(.28,157)+.29*n(1.25,161)
    case 'rock': return .14+.50*pulse(t*(.13+n(.013,169)*.06)+side)+.29*n(.21,173)
    case 'bevel': return Math.max(.04,1-fromCorner)
    case 'stamp': {
      const position=(t/10)%1-.5
      const notch=Math.sqrt(Math.max(0,1-(position/.38)**2))
      return .14+.46*notch
    }
    case 'steps': return .14+.74*Math.floor(pulse(t*.065+side*.3)*5)/5
    case 'stitch': return .16+.71*Math.pow(wave(t*.19+side*.5),1.5)
    default: return 0
  }
}

function textureFor(style:EdgeMaskStyle) {
  switch(style){
    case 'splatter': return {density:.32,along:4,across:3}
    case 'grunge': return {density:.22,along:5,across:4}
    case 'brush': return {density:.19,along:2,across:8}
    case 'watercolor': return {density:.12,along:5,across:5}
    case 'deckle': return {density:.12,along:2,across:5}
    default: return null
  }
}

/** Cuts only existing ink, measured inward from its visible bounds. */
export function applyEdgeMask(data:Uint8ClampedArray,width:number,height:number,options:Options):void {
  const {style,dpi,sides=[true,true,true,true]}=options
  if(style==='none'||!Number.isFinite(options.sizeMm)||options.sizeMm<=0||!Number.isFinite(dpi)||dpi<=0||!sides.some(Boolean))return
  let left=width,top=height,right=-1,bottom=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)
  }
  if(right<left)return
  const depth=Math.max(1,Math.min(options.sizeMm*dpi/25.4,(right-left+1)/3,(bottom-top+1)/3))
  const soft=options.solidAlpha?0:1.25
  const extent=Math.ceil(depth+soft)
  const scale=150/dpi
  const texture=textureFor(style)
  const squaredCorners=style!=='bevel'&&edgeMaskStyles.find(option=>option.id===style)?.family==='geometric'
  const cuts=sides.map((enabled,side)=>{
    if(!enabled)return null
    const length=(side%2===0?right-left:bottom-top)+1
    const before=sides[(side+(side%2===0?3:1))%4]
    const after=sides[(side+(side%2===0?1:3))%4]
    return Float64Array.from({length},(_,along)=>{
      const fromCorner=Math.min(before?along:Infinity,after?length-1-along:Infinity)/depth
      const cut=profile(style,along*scale,side,fromCorner)
      if(!squaredCorners)return depth*cut
      const mix=clamp((fromCorner-.35)/.7)
      return depth*(.42*(1-mix)+cut*mix)
    })
  })

  function cutPixel(x:number,y:number) {
    const i=(y*width+x)*4
    if(!data[i+3])return
    let alpha=1
    for(let side=0;side<4;side++){
      const edge=cuts[side]
      if(!edge)continue
      const distance=side===0?y-top:side===1?right-x:side===2?bottom-y:x-left
      if(distance>extent)continue
      const along=side%2===0?x-left:y-top
      const cut=edge[along]
      let keep=soft?clamp((distance-cut)/soft+.5):distance>=cut?1:0
      if(texture&&keep>0){
        const reach=clamp((depth-distance)/Math.max(1,depth-cut))
        const cellX=Math.floor(along*scale/texture.along)
        const cellY=Math.floor(distance*scale/texture.across)
        const grain=hash(cellX*73+cellY*173+side*911)
        if(grain<texture.density*reach*reach)keep=0
      }
      alpha=Math.min(alpha,keep)
      if(alpha===0)break
    }
    if(alpha<1){
      data[i+3]=Math.round(data[i+3]*alpha)
      if(!data[i+3])data[i]=data[i+1]=data[i+2]=0
    }
  }

  for(let y=top;y<=bottom;y++){
    if((sides[0]&&y-top<=extent)||(sides[2]&&bottom-y<=extent)){
      for(let x=left;x<=right;x++)cutPixel(x,y)
    }else{
      const leftEnd=sides[3]?Math.min(right,left+extent):left-1
      for(let x=left;x<=leftEnd;x++)cutPixel(x,y)
      if(sides[1])for(let x=Math.max(leftEnd+1,right-extent);x<=right;x++)cutPixel(x,y)
    }
  }
}
