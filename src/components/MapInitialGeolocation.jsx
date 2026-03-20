import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { zoomForHorizontalSpanMeters } from '../utils/mapZoomMeters.js'

/** 위치 실패 시 초기 뷰 (광화문 일대) */
const FALLBACK_CENTER = [37.5759, 126.9769]

/**
 * 앱 최초 1회: 위치 성공/실패 모두 가로폭 ≈ 1000m (부트스트랩과 동일 스케일).
 */
export function MapInitialGeolocation({ setUserLocation }) {
  const map = useMap()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const mapWidthPx = () => {
      const el = map.getContainer()
      if (el && el.clientWidth > 0) return el.clientWidth
      if (typeof window !== 'undefined') return window.innerWidth
      return 400
    }

    const applySuccess = (lat, lng) => {
      const w = mapWidthPx()
      const z = zoomForHorizontalSpanMeters(w, 1000, lat)
      map.setView([lat, lng], z, { animate: false })
      setUserLocation({ lat, lng })
    }

    const applyFallback = () => {
      const lat = FALLBACK_CENTER[0]
      const lng = FALLBACK_CENTER[1]
      const w = mapWidthPx()
      const z = zoomForHorizontalSpanMeters(w, 1000, lat)
      map.setView([lat, lng], z, { animate: false })
    }

    if (!navigator.geolocation) {
      requestAnimationFrame(() => requestAnimationFrame(applyFallback))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        requestAnimationFrame(() => requestAnimationFrame(() => applySuccess(lat, lng)))
      },
      () => {
        requestAnimationFrame(() => requestAnimationFrame(applyFallback))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
    )
  }, [map, setUserLocation])

  return null
}
