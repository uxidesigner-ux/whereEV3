import { haversineDistanceKm } from './geo.js'

/** 모바일 검색 확정 시 1km → 10km → 100km → (사실상 전국) 순으로 확장 */
export const MOBILE_SEARCH_RADIUS_TIERS_KM = [1, 10, 100, 2000]

/**
 * 텍스트에 이미 맞는 행들 중, 중심 기준 반경 티어를 올려가며 첫 비어 있지 않은 단계를 고른다.
 * @param {Array<{ lat?: number, lng?: number }>} textMatchedRows
 * @param {{ lat: number, lng: number }} center
 * @returns {{ radiusKm: number, matches: typeof textMatchedRows, widenedHint: boolean }}
 */
export function pickMobileSearchRadiusTier(textMatchedRows, center, tiersKm = MOBILE_SEARCH_RADIUS_TIERS_KM) {
  const lat = center?.lat
  const lng = center?.lng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      radiusKm: tiersKm[tiersKm.length - 1],
      matches: textMatchedRows || [],
      widenedHint: false,
    }
  }
  const rows = textMatchedRows || []
  for (let i = 0; i < tiersKm.length; i++) {
    const r = tiersKm[i]
    const matches = rows.filter((s) => {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return false
      return haversineDistanceKm(lat, lng, s.lat, s.lng) <= r
    })
    if (matches.length > 0) {
      return { radiusKm: r, matches, widenedHint: i > 0 }
    }
  }
  return {
    radiusKm: tiersKm[tiersKm.length - 1],
    matches: [],
    widenedHint: tiersKm.length > 1,
  }
}

/**
 * 중심·반경(km) 기준 대략 정사각형 bounds (appliedMapBounds 용)
 */
export function squareBoundsLiteralAroundCenter(lat, lng, radiusKm) {
  const r = Math.min(Math.max(radiusKm, 0.5), 500)
  const clampLat = Math.max(-85, Math.min(85, lat))
  const cosLat = Math.cos((clampLat * Math.PI) / 180) || 1e-6
  const dLat = r / 111
  const dLng = r / (111 * cosLat)
  return {
    southWest: { lat: clampLat - dLat, lng: lng - dLng },
    northEast: { lat: clampLat + dLat, lng: lng + dLng },
  }
}
