import { zoomForHorizontalSpanMeters } from './mapZoomMeters.js'

/**
 * 광화문광장 인근 — 위치 실패 시 명시적 fallback (모호한 "서울 중심" 금지)
 * @type {Readonly<{ lat: number, lng: number }>}
 */
export const GWANGHWAMUN_FALLBACK = Object.freeze({
  lat: 37.5759,
  lng: 126.9769,
})

const BOOT_HORIZONTAL_SPAN_M = 1000

/** 지도 컨테이너 가로폭(px). Leaflet 컨테이너가 아직 없을 때 innerWidth 근사 */
export function mapBootstrapWidthPx() {
  if (typeof window === 'undefined') return 400
  return Math.max(200, Math.round(window.innerWidth))
}

/**
 * 부트스트랩 전용: 화면 가로폭이 실제 거리로 약 `BOOT_HORIZONTAL_SPAN_M` m에 해당하도록 center+zoom 산출.
 * (기본 zoomForHorizontalSpanMeters의 min=15 클램프는 초기 스케일을 왜곡할 수 있어 여기서만 완화)
 */
export function computeBootLeafletView(lat, lng, mapWidthPx = mapBootstrapWidthPx()) {
  const z = zoomForHorizontalSpanMeters(mapWidthPx, BOOT_HORIZONTAL_SPAN_M, lat, {
    min: 4,
    max: 20,
  })
  return {
    center: /** @type {[number, number]} */ ([lat, lng]),
    zoom: z,
  }
}
