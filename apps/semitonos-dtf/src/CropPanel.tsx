import {useEffect,useRef,useState} from 'react'
import EditorDialog from './EditorDialog'
export type CropRect={x:number;y:number;width:number;height:number}
export default function CropPanel({image,initial,onApply,onCancel}:{image:HTMLImageElement;initial:CropRect;onApply:(r:CropRect)=>void;onCancel:()=>void}) {
 const [rect,setRect]=useState(initial), canvas=useRef<HTMLCanvasElement>(null)
 const scale=Math.min(600/image.naturalWidth,340/image.naturalHeight,1)
 const valid=Object.values(rect).every(Number.isInteger)&&rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0&&rect.x+rect.width<=image.naturalWidth&&rect.y+rect.height<=image.naturalHeight
 useEffect(()=>{const c=canvas.current!;c.width=Math.round(image.naturalWidth*scale);c.height=Math.round(image.naturalHeight*scale);const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0,c.width,c.height);ctx.fillStyle='#0009';ctx.beginPath();ctx.rect(0,0,c.width,c.height);ctx.rect(rect.x*scale,rect.y*scale,rect.width*scale,rect.height*scale);ctx.fill('evenodd');ctx.strokeStyle=getComputedStyle(c).getPropertyValue('--ds-lime').trim();ctx.lineWidth=2;ctx.strokeRect(rect.x*scale,rect.y*scale,rect.width*scale,rect.height*scale)},[image,rect,scale])
 return (
  <EditorDialog
    id="crop" className="crop-modal" title="Recortar imagen"
    description="Ajusta la posición y el tamaño del recorte en píxeles originales."
    onCancel={onCancel}
    actions={<>
      <button className="btn crop-reset" onClick={()=>setRect({x:0,y:0,width:image.naturalWidth,height:image.naturalHeight})}>Imagen completa</button>
      <button className="btn" onClick={onCancel}>Cancelar</button>
      <button className="btn export" disabled={!valid} onClick={()=>onApply(rect)}>Aplicar recorte</button>
    </>}
  >
    <div className="crop-fields">
      {(['x','y','width','height'] as const).map((key,i)=>
        <label className="field" key={key}>{['Desde izquierda','Desde arriba','Ancho','Alto'][i]} (px)
          <input type="number" min={i<2?0:1} step="1" value={rect[key]} onChange={e=>setRect(r=>({...r,[key]:Number(e.target.value)}))}/>
        </label>
      )}
    </div>
    {!valid&&<p role="alert" className="error-text">Usa píxeles enteros y un rectángulo dentro de la imagen.</p>}
    <canvas className="crop-preview" ref={canvas} aria-label="Vista previa del recorte" />
  </EditorDialog>
 )
}
