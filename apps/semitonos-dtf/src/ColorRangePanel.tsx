import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent,type UIEvent} from 'react'
import {Check,Minus,Plus,Trash2,Undo2} from 'lucide-react'
import EditorDialog from './EditorDialog'
import {maxSelectionBrushSize,maxSelectionStrokes,type ColorRange,type SelectionStroke} from './color-range'
import {canvasPoint,drawBrushSegment,positionBrushCursor,type CanvasPoint} from './brush-geometry'
import {normalizedArtwork} from './edge-decontamination'
import ColorRangePreviewWorker from './color-range-preview.worker?worker&inline'
import type {PreviewRequest} from './color-range-preview.worker'
import type {Settings} from './App'
import type {CropRect} from './CropPanel'

type Props={image:HTMLImageElement;crop:CropRect|null;initial:ColorRange;onApply:(range:ColorRange)=>void;onCancel:()=>void;onAutomaticContour?:(range:ColorRange)=>void;purpose?:'background'|'isolated'|'affected'|'protected';settings?:Settings&{dpi?:number};outputWidth?:number;processedSource?:HTMLCanvasElement|null}
export default function ColorRangePanel({image,crop,initial,onApply,onCancel,onAutomaticContour,purpose='background',settings,outputWidth,processedSource}:Props){
  const screening=purpose==='affected'||purpose==='protected'
  const [range,setRange]=useState<ColorRange>(()=>structuredClone(initial))
  const [tool,setTool]=useState<'sample'|'paint'|'erase'>(screening&&initial.useColors===false?'paint':'sample')
  const [size,setSize]=useState(36)
  const [zoom,setZoom]=useState(1)
  const [replace,setReplace]=useState(false)
  const [view,setView]=useState<'result'|'mask'|'background'>('result')
  const [stats,setStats]=useState({selected:0,visible:0,removed:0,holes:0})
  const [message,setMessage]=useState('')
  const left=useRef<HTMLCanvasElement>(null),right=useRef<HTMLCanvasElement>(null)
  const brushGuide=useRef<HTMLCanvasElement>(null), cursor=useRef<HTMLSpanElement>(null)
  const sourceRaster=useRef<HTMLCanvasElement|null>(null)
  const leftViewport=useRef<HTMLDivElement>(null),rightViewport=useRef<HTMLDivElement>(null)
  const sampleButtons=useRef<HTMLUListElement>(null)
  const cleanPreview=useRef<Uint8ClampedArray>(null)
  const keyboardPoint=useRef({x:.5,y:.5})
  const pointer=useRef<CanvasPoint|null>(null)
  const activeStroke=useRef<{id:number;point:CanvasPoint|null;segments:SelectionStroke[]}|null>(null)
  const history=useRef<ColorRange[]>([])
  const baseImage=processedSource?.width?processedSource:image
  const region=processedSource?.width?{x:0,y:0,width:processedSource.width,height:processedSource.height}:crop??{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight}
  // Keep a detailed backing canvas for zoom, while the initial view still fits
  // comfortably in the dialog. The previous 520px bitmap was simply enlarged.
  const displayScale=Math.min(520/region.width,400/region.height,1)
  const renderScale=Math.min(1200/region.width,900/region.height,1)
  const width=Math.max(1,Math.round(region.width*renderScale)),height=Math.max(1,Math.round(region.height*renderScale))
  const displayWidth=Math.max(1,Math.round(region.width*displayScale))
  useEffect(()=>{
    let worker: Worker | undefined
    const frame=requestAnimationFrame(()=>{
      const canvas=left.current!,ctx=canvas.getContext('2d')!
      const source=sourceRaster.current ??= document.createElement('canvas')
      source.width=width;source.height=height
      const sourceContext=source.getContext('2d',{willReadFrequently:true})!
      sourceContext.drawImage(baseImage,region.x,region.y,region.width,region.height,0,0,width,height)
      const original=sourceContext.getImageData(0,0,width,height).data
      if(!cleanPreview.current||canvas.width!==width||canvas.height!==height){
        canvas.width=width;canvas.height=height;ctx.drawImage(source,0,0)
      }
      const previewSettings=settings?{...settings,separateBackground:true,dpi:(settings.dpi??300)*width/(outputWidth??region.width),
        ...(screening?(purpose==='affected'?{affectedColors:range,screenScope:'all' as const}:{protectedColors:range}):{background:'custom' as const,colorRange:range,enabled:false,solidAlpha:false})}:undefined
      worker=new ColorRangePreviewWorker()
      worker.onmessage=({data})=>{
        if(data.error){setMessage(data.error);return}
        cleanPreview.current=data.clean
        if(data.overlay){
          ctx.putImageData(new ImageData(data.clean,width,height),0,0)
          sourceContext.putImageData(new ImageData(data.overlay,width,height),0,0)
          ctx.drawImage(source,0,0)
        } else {
          ctx.clearRect(0,0,width,height)
          ctx.drawImage(source,0,0)
        }
        const target=right.current!
        if(target.width!==width)target.width=width
        if(target.height!==height)target.height=height
        target.getContext('2d')!.putImageData(new ImageData(data.preview,width,height),0,0)
        const guide=brushGuide.current
        if(guide&&!activeStroke.current)guide.getContext('2d')!.clearRect(0,0,guide.width,guide.height)
        setStats({selected:data.selected,visible:data.visible,removed:data.removed,holes:data.holes})
      }
      const artwork=normalizedArtwork(crop,image.naturalWidth,image.naturalHeight)
      const request: PreviewRequest={original,width,height,range,settings:previewSettings,purpose,view,artwork}
      worker.onerror=()=>setMessage('No se pudo actualizar la vista previa.')
      worker.postMessage(request,[original.buffer])
    })
    return()=>{cancelAnimationFrame(frame);worker?.terminate()}
  },[baseImage,crop,image,region.x,region.y,region.width,region.height,width,height,range,settings,outputWidth,view,purpose,screening])
  const colors=range.useColors===false?[]:range.colors

  function saveHistory() {
    history.current=[...history.current.slice(-29),range]
  }

  function sample(x: number, y: number) {
    const preview=cleanPreview.current
    const previewIndex=(Math.min(height-1,Math.floor(y*height))*width+Math.min(width-1,Math.floor(x*width)))*4
    if(screening&&preview&&!preview[previewIndex+3]){
      setMessage('Elige un píxel visible.')
      return
    }
    const pixel=document.createElement('canvas')
    pixel.width=pixel.height=1
    const ctx=pixel.getContext('2d')!
    ctx.drawImage(baseImage,region.x+Math.min(region.width-1,Math.floor(x*region.width)),region.y+Math.min(region.height-1,Math.floor(y*region.height)),1,1,0,0,1,1)
    const rgba=ctx.getImageData(0,0,1,1).data
    if(!rgba[3]){
      setMessage('Elige un píxel visible.')
      return
    }
    const color='#'+Array.from(rgba.slice(0,3),c=>c.toString(16).padStart(2,'0')).join('')
    if((!replace||colors.length===1)&&colors.some(c=>c.toLowerCase()===color)){
      setMessage(`La muestra ${color.toUpperCase()} ya está en la selección.`)
      return
    }
    if(!replace&&colors.length>=8){
      setMessage('Ya tienes 8 muestras. Quita una para añadir otro color.')
      return
    }
    saveHistory()
    setRange({...range,useColors:true,colors:replace?[color]:[...colors,color]})
    setMessage(`Muestra ${color.toUpperCase()} añadida.`)
  }

  function removeSample(index: number) {
    const nextColors=colors.filter((_,i)=>i!==index)
    const buttons=sampleButtons.current?.querySelectorAll('button')
    if(nextColors.length){
      buttons?.[index===colors.length-1?index-1:index]?.focus()
    }else{
      left.current?.focus()
    }
    saveHistory()
    setRange({...range,colors:nextColors,useColors:nextColors.length>0})
    setMessage(`Muestra ${colors[index].toUpperCase()} quitada.`)
  }

  function undo() {
    const previous=history.current.pop()
    if(!previous)return
    if(!history.current.length)left.current?.focus()
    setRange(previous)
    setMessage('Se deshizo el último cambio de selección.')
  }

  function clearSelection() {
    saveHistory()
    setRange({...range,useColors:false,colors:[],strokes:[]})
    setMessage('Selección vaciada.')
    left.current?.focus()
  }

  function clearCursor() {
    pointer.current=null
    positionBrushCursor(cursor.current,null)
  }

  function trackPointer(rect: DOMRect, clientX: number, clientY: number) {
    pointer.current={x:clientX,y:clientY}
    const next=canvasPoint(rect,clientX,clientY)
    positionBrushCursor(cursor.current,next,rect)
    return next
  }

  function appendStrokes(segments: SelectionStroke[]) {
    setRange(r=>({...r,strokes:[...(r.strokes??[]),...segments].slice(0,maxSelectionStrokes)}))
  }

  function paintSegment(active: NonNullable<typeof activeStroke.current>, from: CanvasPoint, to: CanvasPoint, rect: DOMRect) {
    if((range.strokes?.length??0)+active.segments.length>=maxSelectionStrokes)return
    active.segments.push({...from,toX:to.x,toY:to.y,radius:size/(2*rect.width),erase:tool==='erase'})
    const ctx=brushGuide.current?.getContext('2d')
    if(ctx)drawBrushSegment(ctx,from,to,size,rect)
  }

  function paint(e: PointerEvent<HTMLCanvasElement>, start=false) {
    if(tool==='sample')return
    const active=activeStroke.current
    if(active&&active.id!==e.pointerId)return
    const rect=e.currentTarget.getBoundingClientRect()
    const next=trackPointer(rect,e.clientX,e.clientY)
    if(start){
      if(!next||e.button!==0||active)return
      saveHistory()
      setMessage('')
      e.currentTarget.setPointerCapture(e.pointerId)
      const guide=brushGuide.current!
      if(guide.width!==width||guide.height!==height){guide.width=width;guide.height=height}
      const ctx=guide.getContext('2d')!
      ctx.fillStyle=ctx.strokeStyle=getComputedStyle(guide).getPropertyValue(tool==='erase'?'--ds-warning':'--ds-pink').trim()
      const current={id:e.pointerId,point:next,segments:[]}
      activeStroke.current=current
      paintSegment(current,next,next,rect)
      e.preventDefault()
    }else if(active){
      if(next)paintSegment(active,active.point??next,next,rect)
      active.point=next
      e.preventDefault()
    }
  }

  function stopPaint(e: PointerEvent<HTMLCanvasElement>) {
    const active=activeStroke.current
    if(active?.id===e.pointerId){
      activeStroke.current=null
      if(active.segments.length)appendStrokes(active.segments)
    }
    if(e.type==='pointercancel'||(e.type==='pointerup'&&e.pointerType!=='mouse'))clearCursor()
  }

  function useCanvasWithKeyboard(event: KeyboardEvent<HTMLCanvasElement>) {
    const {x,y}=keyboardPoint.current
    if(event.key===' '||event.key==='Enter'){
      event.preventDefault()
      if(event.repeat)return
      pointer.current=null
      const rect=event.currentTarget.getBoundingClientRect()
      positionBrushCursor(cursor.current,{x,y},rect)
      if(tool==='sample'){
        sample(x,y)
      }else{
        saveHistory()
        if(rect.width)appendStrokes([{x,y,toX:x,toY:y,radius:size/(2*rect.width),erase:tool==='erase'}])
        setMessage(tool==='erase'?'Zona excluida.':'Zona pintada.')
      }
      return
    }
    const direction={
      ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
    }[event.key]
    if(!direction)return
    event.preventDefault()
    const [dx,dy]=direction
    const step=event.shiftKey ? .05 : .01
    const next={x:Math.max(0,Math.min(1,x+dx*step)),y:Math.max(0,Math.min(1,y+dy*step))}
    keyboardPoint.current=next
    pointer.current=null
    positionBrushCursor(cursor.current,next,event.currentTarget.getBoundingClientRect())
    const viewport=leftViewport.current!
    const canvas=event.currentTarget
    const targetX=canvas.offsetWidth*next.x+canvas.parentElement!.offsetLeft
    const targetY=canvas.offsetHeight*next.y+canvas.parentElement!.offsetTop
    const margin=12
    const visibleX=Math.max(viewport.scrollLeft+margin,Math.min(viewport.scrollLeft+viewport.clientWidth-margin,targetX))
    const visibleY=Math.max(viewport.scrollTop+margin,Math.min(viewport.scrollTop+viewport.clientHeight-margin,targetY))
    viewport.scrollBy(targetX-visibleX,targetY-visibleY)
  }

  function syncPreviewScroll(e: UIEvent<HTMLDivElement>, other: HTMLDivElement|null) {
    if(!other)return
    const {scrollLeft,scrollTop}=e.currentTarget
    if(other.scrollLeft!==scrollLeft||other.scrollTop!==scrollTop)other.scrollTo(scrollLeft,scrollTop)
  }

  const title=purpose==='affected'?'Dónde aplicar trama':purpose==='protected'?'Dónde conservar sin trama':'Eliminar fondo por color'
  const description=screening
    ?'Selecciona colores o pinta sobre el diseño sin fondo. Las zonas protegidas tienen prioridad en el resultado.'
    :'Toma los colores que quieres quitar y comprueba la transparencia en la vista previa.'
  const tools: [typeof tool,string][]=[
    ['sample','Gotero'],['paint',purpose==='protected'?'Proteger':'Pintar trama'],['erase','Excluir'],
  ]
  const views: [typeof view,string][]=[['result',screening?'Resultado con trama':'Fondo eliminado']]
  if(screening)views.push(['background','Antes de la trama'])
  views.push(['mask','Máscara'])
  const viewLabel=views.find(([value])=>value===view)?.[1]
  const artworkStyle={
    '--range-fit-width':`${displayWidth}px`,
    '--range-aspect':`${width} / ${height}`,
    '--range-zoom':zoom,
  } as CSSProperties

  return (
    <EditorDialog id="color-range" className="color-range-modal" title={title} description={description} onCancel={onCancel} actions={
      <>
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn export" onClick={()=>onApply(range)}>{screening?'Guardar selección':'Aplicar borrado de fondo'}</button>
      </>
    }>
      <div className="range-toolbar">
        {onAutomaticContour&&<button type="button" className="btn" onClick={()=>onAutomaticContour(range)}>Contorno exterior automático</button>}
        {screening&&<div className="segmented range-segments" role="group" aria-label="Herramienta de selección">
          {tools.map(([value,label])=><button key={value} className={tool===value?'active':''} aria-pressed={tool===value} onClick={()=>{setTool(value);clearCursor()}}>{tool===value&&<Check size={14} aria-hidden="true" />}{label}</button>)}
        </div>}
        {tool==='sample'
          ?<label className="range-replace"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/> Reemplazar muestras</label>
          :<label className="range-control range-brush-size" htmlFor="range-brush-size"><span><b>Tamaño del pincel</b><output>{size} px</output></span><input id="range-brush-size" type="range" min="2" max={maxSelectionBrushSize} value={size} style={{'--progress':`${(size-2)/(maxSelectionBrushSize-2)*100}%`} as CSSProperties} onChange={e=>setSize(Number(e.target.value))}/></label>}
        <div className="range-history">
          <button className="btn" disabled={!history.current.length} onClick={undo}><Undo2 size={16} aria-hidden="true"/> Deshacer</button>
          {screening&&<button className="btn" disabled={!colors.length&&!range.strokes?.length} onClick={clearSelection}>Vaciar selección</button>}
        </div>
      </div>

      <section className="range-samples" aria-labelledby="range-samples-title">
        <div className="range-samples-heading">
          <h3 id="range-samples-title">Muestras de color <small>{colors.length}/8</small></h3>
          {!!colors.length&&<div className="range-color-settings">
            {(['tolerance','softness'] as const).map((key,i)=><label className="range-control" key={key}>
              <span><b>{i?'Suavidad':'Tolerancia'}</b><output>{range[key]}%</output></span>
              <input type="range" min="0" max="100" value={range[key]} style={{'--progress':`${range[key]}%`} as CSSProperties} onChange={e=>setRange(r=>({...r,[key]:Number(e.target.value)}))}/>
            </label>)}
          </div>}
        </div>
        {colors.length
          ?<ul className="range-swatches" ref={sampleButtons}>
            {colors.map((color,i)=><li key={i}>
              <label>
                <input type="color" aria-label={`Editar muestra ${i+1} ${color.toUpperCase()}`} value={color.toLowerCase()} onChange={e=>{const value=e.target.value;setRange(r=>({...r,colors:r.colors.map((c,j)=>j===i?value:c)}))}}/>
                <span>{color.toUpperCase()}</span>
              </label>
              <button className="btn editor-icon-button" aria-label={`Quitar muestra ${i+1} ${color.toUpperCase()}`} title="Quitar muestra" onClick={()=>removeSample(i)}><Trash2 size={16} aria-hidden="true"/></button>
            </li>)}
          </ul>
          :<p>Usa el gotero sobre el diseño para añadir una muestra.</p>}
      </section>

      <div className="range-toolbar range-preview-toolbar">
        <div className="segmented range-segments" role="group" aria-label="Vista de comprobación" style={{gridTemplateColumns:`repeat(${views.length},minmax(0,1fr))`}}>
          {views.map(([value,label])=><button key={value} className={view===value?'active':''} aria-pressed={view===value} onClick={()=>setView(value)}>{view===value&&<Check size={14} aria-hidden="true" />}{label}</button>)}
        </div>
        <div className="range-zoom" role="group" aria-label="Zoom de la vista previa">
          <button className="btn editor-icon-button" aria-label="Alejar" disabled={zoom===1} onClick={()=>setZoom(z=>z/2)}><Minus size={16} aria-hidden="true"/></button>
          <output aria-label="Nivel de zoom">{zoom}×</output>
          <button className="btn editor-icon-button" aria-label="Acercar" disabled={zoom===8} onClick={()=>setZoom(z=>z*2)}><Plus size={16} aria-hidden="true"/></button>
          <button className="btn" onClick={()=>{setZoom(1);leftViewport.current?.scrollTo(0,0);rightViewport.current?.scrollTo(0,0)}}>Ajustar</button>
        </div>
      </div>

      <div className="range-preview-grid" style={artworkStyle}>
        <figure>
          <figcaption>{screening?'Diseño sin fondo':'Original'}</figcaption>
          <div ref={leftViewport} className="range-canvas-wrap range-source-wrap" onScroll={e=>{
            syncPreviewScroll(e,rightViewport.current)
            if(pointer.current&&left.current)trackPointer(left.current.getBoundingClientRect(),pointer.current.x,pointer.current.y)
          }}>
            <div className="range-canvas-art">
              <canvas
                ref={left} tabIndex={0} aria-label="Lienzo de selección" aria-describedby="range-canvas-help"
                style={{touchAction:tool==='sample'?'auto':'none',cursor:tool==='sample'?'crosshair':'none'}}
                onClick={e=>{
                  if(tool!=='sample')return
                  const next=canvasPoint(e.currentTarget.getBoundingClientRect(),e.clientX,e.clientY)
                  if(next)sample(next.x,next.y)
                }}
                onPointerEnter={e=>{if(tool!=='sample')trackPointer(e.currentTarget.getBoundingClientRect(),e.clientX,e.clientY)}}
                onPointerDown={e=>paint(e,true)}
                onPointerMove={e=>paint(e)}
                onPointerLeave={clearCursor}
                onPointerUp={stopPaint}
                onPointerCancel={stopPaint}
                onLostPointerCapture={stopPaint}
                onFocus={e=>{if(e.currentTarget.matches(':focus-visible'))positionBrushCursor(cursor.current,keyboardPoint.current,e.currentTarget.getBoundingClientRect())}}
                onBlur={clearCursor}
                onKeyDown={useCanvasWithKeyboard}
              />
              <canvas ref={brushGuide} className="brush-guide" aria-hidden="true"/>
              <span ref={cursor} hidden className={`brush-cursor ${tool==='erase'?'brush-cursor-erase':''}`} style={{width:tool==='sample'?12:size,height:tool==='sample'?12:size}} aria-hidden="true"/>
            </div>
          </div>
        </figure>
        <figure>
          <figcaption>{viewLabel}{view==='mask'&&<span> · Blanco = selección</span>}</figcaption>
          <div ref={rightViewport} className="range-canvas-wrap range-source-wrap" onScroll={e=>syncPreviewScroll(e,leftViewport.current)}>
            <div className="range-canvas-art"><canvas ref={right} aria-label="Vista previa del resultado"/></div>
          </div>
        </figure>
      </div>
      <p id="range-canvas-help" className="range-canvas-help">Con teclado, mueve el cursor con las flechas y pulsa Intro para {tool==='sample'?'tomar el color':tool==='paint'?'pintar':'excluir'}.</p>
      <div className="range-feedback">
        <p>{screening
          ?stats.selected?`${stats.selected.toLocaleString('es-CL')} de ${stats.visible.toLocaleString('es-CL')} píxeles visibles seleccionados.`:'Selecciona zonas con el gotero o el pincel.'
          :`${stats.removed.toLocaleString('es-CL')} píxeles de fondo eliminados en esta vista.`}
          {view==='result'&&screening&&stats.selected>0&&stats.holes===0&&purpose==='affected'&&' La selección no genera huecos con los ajustes actuales.'}
        </p>
        <span role="status">{message}</span>
      </div>
    </EditorDialog>
  )
}
