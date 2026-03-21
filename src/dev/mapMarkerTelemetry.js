/**
 * DEV 전용: 초기 마커 파이프라인 계측 (프로덕션에서는 no-op)
 */

const T0_KEY = '__whereEV3MapT0'

function t0() {
  if (typeof performance === 'undefined') return 0
  if (typeof globalThis !== 'undefined' && globalThis[T0_KEY] != null) return globalThis[T0_KEY]
  const v = performance.now()
  if (typeof globalThis !== 'undefined') globalThis[T0_KEY] = v
  return v
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : 0
}

function rel() {
  return Math.round((nowMs() - t0()) * 100) / 100
}

const milestones = new Set()
const layerLenLog = []
let layerLogT0 = 0

export function resetMapMarkerTelemetry() {
  milestones.clear()
  layerLenLog.length = 0
  layerLogT0 = nowMs()
  if (typeof globalThis !== 'undefined') delete globalThis[T0_KEY]
  t0()
}

export function telemetryAppMount() {
  if (!import.meta.env.DEV) return
  resetMapMarkerTelemetry()
  console.time('[whereEV3-map] boot→overlayOff')
  console.info(`[whereEV3-map] +0ms app mount`)
}

export function telemetryLocationResolved(usedGeo) {
  if (!import.meta.env.DEV) return
  const k = 'location'
  if (milestones.has(k)) return
  milestones.add(k)
  console.info(`[whereEV3-map] +${rel()}ms location resolved (geo=${usedGeo})`)
}

export function telemetryItemsReady(len) {
  if (!import.meta.env.DEV) return
  const k = 'items'
  if (milestones.has(k)) return
  milestones.add(k)
  console.info(`[whereEV3-map] +${rel()}ms items ready (n=${len})`)
}

export function telemetryMapReady() {
  if (!import.meta.env.DEV) return
  const k = 'map'
  if (milestones.has(k)) return
  milestones.add(k)
  console.info(`[whereEV3-map] +${rel()}ms map ready (Leaflet container)`)
}

export function telemetryMapLayerStations(len, prevLen) {
  if (!import.meta.env.DEV) return
  const t = nowMs()
  if (!layerLogT0) layerLogT0 = t
  layerLenLog.push({ t: Math.round(t - layerLogT0), len, prev: prevLen })
  if (t - layerLogT0 <= 3000) {
    console.debug(`[whereEV3-map] +${rel()}ms mapLayerStations ${prevLen}→${len} (within boot window log)`)
  }
}

export function telemetryBootOverlayHidden() {
  if (!import.meta.env.DEV) return
  const k = 'overlay'
  if (milestones.has(k)) return
  milestones.add(k)
  console.timeEnd('[whereEV3-map] boot→overlayOff')
  console.info(`[whereEV3-map] +${rel()}ms boot overlay hidden`)
}

export function logMapLayerStationsSummary() {
  if (!import.meta.env.DEV || layerLenLog.length === 0) return
  console.table(layerLenLog)
}

/** DOM의 `.leaflet-marker-icon` 개수가 목표에 도달한 시각 기록 */
export function startMarkerIconMilestones(getMap) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => {}
  const targets = [10, 20, 40]
  const hit = new Set()
  let rid = 0
  const tick = () => {
    let n = 0
    try {
      const map = typeof getMap === 'function' ? getMap() : null
      const pane = map?.getPane?.('markerPane')
      if (pane) n = pane.querySelectorAll('.leaflet-marker-icon').length
    } catch {
      n = 0
    }
    for (const t of targets) {
      if (!hit.has(t) && n >= t) {
        hit.add(t)
        console.info(`[whereEV3-map] +${rel()}ms first ${t} marker icons in DOM (count=${n})`)
      }
    }
  }
  const id = window.setInterval(tick, 24)
  rid = id
  tick()
  return () => window.clearInterval(rid)
}

let markerRenderCount = 0

export function telemetryMarkerComponentRender() {
  if (!import.meta.env.DEV) return
  markerRenderCount += 1
  if (markerRenderCount <= 5 || markerRenderCount % 120 === 0) {
    console.debug(`[whereEV3-map] EvStationMapMarker render #${markerRenderCount} (+${rel()}ms)`)
  }
}

export function getMarkerRenderCount() {
  return markerRenderCount
}
