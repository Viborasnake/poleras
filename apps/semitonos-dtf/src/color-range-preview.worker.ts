import type {Settings} from './App'
import type {CropRect} from './crop.ts'
import {removeBackground} from './background-stage.ts'
import {colorRangeRetention, selectionBrushMask, selectionCoverage, type ColorRange} from './color-range.ts'
import {processImage} from './process-image.ts'

export type PreviewRequest = {
  original: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; range: ColorRange
  settings?: Settings & {dpi: number}; purpose: 'background' | 'isolated' | 'affected' | 'protected'
  view: 'result' | 'mask' | 'background'
  artwork?: CropRect
}

self.onmessage = ({data}: MessageEvent<PreviewRequest>) => {
  try {
    const {original,width,height,settings,range,purpose,view} = data
    const screening = purpose === 'affected' || purpose === 'protected'
    const clean = settings ? removeBackground(original,width,height,settings) : original
    const result = view === 'result' && settings ? processImage(original,width,height,settings,undefined,false,0,data.artwork).data : clean
    const retain = colorRangeRetention(range)
    const brush = selectionBrushMask(range,width,height)
    const mask = view === 'mask' ? new Uint8ClampedArray(original.length) : undefined
    const overlay = screening ? new Uint8ClampedArray(original.length) : undefined
    let selected=0,visible=0,removed=0,holes=0
    for (let p=0;p<width*height;p++) {
      const i=p*4
      const selection=selectionCoverage(range,retain(original[i],original[i+1],original[i+2]),brush?.[p])
      if(original[i+3]&&!clean[i+3])removed++
      if(clean[i+3]){visible++;if(!result[i+3])holes++}
      const available=(screening?clean[i+3]:original[i+3])/255
      selected+=selection*available
      if (mask) {
        mask[i]=mask[i+1]=mask[i+2]=selection*available*255
        mask[i+3]=255
      }
      if(overlay&&selection&&available){
        overlay[i]=purpose==='protected'?255:20
        overlay[i+1]=purpose==='protected'?190:220
        overlay[i+2]=purpose==='protected'?40:180
        overlay[i+3]=selection*available*100
      }
    }
    const preview = mask ?? result
    self.postMessage({clean,overlay,preview,selected:Math.round(selected),visible,removed,holes}, {
      transfer:[...new Set([clean.buffer,preview.buffer,...(overlay?[overlay.buffer]:[])])],
    })
  } catch (error) {
    self.postMessage({error:error instanceof Error?error.message:'No se pudo actualizar la vista previa.'})
  }
}
