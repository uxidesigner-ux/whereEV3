import { useEffect, useRef, useMemo, useState } from 'react'
import { Drawer, Box, IconButton, Typography, CircularProgress } from '@mui/material'
import Close from '@mui/icons-material/Close'
import Refresh from '@mui/icons-material/Refresh'
import { appMobileType, radius, motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'
import { StationDetailContent, StationDetailFooterActions } from './StationDetailContent.jsx'

const SWIPE_CLOSE_PX = 56
/** px/ms, 아래 방향 양수 */
const SWIPE_CLOSE_VELOCITY = 0.42
const SWIPE_MIN_FOR_VELOCITY_PX = 20
const MOVE_BUFFER_MAX = 12

/**
 * 모바일 전용: 상세 bottom sheet. 핸들+헤더 줄만 스와이프 다운으로 닫기(본문 스크롤과 분리).
 * 닫기 조건: 이동 거리 또는 최근 구간 속도(내부 스크롤과 분리).
 */
export function StationDetailSheet({
  open,
  station,
  onClose,
  onRefresh,
  refreshLoading = false,
  headerSubtitle = '',
  chargerSummaryUpdatedInHeader = false,
}) {
  const { colors, tokens, resolvedMode } = useEvTheme()
  const dragStartY = useRef(0)
  const dragging = useRef(false)
  const closeBtnRef = useRef(null)
  /** 최근 포인터 이동 샘플로 속도 추정 */
  const moveSamples = useRef(/** @type {{ y: number; t: number }[]} */ ([]))

  const refreshEnabled = typeof onRefresh === 'function'

  const [chargerStatFilter, setChargerStatFilter] = useState(/** @type {'all' | '2' | '3' | '5'} */ ('all'))
  useEffect(() => {
    if (open && station) setChargerStatFilter('all')
    // station 객체 참조만 바뀌면 필터 유지(같은 id). 열림/다른 장소 id에서만 초기화.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- station?.id 의도적 제한
  }, [open, station?.id])

  const subtitle = useMemo(() => {
    if (!station) return ''
    if (headerSubtitle) return headerSubtitle
    const st = station.latestStatUpdDt || station.statUpdDt || ''
    return st ? `충전기 상태 기준 ${st}` : ''
  }, [station, headerSubtitle])

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
        transition: {
          timeout: { enter: motion.duration.detailEnter, exit: motion.duration.detailExit },
        },
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
          bgcolor: tokens.bg.paper,
          boxShadow: tokens.shadow.sheet,
          transition: `transform ${motion.duration.detailEnter}ms ${motion.easing.emphasized}`,
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
              pt: 1.25,
              px: 2,
              pb: 2.25,
              borderBottom: `1px solid ${tokens.border.subtle}`,
              bgcolor: tokens.bg.subtle,
              boxShadow: `0 10px 24px -18px ${resolvedMode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.12)'}`,
              touchAction: 'none',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <Box
              sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border.strong, mx: 'auto', mb: 1.25, opacity: 0.5 }}
              aria-hidden
            />
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25, pointerEvents: 'none' }}>
              <Box sx={{ minWidth: 0, flex: 1, pr: 0.5 }}>
                <Typography
                  id="ev-detail-sheet-title"
                  variant="h6"
                  component="h2"
                  sx={{ color: tokens.text.primary, ...appMobileType.detailSheetTitle }}
                >
                  {station.statNm}
                </Typography>
                {subtitle ? (
                  <Typography
                    variant="body2"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      ...appMobileType.detailSheetSubtitle,
                      color: tokens.text.secondary,
                      fontSize: '0.8125rem',
                      lineHeight: 1.45,
                      fontWeight: 500,
                    }}
                  >
                    {subtitle}
                  </Typography>
                ) : null}
              </Box>
              <Box sx={{ pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 0.25, flexShrink: 0, pt: 0.125 }}>
                <IconButton
                  onClick={() => refreshEnabled && onRefresh?.()}
                  disabled={!refreshEnabled || refreshLoading}
                  aria-label={refreshEnabled ? '충전소 데이터 새로고침' : '새로고침을 사용할 수 없습니다'}
                  title={refreshEnabled ? '목록 데이터 다시 불러오기' : 'API 키가 설정된 경우에만 새로고침할 수 있습니다'}
                  size="small"
                  sx={{ color: tokens.text.secondary }}
                >
                  {refreshLoading ? <CircularProgress size={20} thickness={5} sx={{ color: colors.blue.primary }} /> : <Refresh sx={{ fontSize: 21 }} />}
                </IconButton>
                <IconButton ref={closeBtnRef} onClick={onClose} aria-label="상세 닫기" size="small" sx={{ color: tokens.text.secondary }}>
                  <Close sx={{ fontSize: 22 }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              component="div"
              role="document"
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                px: 2,
                pt: 1.5,
                pb: 1.75,
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
              <StationDetailContent
                station={station}
                stackActions
                detachedFooter
                chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
                chargerStatFilter={chargerStatFilter}
                onChargerStatFilterChange={setChargerStatFilter}
              />
            </Box>
            <Box
              sx={{
                flexShrink: 0,
                px: 2,
              }}
            >
              <StationDetailFooterActions station={station} variant="sheet" />
            </Box>
          </Box>
        </>
      ) : null}
    </Drawer>
  )
}
