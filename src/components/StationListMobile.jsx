import { Box, Button, Chip, Typography } from '@mui/material'
import MapOutlined from '@mui/icons-material/MapOutlined'
import SearchOff from '@mui/icons-material/SearchOff'
import InboxOutlined from '@mui/icons-material/InboxOutlined'
import { appMobileType, colors, motion, radius } from '../theme/dashboardTheme.js'
import { formatDistanceKm } from '../utils/geo.js'

const EMPTY_ICONS = {
  no_data: InboxOutlined,
  no_filter: SearchOff,
  no_in_view: MapOutlined,
}

/**
 * 모바일 시트: 지도 검색 결과 리스트(리스트 아이템 밀도, 상세 패널 아님).
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
        <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', mb: 1, ...appMobileType.secondary, fontWeight: 600 }}>
          {loadingHint}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }} aria-busy="true" aria-label="목록 불러오는 중">
          {[1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              sx={{
                height: 44,
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
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, color: colors.gray[800], ...appMobileType.bodyStrong }}>
          {emptyMessage ?? '조건에 맞는 충전소가 없습니다.'}
        </Typography>
        {emptySubMessage && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.75, color: colors.gray[600], maxWidth: 280, mx: 'auto', ...appMobileType.secondary, lineHeight: 1.5 }}
          >
            {emptySubMessage}
          </Typography>
        )}
      </Box>
    )
  }

  const textActionSx = {
    minWidth: 0,
    minHeight: 32,
    py: 0.25,
    px: 0.75,
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'none',
    borderRadius: `${radius.xs}px`,
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
      {stations.map((s) => {
        const isSelected = selectedId != null && s.id === selectedId
        const distLabel = formatDistanceKm(s.distanceKm)
        const speedBadge = s.speedBadge ?? null
        const locationHint = s.locationHint ?? ''
        return (
          <Box
            key={s.id}
            data-ev-station-id={s.id}
            sx={{
              borderRadius: `${radius.xs}px`,
              border: `1px solid ${isSelected ? 'rgba(37,99,235,0.22)' : 'rgba(0,0,0,0.06)'}`,
              bgcolor: isSelected ? 'rgba(37,99,235,0.04)' : 'transparent',
              px: 1,
              pt: 0.65,
              pb: 0.45,
              transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.2 }}>
              <Typography
                variant="subtitle1"
                component="div"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.3,
                  ...appMobileType.listSheetTitle,
                  flex: 1,
                  minWidth: 0,
                  color: isSelected ? colors.blue.deep : colors.gray[900],
                }}
              >
                {s.statNm}
              </Typography>
              {distLabel && (
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    flexShrink: 0,
                    fontWeight: 700,
                    color: isSelected ? colors.blue.primary : colors.gray[600],
                    ...appMobileType.bodyStrong,
                    fontSize: { xs: '0.8125rem', md: '0.875rem' },
                  }}
                >
                  {distLabel}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.4, mb: locationHint ? 0.2 : 0 }}>
              <Typography variant="body2" sx={{ color: colors.gray[600], ...appMobileType.body, fontSize: '0.8125rem', minWidth: 0 }}>
                {s.busiNm || '—'}
              </Typography>
              {speedBadge && (
                <Chip
                  label={speedBadge}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(0,0,0,0.04)',
                    color: colors.gray[600],
                    border: 'none',
                    '& .MuiChip-label': { px: 0.5, py: 0 },
                  }}
                />
              )}
            </Box>

            {locationHint ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: colors.gray[500],
                  fontSize: '0.6875rem',
                  lineHeight: 1.35,
                  mb: 0.15,
                }}
              >
                {locationHint}
              </Typography>
            ) : null}

            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, mt: 0.15 }}>
              <Button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${s.statNm}, 지도에서 보기`}
                variant="text"
                onClick={() => onSelect(s)}
                sx={{
                  ...textActionSx,
                  color: colors.gray[700],
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                }}
              >
                지도
              </Button>
              {onOpenDetail ? (
                <>
                  <Typography component="span" sx={{ color: colors.gray[300], fontSize: '0.65rem', userSelect: 'none', px: 0.125 }} aria-hidden>
                    |
                  </Typography>
                  <Button
                    type="button"
                    aria-label={`${s.statNm} 상세`}
                    variant="text"
                    onClick={() => onOpenDetail(s)}
                    sx={{
                      ...textActionSx,
                      color: colors.blue.primary,
                      '&:hover': { bgcolor: 'rgba(37,99,235,0.06)' },
                    }}
                  >
                    상세
                  </Button>
                </>
              ) : null}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
