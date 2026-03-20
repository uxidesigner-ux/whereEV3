import { useEffect, useRef } from 'react'
import { Drawer, Box, IconButton, Typography } from '@mui/material'
import Close from '@mui/icons-material/Close'
import { colors, radius, motion } from '../theme/dashboardTheme.js'
import { StationDetailContent } from './StationDetailContent.jsx'

const SWIPE_CLOSE_PX = 56
/** px/ms, 아래 방향 양수 */
const SWIPE_CLOSE_VELOCITY = 0.42
const SWIPE_MIN_FOR_VELOCITY_PX = 20
const MOVE_BUFFER_MAX = 12

/**
 * 모바일 전용: 상세 bottom sheet. 핸들+헤더 줄만 스와이프 다운으로 닫기(본문 스크롤과 분리).
 * 닫기 조건: 이동 거리 또는 최근 구간 속도(내부 스크롤과 분리).
 */
export function StationDetailSheet({ open, station, onClose }) {
  const dragStartY = useRef(0)
  const dragging = useRef(false)
  const closeBtnRef = useRef(null)
  /** 최근 포인터 이동 샘플로 속도 추정 */
  const moveSamples = useRef(/** @type {{ y: number; t: number }[]} */ ([]))

  useEffect(() => {
    if (!open || !station) return
    const id = requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open, station])

  const headerPointerDown = (e) => {
    if (e.button !== 0) return
    if (e.target.closest('button')) return
    dragging.current = true
    dragStartY.current = e.clientY
    moveSamples.current = [{ y: e.clientY, t: performance.now() }]
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const headerPointerMove = (e) => {
    if (!dragging.current) return
    const t = performance.now()
    const arr = moveSamples.current
    arr.push({ y: e.clientY, t })
    if (arr.length > MOVE_BUFFER_MAX) arr.shift()
  }

  const headerPointerUp = (e) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    const dy = e.clientY - dragStartY.current
    const samples = moveSamples.current
    let velocityDown = 0
    if (samples.length >= 2) {
      const a = samples[0]
      const b = samples[samples.length - 1]
      const dt = Math.max(1, b.t - a.t)
      velocityDown = (b.y - a.y) / dt
    }
    const shouldClose =
      dy > SWIPE_CLOSE_PX ||
      (dy > SWIPE_MIN_FOR_VELOCITY_PX && velocityDown > SWIPE_CLOSE_VELOCITY)
    if (shouldClose) onClose()
    moveSamples.current = []
  }

  const headerPointerCancel = (e) => {
    dragging.current = false
    moveSamples.current = []
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      slotProps={{
        backdrop: { sx: { bgcolor: 'rgba(15,23,42,0.45)' } },
        transition: { timeout: { enter: motion.duration.sheet, exit: motion.duration.exit } },
      }}
      PaperProps={{
        component: 'div',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'ev-detail-sheet-title',
        tabIndex: -1,
        sx: {
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)',
          minHeight: 'min(88dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 8px))',
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: colors.white,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transition: `transform ${motion.duration.sheet}ms ${motion.easing.standard}`,
        },
      }}
    >
      {station ? (
        <>
          <Box
            onPointerDown={headerPointerDown}
            onPointerMove={headerPointerMove}
            onPointerUp={headerPointerUp}
            onPointerCancel={headerPointerCancel}
            sx={{
              flexShrink: 0,
              pt: 1,
              px: 2,
              pb: 1,
              borderBottom: `1px solid ${colors.gray[200]}`,
              touchAction: 'none',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: colors.gray[300], mx: 'auto', mb: 1 }} aria-hidden />
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, pointerEvents: 'none' }}>
              <Typography id="ev-detail-sheet-title" variant="h6" component="h2" sx={{ fontWeight: 600, color: colors.gray[800], fontSize: '1.05rem', lineHeight: 1.35, pr: 0.5 }}>
                {station.statNm}
              </Typography>
              <Box sx={{ pointerEvents: 'auto', mt: -0.25 }}>
                <IconButton ref={closeBtnRef} onClick={onClose} aria-label="상세 닫기" size="small" sx={{ color: colors.gray[600] }}>
                  <Close />
                </IconButton>
              </Box>
            </Box>
          </Box>
          <Box
            component="div"
            role="document"
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              px: 2,
              pt: 1.5,
              pb: 'calc(20px + env(safe-area-inset-bottom, 0px))',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            <StationDetailContent station={station} stackActions />
          </Box>
        </>
      ) : null}
    </Drawer>
  )
}
