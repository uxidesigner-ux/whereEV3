import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import { computeBootLeafletView, mapBootstrapWidthPx } from '../utils/mapInitialView.js'
import { countMapFirstPaintSignals } from '../utils/mapPaintSignals.js'

/**
 * 1) 부트 시 map.setView (MapContainer는 props 갱신을 따르지 않음)
 * 2) moveend 후 실제 지도 위 첫 페인트(마커 아이콘 또는 부트 CircleMarker) 확인 시 onReady
 * 3) 기대 마커가 있는데 DOM에 안 뜨면 onTimeout (로딩만 닫지 않음 — 부모에서 처리)
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
   * DEV Leaflet 하네스: EvStationMapLayer는 빈 stations라 DOM 마커 기대치가 데이터 파이프와 불일치할 수 있음.
   * true면 moveend 이후 짧은 페인트만 보고 onReady (아이콘 개수 대기 생략).
   */
  skipDomIconCountGate = false,
  /** 기대 페인트가 있을 때 DOM 신호가 안 잡히면 호출 (로딩 종료용 onReady는 호출하지 않음) */
  onTimeout,
  /** DOM에서 첫 페인트까지 최대 대기(ms) */
  firstPaintMaxWaitMs = 12000,
  onReady,
}) {
  const map = useMap()
  const onReadyRef = useRef(onReady)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  /** moveend까지 도달했는지(이후 markerCount로 로딩 종료 타이밍 조정) */
  const [bootMoveGeneration, setBootMoveGeneration] = useState(0)
  const finishedRef = useRef(false)
  const prevBootMoveGenRef = useRef(0)
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
    if (bootMoveGeneration !== prevBootMoveGenRef.current) {
      prevBootMoveGenRef.current = bootMoveGeneration
      finishedRef.current = false
    }
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
    const finishSuccess = () => {
      if (cancelled || finishedRef.current) return
      finishedRef.current = true
      onReadyRef.current(readBoundsLiteral())
    }

    const finishAfterPaint = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) finishSuccess()
        })
      })
    }

    const signalCount = () => countMapFirstPaintSignals(map)
    const hasPaint = () => signalCount() >= 1

    /** 표시할 충전소가 없음 — 지도만 준비되면 종료 */
    if (itemsLength === 0) {
      finishAfterPaint()
      return () => {
        cancelled = true
      }
    }

    if (skipDomIconCountGate) {
      finishAfterPaint()
      return () => {
        cancelled = true
      }
    }

    const targetIcons = Math.max(0, expectedMarkerIcons || markerCount)
    const maxWait = Math.max(800, firstPaintMaxWaitMs)

    /** 데이터는 있는데 레이어 소스 0건 — 파이프 문제. 무한 대기 금지 */
    if (itemsLength > 0 && markerCount === 0) {
      const t = window.setTimeout(() => {
        if (!cancelled && !finishedRef.current) onTimeoutRef.current?.()
      }, maxWait)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    /** 마커가 있어야 함: 반드시 DOM 페인트 1개 이상 확인 후에만 성공 종료 */
    if (markerCount > 0 && targetIcons > 0) {
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
      const scheduleSuccess = () => {
        clearTimers()
        finishAfterPaint()
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          if (hasPaint()) {
            scheduleSuccess()
            return
          }
          pollTimer = window.setInterval(() => {
            if (cancelled) return
            if (hasPaint()) scheduleSuccess()
          }, 48)
          maxTimer = window.setTimeout(() => {
            if (cancelled) return
            clearTimers()
            if (hasPaint()) finishAfterPaint()
            else onTimeoutRef.current?.()
          }, maxWait)
        })
      })
      return () => {
        cancelled = true
        clearTimers()
      }
    }

    const safety = window.setTimeout(() => {
      if (!cancelled && !finishedRef.current) onTimeoutRef.current?.()
    }, maxWait)
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [
    active,
    bootMoveGeneration,
    itemsLength,
    markerCount,
    expectedMarkerIcons,
    map,
    skipDomIconCountGate,
    firstPaintMaxWaitMs,
  ])

  return null
}
