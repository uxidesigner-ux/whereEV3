import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import { computeBootLeafletView, mapBootstrapWidthPx } from '../utils/mapInitialView.js'

/**
 * 1) 부트 시 map.setView (MapContainer는 props 갱신을 따르지 않음)
 * 2) moveend 후 첫 배치 마커가 markerPane에 올라오면 onReady (전량 대기 금지 — 체감 지연 방지)
 * 3) onReady( boundsLiteral | null ) — Leaflet getBounds() 스냅샷으로 applied 영역 동기화
 */
export function MapBootMarkerReady({
  active,
  center,
  zoom,
  itemsLength,
  markerCount,
  /** 지도에 그려야 할 마커 수(상한) */
  expectedMarkerIcons = 0,
  /**
   * DOM에서 이 개수만큼 `.leaflet-marker-icon`이 생기면 부트 완료로 본다.
   * target보다 작은 값이면 나머지 마커는 오버레이 종료 후 이어서 페인트.
   */
  paintSatisfiedIconCap = 40,
  /** 폴링·안전 타임아웃 상한(ms) */
  markerIconsMaxWaitMs = 2500,
  onReady,
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
      }, 80)
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      map.off('moveend', onMoveEnd)
    }
  }, [active, map, center, zoom])

  useEffect(() => {
    if (!active || bootMoveGeneration === 0) return undefined
    if (finishedRef.current) return undefined

    let cancelled = false
    const readBoundsLiteral = () => {
      try {
        const bb = map.getBounds()
        return {
          southWest: { lat: bb.getSouthWest().lat, lng: bb.getSouthWest().lng },
          northEast: { lat: bb.getNorthEast().lat, lng: bb.getNorthEast().lng },
        }
      } catch {
        return null
      }
    }
    const finish = () => {
      if (cancelled || finishedRef.current) return
      finishedRef.current = true
      onReadyRef.current(readBoundsLiteral())
    }

    /** 데이터가 있으면 마커가 1개 이상 준비된 뒤(다음 프레임 페인트 후)에만 오버레이 종료 */
    const finishAfterPaint = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) finish()
        })
      })
    }

    if (itemsLength === 0) {
      finishAfterPaint()
      return () => {
        cancelled = true
      }
    }

    const targetIcons = Math.max(0, expectedMarkerIcons || markerCount)
    const maxWait = Math.max(400, markerIconsMaxWaitMs)
    const cap = Math.max(1, Math.floor(paintSatisfiedIconCap))
    const iconsRequired = targetIcons <= 0 ? 0 : Math.min(targetIcons, cap)

    const countMarkerIcons = () => {
      try {
        const pane = map.getPane?.('markerPane')
        if (!pane) return 0
        return pane.querySelectorAll('.leaflet-marker-icon').length
      } catch {
        return 0
      }
    }

    const enoughIconsPainted = () => iconsRequired > 0 && countMarkerIcons() >= iconsRequired

    if (markerCount > 0 && iconsRequired > 0) {
      let pollTimer = null
      let maxTimer = null
      const clearTimers = () => {
        if (pollTimer != null) {
          window.clearInterval(pollTimer)
          pollTimer = null
        }
        if (maxTimer != null) {
          window.clearTimeout(maxTimer)
          maxTimer = null
        }
      }
      const scheduleFinish = () => {
        clearTimers()
        finishAfterPaint()
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          if (enoughIconsPainted()) {
            scheduleFinish()
            return
          }
          pollTimer = window.setInterval(() => {
            if (cancelled) return
            if (enoughIconsPainted()) scheduleFinish()
          }, 32)
          maxTimer = window.setTimeout(() => {
            if (!cancelled) scheduleFinish()
          }, maxWait)
        })
      })
      return () => {
        cancelled = true
        clearTimers()
      }
    }

    /** 데이터는 있는데 지도 소스가 아직 0건 — 늦게 붙는 경우 대비해 길게 대기 */
    if (itemsLength > 0 && markerCount === 0) {
      const t = window.setTimeout(() => finishAfterPaint(), maxWait)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    const safety = window.setTimeout(() => finish(), maxWait)
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [active, bootMoveGeneration, itemsLength, markerCount, expectedMarkerIcons, markerIconsMaxWaitMs, map, paintSatisfiedIconCap])

  return null
}
