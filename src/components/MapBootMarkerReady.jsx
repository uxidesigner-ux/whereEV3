import { useEffect, useRef } from 'react'

/**
 * 부트스트랩: 지도 뷰포트·마커 레이어가 한 번 그려질 때까지 대기한 뒤 onReady 호출.
 * chunked 로딩 등으로 마커가 늦게 붙는 체감을 줄이기 위해 로딩 오버레이 종료와 연동한다.
 */
export function MapBootMarkerReady({ active, itemsLength, markerCount, boundsReady, onReady }) {
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    const finish = () => {
      if (cancelled) return
      onReadyRef.current()
    }

    if (itemsLength === 0) {
      const t = window.setTimeout(finish, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    if (!boundsReady) {
      const t = window.setTimeout(finish, 2800)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    let raf1 = 0
    raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const delay =
          markerCount === 0 && itemsLength > 150 ? 320 : markerCount === 0 && itemsLength > 0 ? 200 : 100
        window.setTimeout(finish, delay)
      })
    })
    const safety = window.setTimeout(finish, 12000)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      window.clearTimeout(safety)
    }
  }, [active, itemsLength, markerCount, boundsReady])

  return null
}
