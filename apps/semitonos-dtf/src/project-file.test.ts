import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseProject,type ProjectFile} from './project-file.ts'
import {restoreEditorAdjustments,type EditorDocument} from './editor-document.ts'
import {garmentPresets} from './garment-presets.ts'

const fixture=():ProjectFile=>({format:'trama-dtf',version:1,name:'Mi trabajo',sheet:{width:58,height:100,dpi:600,gap:5,rotate:true},background:'black',items:[{id:'a',name:'Diseño',dataUrl:'data:image/png;base64,AAAA',naturalWidth:100,naturalHeight:200,widthCm:2.54,heightCm:5.08,quantity:2}]})
test('project round trip preserves images, dimensions, DPI and copies',()=>{
  const p=fixture();assert.deepEqual(parseProject(JSON.stringify(p)),p)
})
test('project restores optimized packing while accepting files saved without the setting', () => {
  const legacy = fixture()
  assert.equal(parseProject(JSON.stringify(legacy)).sheet.optimized, undefined)
  const optimized = {...legacy, sheet:{...legacy.sheet, optimized:true}}
  assert.deepEqual(parseProject(JSON.stringify(optimized)), optimized)
  assert.throws(() => parseProject(JSON.stringify({...legacy, sheet:{...legacy.sheet, optimized:'true'}})))
})
test('project restores a 60 px contour with exterior brush strokes', () => {
  const p=fixture()
  const contourBand={side:'outside' as const,widthPx:60,softness:75,flow:90,strokes:[{from:{x:-.03,y:.5},to:{x:.02,y:.5},radius:.03,mode:'exclude' as const}]}
  const settings={...garmentPresets.default.values,edgeSides:[true,true,true,true],featherMm:0,trimMm:0,cornerRadiusMm:0,edgeMask:'none' as const,edgeMaskSizeMm:5,contourBand}
  p.items[0].document={version:1,original:p.items[0].dataUrl,settings,crop:null,widthCm:10,dpi:300}
  assert.deepEqual(parseProject(JSON.stringify(p)).items[0].document?.settings.contourBand,contourBand)
  p.items[0].document.settings.contourBand={...contourBand,widthPx:61}
  assert.throws(()=>parseProject(JSON.stringify(p)))
})
test('project accepts every garment preview color',()=>{
  for(const background of ['#596778','#8ecae6','#2563eb','#304b70','#102a43','#86efac','#16a34a','#166534','#808000','#4b5320','#c4b5fd','#7c3aed','#4c1d95','#fda4af','#c1121f','#7b2931','#fde68a','#f59e0b','#ea580c','#e7d3b0','#a16207','#3b2418']) {
    const p=fixture();p.background=background
    assert.deepEqual(parseProject(JSON.stringify(p)),p)
  }
})
test('project preserves individual preview colors and permits designs that inherit the general color',()=>{
  const p=fixture()
  p.items.push({...p.items[0],id:'red',previewColor:'#c1121f'},{...p.items[0],id:'transparent',previewColor:'checker'})
  const restored=parseProject(JSON.stringify(p))
  assert.deepEqual(restored,p)
  assert.equal(restored.items[0].previewColor,undefined)
  assert.throws(()=>parseProject(JSON.stringify({...p,items:[{...p.items[0],previewColor:'invalid'}]})))
})
test('project restores whether individual colors are visible',()=>{
  const p=fixture()
  p.items[0].previewColor='#c1121f'
  assert.equal(parseProject(JSON.stringify(p)).showIndividualColors,undefined)
  for(const enabled of [true,false]){
    const saved={...p,showIndividualColors:enabled}
    assert.deepEqual(parseProject(JSON.stringify(saved)),saved)
  }
  assert.throws(()=>parseProject(JSON.stringify({...p,showIndividualColors:'false'})))
})
test('project rejects unknown versions, external image URLs and duplicate IDs',()=>{
  const p=fixture();assert.throws(()=>parseProject(JSON.stringify({...p,version:2})))
  p.items[0].dataUrl='https://example.com/image.png';assert.throws(()=>parseProject(JSON.stringify(p)))
  const q=fixture();q.items.push({...q.items[0]});assert.throws(()=>parseProject(JSON.stringify(q)))
})
test('project rejects invalid geometry, resolution and missing editor settings',()=>{
  const p=fixture();p.sheet.dpi=96;assert.throws(()=>parseProject(JSON.stringify(p)))
  const q=fixture();q.items[0].quantity=-1;assert.throws(()=>parseProject(JSON.stringify(q)))
  assert.throws(()=>parseProject(JSON.stringify({...fixture(),editor:{name:'x',document:{version:1,original:'data:image/png;base64,AAAA',widthCm:25,dpi:300}}})))
})

test('reopening designs restores their own adjustments, preset and editor preview from the project', () => {
  const p = fixture()
  const asset = p.items[0]
  const defaults = {
    ...garmentPresets.default.values, edgeSides: [true,true,true,true],
    edgeMask: 'none' as const, edgeMaskSizeMm: 5, trimMm: 0, featherMm: 0, cornerRadiusMm: 0,
  }
  const dark: EditorDocument = {
    version: 1, original: asset.dataUrl, settings: {...defaults, ...garmentPresets.darkFine.values},
    widthCm: 5.08, dpi: 150, crop: null, garment: 'dark', presetId: 'darkFine', previewColor: '#102a43',
  }
  const light: EditorDocument = {
    ...dark, dpi: 600, crop: {x:1,y:2,width:50,height:80}, garment: 'light',
    presetId: 'saved:light', previewColor: 'white',
    settings: {
      ...defaults, ...garmentPresets.lightBold.values, angle: 30, edgeSides: [true,false,true,false],
      background: 'custom', colorRange: {colors:['#ffffff'],tolerance:15,softness:20},
    },
  }
  p.items[0].document = dark
  p.items.push({...asset, id:'b', document:light})
  const [a, b] = parseProject(JSON.stringify(p)).items
  assert.deepEqual(a.document, JSON.parse(JSON.stringify(dark)))
  assert.deepEqual(b.document, JSON.parse(JSON.stringify(light)))

  const savedPresets = [{id:'saved:light', settings:{lpi:65}}]
  const editedLight = restoreEditorAdjustments(b.document!, defaults, savedPresets)
  assert.equal(editedLight.preset, 'saved:light')
  assert.equal(editedLight.garment, 'light')
  assert.equal(editedLight.settings.lpi, 24)
  assert.equal(editedLight.settings.angle, 30)
  assert.equal(editedLight.previewColor, 'white')
  editedLight.settings.edgeSides[1] = true
  assert.equal(b.document!.settings.edgeSides[1], false)
  const editedDark = restoreEditorAdjustments(a.document!, defaults, savedPresets)
  assert.equal(editedDark.preset, 'darkFine')
  assert.equal(editedDark.garment, 'dark')
  assert.equal(editedDark.settings.lpi, 45)
  assert.equal(editedDark.settings.colorRange, undefined)
  assert.equal(editedDark.previewColor, '#102a43')

  const missingPreset = restoreEditorAdjustments(b.document!, defaults, [])
  assert.equal(missingPreset.preset, 'custom')
  assert.deepEqual(JSON.parse(JSON.stringify(missingPreset.settings)), b.document!.settings)
  const legacy = {...dark, presetId:undefined, previewColor:undefined, garment:undefined, settings:{...defaults,background:'white' as const}}
  const restoredLegacy = restoreEditorAdjustments(legacy, defaults, [])
  assert.equal(restoredLegacy.garment, 'light')
  assert.equal(restoredLegacy.previewColor, 'white')
  assert.equal(restoredLegacy.preset, 'custom')
})
