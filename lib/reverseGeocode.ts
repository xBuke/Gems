const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

export const resolveCityName = async (
  latitude: number,
  longitude: number,
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${NOMINATIM_REVERSE}?lat=${latitude}&lon=${longitude}&format=json`,
      { headers: { 'User-Agent': 'AbditaGemsApp/1.0' } },
    );
    const data = await response.json();
    const name =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      null;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
};
