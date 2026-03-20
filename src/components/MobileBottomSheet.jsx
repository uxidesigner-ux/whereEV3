import { useCallback, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { colors, radius, motion } from '../theme/dashboardTheme.js'

/** @typedef {'collapsed' | 'half' | 'full'} SheetSnap */

const SNAP_ORDER = /** @type {const} */ (['collapsed', 'half', 'full'])

function computeHeights(topOffsetPx, collapsedPx, halfVhRatio, fullMarginPx) {
  if (typeof window === 'undefined') {
    return { collapsed: collapsedPx, half: 320, full: 560 }
  }
  const vh = window.innerHeight
  const maxH = Math.max(collapsedPx + 100, vh - topOffsetPx - fullMarginPx)
  const half = Math.round(Math.min(vh * halfVhRatio, maxH * 0.62))
  const full = Math.round(maxH)
  return { collapsed: collapsedPx, half, full }
}

/**
 * 모바일 바텀 시트: 헤더/핸들 영역 드래그로 collapsed / half / full 스냅.
 * 본문 스크롤과 충돌하지 않도록 드래그는 drag 영역에만 바인딩.
 *
 * 레이어(모바일): 지도(z0) < 본 시트(1000) < 이 지역 검색 FAB(1001) < 필터 Drawer(1200) < 상세 시트(1400).
 * 지도 제스처는 시트·Drawer 백드롭 밖에서만 유효. FAB는 상세/필터 열림 시 숨김(App).
 */
export function MobileBottomSheet({
  topOffsetPx = 56,
  collapsedPx = 72,
  halfVhRatio = 0.42,
  fullMarginPx = 12,
  defaultSnap = 'collapsed',
  /** 제어 모드: 부모가 스냅 유지(상세 복귀 등) */
  snap: snapProp,
  onSnapChange,
  onSnapHeightPxChange,
  /** 목록 스크롤 복원용 */
  listScrollRef,
  renderHeader,
  /** 헤더(핸들+타이틀) 바로 아래, 스크롤 목록 위 — 정렬·필터 rail 등 */
  renderToolbar,
  children,
}) {
  const isControlled = snapProp !== undefined
  const [snapInternal, setSnapInternal] = useState(/** @type {SheetSnap} */ (defaultSnap))
  const snap = isControlled ? snapProp : snapInternal
  const [heights, setHeights] = useState(() => computeHeights(topOffsetPx, collapsedPx, halfVhRatio, fullMarginPx))
  const [dragPx, setDragPx] = useState(null)
  const dragRef = useRef({ active: false, startY: 0, startH: 0 })

  const recomputeHeights = useCallback(() => {
    setHeights(computeHeights(topOffsetPx, collapsedPx, halfVhRatio, fullMarginPx))
  }, [topOffsetPx, collapsedPx, halfVhRatio, fullMarginPx])

  useEffect(() => {
    recomputeHeights()
    window.addEventListener('resize', recomputeHeights)
    return () => window.removeEventListener('resize', recomputeHeights)
  }, [recomputeHeights])

  const heightForSnap = useCallback((s) => heights[s] ?? collapsedPx, [heights, collapsedPx])
  const targetH = heightForSnap(snap)
  const visualH = dragPx ?? targetH
  const transitioning = dragPx === null

  useEffect(() => {
    onSnapHeightPxChange?.(heightForSnap(snap))
  }, [snap, heights, heightForSnap, onSnapHeightPxChange])

  useEffect(() => {
    onSnapChange?.(snap)
  }, [snap, onSnapChange])

  const pickNearestSnap = useCallback(
    (px) => {
      const lo = heights.collapsed
      const hi = heights.full
      const clamped = Math.max(lo, Math.min(hi, px))
      let best = /** @type {SheetSnap} */ ('collapsed')
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

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    dragRef.current = { active: true, startY: e.clientY, startH: visualH }
    setDragPx(visualH)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return
    const delta = e.clientY - dragRef.current.startY
    const next = Math.round(dragRef.current.startH - delta)
    const lo = heights.collapsed
    const hi = heights.full
    setDragPx(Math.max(lo, Math.min(hi, next)))
  }

  const onPointerUp = (e) => {
    if (!dragRef.current.active) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    dragRef.current.active = false
    const lo = heights.collapsed
    const hi = heights.full
    const delta = e.clientY - dragRef.current.startY
    const raw = Math.round(dragRef.current.startH - delta)
    const clamped = Math.max(lo, Math.min(hi, raw))
    const next = pickNearestSnap(clamped)
    if (!isControlled) setSnapInternal(next)
    onSnapChange?.(next)
    setDragPx(null)
  }

  const commitSnap = useCallback(
    (next) => {
      if (!isControlled) setSnapInternal(next)
      onSnapChange?.(next)
    },
    [isControlled, onSnapChange]
  )

  const cycleSnap = useCallback(() => {
    const idx = SNAP_ORDER.indexOf(snap)
    commitSnap(SNAP_ORDER[(idx + 1) % SNAP_ORDER.length])
  }, [snap, commitSnap])

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
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
          bgcolor: colors.white,
          borderTop: `1px solid ${colors.gray[200]}`,
          boxShadow: '0 -2px 20px rgba(0,0,0,0.07)',
          height: visualH,
          maxHeight: visualH,
          transition: transitioning
            ? `height ${motion.duration.sheet}ms ${motion.easing.standard}, max-height ${motion.duration.sheet}ms ${motion.easing.standard}`
            : 'none',
        }}
      >
        <Box
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            flexShrink: 0,
            touchAction: 'none',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          {renderHeader({ snap, cycleSnap })}
        </Box>
        {renderToolbar ? (
          <Box
            sx={{
              flexShrink: 0,
              px: 2,
              /* 정리선과 필터 rail 사이 */
              pt: '14px',
              pb: '14px',
              borderBottom: '1px solid rgba(15, 23, 42, 0.07)',
              bgcolor: colors.gray[50],
              display: snap === 'collapsed' ? 'none' : 'block',
            }}
          >
            {renderToolbar({ snap, cycleSnap })}
          </Box>
        ) : null}
        <Box
          ref={listScrollRef}
          tabIndex={-1}
          role="region"
          aria-label="목록 스크롤 영역"
          sx={{
            flex: snap === 'collapsed' ? 0 : 1,
            minHeight: 0,
            overflow: 'auto',
            display: snap === 'collapsed' ? 'none' : 'block',
            WebkitOverflowScrolling: 'touch',
            px: 2.5,
            pb: 1,
            /* 필터 rail 하단 정리선과 목록 사이 */
            pt: '14px',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
