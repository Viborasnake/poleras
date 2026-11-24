const maxPresetWidthCm = 29
const unisexLWidthCm = 54
const kidsFirstWidthCm = 32
const oversizeLWidthCm = 60

export const printWidthGroups = ([
  {
    id: 'unisex',
    label: 'Unisex · Roly Dogo Premium',
    referenceWidth: unisexLWidthCm,
    referencePrintWidth: maxPresetWidthCm,
    sizes: [['S', 48], ['M', 50], ['L', unisexLWidthCm], ['XL', 58], ['2XL', 62]],
  },
  {
    id: 'kids',
    label: 'Niños · Roly Dogo Premium',
    referenceWidth: kidsFirstWidthCm,
    referencePrintWidth: 21,
    sizes: [['3/4 años', kidsFirstWidthCm], ['5/6 años', 35], ['7/8 años', 39], ['9/10 años', 43], ['11/12 años', 46]],
  },
  {
    id: 'oversize',
    label: 'Oversize · Roly Bull',
    referenceWidth: oversizeLWidthCm,
    referencePrintWidth: maxPresetWidthCm,
    sizes: [['S', 54], ['M', 57], ['L', oversizeLWidthCm], ['XL', 63], ['2XL', 66]],
  },
] as const).map(({id,label,referenceWidth,referencePrintWidth,sizes}) => ({
  label,
  options: sizes.map(([size,garmentWidth])=>({
    id: `${id}-${size}`,
    size,
    width: Math.min(maxPresetWidthCm, Math.round(referencePrintWidth * garmentWidth / referenceWidth)),
  })),
}))
