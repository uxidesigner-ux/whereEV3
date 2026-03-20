import { Box, IconButton, Typography } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import SearchOff from '@mui/icons-material/SearchOff'
import InboxOutlined from '@mui/icons-material/InboxOutlined'
import { colors, motion, radius } from '../theme/dashboardTheme.js'
import { formatDistanceKm } from '../utils/geo.js'

const EMPTY_ICONS = {
  no_data: InboxOutlined,
  no_filter: SearchOff,
  no_in_view: MapOutlined,
}

/**
 * 모바일 시트용 충전소 목록.
 * 좌측: 지도에서 포커스만 / 우측: 상세 시트 진입.
 */
export function StationListMobile({
  stations = [],
  selectedId,
  onSelect,
  onOpenDetail,
  loadingBounds = false,
  loadingHint = '지도에 표시할 영역을 준비하는 중입니다.',
  emptyMessage,
  emptySubMessage,
  emptyVariant,
}) {
  if (loadingBounds) {
    return (
      <Box sx={{ py: 0.5 }}>
        <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', mb: 1, fontSize: '0.75rem', fontWeight: 600 }}>
          {loadingHint}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }} aria-busy="true" aria-label="목록 불러오는 중">
          {[1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              sx={{
                height: 52,
                borderRadius: 1,
                bgcolor: colors.gray[200],
                animation: 'ev-shimmer 1.1s ease-in-out infinite',
                animationDelay: `${i * 0.08}s`,
                '@keyframes ev-shimmer': {
                  '0%, 100%': { opacity: 0.55 },
                  '50%': { opacity: 0.9 },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    )
  }

  if (!stations.length) {
    const IconCmp = (emptyVariant && EMPTY_ICONS[emptyVariant]) || MapOutlined
    return (
      <Box sx={{ py: 2.5, px: 1, textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: `${radius.sm}px`,
            bgcolor: colors.gray[100],
            border: `1px solid ${colors.gray[200]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1.25,
            color: colors.gray[500],
          }}
          aria-hidden
        >
          <IconCmp sx={{ fontSize: 26 }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.875rem', color: colors.gray[800] }}>
          {emptyMessage ?? '조건에 맞는 충전소가 없습니다.'}
        </Typography>
        {emptySubMessage && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontSize: '0.75rem', lineHeight: 1.5, color: colors.gray[600], maxWidth: 280, mx: 'auto' }}>
            {emptySubMessage}
          </Typography>
        )}
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
      {stations.map((s) => {
        const isSelected = selectedId != null && s.id === selectedId
        return (
          <Box
            key={s.id}
            data-ev-station-id={s.id}
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: 1,
              border: `1px solid ${isSelected ? colors.blue.primary : colors.gray[200]}`,
              bgcolor: isSelected ? colors.blue.muted : colors.gray[50],
              overflow: 'hidden',
              transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
            }}
          >
            <Box
              component="button"
              type="button"
              aria-pressed={isSelected}
              aria-label={`${s.statNm}, 지도에서 보기`}
              onClick={() => onSelect(s)}
              sx={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                p: 1,
                minHeight: 56,
                border: 'none',
                bgcolor: 'transparent',
                cursor: 'pointer',
                borderRadius: 0,
                WebkitTapHighlightColor: 'transparent',
                transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, transform 0.12s ease`,
                display: 'flex',
                gap: 0.75,
                alignItems: 'flex-start',
                '&:hover': { bgcolor: isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)' },
                '&:active': { bgcolor: colors.gray[100], transform: 'scale(0.997)' },
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: `${radius.sm}px`,
                  bgcolor: isSelected ? 'rgba(37,99,235,0.15)' : colors.gray[100],
                  border: `1px solid ${isSelected ? colors.blue.primary : colors.gray[200]}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSelected ? colors.blue.primary : colors.gray[600],
                  mt: 0.125,
                }}
                aria-hidden
              >
                <MapOutlined sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.02em', display: 'block', mb: 0.125 }}>
                  지도에서 보기
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.875rem', color: colors.gray[800], lineHeight: 1.3 }}>
                  {s.statNm}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.gray[600], fontSize: '0.75rem', display: 'block', mt: 0.25 }}>
                  {s.busiNm} · {s.chgerTyLabel}
                </Typography>
                {(s.totalChargers != null && s.totalChargers > 0) && (
                  <Typography variant="caption" sx={{ color: colors.gray[600], fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                    총 {s.totalChargers}대{s.statSummary ? ` · ${s.statSummary}` : ''}
                  </Typography>
                )}
                {s.distanceKm != null && (
                  <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.7rem', display: 'block', mt: 0.125 }}>
                    {formatDistanceKm(s.distanceKm)}
                  </Typography>
                )}
              </Box>
            </Box>
            {onOpenDetail && (
              <Box
                component="button"
                type="button"
                aria-label={`${s.statNm} 상세 정보 열기`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenDetail(s)
                }}
                sx={{
                  flexShrink: 0,
                  width: 56,
                  minWidth: 56,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  border: 'none',
                  borderLeft: `1px solid ${colors.gray[200]}`,
                  bgcolor: colors.white,
                  cursor: 'pointer',
                  color: colors.gray[700],
                  WebkitTapHighlightColor: 'transparent',
                  transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, transform 0.12s ease`,
                  '&:hover': { bgcolor: colors.gray[50], color: colors.gray[900] },
                  '&:active': { bgcolor: colors.gray[100], transform: 'scale(0.97)' },
                }}
              >
                <InfoOutlined sx={{ fontSize: 22, color: colors.blue.primary }} />
                <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: colors.gray[700], lineHeight: 1 }}>
                  상세
                </Typography>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
