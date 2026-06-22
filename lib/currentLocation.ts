import * as Location from 'expo-location'

export type CurrentCoordinates = {
  latitude: number
  longitude: number
}

export async function getCurrentCoordinates(): Promise<CurrentCoordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null

    const location = await Location.getCurrentPositionAsync({})
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }
  } catch {
    return null
  }
}
