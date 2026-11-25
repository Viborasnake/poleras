import { designProductArtworks, modelProductSlug } from './catalog-product-artworks.js'
import { normalizePrintConfiguration, PRINT_SIZE_SCALE } from './print-configuration.js'

export const POLERA_PRINT_LOCATIONS = Object.freeze({
  front: { label: 'Frente completo', side: 'front', placement: 'center', size: 'large' },
  back: { label: 'Espalda completa', side: 'back', placement: 'center', size: 'large' },
  'pocket-left': { label: 'Bolsillo izquierdo', side: 'front', placement: 'chest_left', size: 'pocket' },
  'pocket-right': { label: 'Bolsillo derecho', side: 'front', placement: 'chest_right', size: 'pocket' },
  'arm-left': { label: 'Brazo izquierdo', side: 'front', placement: 'sleeve_left', size: 'pocket' },
  'arm-right': { label: 'Brazo derecho', side: 'front', placement: 'sleeve_right', size: 'pocket' },
  arms: { label: 'Ambos brazos', side: 'front', placement: 'sleeve_both', size: 'pocket' },
})

export function poleraPrintsOverlap(first, second) {
  const arms = ['arm-left', 'arm-right', 'arms']
  return first === second || (first === 'arms' || second === 'arms') && arms.includes(first) && arms.includes(second)
}

export function normalizePoleraPrints(value) {
  const primary = Object.hasOwn(POLERA_PRINT_LOCATIONS, value?.primary) ? value.primary : 'front'
  const additional = {}
  for (const location of Object.keys(POLERA_PRINT_LOCATIONS)) {
    const path = value?.additional?.[location]
    if (typeof path !== 'string' || !path.trim() || poleraPrintsOverlap(primary, location)) continue
    if (Object.keys(additional).some(selected => poleraPrintsOverlap(selected, location))) continue
    additional[location] = path.trim()
  }
  const mockups = {}
  for (const location of [primary, ...Object.keys(additional)]) {
    const path = value?.mockups?.[location]
    if (typeof path === 'string' && path.trim()) mockups[location] = path.trim()
  }
  return { primary, additional, mockups }
}

export function catalogPoleraComposition(design, modelCode) {
  if (!design || modelProductSlug(modelCode) !== 'poleras') return null
  const primaryPath = designProductArtworks(design).poleras
  if (!primaryPath) return null
  const { primary, additional } = normalizePoleraPrints(design.poleraPrints ?? design.polera_prints)
  const files = [[primary, primaryPath], ...Object.entries(additional)]
  const layout = files.map(([location, path], index) => {
    const { side, placement, size } = POLERA_PRINT_LOCATIONS[location]
    return {
      id: index === 0 ? `primary-${side}` : `catalog-${location}`,
      side, placement, size, scale: size === 'large' ? 1.7 : PRINT_SIZE_SCALE.pocket,
      catalogArtworkPath: path,
    }
  })
  const printSides = layout.some(print => print.side === 'back') ?
    (layout.some(print => print.side === 'front') ? 'both' : 'back') : 'front'
  const normalized = normalizePrintConfiguration({ prints: layout }, printSides)
  return {
    printSides,
    configuration: {
      ...normalized,
      prints: normalized.prints.map((print, index) => ({ ...print, catalogArtworkPath: layout[index].catalogArtworkPath })),
    },
  }
}

// The base price includes one print. A two-sleeve primary artwork still needs a second application.
export function catalogChargeablePrints(configuration) {
  const [primary, ...prints] = configuration.prints
  if (primary.placement === 'sleeve_both') prints.unshift({ ...primary, placement: 'sleeve_left' })
  return { prints }
}

export function catalogOrderConfiguration(composition, customerImage) {
  if (!customerImage) return composition.configuration
  return {
    ...composition.configuration,
    prints: composition.configuration.prints.map((print, index) => {
      if (index > 0) return print
      const { catalogArtworkPath, ...placement } = print
      return placement
    }),
  }
}
