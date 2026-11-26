import type {Settings} from './App'
import type {CropRect} from './crop'
import type {PreviewColor} from './preview-colors'
import {presetsFor, type GarmentTone} from './garment-presets.ts'

export type EditorDocument = {
  version: 1
  original: string
  settings: Settings
  crop: CropRect | null
  widthCm: number
  dpi: number
  garment?: GarmentTone
  presetId?: string
  previewColor?: PreviewColor
}
export type GangSource={id:number;blob:Blob;widthCm:number;name:string;document:EditorDocument;replaceId?:string}

export function restoreEditorAdjustments(document:EditorDocument, defaults:Settings, savedPresets:readonly {id:string}[]) {
  const settings = {...defaults, ...structuredClone(document.settings)}
  const garment = document.garment ??
    (settings.background === 'white' || settings.customBase === 'white' || settings.screenBase === 'white' ? 'light' : 'dark')
  const mode = settings.enabled ? 'halftone' : 'continuous'
  const presetId = document.presetId
  const preset = presetId && (presetsFor(garment, mode).some(([id]) => id === presetId) || savedPresets.some(p => p.id === presetId))
    ? presetId : 'custom'
  const previewColor = document.previewColor ?? (garment === 'light' ? 'white' : 'black')
  return {settings, garment, preset, previewColor}
}

export function updateGangAsset<T extends {id:string;quantity:number;previewColor?:PreviewColor}>(items:T[],next:T,replaceId?:string):T[] {
  const old=items.find(item=>item.id===replaceId)
  return old?items.map(item=>item.id===old.id?{...next,id:old.id,quantity:old.quantity,previewColor:old.previewColor}:item):[...items,next]
}
