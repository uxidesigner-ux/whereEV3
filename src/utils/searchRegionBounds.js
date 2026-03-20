/**
 * 모바일 검색 시 지도 맞춤용 대표 지역 키워드 → 대략적 bounds (WGS84).
 * MVP: 소수 키워드만 정의, 나머지는 검색 결과 좌표로 fit.
 */

/** @typedef {{ southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} BoundsLiteral */

/** @type {Record<string, BoundsLiteral>} 키는 trim + 소문자 정규화된 검색어와 정확히 일치할 때만 사용 */
export const SEARCH_REGION_BOUNDS = {
  강남: {
    southWest: { lat: 37.478, lng: 127.01 },
    northEast: { lat: 37.532, lng: 127.072 },
  },
  판교: {
    southWest: { lat: 37.378, lng: 127.08 },
    northEast: { lat: 37.418, lng: 127.128 },
  },
  성수: {
    southWest: { lat: 37.536, lng: 127.038 },
    northEast: { lat: 37.558, lng: 127.062 },
  },
  종로: {
    southWest: { lat: 37.565, lng: 126.96 },
    northEast: { lat: 37.598, lng: 127.015 },
  },
  서초: {
    southWest: { lat: 37.468, lng: 126.98 },
    northEast: { lat: 37.508, lng: 127.04 },
  },
}

/** @param {string} qNormalized trim + toLowerCase */
export function getExactRegionBounds(qNormalized) {
  if (!qNormalized) return null
  return SEARCH_REGION_BOUNDS[qNormalized] ?? null
}

export const SEARCH_REGION_KEYWORDS = new Set(Object.keys(SEARCH_REGION_BOUNDS))

function cloneBoundsLiteral(b) {
  return {
    southWest: { lat: b.southWest.lat, lng: b.southWest.lng },
    northEast: { lat: b.northEast.lat, lng: b.northEast.lng },
  }
}

/** 단일 좌표 주변 소형 박스(지도 사각 강조용, 약 수백 m) */
const SINGLE_POINT_PAD = 0.0042

/**
 * 탐색 강조 오버레이용 bounds (fitter와 동일 우선순위: 사전 지역 → 결과 좌표).
 * @param {string} qRaw
 * @param {Array<{ lat?: number, lng?: number }>} filteredItems
 * @returns {BoundsLiteral | null}
 */
export function computeExploreHighlightBoundsForSearch(qRaw, filteredItems) {
  const q = (qRaw || '').trim().toLowerCase()
  if (!q) return null
  const region = getExactRegionBounds(q)
  if (region) return cloneBoundsLiteral(region)

  const pts = (filteredItems || []).filter(
    (s) => s != null && Number.isFinite(s.lat) && Number.isFinite(s.lng)
  )
  if (pts.length === 0) return null
  if (pts.length === 1) {
    const { lat, lng } = pts[0]
    return {
      southWest: { lat: lat - SINGLE_POINT_PAD, lng: lng - SINGLE_POINT_PAD },
      northEast: { lat: lat + SINGLE_POINT_PAD, lng: lng + SINGLE_POINT_PAD },
    }
  }
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const s of pts) {
    minLat = Math.min(minLat, s.lat)
    maxLat = Math.max(maxLat, s.lat)
    minLng = Math.min(minLng, s.lng)
    maxLng = Math.max(maxLng, s.lng)
  }
  return {
    southWest: { lat: minLat, lng: minLng },
    northEast: { lat: maxLat, lng: maxLng },
  }
}

export function cloneViewportBoundsLiteral(b) {
  if (!b?.southWest || !b?.northEast) return null
  return cloneBoundsLiteral(b)
}
