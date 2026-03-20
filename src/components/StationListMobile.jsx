import { Box, Button, Chip, Typography } from '@mui/material'
import Directions from '@mui/icons-material/Directions'
import Phone from '@mui/icons-material/Phone'
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

const CARD_PAD = '17px'

/**
 * 모바일 시트: 지도 검색 결과 리스트(앱형 검색 결과 카드).
 * 카드 탭 → 상세, 하단 → 길찾기 / 전화.
 */
export function StationListMobile({
  stations = [],
  selectedId,
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

  const openDetail = (s) => {
    if (typeof onOpenDetail === 'function') onOpenDetail(s)
  }

  const stop = (e) => {
    e.stopPropagation()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {stations.map((s) => {
        const isSelected = selectedId != null && s.id === selectedId
        const distLabel = formatDistanceKm(s.distanceKm)
        const speedBadge = s.speedBadge ?? null
        const locationHint = s.locationHint ?? ''
        const tel = (s.telno || '').trim()
        const mapsHref =
          s.lat != null && s.lng != null
            ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
            : null

        return (
          <Box
            key={s.id}
            data-ev-station-id={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${s.statNm}, 상세 보기`}
            onClick={() => openDetail(s)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openDetail(s)
              }
            }}
            sx={{
              borderRadius: `${radius.md}px`,
              border: `1px solid ${
                isSelected ? 'rgba(37,99,235,0.2)' : 'rgba(15, 23, 42, 0.07)'
              }`,
              bgcolor: isSelected ? 'rgba(37,99,235,0.05)' : colors.white,
              px: CARD_PAD,
              py: CARD_PAD,
              cursor: 'pointer',
              textAlign: 'left',
              outline: 'none',
              transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
              boxShadow: isSelected ? '0 1px 8px rgba(37,99,235,0.08)' : '0 1px 2px rgba(15,23,42,0.04)',
              '&:focus-visible': {
                boxShadow: `0 0 0 2px ${colors.white}, 0 0 0 4px ${colors.blue.primary}`,
              },
            }}
          >
            {/* 1행: 충전소명 + 거리 */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25, mb: 1 }}>
              <Typography
                variant="subtitle1"
                component="div"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 800,
                  fontSize: '1.0625rem',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                  color: isSelected ? colors.blue.deep : colors.gray[900],
                }}
              >
                {s.statNm}
              </Typography>
              {distLabel ? (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    flexShrink: 0,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    lineHeight: 1.35,
                    color: isSelected ? colors.blue.primary : colors.gray[500],
                    pt: 0.125,
                  }}
                >
                  {distLabel}
                </Typography>
              ) : null}
            </Box>

            {/* 2행: 운영사 + 속도 */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: locationHint ? 0.75 : 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: colors.gray[600],
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  minWidth: 0,
                  lineHeight: 1.4,
                }}
              >
                {s.busiNm || '—'}
              </Typography>
              {speedBadge ? (
                <Chip
                  label={speedBadge}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    bgcolor: colors.gray[100],
                    color: colors.gray[700],
                    border: `1px solid ${colors.gray[200]}`,
                    '& .MuiChip-label': { px: 1, py: 0 },
                  }}
                />
              ) : null}
            </Box>

            {/* 3행: 위치 힌트 */}
            {locationHint ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: colors.gray[500],
                  fontSize: '0.75rem',
                  lineHeight: 1.45,
                  mb: 1.25,
                }}
              >
                {locationHint}
              </Typography>
            ) : null}

            {/* 4행: 길찾기 / 전화 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 1,
                pt: 1.25,
                mt: locationHint ? 0 : 0.25,
                borderTop: `1px solid ${colors.gray[100]}`,
              }}
              onClick={stop}
            >
              <Button
                component={mapsHref ? 'a' : 'button'}
                href={mapsHref || undefined}
                target={mapsHref ? '_blank' : undefined}
                rel={mapsHref ? 'noopener noreferrer' : undefined}
                disabled={!mapsHref}
                variant="outlined"
                size="medium"
                startIcon={<Directions sx={{ fontSize: 20 }} />}
                aria-label={`${s.statNm} 길찾기`}
                sx={{
                  flex: 1,
                  minHeight: 44,
                  py: 1,
                  px: 1,
                  borderRadius: `${radius.sm}px`,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  borderColor: colors.gray[200],
                  color: colors.gray[800],
                  bgcolor: colors.gray[50],
                  '&:hover': {
                    borderColor: colors.gray[300],
                    bgcolor: colors.white,
                  },
                }}
              >
                길찾기
              </Button>
              <Button
                component={tel ? 'a' : 'button'}
                href={tel ? `tel:${tel}` : undefined}
                disabled={!tel}
                variant="outlined"
                size="medium"
                startIcon={<Phone sx={{ fontSize: 20 }} />}
                aria-label={tel ? `${s.statNm} 전화` : '전화번호 없음'}
                sx={{
                  flex: 1,
                  minHeight: 44,
                  py: 1,
                  px: 1,
                  borderRadius: `${radius.sm}px`,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  borderColor: tel ? colors.gray[200] : colors.gray[200],
                  color: colors.gray[800],
                  bgcolor: colors.gray[50],
                  '&:hover': {
                    borderColor: colors.gray[300],
                    bgcolor: colors.white,
                  },
                }}
              >
                전화
              </Button>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
