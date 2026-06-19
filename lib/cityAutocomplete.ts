export const searchCities = async (query: string): Promise<{ name: string; lat: number; lng: number }[]> => {
  if (query.length < 2) return []

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&featuretype=city&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'HiddenGemsApp/1.0' } },
    )
    const data = await response.json()

    return data
      .filter(
        (item: { type?: string; class?: string }) =>
          item.type === 'city' ||
          item.type === 'town' ||
          item.type === 'village' ||
          item.class === 'place',
      )
      .map((item: { display_name: string; lat: string; lon: string }) => ({
        name: item.display_name.split(',').slice(0, 2).join(',').trim(),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }))
  } catch (error) {
    console.log('City search error:', error)
    return []
  }
}
