export function getCoordsFromLocation(locationString = '', customPin = '') {
  const str = `${locationString} ${customPin}`.toLowerCase();
  const match = str.match(/\b\d{6}\b/);
  const pin = match ? match[0] : '';

  const prefix2 = pin ? parseInt(pin.substring(0, 2), 10) : 0;
  const pinVal = pin ? parseInt(pin, 10) : 0;
  const offset = (pinVal % 100) * 0.008;

  // Bangalore (56)
  if (prefix2 === 56 || str.includes('bangalore') || str.includes('bengaluru')) {
    return { lat: 12.9716 + offset, lng: 77.5946 + offset };
  }
  // Hyderabad (50)
  if (prefix2 === 50 || str.includes('hyderabad') || str.includes('hyd')) {
    return { lat: 17.3850 + offset, lng: 78.4867 + offset };
  }
  // Visakhapatnam (53)
  if (prefix2 === 53 || str.includes('vizag') || str.includes('visakhapatnam')) {
    return { lat: 17.6868 + offset, lng: 83.2185 + offset };
  }
  // Vijayawada (52)
  if (prefix2 === 52 || str.includes('vijayawada')) {
    return { lat: 16.5062 + offset, lng: 80.6480 + offset };
  }
  // Chennai (60)
  if (prefix2 === 60 || str.includes('chennai')) {
    return { lat: 13.0827 + offset, lng: 80.2707 + offset };
  }
  // Mumbai (40)
  if (prefix2 === 40 || str.includes('mumbai')) {
    return { lat: 19.0760 + offset, lng: 72.8777 + offset };
  }
  // Delhi (11)
  if (prefix2 === 11 || str.includes('delhi')) {
    return { lat: 28.6139 + offset, lng: 77.2090 + offset };
  }

  return { lat: 16.5062, lng: 80.6480 };
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0;
  const R = 6371; // Radius of earth in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}
