/**
 * 부트/가시성 게이트: 마커 아이콘(div) + 부트용 CircleMarker(SVG class)
 */
export function countMapFirstPaintSignals(map) {
  if (!map || typeof map.getPane !== 'function') return 0
  try {
    const mp = map.getPane('markerPane')
    const op = map.getPane('overlayPane')
    let n = 0
    if (mp) n += mp.querySelectorAll('.leaflet-marker-icon').length
    if (op) n += op.querySelectorAll('.ev-map-boot-paint').length
    return n
  } catch {
    return 0
  }
}
