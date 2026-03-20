import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { zoomForHorizontalSpanMeters } from '../utils/mapZoomMeters.js'

/** 위치 실패 시 초기 뷰 (서울 시청 일대) */
const FALLBACK_CENTER = [37.5665, 126.978]

/**
 * 앱 최초 1회: 위치 성공 시 현재 위치 + 가로폭 ≈ 1000m.
 * 실패·미지원 시 서울 중심 + 가로폭 ≈ 2000m. (로딩 UI 없음)
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
      const z = zoomForHorizontalSpanMeters(w, 2000, lat)
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
