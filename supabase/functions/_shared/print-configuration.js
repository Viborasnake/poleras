const PLACEMENTS = new Set(['center', 'upper_back', 'chest_left', 'chest_right', 'sleeve_left', 'sleeve_right', 'sleeve_both'])
const SIZES = new Set(['pocket', 'small', 'medium', 'large'])
export const PRINT_MAX_LAYERS = 4

export const PRINT_SIZE_SCALE = Object.freeze({ pocket: .55, small: .85, medium: 1.2, large: 1.6 })
export const PRINT_PLACEMENT_LABEL = Object.freeze({
  center: 'Centro',
  upper_back: 'Espalda alta',
  chest_left: 'Pecho izquierdo',
  chest_right: 'Pecho derecho',
  sleeve_left: 'Manga izquierda',
  sleeve_right: 'Manga derecha',
  sleeve_both: 'Ambos brazos',
})
export const PRINT_SIZE_LABEL = Object.freeze({ pocket: 'Bolsillo', small: 'Pequeño', medium: 'Mediano', large: 'Grande' })

export function defaultPrintSideConfiguration(side = 'front') {
  return { placement: 'center', size: 'large', scale: PRINT_SIZE_SCALE.large, offsetX: 0, offsetY: 0 }
}

function boundedOffset(value) {
  const number = Math.round(Number(value) || 0)
  return Math.max(-2, Math.min(2, number))
}

export function normalizePrintSideConfiguration(value, side = 'front') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  let placement = PLACEMENTS.has(source.placement) ? source.placement : 'center'
  if (side === 'back' && !['center', 'upper_back'].includes(placement)) placement = 'center'
  const size = SIZES.has(source.size) ? source.size : 'large'
  const requestedScale = Number(source.scale)
  const scale = Number.isFinite(requestedScale) ? Math.max(.55, Math.min(1.7, requestedScale)) : PRINT_SIZE_SCALE[size]
  return { placement, size, scale: Math.round(scale * 100) / 100, offsetX: boundedOffset(source.offsetX), offsetY: boundedOffset(source.offsetY) }
}

export function normalizePrintConfiguration(value, printSides = 'front') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const sides = printSides === 'both' ? ['front', 'back'] : [printSides === 'back' ? 'back' : 'front']
  const legacy = Object.fromEntries(sides.map(side => [side, normalizePrintSideConfiguration(source[side], side)]))
  if (!Array.isArray(source.prints)) return legacy
  const prints = source.prints.slice(0, PRINT_MAX_LAYERS).map((entry, index) => {
    const item = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {}
    const side = item.side === 'back' ? 'back' : 'front'
    const id = /^[a-z0-9-]{1,64}$/i.test(String(item.id || '')) ? String(item.id) : `print-${index + 1}`
    const fileName = String(item.fileName || '').trim().slice(0, 120)
    const designPath = String(item.designPath || '').trim().slice(0, 240)
    return { id, side, ...normalizePrintSideConfiguration(item, side), ...(fileName ? { fileName } : {}), ...(designPath ? { designPath } : {}) }
  })
  if (!prints.length) return legacy
  const firstFront = prints.find(item => item.side === 'front')
  const firstBack = prints.find(item => item.side === 'back')
  const compatibility = {
    ...(firstFront ? { front: normalizePrintSideConfiguration(firstFront, 'front') } : {}),
    ...(firstBack ? { back: normalizePrintSideConfiguration(firstBack, 'back') } : {}),
  }
  return { ...compatibility, prints }
}

export function printSideConfigurationLabel(value, side = 'front') {
  const normalized = normalizePrintSideConfiguration(value, side)
  const moved = normalized.offsetX || normalized.offsetY ? ' · posición ajustada' : ''
  return `${PRINT_PLACEMENT_LABEL[normalized.placement]} · ${PRINT_SIZE_LABEL[normalized.size]}${moved}`
}

export function printConfigurationLabel(value, printSides = 'front') {
  const normalized = normalizePrintConfiguration(value, printSides)
  if (normalized.prints?.length) return normalized.prints.map((item, index) => `${index + 1}. ${item.side === 'back' ? 'Espalda' : 'Frente'}: ${printSideConfigurationLabel(item, item.side)}`).join(' · ')
  return Object.entries(normalized).map(([side, config]) => `${side === 'back' ? 'Espalda' : 'Frente'}: ${printSideConfigurationLabel(config, side)}`).join(' · ')
}

export function printConfigurationCount(value, printSides = 'front') {
  const normalized = normalizePrintConfiguration(value, printSides)
  return normalized.prints?.length || (printSides === 'both' ? 2 : 1)
}
