export const DEFAULT_PRINT_PRICES = Object.freeze({
  front_large_clp: 5990,
  front_pocket_clp: 2990,
  back_large_clp: 5990,
  arm_clp: 2990,
})

export function normalizePrintPrices(value = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_PRINT_PRICES).map(([key, fallback]) => {
    const amount = Number(value?.[key])
    return [key, Number.isSafeInteger(amount) && amount >= 0 && amount <= 1000000 ? amount : fallback]
  }))
}

export function printPrice(configuration, printSides = 'front', prices = DEFAULT_PRINT_PRICES) {
  const rates = normalizePrintPrices(prices)
  const prints = Array.isArray(configuration?.prints) ? configuration.prints :
    (printSides === 'both' ? ['front', 'back'] : [printSides === 'back' ? 'back' : 'front']).map(side => ({ side, ...configuration?.[side] }))
  return prints.reduce((total, print) => {
    const key = /sleeve_/.test(print.placement || '') ? 'arm_clp' :
      print.side === 'back' ? 'back_large_clp' :
      print.size === 'pocket' || /chest_/.test(print.placement || '') ? 'front_pocket_clp' : 'front_large_clp'
    return total + rates[key] * (print.placement === 'sleeve_both' ? 2 : 1)
  }, 0)
}
