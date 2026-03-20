import { useCallback, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { radius, motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/** @typedef {'closed' | 'half' | 'full'} SheetSnap */

const SNAP_ORDER = /** @type {const} */ (['closed', 'half', 'full'])

const FULL_PULL_DOWN_PX = 52

function computeHeights(topOffsetPx, halfVhRatio, fullMarginPx) {
  if (typeof window === 'undefined') {
    return { closed: 0, half: 320, full: 640 }
  }
  const vh = window.innerHeight
  const maxHForHalf = Math.max(220, vh - topOffsetPx - fullMarginPx)
  const half = Math.round(Math.min(vh * halfVhRatio, maxHForHalf * 0.68))
  const full = Math.round(vh)
  return { closed: 0, half, full }
}

/**
 * 모바일 detent 시트: closed / half / full.
 * - half: 헤더의 드래그 핸들에만 sheetDragHandlers 부착 → 시트 이동 우선.
 * - full: 상단까지 덮는 레이어(z 상승), radius 0. 본문 스크롤 우선; scrollTop===0에서 아래로 당기면 half 복귀.
 */
export function MobileBottomSheet({
  topOffsetPx = 56,
  halfVhRatio = 0.42,
  fullMarginPx = 12,
  defaultSnap = 'closed',
  snap: snapProp,
  onSnapChange,
  onSnapHeightPxChange,
  listScrollRef,
  /** half일 때만 핸들에 spread. full에서는 빈 객체 */
  renderHeader,
  children,
  /** 상세 등: 스크롤 밖 하단 고정(CTA) */
  footer = null,
  /** snap===full일 때 검색·FAB·지도 위로 덮기 */
  fullZIndex = 1600,
}) {
  const { colors, tokens } = useEvTheme()
  const isControlled = snapProp !== undefined
  const [snapInternal, setSnapInternal] = useState(/** @type {SheetSnap} */ (defaultSnap))
  const snap = isControlled ? snapProp : snapInternal
  const [heights, setHeights] = useState(() => computeHeights(topOffsetPx, halfVhRatio, fullMarginPx))
  const [dragPx, setDragPx] = useState(null)
  const dragRef = useRef({ active: false, startY: 0, startH: 0 })
  const snapRef = useRef(snap)
  useEffect(() => {
    snapRef.current = snap
  }, [snap])

  const recomputeHeights = useCallback(() => {
    setHeights(computeHeights(topOffsetPx, halfVhRatio, fullMarginPx))
  }, [topOffsetPx, halfVhRatio, fullMarginPx])

  useEffect(() => {
    recomputeHeights()
    window.addEventListener('resize', recomputeHeights)
    return () => window.removeEventListener('resize', recomputeHeights)
  }, [recomputeHeights])

  const heightForSnap = useCallback((s) => heights[s] ?? 0, [heights])
  const targetH = heightForSnap(snap)
  const visualH = dragPx ?? targetH
  const transitioning = dragPx === null
  const isFull = snap === 'full'

  useEffect(() => {
    onSnapHeightPxChange?.(heightForSnap(snap))
  }, [snap, heights, heightForSnap, onSnapHeightPxChange])

  useEffect(() => {
    onSnapChange?.(snap)
  }, [snap, onSnapChange])

  const pickNearestSnap = useCallback(
    (px) => {
      const lo = heights.closed
      const hi = heights.full
      const clamped = Math.max(lo, Math.min(hi, px))
      let best = /** @type {SheetSnap} */ ('closed')
      let bestD = Infinity
      for (const k of SNAP_ORDER) {
        const d = Math.abs(clamped - heights[k])
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      return best
    },
    [heights]
  )

  const commitSnap = useCallback(
    (next) => {
      if (!isControlled) setSnapInternal(next)
      onSnapChange?.(next)
    },
    [isControlled, onSnapChange]
  )

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      if (snapRef.current !== 'half') return
      const startH = heightForSnap('half')
      dragRef.current = { active: true, startY: e.clientY, startH }
      setDragPx(startH)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    },
    [heightForSnap]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragRef.current.active) return
      const delta = e.clientY - dragRef.current.startY
      const next = Math.round(dragRef.current.startH - delta)
      const lo = heights.closed
      const hi = heights.full
      setDragPx(Math.max(lo, Math.min(hi, next)))
    },
    [heights.closed, heights.full]
  )

  const onPointerUp = useCallback(
    (e) => {
      if (!dragRef.current.active) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      dragRef.current.active = false
      const lo = heights.closed
      const hi = heights.full
      const delta = e.clientY - dragRef.current.startY
      const raw = Math.round(dragRef.current.startH - delta)
      const clamped = Math.max(lo, Math.min(hi, raw))
      const next = pickNearestSnap(clamped)
      commitSnap(next)
      setDragPx(null)
    },
    [pickNearestSnap, commitSnap, heights.closed, heights.full]
  )

  const sheetDragHandlers =
    snap === 'half'
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
        }
      : {
          onPointerDown: undefined,
          onPointerMove: undefined,
          onPointerUp: undefined,
          onPointerCancel: undefined,
        }

  /** full: 스크롤 맨 위에서 아래로 당기면 half */
  useEffect(() => {
    const el = listScrollRef?.current
    if (!el || snap !== 'full' || !onSnapChange) return undefined

    let startY = 0
    let maxPull = 0
    let armed = false

    const touchStart = (e) => {
      if (el.scrollTop > 2) {
        armed = false
        return
      }
      armed = true
      startY = e.touches[0].clientY
      maxPull = 0
    }

    const touchMove = (e) => {
      if (!armed) return
      if (el.scrollTop > 2) {
        armed = false
        return
      }
      const y = e.touches[0].clientY
      const dy = y - startY
      if (dy > 0) {
        maxPull = Math.max(maxPull, dy)
        if (dy > 14) e.preventDefault()
      }
    }

    const touchEnd = () => {
      if (armed && maxPull >= FULL_PULL_DOWN_PX && el.scrollTop <= 2) {
        onSnapChange('half')
      }
      armed = false
      maxPull = 0
    }

    el.addEventListener('touchstart', touchStart, { passive: true })
    el.addEventListener('touchmove', touchMove, { passive: false })
    el.addEventListener('touchend', touchEnd)
    el.addEventListener('touchcancel', touchEnd)
    return () => {
      el.removeEventListener('touchstart', touchStart)
      el.removeEventListener('touchmove', touchMove)
      el.removeEventListener('touchend', touchEnd)
      el.removeEventListener('touchcancel', touchEnd)
    }
  }, [snap, listScrollRef, onSnapChange])

  const cycleSnap = useCallback(() => {
    const idx = SNAP_ORDER.indexOf(snap)
    commitSnap(SNAP_ORDER[(idx + 1) % SNAP_ORDER.length])
  }, [snap, commitSnap])

  const shellTransition = transitioning
    ? `height ${motion.duration.sheet}ms ${motion.easing.standard}, max-height ${motion.duration.sheet}ms ${motion.easing.standard}, border-radius ${motion.duration.sheet}ms ${motion.easing.standard}, box-shadow ${motion.duration.sheet}ms ${motion.easing.standard}`
    : 'none'

  return (
    <Box
      component="section"
      role="region"
      aria-label="충전소 목록"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: isFull ? fullZIndex : 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      }}
      aria-hidden={snap === 'closed'}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isFull ? 0 : `${radius.sheet}px ${radius.sheet}px 0 0`,
          bgcolor: tokens.bg.paper,
          borderTop: isFull ? 'none' : `1px solid ${colors.gray[200]}`,
          boxShadow: isFull ? 'none' : tokens.shadow.sheet,
          height: visualH,
          maxHeight: visualH,
          paddingTop: isFull ? 'env(safe-area-inset-top, 0px)' : 0,
          transition: shellTransition,
        }}
      >
        {/* renderHeader는 부모(App)가 ref·상태를 캡처할 수 있어 refs 규칙 오탐 방지 */}
        <Box sx={{ flexShrink: 0 }}>
          {/* eslint-disable-next-line react-hooks/refs -- render prop; 부모 헤더만 조합 */}
          {renderHeader({ snap, cycleSnap, sheetDragHandlers })}
        </Box>
        <Box
          ref={listScrollRef}
          tabIndex={-1}
          role="region"
          aria-label={isFull ? '화면 본문' : '목록 스크롤 영역'}
          sx={{
            flex: snap === 'closed' ? 0 : 1,
            minHeight: 0,
            overflow: 'auto',
            display: snap === 'closed' ? 'none' : 'block',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            px: 2.5,
            pb: footer && snap !== 'closed' ? 0.5 : 1,
            pt: isFull ? '10px' : '12px',
          }}
        >
          {snap === 'closed' ? null : children}
        </Box>
        {footer && snap !== 'closed' ? (
          <Box
            sx={{
              flexShrink: 0,
              px: 2.5,
              pt: 0.75,
              pb: 'max(8px, env(safe-area-inset-bottom, 0px))',
              borderTop: `1px solid ${colors.gray[200]}`,
              bgcolor: tokens.bg.paper,
            }}
          >
            {footer}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
