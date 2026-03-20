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

/**
 * 뷰포트 boundsLiteral 을 비율로 확장(지도 마커·클러스터용 프리로드 영역).
 * @param {{ southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} bounds
 * @param {number} [padRatio] 각 변 바깥으로 늘릴 비율(예: 0.42)
 */
export function expandLiteralBounds(bounds, padRatio = 0.42) {
  if (!bounds?.southWest || !bounds?.northEast) return null
  const sw = bounds.southWest
  const ne = bounds.northEast
  const dLat = ne.lat - sw.lat
  const dLng = ne.lng - sw.lng
  const p = padRatio
  return {
    southWest: { lat: sw.lat - dLat * p, lng: sw.lng - dLng * p },
    northEast: { lat: ne.lat + dLat * p, lng: ne.lng + dLng * p },
  }
}

/** 같은 장소 그룹 키: statNm + 좌표(소수 5자리). */
export function placeKey(row) {
  const lat = Number(row.lat).toFixed(5)
  const lng = Number(row.lng).toFixed(5)
  return `${(row.statNm || '').trim()}|${lat}|${lng}`
}

/** 여러 값 요약 표시 (최대 2개 + 나머지 N). */
export function formatListSummary(arr, maxShow = 2) {
  if (!arr || arr.length === 0) return '-'
  const uniq = [...new Set(arr)].filter(Boolean)
  if (uniq.length <= maxShow) return uniq.join(' · ')
  return uniq.slice(0, maxShow).join(' · ') + ` +${uniq.length - maxShow}`
}

/**
 * 그룹 내 충전기 급속/완속 요약 — 목록 뱃지용.
 * @param {{ speedCategory?: string }[]} rows
 * @returns {string | null}
 */
export function summarizeSpeedCategories(rows) {
  const cats = [...new Set((rows || []).map((r) => r.speedCategory).filter(Boolean))]
  if (cats.length === 0) return null
  if (cats.length === 1) return cats[0]
  return '혼합'
}

/**
 * 목록용 짧은 위치 맥락(시·구 등). 전체 도로명 주소는 상세로 유도.
 * @param {{ rnAdres?: string, adres?: string }[]} rows
 * @param {{ rnAdres?: string, adres?: string }} firstRow
 */
export function pickShortLocationHint(rows, firstRow) {
  const tryLine = () => {
    const a = (firstRow?.rnAdres || firstRow?.adres || '').trim()
    if (a) return a
    for (const r of rows || []) {
      const t = (r.rnAdres || r.adres || '').trim()
      if (t) return t
    }
    return ''
  }
  const line = tryLine()
  if (!line) return ''
  const m = line.match(
    /([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)\s+[가-힣]+(?:구|군|시))/
  )
  if (m) return m[1].replace(/\s+/g, ' ')
  const m2 = line.match(/([가-힣]+시\s+[가-힣]+(?:구|군))/)
  if (m2) return m2[1].replace(/\s+/g, ' ')
  const parts = line.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`.slice(0, 32)
  return line.length > 28 ? `${line.slice(0, 28)}…` : line
}
