import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { computeBootLeafletView, mapBootstrapWidthPx } from '../utils/mapInitialView.js'

/**
 * react-leaflet MapContainer는 최초 생성 시 center/zoom만 반영하고 props 갱신을 따라가지 않는다.
 * 부트 완료 시 실제 맵 컨테이너 너비로 ≈1000m 줌을 다시 계산해 setView 한 뒤, moveend·마커 안정 후 onReady.
 */
export function MapBootMarkerReady({
  active,
  center,
  zoom,
  itemsLength,
  markerCount,
  onReady,
}) {
  const map = useMap()
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!active) return undefined
    if (!center || center.length !== 2 || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      return undefined
    }

    let cancelled = false
    const finish = () => {
      if (cancelled) return
      onReadyRef.current()
    }

    let moveHandled = false
    const onMoveEnd = () => {
      if (moveHandled || cancelled) return
      moveHandled = true
      map.off('moveend', onMoveEnd)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          try {
            map.invalidateSize()
          } catch {
            /* ignore */
          }
          const delay =
            itemsLength === 0
              ? 0
              : markerCount === 0 && itemsLength > 150
                ? 420
                : markerCount === 0 && itemsLength > 0
                  ? 260
                  : 140
          window.setTimeout(finish, delay)
        })
      })
    }

    const apply = () => {
      if (cancelled) return
      try {
        map.invalidateSize()
        const el = map.getContainer()
        const wPx = el && el.clientWidth > 0 ? el.clientWidth : mapBootstrapWidthPx()
        const { center: c, zoom: z } = computeBootLeafletView(center[0], center[1], wPx)
        map.setView(c, z, { animate: false })
      } catch {
        finish()
        return
      }
      map.on('moveend', onMoveEnd)
      window.setTimeout(() => {
        if (!cancelled && !moveHandled) onMoveEnd()
      }, 200)
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply)
    })

    const safety = window.setTimeout(finish, 12000)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      map.off('moveend', onMoveEnd)
      window.clearTimeout(safety)
    }
  }, [active, map, center, zoom, itemsLength, markerCount])

  return null
}
