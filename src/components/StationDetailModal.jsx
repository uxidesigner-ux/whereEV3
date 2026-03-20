import { useEffect, useState } from 'react'
import { Dialog, DialogContent, IconButton, Typography, Box, CircularProgress } from '@mui/material'
import Close from '@mui/icons-material/Close'
import Refresh from '@mui/icons-material/Refresh'
import { appMobileType, motion, radius } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'
import { StationDetailContent } from './StationDetailContent.jsx'

/**
 * 데스크톱 전용: 충전소 상세 중앙 Dialog. 모바일은 App의 MobileBottomSheet(목록과 동일 detent)에 상세 본문을 넣는다.
 */
export function StationDetailModal({
  open,
  station,
  onClose,
  onRefresh,
  refreshLoading = false,
  headerSubtitle = '',
  chargerSummaryUpdatedInHeader = false,
}) {
  const { colors, tokens } = useEvTheme()
  const [chargerStatFilter, setChargerStatFilter] = useState(/** @type {'all' | '2' | '3' | '5'} */ ('all'))
  useEffect(() => {
    if (open && station) setChargerStatFilter('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- station?.id 의도적 제한
  }, [open, station?.id])

  if (!station) return null

  const refreshEnabled = typeof onRefresh === 'function'
  const subtitle =
    headerSubtitle ||
    (() => {
      const st = station.latestStatUpdDt || station.statUpdDt || ''
      return st ? `충전기 상태 기준 ${st}` : ''
    })()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: { sx: { bgcolor: tokens.overlay.scrim } },
        transition: {
          timeout: { enter: motion.duration.enter, exit: motion.duration.exit },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 1.25,
          borderBottom: `1px solid ${colors.gray[200]}`,
          bgcolor: tokens.bg.subtle,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ color: colors.gray[900], ...appMobileType.detailSheetTitle }}>
            {station.statNm}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.4, color: colors.gray[500], ...appMobileType.detailSheetSubtitle }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          <IconButton
            onClick={() => refreshEnabled && onRefresh?.()}
            disabled={!refreshEnabled || refreshLoading}
            aria-label={refreshEnabled ? '충전소 데이터 새로고침' : '새로고침을 사용할 수 없습니다'}
            title={refreshEnabled ? '목록 데이터 다시 불러오기' : 'API 키가 설정된 경우에만 새로고침할 수 있습니다'}
            size="small"
            sx={{ color: colors.gray[600] }}
          >
            {refreshLoading ? <CircularProgress size={20} thickness={5} sx={{ color: colors.blue.primary }} /> : <Refresh sx={{ fontSize: 22 }} />}
          </IconButton>
          <IconButton onClick={onClose} aria-label="닫기" size="small" sx={{ color: colors.gray[600] }}>
            <Close />
          </IconButton>
        </Box>
      </Box>
      <DialogContent sx={{ pt: 1.5, pb: 2, px: 2, borderRadius: `0 0 ${radius.sm}px ${radius.sm}px` }}>
        <StationDetailContent
          station={station}
          stackActions={false}
          chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
          chargerStatFilter={chargerStatFilter}
          onChargerStatFilterChange={setChargerStatFilter}
        />
      </DialogContent>
    </Dialog>
  )
}
