import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { computeBootLeafletView, GWANGHWAMUN_FALLBACK } from '../utils/mapInitialView.js'

/**
 * (레거시/미사용 가능) 위치 성공/실패 모두 가로폭 ≈ 1000m — 부트스트랩과 동일 유틸.
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
      const { center, zoom } = computeBootLeafletView(lat, lng, w)
      map.setView(center, zoom, { animate: false })
      setUserLocation({ lat, lng })
    }

    const applyFallback = () => {
      const lat = GWANGHWAMUN_FALLBACK.lat
      const lng = GWANGHWAMUN_FALLBACK.lng
      const w = mapWidthPx()
      const { center, zoom } = computeBootLeafletView(lat, lng, w)
      map.setView(center, zoom, { animate: false })
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
