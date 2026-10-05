// Earth's Radius in Kilometers
const EARTH_RADIUS_KM = 6371;

// Haversine Formula: Calculates real physical distance between two GPS coordinates
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const p1 = Number(lat1);
  const l1 = Number(lon1);
  const p2 = Number(lat2);
  const l2 = Number(lon2);

  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) {
    return null;
  }

  const dLat = ((p2 - p1) * Math.PI) / 180;
  const dLon = ((l2 - l1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1 * Math.PI) / 180) *
      Math.cos((p2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10; // Round to 1 decimal place (e.g. 4.2 KM)
};

// Check deliverability strictly using User Coordinates & User Selected Radius
export const isDeliverable = (customerCoords, itemCoords, maxRadiusKm = 10) => {
  // If coordinates are missing or default location not yet selected, allow viewing
  if (!customerCoords || !customerCoords.lat || !customerCoords.lng) {
    return true;
  }
  if (!itemCoords || !itemCoords.lat || !itemCoords.lng) {
    return true;
  }

  const actualDistance = calculateDistanceKm(
    customerCoords.lat,
    customerCoords.lng,
    itemCoords.lat,
    itemCoords.lng
  );

  if (actualDistance === null) return true;

  // Purely dynamic: if distance <= user selected radius, it is deliverable
  return actualDistance <= Number(maxRadiusKm);
};
