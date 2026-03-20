import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import { computeBootLeafletView, mapBootstrapWidthPx } from '../utils/mapInitialView.js'

/**
 * 1) 부트 시 map.setView (MapContainer는 props 갱신을 따르지 않음)
 * 2) primeClusterBoundsNow → 클러스터용 bounds 디바운스 1회 우회
 * 3) moveend 후 마커 데이터가 뷰에 반영될 때까지 대기한 뒤 onReady
 */
export function MapBootMarkerReady({
  active,
  center,
  zoom,
  itemsLength,
  markerCount,
  onReady,
  primeClusterBoundsNow,
}) {
  const map = useMap()
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  /** moveend까지 도달했는지(이후 markerCount로 로딩 종료 타이밍 조정) */
  const [bootMoveGeneration, setBootMoveGeneration] = useState(0)
  const finishedRef = useRef(false)
  const viewApplyGenRef = useRef(0)

  useEffect(() => {
    if (!active) {
      finishedRef.current = false
      setBootMoveGeneration(0)
    }
  }, [active])

  useEffect(() => {
    if (!active) return undefined
    if (!center || center.length !== 2 || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      return undefined
    }

    let cancelled = false
    viewApplyGenRef.current += 1
    const gen = viewApplyGenRef.current

    const onMoveEnd = () => {
      if (cancelled || gen !== viewApplyGenRef.current) return
      map.off('moveend', onMoveEnd)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || gen !== viewApplyGenRef.current) return
          try {
            map.invalidateSize()
          } catch {
            /* ignore */
          }
          setBootMoveGeneration((n) => n + 1)
        })
      })
    }

    const apply = () => {
      if (cancelled || gen !== viewApplyGenRef.current) return
      try {
        primeClusterBoundsNow?.()
        map.invalidateSize()
        const el = map.getContainer()
        const wPx = el && el.clientWidth > 0 ? el.clientWidth : mapBootstrapWidthPx()
        const { center: c, zoom: z } = computeBootLeafletView(center[0], center[1], wPx)
        map.on('moveend', onMoveEnd)
        map.setView(c, z, { animate: false })
      } catch {
        map.off('moveend', onMoveEnd)
        if (!cancelled) setBootMoveGeneration((n) => n + 1)
        return
      }
      window.setTimeout(() => {
        if (cancelled || gen !== viewApplyGenRef.current) return
        if (map && typeof map.off === 'function') map.off('moveend', onMoveEnd)
        onMoveEnd()
      }, 240)
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      map.off('moveend', onMoveEnd)
    }
  }, [active, map, center, zoom, primeClusterBoundsNow])

  useEffect(() => {
    if (!active || bootMoveGeneration === 0) return undefined
    if (finishedRef.current) return undefined

    let cancelled = false
    const finish = () => {
      if (cancelled || finishedRef.current) return
      finishedRef.current = true
      onReadyRef.current()
    }

    if (itemsLength === 0) {
      const t = window.setTimeout(finish, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    const delay =
      markerCount > 0 ? 220 : markerCount === 0 && itemsLength > 0 ? 950 : 280

    const t = window.setTimeout(finish, delay)
    const safety = window.setTimeout(finish, 6500)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      window.clearTimeout(safety)
    }
  }, [active, bootMoveGeneration, itemsLength, markerCount])

  return null
}
