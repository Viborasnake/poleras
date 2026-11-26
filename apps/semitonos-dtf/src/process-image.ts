import {halftone} from './halftone.ts'
import {autoAdjust} from './auto-adjust.ts'
import {removeBackground} from './background-stage.ts'
import {applyColorCorrection,flattenSelectedColor,smoothRgba,removeTinyDots,removeSmallParticles,restoreProtectedPixels,shrinkAlphaMask} from './refine.ts'
import {applyEdgeMask} from './edge-mask.ts'
import {applyContourBand, padRgba} from './contour-band.ts'
import type {Settings} from './App'

/** Shared by export worker and interactive preview: one rendering pipeline. */
export function processImage(resized:Uint8ClampedArray,width:number,height:number,settings:Settings&{dpi?:number},correction?:Uint8Array,includeBackground=false,padding=0){
  const corrected=correction?applyColorCorrection(resized,correction,settings.flattenColorValue,100):resized
  const flattened=settings.flattenColor?flattenSelectedColor(corrected,settings.flattenColorValue,settings.flattenColorTolerance):corrected
  const softened=smoothRgba(flattened,width,height,settings.preSmooth??0)
  const adjusted=autoAdjust(softened,settings)
  const contour = settings.enabled ? settings.contourBand : undefined
  const result=halftone(adjusted,width,height,contour ? {...settings,enabled:false,separateBackground:true,solidAlpha:true,preserveColor:true} : settings,softened,flattened)
  const solidAlpha=settings.enabled!==false||settings.solidAlpha
  const maskEdges = () => applyEdgeMask(result.data,width,height,{style:settings.edgeMask??'none',sizeMm:settings.edgeMaskSizeMm??5,dpi:settings.dpi??300,sides:settings.edgeSides,solidAlpha})
  if (contour) maskEdges()
  const data = contour ? applyContourBand(result.data,width,height,contour,settings,padding) : result.data
  const resultWidth = width + padding * 2, resultHeight = height + padding * 2
  for(let p=0;p<result.protectedMask.length;p++)if(result.protectedMask[p])data.fill(0,p*4,p*4+4)
  removeTinyDots(data,resultWidth,resultHeight,settings.minDotSize??0)
  removeSmallParticles(data,resultWidth,resultHeight,settings.particleMinSize??0)
  if (!contour) {
    restoreProtectedPixels(data,flattened,resized,result.protectedMask,solidAlpha,settings.protectSmoothEdge!==false)
    maskEdges()
  }
  if (settings.enabled === false) shrinkAlphaMask(result.data,width,height,settings.contourShrinkPx??0)
  let transparent=0
  for(let i=3;i<data.length;i+=4)if(!data[i])transparent++
  return {...result,data,transparent:Math.round(transparent/(resultWidth*resultHeight)*100),background:includeBackground?new Uint8ClampedArray(padRgba(removeBackground(adjusted,width,height,settings,softened),width,height,padding)):undefined}
}
