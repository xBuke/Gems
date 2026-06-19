export const searchCities = async (query: string): Promise<{ name: string; lat: number; lng: number }[]> => {
  if (query.length < 2) return []

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`,
      { headers: { 'User-Agent': 'HiddenGemsApp/1.0' } },
    )
    const data = await response.json()

    return data
      .filter((item: any) => {
        const validClasses = ['place', 'boundary']
        const validTypes = ['city', 'town', 'village', 'administrative', 'municipality', 'suburb']
        return validClasses.includes(item.class) && validTypes.includes(item.type)
      })
      .map((item: any) => {
        const address = item.address || {}
        const cityName = address.city || address.town || address.village || address.municipality || item.name
        const country = address.country || ''
        const displayName = country ? `${cityName}, ${country}` : cityName
        return {
          name: displayName,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }
      })
      .filter((item: any) => item.name && item.name !== ', ')
  } catch (error) {
    console.log('City search error:', error)
    return []
  }
}
