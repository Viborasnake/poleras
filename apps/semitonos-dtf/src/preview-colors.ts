export const previewColorGroups = [
  { label: 'Neutros', colors: [
    ['white', 'Blanco · claro'],
    ['#596778', 'Gris · normal'],
    ['black', 'Negro · oscuro'],
  ] },
  { label: 'Azules', colors: [
    ['#8ecae6', 'Celeste · claro'],
    ['#2563eb', 'Azul rey · normal'],
    ['#304b70', 'Azul marino · oscuro'],
    ['#102a43', 'Azul oscuro · oscuro'],
  ] },
  { label: 'Verdes', colors: [
    ['#86efac', 'Verde menta · claro'],
    ['#16a34a', 'Verde · normal'],
    ['#166534', 'Verde botella · oscuro'],
    ['#808000', 'Verde olivo · normal'],
    ['#4b5320', 'Verde militar · oscuro'],
  ] },
  { label: 'Morados', colors: [
    ['#c4b5fd', 'Lavanda · claro'],
    ['#7c3aed', 'Morado · normal'],
    ['#4c1d95', 'Morado oscuro · oscuro'],
  ] },
  { label: 'Rojos', colors: [
    ['#fda4af', 'Rosado · claro'],
    ['#c1121f', 'Rojo fuerte · normal'],
    ['#7b2931', 'Rojo oscuro · oscuro'],
  ] },
  { label: 'Amarillos y naranjas', colors: [
    ['#fde68a', 'Amarillo · claro'],
    ['#f59e0b', 'Mostaza · normal'],
    ['#ea580c', 'Naranjo · oscuro'],
  ] },
  { label: 'Cafés', colors: [
    ['#e7d3b0', 'Beige · claro'],
    ['#a16207', 'Café · normal'],
    ['#3b2418', 'Café oscuro · oscuro'],
  ] },
] as const

export type PreviewColor = 'checker' | typeof previewColorGroups[number]['colors'][number][0]

const colorLabels = new Map<string, string>([
  ['checker', 'Transparencia'],
  ...previewColorGroups.flatMap(group => [...group.colors]),
])

export function isPreviewColor(value: unknown): value is PreviewColor {
  return typeof value === 'string' && colorLabels.has(value)
}

export function previewColorName(value: string) {
  return colorLabels.get(value)?.split(' · ')[0] ?? value
}
