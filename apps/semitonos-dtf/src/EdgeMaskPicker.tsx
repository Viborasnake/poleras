import {useEffect,useRef,useState} from 'react'
import {Check} from 'lucide-react'
import {applyEdgeMask,edgeMaskFamilies,edgeMaskStyles,type EdgeMaskStyle} from './edge-mask'

type Family = (typeof edgeMaskFamilies)[number]['id']

function EdgeMaskThumbnail({style}: {style: EdgeMaskStyle}) {
  const ref=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const canvas=ref.current!
    const ctx=canvas.getContext('2d')
    if(!ctx)return
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.fillStyle=getComputedStyle(canvas).color
    ctx.fillRect(12,12,canvas.width-24,canvas.height-24)
    const image=ctx.getImageData(0,0,canvas.width,canvas.height)
    applyEdgeMask(image.data,canvas.width,canvas.height,{style,sizeMm:2.4,dpi:300})
    ctx.putImageData(image,0,0)
  },[style])
  return <canvas className="edge-mask-thumbnail" ref={ref} width={256} height={156} aria-hidden="true"/>
}

export default function EdgeMaskPicker({value,onChange}: {value: EdgeMaskStyle; onChange: (style: EdgeMaskStyle) => void}) {
  const selected=edgeMaskStyles.find(style=>style.id===value)
  const [familyFilter,setFamilyFilter]=useState<Family>()
  const family=familyFilter??selected?.family??edgeMaskFamilies[0].id
  return (
    <div className="edge-mask-picker">
      <div className="edge-mask-heading">
        <h3 id="edge-mask-heading">Máscaras de borde</h3>
        <button type="button" className="btn edge-mask-clear" aria-pressed={value==='none'} onClick={()=>{setFamilyFilter(family);onChange('none')}}>Sin máscara</button>
      </div>
      <label className="field edge-mask-family">Familia
        <select value={family} onChange={e=>setFamilyFilter(e.target.value as Family)}>
          {edgeMaskFamilies.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      {selected&&<p className="edge-mask-current">Activa <strong>{selected.name}</strong></p>}
      <div className="edge-mask-grid" role="group" aria-labelledby="edge-mask-heading">
        {edgeMaskStyles.filter(style=>style.family===family).map(style=>
          <button key={style.id} type="button" aria-pressed={value===style.id} onClick={()=>onChange(style.id)}>
            <span className="edge-mask-preview">
              <EdgeMaskThumbnail style={style.id}/>
              {value===style.id&&<span className="edge-mask-check"><Check size={13} aria-hidden="true"/></span>}
            </span>
            <span>{style.name}</span>
          </button>,
        )}
      </div>
    </div>
  )
}
