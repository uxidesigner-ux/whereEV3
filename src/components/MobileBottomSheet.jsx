import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { radius, motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/** @typedef {'closed' | 'peek' | 'half' | 'full'} SheetSnap */

const FULL_PULL_DOWN_PX = 52
const FULL_GAP_BELOW_TOP_OFFSET_PX = 8

/**
 * @param {number} topOffsetPx
 * @param {number} halfVhRatio
 * @param {number} fullMarginPx
 * @param {{ peekVhRatio?: number | null, capFullBelowTopOffset?: boolean }} [opts]
 */
function computeHeights(topOffsetPx, halfVhRatio, fullMarginPx, opts = {}) {
  if (typeof window === 'undefined') {
    return { closed: 0, half: 320, full: 640, peek: undefined, snapOrder: ['closed', 'half', 'full'] }
  }
  const { peekVhRatio = null, capFullBelowTopOffset = false } = opts
  const vh = window.innerHeight
  const maxHForHalf = Math.max(220, vh - topOffsetPx - fullMarginPx)
  const half = Math.round(Math.min(vh * halfVhRatio, maxHForHalf * 0.68))
  let full = Math.round(vh)
  if (capFullBelowTopOffset) {
    const capped = Math.round(vh - topOffsetPx - FULL_GAP_BELOW_TOP_OFFSET_PX)
    full = Math.max(half + 48, Math.min(full, capped))
  }

  /** @type {number | undefined} */
  let peek
  const snapOrder = /** @type {SheetSnap[]} */ (['closed'])
  if (peekVhRatio != null && peekVhRatio > 0) {
    const rawPeek = Math.round(vh * peekVhRatio)
    peek = Math.max(52, Math.min(rawPeek, Math.max(56, half - 20)))
    snapOrder.push('peek')
  }
  snapOrder.push('half', 'full')

  const heights = { closed: 0, half, full, peek }
  return { ...heights, snapOrder }
}

/**
 * 모바일 detent 시트: closed / (peek) / half / full.
 * - half·peek: 헤더 드래그 핸들에 sheetDragHandlers.
 * - full: 본문 스크롤 우선; scrollTop===0에서 아래로 당기면 half 복귀.
 * - capFullBelowTopOffset: full 높이를 뷰포트 상단 오프셋 아래까지만(검색 허브 미침범).
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
  /** snap===full 이고 immersiveFull일 때만 검색·FAB 위로 덮는 z-index */
  fullZIndex = 1600,
  /** 상세 half: 스크롤 맨 위에서 위로 쓸면 half→full */
  pullBodyToExpandWhenHalf = false,
  /** peek에서 본문 상단 스와이프로 peek→half */
  allowPeekBodyExpand = false,
  /** 뷰포트 비율(예: 0.12). null이면 peek 스냅 비활성 */
  peekVhRatio = null,
  /** true면 full 높이를 vh - topOffsetPx - gap 으로 제한 */
  capFullBelowTopOffset = false,
  /** false면 full이 화면 전체를 덮는 모드(상단 safe-area 패딩·높은 z-index) */
  immersiveFull = true,
}) {
  const { colors, tokens } = useEvTheme()
  const isControlled = snapProp !== undefined
  const [snapInternal, setSnapInternal] = useState(/** @type {SheetSnap} */ (defaultSnap))
  const snap = isControlled ? snapProp : snapInternal
  const [heightState, setHeightState] = useState(() =>
    computeHeights(topOffsetPx, halfVhRatio, fullMarginPx, { peekVhRatio, capFullBelowTopOffset })
  )
  const snapOrder = heightState.snapOrder
  const heights = useMemo(() => {
    const { snapOrder: _o, ...rest } = heightState
    return rest
  }, [heightState])

  const [dragPx, setDragPx] = useState(null)
  const dragRef = useRef({ active: false, startY: 0, startH: 0 })
  const snapRef = useRef(snap)
  useEffect(() => {
    snapRef.current = snap
  }, [snap])

  const recomputeHeights = useCallback(() => {
    setHeightState(computeHeights(topOffsetPx, halfVhRatio, fullMarginPx, { peekVhRatio, capFullBelowTopOffset }))
  }, [topOffsetPx, halfVhRatio, fullMarginPx, peekVhRatio, capFullBelowTopOffset])

  useEffect(() => {
    recomputeHeights()
    window.addEventListener('resize', recomputeHeights)
    return () => window.removeEventListener('resize', recomputeHeights)
  }, [recomputeHeights])

  const heightForSnap = useCallback(
    (s) => {
      if (s === 'peek') return heights.peek ?? 0
      return heights[s] ?? 0
    },
    [heights]
  )

  const targetH = heightForSnap(snap)
  const visualH = dragPx ?? targetH
  const transitioning = dragPx === null
  const isFull = snap === 'full'
  const immersiveFullEffective = immersiveFull && isFull

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
      for (const k of snapOrder) {
        const h = heightForSnap(k)
        const d = Math.abs(clamped - h)
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      return best
    },
    [snapOrder, heights.closed, heights.full, heightForSnap]
  )

  const commitSnap = useCallback(
    (next) => {
      if (!isControlled) setSnapInternal(next)
      onSnapChange?.(next)
    },
    [isControlled, onSnapChange]
  )

  const sheetDraggable = snap === 'half' || snap === 'peek'

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return
      if (!sheetDraggable) return
      const cur = snapRef.current
      const startH = heightForSnap(cur)
      dragRef.current = { active: true, startY: e.clientY, startH }
      setDragPx(startH)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    },
    [sheetDraggable, heightForSnap]
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

  const sheetDragHandlers = sheetDraggable
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

  const bodyExpandActive =
    (snap === 'half' && pullBodyToExpandWhenHalf) || (snap === 'peek' && allowPeekBodyExpand)

  /** half·peek: 본문 상단에서 위로 쓸면 시트 확장 */
  useEffect(() => {
    const el = listScrollRef?.current
    if (!el || !bodyExpandActive || !onSnapChange) return undefined

    const startSnapH = () => heightForSnap(snapRef.current)

    const onTouchStart = (e) => {
      if (el.scrollTop > 2) return
      dragRef.current = { active: true, startY: e.touches[0].clientY, startH: startSnapH() }
      setDragPx(startSnapH())
    }

    const onTouchMove = (e) => {
      if (!dragRef.current.active) return
      if (el.scrollTop > 2) {
        dragRef.current.active = false
        setDragPx(null)
        return
      }
      const delta = e.touches[0].clientY - dragRef.current.startY
      const next = Math.round(dragRef.current.startH - delta)
      const lo = heights.closed
      const hi = heights.full
      setDragPx(Math.max(lo, Math.min(hi, next)))
      if (Math.abs(delta) > 6) e.preventDefault()
    }

    const onTouchEnd = (e) => {
      if (!dragRef.current.active) return
      try {
        const t = e.changedTouches[0]
        const delta = t ? t.clientY - dragRef.current.startY : 0
        const raw = Math.round(dragRef.current.startH - delta)
        const clamped = Math.max(heights.closed, Math.min(heights.full, raw))
        const next = pickNearestSnap(clamped)
        commitSnap(next)
      } finally {
        dragRef.current.active = false
        setDragPx(null)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [
    bodyExpandActive,
    listScrollRef,
    onSnapChange,
    heights.closed,
    heights.full,
    heightForSnap,
    pickNearestSnap,
    commitSnap,
  ])

  const cycleSnap = useCallback(() => {
    const idx = snapOrder.indexOf(snap)
    commitSnap(snapOrder[(idx + 1) % snapOrder.length])
  }, [snap, snapOrder, commitSnap])

  const shellTransition = transitioning
    ? `height ${motion.duration.sheet}ms ${motion.easing.standard}, max-height ${motion.duration.sheet}ms ${motion.easing.standard}, border-radius ${motion.duration.sheet}ms ${motion.easing.standard}, box-shadow ${motion.duration.sheet}ms ${motion.easing.standard}`
    : 'none'

  const sheetZ = immersiveFullEffective ? fullZIndex : 1000

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
        zIndex: sheetZ,
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
          paddingTop: immersiveFullEffective ? 'env(safe-area-inset-top, 0px)' : 0,
          transition: shellTransition,
        }}
      >
        <Box sx={{ flexShrink: 0 }}>{renderHeader({ snap, cycleSnap, sheetDragHandlers })}</Box>
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
