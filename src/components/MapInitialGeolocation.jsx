import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { zoomForHorizontalSpanMeters } from '../utils/mapZoomMeters.js'

/**
 * 앱 최초 1회: 위치 권한 허용 시 현재 위치 중심 + 가로폭 ≈ 1000m 줌.
 * 실패·거부 시 기존 MapContainer 초기 center/zoom 유지. (로딩 UI 없음 — 내 위치 버튼과 구분)
 */
export function MapInitialGeolocation({ setUserLocation }) {
  const map = useMap()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const apply = () => {
          const el = map.getContainer()
          const w =
            el && el.clientWidth > 0
              ? el.clientWidth
              : typeof window !== 'undefined'
                ? window.innerWidth
                : 400
          const z = zoomForHorizontalSpanMeters(w, 1000, lat)
          map.setView([lat, lng], z, { animate: false })
          setUserLocation({ lat, lng })
        }
        requestAnimationFrame(() => requestAnimationFrame(apply))
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
    )
  }, [map, setUserLocation])

  return null
}
