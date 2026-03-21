import { useEffect, useMemo, createContext, useContext } from 'react'
import { Typography, Box, Button, Chip, Stack, LinearProgress } from '@mui/material'
import Directions from '@mui/icons-material/Directions'
import Phone from '@mui/icons-material/Phone'
import { appMobileType, radius, motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'
import {
  formatAddressBlockLines,
  formatChargerExplicitTime,
  getStatLabel,
  parseExplicitChargePercentPair,
} from '../api/safemapEv.js'
import { getChargerSessionForUi } from '../data/chargerSessionMvp.js'

function chargerRowsFromStation(station) {
  if (!station) return []
  if (Array.isArray(station.rows) && station.rows.length) {
    return [...station.rows].sort((a, b) =>
      String(a.chgerId ?? a.id ?? '').localeCompare(String(b.chgerId ?? b.id ?? ''), 'ko', { numeric: true })
    )
  }
  return [station]
}

/** @typedef {ReturnType<typeof buildDetailUi>} StationDetailUiValue */

const StationDetailUiContext = /** @type {import('react').Context<StationDetailUiValue | null>} */ (createContext(null))

function buildDetailUi(colors, tokens, resolvedMode) {
  const chipSx = {
    avail: {
      bgcolor: tokens.status.avail.chipBg,
      color: tokens.status.avail.fg,
      fontWeight: 600,
      border: `1px solid ${tokens.status.avail.border}`,
    },
    use: {
      bgcolor: tokens.status.use.chipBg,
      color: tokens.status.use.fg,
      fontWeight: 600,
      border: `1px solid ${tokens.status.use.border}`,
    },
    maint: {
      bgcolor: tokens.status.maint.chipBg,
      color: tokens.status.maint.fg,
      fontWeight: 600,
      border: `1px solid ${tokens.status.maint.border}`,
    },
  }
  const statFilterPalettes = {
    all: {
      idle: {
        border: `1px solid ${tokens.border.default}`,
        bgcolor: tokens.bg.chipIdle,
        color: colors.gray[700],
      },
      active: {
        border: `1px solid ${colors.blue.primary}`,
        bgcolor: tokens.blue.mutedStrong,
        color: colors.blue.deep,
        boxShadow: 'none',
      },
    },
    avail: {
      idle: {
        border: `1px solid ${tokens.border.default}`,
        bgcolor: tokens.bg.chipIdle,
        color: colors.gray[700],
      },
      active: {
        border: `1px solid ${tokens.status.avail.border}`,
        bgcolor: tokens.status.avail.chipBg,
        color: tokens.status.avail.fg,
        boxShadow: 'none',
      },
    },
    use: {
      idle: {
        border: `1px solid ${tokens.border.default}`,
        bgcolor: tokens.bg.chipIdle,
        color: colors.gray[700],
      },
      active: {
        border: `1px solid ${tokens.status.use.border}`,
        bgcolor: tokens.status.use.chipBg,
        color: tokens.status.use.fg,
        boxShadow: 'none',
      },
    },
    maint: {
      idle: {
        border: `1px solid ${tokens.border.default}`,
        bgcolor: tokens.bg.chipIdle,
        color: colors.gray[600],
      },
      active: {
        border: `1px solid ${tokens.border.strong}`,
        bgcolor: tokens.status.maint.chipBg,
        color: tokens.text.primary,
        boxShadow: 'none',
      },
    },
  }
  /** 충전기 카드: 거의 화이트·소프트 섀도(라) / 레이어 분리(다) */
  const chargerCard =
    resolvedMode === 'dark'
      ? {
          bgcolor: tokens.bg.raised,
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.05) inset, 0 2px 8px rgba(0,0,0,0.35), 0 12px 32px rgba(0,0,0,0.28)',
        }
      : {
          bgcolor: tokens.bg.subtle,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 20px rgba(15, 23, 42, 0.055)',
        }

  return {
    colors,
    tokens,
    resolvedMode,
    chipSx,
    statFilterPalettes,
    chargerCard,
    sectionBlockTitleSx: {
      color: tokens.text.primary,
      display: 'block',
      mb: 1.25,
      ...appMobileType.sectionBlock,
    },
    metaFieldLabelSx: {
      color: tokens.text.tertiary,
      display: 'block',
      mb: 0.35,
      ...appMobileType.metaFieldLabel,
    },
    metaBodySx: { color: tokens.text.secondary, ...appMobileType.body },
  }
}

function useStationDetailUi() {
  const ctx = useContext(StationDetailUiContext)
  if (!ctx) throw new Error('useStationDetailUi는 StationDetailContent 내부에서만 사용')
  return ctx
}

/** 앱형 가로 레일용 pill 칩 (높이 36~40px, 한 줄 스크롤) */
function StatFilterChip({ label, selected, disabled, onClick, paletteKey }) {
  const { statFilterPalettes } = useStationDetailUi()
  const pal = statFilterPalettes[paletteKey]
  const tone = selected ? pal.active : pal.idle
  return (
    <Chip
      label={label}
      size="medium"
      clickable={!disabled}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={{
        flexShrink: 0,
        height: appMobileType.chipRail.height,
        borderRadius: 999,
        fontSize: appMobileType.chipRail.fontSize,
        fontWeight: selected ? 700 : 500,
        letterSpacing: selected ? '0.01em' : '0.005em',
        transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}`,
        '& .MuiChip-label': { px: 1.4, py: 0.125 },
        ...tone,
        ...(disabled
          ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', boxShadow: 'none' }
          : {}),
      }}
    />
  )
}

function chargerFilterLabel(filter) {
  if (filter === '2') return '사용 가능'
  if (filter === '3') return '사용 중'
  if (filter === '5') return '점검중'
  return '전체'
}

/** 필터 선택과 리스트를 한 문장으로 연결 */
function ChargerListHeading({ filter, totalChargers, filteredCount }) {
  const { tokens } = useStationDetailUi()
  const label = chargerFilterLabel(filter)
  const count = filter === 'all' ? totalChargers : filteredCount
  return (
    <Typography
      variant="caption"
      component="div"
      sx={{
        display: 'block',
        mb: 1,
        letterSpacing: '0.02em',
        ...appMobileType.railHeading,
      }}
    >
      <Box component="span" sx={{ fontWeight: 700, color: tokens.text.primary }}>
        충전기
      </Box>
      <Box component="span" sx={{ color: tokens.text.muted, fontWeight: 500, mx: 0.45 }}>
        ·
      </Box>
      <Box component="span" sx={{ fontWeight: 600, color: tokens.text.secondary }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontWeight: 500, color: tokens.text.tertiary, ml: 0.35 }}>
        {count}대
      </Box>
    </Typography>
  )
}

function ChargerCard({ row, idx }) {
  const { colors, chipSx, tokens, chargerCard, resolvedMode } = useStationDetailUi()
  const stat = String(row.stat ?? '').trim()
  const title = (row.chgerNm || '').trim() || `충전기 ${(row.chgerId || '').toString().trim() || idx + 1}`
  const outRaw = (row.outputKw || '').toString().trim()
  const outDisp = outRaw && !/k\s*w/i.test(outRaw) ? `${outRaw} kW` : outRaw
  /** 세션(진행·잔여시간)은 공공 row와 분리 — stat=3일 때만 목업/향후 API */
  const session = stat === '3' ? getChargerSessionForUi(row) : null
  const timeLine =
    session != null
      ? formatChargerExplicitTime({ stat: '3', remainingMinutesRaw: session.remainingMinutesRaw, expectedEndAt: session.expectedEndAt })
      : null
  const chargePair = session != null ? parseExplicitChargePercentPair(session) : null
  const showChargeBar = chargePair != null
  const showSessionPanel = stat === '3' && (showChargeBar || timeLine)

  const chipForStat = () => {
    if (stat === '2') return { label: '사용 가능', sx: chipSx.avail }
    if (stat === '3') return { label: '사용 중', sx: chipSx.use }
    if (stat === '5') return { label: '점검중', sx: chipSx.maint }
    return {
      label: getStatLabel(row.stat),
      sx: {
        bgcolor: tokens.status.unknown.chipBg,
        color: tokens.status.unknown.fg,
        fontWeight: 500,
        border: `1px solid ${tokens.status.unknown.border}`,
      },
    }
  }
  const chip = chipForStat()

  const typeLabel = row.displayChgerLabel ?? row.chgerTyLabel ?? '—'

  const isDark = resolvedMode === 'dark'
  const moduleBorder = isDark ? 'rgba(255,255,255,0.09)' : tokens.border.default
  const moduleBg = isDark ? tokens.bg.subtle : tokens.bg.paper

  const statCellLabelSx = {
    display: 'block',
    mb: 0.45,
    fontSize: '0.625rem',
    fontWeight: 500,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: tokens.text.muted,
    lineHeight: 1.2,
  }
  const infoCellShellSx = {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    p: 0.875,
    borderRadius: `${radius.md}px`,
    border: `1px solid ${moduleBorder}`,
    bgcolor: moduleBg,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  }
  const valueChipBase = {
    display: 'block',
    width: '100%',
    mt: 'auto',
    px: 0.65,
    py: 0.45,
    borderRadius: `${radius.sm}px`,
    bgcolor: isDark ? 'rgba(0,0,0,0.22)' : tokens.bg.subtle,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : tokens.border.subtle}`,
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.38,
    color: tokens.text.primary,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'center',
  }
  const valueChipSx = {
    ...valueChipBase,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const valueChipMultilineSx = {
    ...valueChipBase,
    whiteSpace: 'normal',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  }
  const statusValueSx = {
    ...valueChipBase,
    bgcolor: chip.sx.bgcolor,
    color: chip.sx.color,
    border: chip.sx.border,
    fontWeight: chip.sx.fontWeight ?? 600,
    fontSize: '0.75rem',
    letterSpacing: '0.008em',
    whiteSpace: 'normal',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  }

  const headerChipSx = {
    ...chip.sx,
    flexShrink: 0,
    height: 24,
    borderRadius: `${radius.control}px`,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    maxWidth: 'min(46%, 140px)',
    '& .MuiChip-label': { px: 1, py: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  }

  const sessionInsetSx = {
    mt: 1.25,
    p: 1.125,
    borderRadius: `${radius.md}px`,
    bgcolor: isDark ? tokens.bg.subtle : tokens.bg.muted,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : tokens.border.subtle}`,
    boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 2px rgba(15,23,42,0.04)',
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: 1.625,
        borderRadius: `${radius.md}px`,
        border: 'none',
        bgcolor: chargerCard.bgcolor,
        boxShadow: chargerCard.boxShadow,
        transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.125,
          minHeight: 28,
        }}
      >
        <Typography
          variant="subtitle2"
          component="h3"
          title={title}
          sx={{
            flex: 1,
            minWidth: 0,
            color: tokens.text.primary,
            fontSize: '0.9375rem',
            lineHeight: 1.3,
            fontWeight: 600,
            letterSpacing: '-0.018em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
        <Chip label={chip.label} size="small" sx={headerChipSx} />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0.625,
        }}
      >
        <Box sx={infoCellShellSx}>
          <Typography component="span" sx={statCellLabelSx}>
            커넥터
          </Typography>
          <Typography component="span" sx={valueChipMultilineSx} title={String(typeLabel)}>
            {typeLabel}
          </Typography>
        </Box>
        <Box sx={infoCellShellSx}>
          <Typography component="span" sx={statCellLabelSx}>
            출력
          </Typography>
          <Typography component="span" sx={valueChipSx}>
            {outDisp || '—'}
          </Typography>
        </Box>
        <Box sx={infoCellShellSx}>
          <Typography component="span" sx={statCellLabelSx}>
            상태
          </Typography>
          <Typography component="span" sx={statusValueSx}>
            {chip.label}
          </Typography>
        </Box>
      </Box>

      {showSessionPanel ? (
        <Box sx={sessionInsetSx}>
          {showChargeBar ? (
            <>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.75,
                  color: tokens.text.tertiary,
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                충전 진행
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  columnGap: 0.75,
                  mb: 1,
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    color: tokens.text.primary,
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {chargePair.current}%
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: tokens.text.secondary,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  / 목표 {chargePair.target}%
                </Typography>
              </Box>
              <LinearProgress
                className="ev-charger-session-progress"
                variant="determinate"
                value={chargePair.barValue}
                sx={{
                  height: 7,
                  borderRadius: 999,
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : tokens.blue.muted,
                  overflow: 'hidden',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${colors.blue.deep} 0%, ${colors.blue.primary} 55%, ${colors.blue.light} 100%)`,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  color: tokens.text.muted,
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                목표 충전량 대비 진행(시뮬레이션)
              </Typography>
            </>
          ) : null}
          {timeLine ? (
            <Box sx={{ mt: showChargeBar ? 1 : 0 }}>
              <Typography
                variant="caption"
                component="div"
                sx={{
                  color: tokens.text.tertiary,
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  mb: 0.35,
                }}
              >
                남은 시간 · 완료 예상
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: tokens.text.primary,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {timeLine}
              </Typography>
            </Box>
          ) : null}
        </Box>
      ) : null}

      {stat === '5' && (
        <Typography
          variant="caption"
          sx={{
            color: tokens.text.muted,
            display: 'block',
            mt: 1.125,
            pt: 1,
            borderTop: `1px solid ${tokens.border.subtle}`,
            fontSize: '0.75rem',
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          점검으로 현재 이용할 수 없습니다.
        </Typography>
      )}
    </Box>
  )
}

const FOOTER_BTN_SX = {
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 46,
  maxHeight: 46,
  py: 0,
  px: { xs: 1, sm: 1.25 },
  borderRadius: 999,
  fontWeight: 600,
  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
  lineHeight: 1.2,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': {
    marginRight: { xs: 0.4, sm: 0.65 },
    marginLeft: 0,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
  },
}

/**
 * 하단 길찾기·전화 CTA (모바일 시트에서는 스크롤 밖에 두기 위해 분리).
 * @param {'dialog' | 'sheet'} variant — dialog: 본문 패딩 상쇄용 가로 bleed, sheet: 패딩 없음
 */
export function StationDetailFooterActions({ station, variant = 'dialog' }) {
  const { colors, tokens } = useEvTheme()
  if (!station) return null
  const telno = station.telno?.trim() || ''
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`
  const isSheet = variant === 'sheet'
  const footerBleed = variant === 'dialog' ? { mx: -2, px: 2 } : {}

  return (
    <Box
      sx={{
        ...footerBleed,
        pt: isSheet ? 0 : 1.25,
        pb: isSheet ? 'calc(4px + env(safe-area-inset-bottom, 0px))' : 1.5,
        bgcolor: isSheet ? 'transparent' : tokens.bg.subtle,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: { xs: 0.875, sm: 1.125 },
        }}
      >
        {telno ? (
          <Button
            variant="outlined"
            startIcon={<Phone sx={{ fontSize: 20 }} />}
            href={`tel:${telno}`}
            aria-label="전화 걸기"
            sx={{
              ...FOOTER_BTN_SX,
              flex: '1 1 0',
              borderColor: tokens.border.default,
              bgcolor: tokens.bg.subtle,
              color: tokens.text.primary,
              fontWeight: 600,
              boxShadow: 'none',
              transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
              '&:hover': {
                borderColor: tokens.border.strong,
                bgcolor: tokens.bg.muted,
              },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            전화
          </Button>
        ) : null}
        <Button
          variant="contained"
          startIcon={<Directions sx={{ fontSize: 20 }} />}
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="충전소 위치 길찾기"
            sx={{
            ...FOOTER_BTN_SX,
            flex: telno ? '1 1 0' : '1 1 auto',
            bgcolor: colors.blue.primary,
            color: tokens.text.onPrimary,
            fontWeight: 600,
            boxShadow: `0 1px 2px rgba(0,0,0,0.06)`,
            transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
            '&:hover': { bgcolor: colors.blue.deep, boxShadow: `0 2px 10px ${tokens.blue.glowSoft}` },
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          충전소 위치 길찾기
        </Button>
      </Box>
    </Box>
  )
}

/**
 * 충전소 상세 본문(데스크톱 Dialog / 모바일 시트 공용).
 * station: 그룹(rows, totalChargers, …) 또는 단일 row.
 * @param {boolean} [chargerSummaryUpdatedInHeader] — true면 필터 블록 하단의 상태 갱신 문구 숨김(헤더에 표시될 때).
 * @param {'all'|'2'|'3'|'5'} [chargerStatFilter]
 * @param {(v: 'all'|'2'|'3'|'5') => void} [onChargerStatFilterChange]
 * @param {boolean} [detachedFooter] — true면 하단 길찾기·전화 CTA는 렌더하지 않음(시트 footer에서 별도 렌더).
 */
export function StationDetailContent({
  station,
  stackActions = false,
  detachedFooter = false,
  chargerSummaryUpdatedInHeader = false,
  chargerStatFilter = 'all',
  onChargerStatFilterChange,
}) {
  const { colors, tokens, resolvedMode } = useEvTheme()
  const ui = useMemo(() => buildDetailUi(colors, tokens, resolvedMode), [colors, tokens, resolvedMode])
  const chargerRows = useMemo(() => chargerRowsFromStation(station), [station])
  const totalChargers = station?.totalChargers ?? chargerRows.length
  const statCounts =
    station?.statCounts ??
    (station != null && station.stat != null && station.stat !== ''
      ? { [String(station.stat)]: 1 }
      : {})
  const latestStatUpdDt = station ? (station.latestStatUpdDt ?? (station.statUpdDt || '')) : ''

  const cAvail = statCounts['2'] ?? 0
  const cUse = statCounts['3'] ?? 0
  const cMaint = statCounts['5'] ?? 0

  const setStatFilter = onChargerStatFilterChange ?? (() => {})

  const filteredChargerRows = useMemo(() => {
    if (chargerStatFilter === 'all') return chargerRows
    return chargerRows.filter((r) => String(r.stat ?? '').trim() === chargerStatFilter)
  }, [chargerRows, chargerStatFilter])

  /** 새로고침 등으로 해당 상태 대수가 0이 되면 필터가 고립되지 않게 전체로 복귀 */
  useEffect(() => {
    if (!station || !onChargerStatFilterChange || chargerStatFilter === 'all') return
    const n = chargerStatFilter === '2' ? cAvail : chargerStatFilter === '3' ? cUse : cMaint
    if (n === 0) onChargerStatFilterChange('all')
  }, [station, chargerStatFilter, cAvail, cUse, cMaint, onChargerStatFilterChange])

  if (!station) return null

  const telno = station.telno?.trim() || ''
  const addressLines = formatAddressBlockLines(station)
  const addressDisplay = addressLines.length ? addressLines.join('\n') : null

  /** 모바일 시트: 필터 레일을 스크롤 상단에 붙임 */
  const stickyRail = stackActions

  return (
    <StationDetailUiContext.Provider value={ui}>
    <>
      {chargerRows.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {totalChargers > 0 && (
            <Box
              sx={
                stickyRail
                  ? {
                      position: 'sticky',
                      top: 0,
                      zIndex: 4,
                      bgcolor: tokens.bg.paper,
                      mx: -2,
                      px: 2,
                      pt: 0,
                      pb: 0,
                      mb: 0,
                      borderBottom: `1px solid ${tokens.border.subtle}`,
                      boxShadow: `0 6px 12px -8px ${resolvedMode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.08)'}`,
                    }
                  : {}
              }
            >
              <Box
                role="tablist"
                aria-label="충전기 상태 필터"
                sx={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: 0.625,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  py: 0.75,
                  ...(stickyRail ? {} : { mx: -2, px: 2 }),
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                <StatFilterChip
                  label={`전체 ${totalChargers}`}
                  paletteKey="all"
                  selected={chargerStatFilter === 'all'}
                  disabled={totalChargers === 0}
                  onClick={() => setStatFilter('all')}
                />
                <StatFilterChip
                  label={`사용 가능 ${cAvail}`}
                  paletteKey="avail"
                  selected={chargerStatFilter === '2'}
                  disabled={cAvail === 0}
                  onClick={() => setStatFilter('2')}
                />
                <StatFilterChip
                  label={`사용 중 ${cUse}`}
                  paletteKey="use"
                  selected={chargerStatFilter === '3'}
                  disabled={cUse === 0}
                  onClick={() => setStatFilter('3')}
                />
                <StatFilterChip
                  label={`점검중 ${cMaint}`}
                  paletteKey="maint"
                  selected={chargerStatFilter === '5'}
                  disabled={cMaint === 0}
                  onClick={() => setStatFilter('5')}
                />
              </Box>
              {!chargerSummaryUpdatedInHeader && latestStatUpdDt && (
                <Typography
                  variant="caption"
                  sx={{ color: tokens.text.tertiary, display: 'block', mt: 0.5, mb: 0.125, ...appMobileType.captionDense }}
                >
                  상태 갱신 {latestStatUpdDt}
                </Typography>
              )}
            </Box>
          )}

          <Typography
            variant="caption"
            component="p"
            sx={{
              color: tokens.text.tertiary,
              display: 'block',
              mt: totalChargers > 0 ? 1 : 0,
              mb: 0,
              ...appMobileType.captionDense,
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}
          >
            * 충전기 상태 및 충전율 정보는 MVP용 시뮬레이션 데이터입니다.
          </Typography>

          <Box sx={{ mt: totalChargers > 0 ? 1.25 : 0 }}>
            <ChargerListHeading
              filter={chargerStatFilter}
              totalChargers={totalChargers}
              filteredCount={filteredChargerRows.length}
            />
            <Box
              sx={{
                ...(stackActions
                  ? {}
                  : {
                      maxHeight: 240,
                      overflow: 'auto',
                      WebkitOverflowScrolling: 'touch',
                    }),
                pr: 0.25,
                pt: 0.5,
              }}
            >
              {filteredChargerRows.length === 0 ? (
                <Typography variant="body2" sx={{ color: tokens.text.tertiary, py: 0.75, px: 0.125, ...appMobileType.secondary }}>
                  이 상태의 충전기가 없습니다.
                </Typography>
              ) : (
                filteredChargerRows.map((row, idx) => (
                  <ChargerCard key={row.id ?? `${row.chgerId ?? idx}-${idx}`} row={row} idx={idx} />
                ))
              )}
            </Box>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          mb: 0,
          pt: 2,
          mt: 1.5,
          borderTop: `1px solid ${tokens.border.subtle}`,
        }}
      >
        <Typography variant="subtitle2" component="h3" sx={ui.sectionBlockTitleSx}>
          장소 정보
        </Typography>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" component="p" sx={ui.metaFieldLabelSx}>
            주소
          </Typography>
          <Typography
            variant="body2"
            sx={{
              ...ui.metaBodySx,
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
            }}
          >
            {addressDisplay || '등록된 주소가 없습니다. 원본 API에 주소 필드가 없을 수 있습니다.'}
          </Typography>
        </Box>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" component="p" sx={ui.metaFieldLabelSx}>
            이용시간
          </Typography>
          <Typography variant="body2" sx={ui.metaBodySx}>{station.useTm || '-'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 0.5 }}>
          <Typography variant="body2" sx={ui.metaBodySx}>
            <Box component="span" sx={{ color: tokens.text.tertiary, fontWeight: 700, fontSize: 'inherit' }}>운영기관</Box>{' '}
            {station.busiNm}
          </Typography>
          {telno && (
            <Typography variant="body2" sx={ui.metaBodySx}>
              <Box component="span" sx={{ color: tokens.text.tertiary, fontWeight: 700, fontSize: 'inherit' }}>전화</Box> {telno}
            </Typography>
          )}
        </Box>
      </Box>

      {!detachedFooter ? (
        <Box sx={{ mt: 2 }}>
          <StationDetailFooterActions station={station} variant="dialog" />
        </Box>
      ) : null}
    </>
    </StationDetailUiContext.Provider>
  )
}
