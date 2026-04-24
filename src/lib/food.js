// MET metabolic equivalent values (kcal/kg/hour)
const MET = {
  'Running': 9.8, 'Cycling': 7.5, 'Rowing': 7.0, 'Jump Rope': 12.3,
  'Stairmaster': 9.0, 'Swimming': 8.0, 'Elliptical': 5.0, 'HIIT': 8.0,
}

// weightKg defaults to 70 if not provided
export const estimateCalories = (type, durationMin, weightKg = 70) => {
  const met = MET[type] ?? 6
  return Math.round(met * weightKg * (durationMin / 60))
}

let _timer = null
export const searchFood = (query) => new Promise(resolve => {
  clearTimeout(_timer)
  const q = query?.trim()
  if (!q || q.length < 2) { resolve([]); return }
  _timer = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=10&search_simple=1&action=process`
      )
      const { products = [] } = await res.json()
      resolve(
        products
          .filter(p => (p.product_name_en || p.product_name) && p.nutriments?.['energy-kcal_100g'])
          .map(p => ({
            name: (p.product_name_en || p.product_name).trim(),
            brand: p.brands?.split(',')[0]?.trim() || '',
            cal100: Math.round(p.nutriments['energy-kcal_100g']),
            prot100: +((p.nutriments.proteins_100g ?? 0).toFixed(1)),
            carb100: +((p.nutriments.carbohydrates_100g ?? 0).toFixed(1)),
            fat100: +((p.nutriments.fat_100g ?? 0).toFixed(1)),
          }))
          .filter(p => p.cal100 > 0 && p.name.length > 0)
          .slice(0, 8)
      )
    } catch { resolve([]) }
  }, 500)
})
