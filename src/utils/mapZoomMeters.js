/** Web Mercator (EPSG:3857) — OSM slippy map 기준 m/px */
const METERS_PER_PIXEL_SCALE = 156543.03392

/**
 * 지도 가로 픽셀 폭이 대략 `spanMeters`(m) 실거리에 해당하도록 하는 줌.
 * @param {number} mapWidthPx
 * @param {number} spanMeters
 * @param {number} latDeg
 * @param {{ min?: number, max?: number }} [limits]
 */
export function zoomForHorizontalSpanMeters(mapWidthPx, spanMeters, latDeg, limits = {}) {
  const min = limits.min ?? 15
  const max = limits.max ?? 19
  const w = Math.max(200, mapWidthPx)
  const cosLat = Math.cos((latDeg * Math.PI) / 180)
  const z = Math.log2((w * METERS_PER_PIXEL_SCALE * cosLat) / spanMeters)
  const clamped = Math.min(max, Math.max(min, z))
  return Math.round(clamped * 10) / 10
}
