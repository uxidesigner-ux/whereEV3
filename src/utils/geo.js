/**
 * 위경도 거리 계산 (Haversine)
 * @returns 거리(km)
 */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 거리를 "약 1.2km" 형태 문자열로
 */
export function formatDistanceKm(km) {
  if (km == null || Number.isNaN(km)) return null
  if (km < 1) return `약 ${(km * 1000).toFixed(0)}m`
  return `약 ${km.toFixed(1)}km`
}
