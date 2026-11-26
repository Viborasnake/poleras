type PrintWidthOption = {
  id: string
  label: string
  width: number
  height?: number
}

const maxShirtPresetWidthCm = 29
const unisexLWidthCm = 54
const kidsFirstWidthCm = 32
const oversizeLWidthCm = 60

const shirtGroups = ([
  {
    id: 'unisex',
    label: 'Unisex · Roly Dogo Premium',
    referenceWidth: unisexLWidthCm,
    referencePrintWidth: maxShirtPresetWidthCm,
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
    referencePrintWidth: maxShirtPresetWidthCm,
    sizes: [['S', 54], ['M', 57], ['L', oversizeLWidthCm], ['XL', 63], ['2XL', 66]],
  },
] as const).map(({id, label, referenceWidth, referencePrintWidth, sizes}) => ({
  label,
  options: sizes.map(([size, garmentWidth]) => {
    const width = Math.min(maxShirtPresetWidthCm, Math.round(referencePrintWidth * garmentWidth / referenceWidth))
    return {id: `${id}-${size}`, label: `${size} · ${width} cm`, width}
  }),
}))

export const printWidthGroups: {label: string; options: PrintWidthOption[]}[] = [
  ...shirtGroups,
  {
    label: 'Tote bags',
    options: [[30, 30], [35, 40], [45, 50]].map(([width, height]) => ({
      id: `tote-${width}x${height}`,
      label: `${width} × ${height} cm`,
      width,
      height,
    })),
  },
]

export function presetPrintWidth({width, height}: PrintWidthOption, ratio: number) {
  return height === undefined ? width : Math.min(width, height * ratio)
}
