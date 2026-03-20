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

function buildDetailUi(colors, tokens) {
  const chipSx = {
    avail: {
      bgcolor: tokens.status.avail.chipBg,
      color: tokens.status.avail.fg,
      fontWeight: 700,
      border: `1px solid ${tokens.status.avail.border}`,
    },
    use: {
      bgcolor: tokens.status.use.chipBg,
      color: tokens.status.use.fg,
      fontWeight: 700,
      border: `1px solid ${tokens.status.use.border}`,
    },
    maint: {
      bgcolor: tokens.status.maint.chipBg,
      color: tokens.status.maint.fg,
      fontWeight: 700,
      border: `1px solid ${tokens.status.maint.border}`,
    },
  }
  const statFilterPalettes = {
    all: {
      idle: { border: `1px solid ${colors.gray[300]}`, bgcolor: tokens.bg.paper, color: colors.gray[700] },
      active: {
        border: `1px solid ${colors.blue.primary}`,
        bgcolor: tokens.blue.mutedStrong,
        color: colors.blue.deep,
        boxShadow: 'none',
      },
    },
    avail: {
      idle: {
        border: `1px solid ${tokens.status.avail.border}`,
        bgcolor: tokens.status.avail.rowBg,
        color: tokens.status.avail.fg,
      },
      active: {
        border: `1px solid ${tokens.status.avail.fg}`,
        bgcolor: tokens.status.avail.chipBg,
        color: tokens.status.avail.fg,
        boxShadow: 'none',
      },
    },
    use: {
      idle: {
        border: `1px solid ${tokens.status.use.border}`,
        bgcolor: tokens.status.use.rowBg,
        color: tokens.status.use.fg,
      },
      active: {
        border: `1px solid ${tokens.status.use.fg}`,
        bgcolor: tokens.status.use.chipBg,
        color: tokens.status.use.fg,
        boxShadow: 'none',
      },
    },
    maint: {
      idle: { border: `1px solid ${colors.gray[300]}`, bgcolor: tokens.bg.muted, color: colors.gray[600] },
      active: {
        border: `1px solid ${colors.gray[500]}`,
        bgcolor: tokens.status.maint.chipBg,
        color: tokens.text.primary,
        boxShadow: 'none',
      },
    },
  }
  return {
    colors,
    tokens,
    chipSx,
    statFilterPalettes,
    sectionBlockTitleSx: { color: colors.gray[900], display: 'block', mb: 1, ...appMobileType.sectionBlock },
    metaFieldLabelSx: { color: colors.gray[500], display: 'block', mb: 0.2, ...appMobileType.metaFieldLabel },
    metaBodySx: { color: colors.gray[600], ...appMobileType.body },
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
        fontWeight: selected ? 800 : 600,
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
  const { colors } = useStationDetailUi()
  const label = chargerFilterLabel(filter)
  const count = filter === 'all' ? totalChargers : filteredCount
  return (
    <Typography
      variant="caption"
      component="div"
      sx={{
        display: 'block',
        mb: 0.75,
        letterSpacing: '0.02em',
        ...appMobileType.railHeading,
      }}
    >
      <Box component="span" sx={{ fontWeight: 800, color: colors.gray[900] }}>
        충전기
      </Box>
      <Box component="span" sx={{ color: colors.gray[400], fontWeight: 500, mx: 0.45 }}>
        ·
      </Box>
      <Box component="span" sx={{ fontWeight: 700, color: colors.gray[700] }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontWeight: 600, color: colors.gray[500], ml: 0.35 }}>
        {count}대
      </Box>
    </Typography>
  )
}

function ChargerCard({ row, idx }) {
  const { colors, chipSx, tokens } = useStationDetailUi()
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

  const chipForStat = () => {
    if (stat === '2') return { label: '사용 가능', sx: chipSx.avail }
    if (stat === '3') return { label: '사용 중', sx: chipSx.use }
    if (stat === '5') return { label: '점검중', sx: chipSx.maint }
    return {
      label: getStatLabel(row.stat),
      sx: {
        bgcolor: tokens.status.unknown.chipBg,
        color: tokens.status.unknown.fg,
        fontWeight: 600,
        border: `1px solid ${tokens.status.unknown.border}`,
      },
    }
  }
  const chip = chipForStat()

  const cardBorder =
    stat === '2'
      ? tokens.status.avail.border
      : stat === '3'
        ? tokens.status.use.border
        : stat === '5'
          ? tokens.status.maint.border
          : colors.gray[200]
  const cardBg =
    stat === '2'
      ? tokens.status.avail.rowBg
      : stat === '3'
        ? tokens.status.use.rowBg
        : stat === '5'
          ? tokens.status.maint.rowBg
          : tokens.bg.paper

  const typeLabel = row.displayChgerLabel ?? row.chgerTyLabel ?? '—'

  return (
    <Box
      sx={{
        mb: 1,
        p: 1.25,
        borderRadius: `${radius.sm}px`,
        border: `1px solid ${cardBorder}`,
        bgcolor: cardBg,
        transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" sx={{ color: colors.gray[800], display: 'block', ...appMobileType.chargerCardTitle }}>
            {title}
          </Typography>
        </Box>
        <Chip
          label={chip.label}
          size="small"
          sx={{
            ...chip.sx,
            flexShrink: 0,
            height: appMobileType.statusChip.height,
            fontSize: appMobileType.statusChip.fontSize,
            fontWeight: appMobileType.statusChip.fontWeight,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      </Stack>

      <Box sx={{ mb: stat === '3' && (showChargeBar || timeLine) ? 1 : stat === '5' ? 0.75 : 0 }}>
        <Typography variant="body2" sx={{ color: colors.gray[700], ...appMobileType.body }}>
          타입 {typeLabel}
        </Typography>
        <Typography variant="body2" sx={{ color: colors.gray[700], ...appMobileType.body }}>
          출력 {outDisp || '—'}
        </Typography>
      </Box>

      {stat === '3' && showChargeBar && (
        <Box sx={{ mb: timeLine ? 0.75 : 0 }}>
          <Typography variant="body2" sx={{ color: colors.gray[800], mb: 0.5, ...appMobileType.bodyStrong }}>
            현재 {chargePair.current}% / 목표 {chargePair.target}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={chargePair.barValue}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: tokens.status.use.rowBg,
              '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: colors.blue.primary },
            }}
          />
          <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', mt: 0.35, ...appMobileType.captionDense }}>
            목표 충전량 대비 진행(시뮬레이션)
          </Typography>
        </Box>
      )}

      {stat === '3' && timeLine && (
        <Typography variant="body2" sx={{ color: colors.gray[800], ...appMobileType.bodyStrong }}>
          {timeLine}
        </Typography>
      )}

      {stat === '5' && (
        <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', ...appMobileType.secondary }}>
          점검으로 현재 이용할 수 없습니다.
        </Typography>
      )}
    </Box>
  )
}

const FOOTER_BTN_SX = {
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 48,
  maxHeight: 48,
  py: 0,
  px: { xs: 0.75, sm: 1.25 },
  borderRadius: `${radius.sm}px`,
  fontWeight: 700,
  fontSize: { xs: '0.8125rem', sm: '0.9375rem' },
  lineHeight: 1.2,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': {
    marginRight: { xs: 0.35, sm: 0.75 },
    marginLeft: 0,
    flexShrink: 0,
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
        pt: 1.25,
        pb: isSheet ? 'calc(10px + env(safe-area-inset-bottom, 0px))' : 1.5,
        bgcolor: tokens.bg.subtle,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        {telno ? (
          <Button
            variant="outlined"
            startIcon={<Phone sx={{ fontSize: { xs: 20, sm: 22 } }} />}
            href={`tel:${telno}`}
            aria-label="전화 걸기"
            sx={{
              ...FOOTER_BTN_SX,
              flex: '1 1 0',
              borderColor: tokens.border.strong,
              bgcolor: tokens.bg.paper,
              color: tokens.text.primary,
              transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
              '&:hover': {
                borderColor: tokens.border.default,
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
          startIcon={<Directions sx={{ fontSize: { xs: 20, sm: 22 } }} />}
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="충전소 위치 길찾기"
          sx={{
            ...FOOTER_BTN_SX,
            flex: telno ? '1 1 0' : '1 1 auto',
            bgcolor: colors.blue.primary,
            color: tokens.text.onPrimary,
            boxShadow: `0 1px 4px ${tokens.blue.glowSoft}`,
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
  const { colors, tokens } = useEvTheme()
  const ui = useMemo(() => buildDetailUi(colors, tokens), [colors, tokens])
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
        <Box sx={{ mb: 1.5 }}>
          {totalChargers > 0 && (
            <Box
              sx={
                stickyRail
                  ? {
                      position: 'sticky',
                      top: 0,
                      zIndex: 4,
                      bgcolor: 'transparent',
                      mx: -2,
                      px: 2,
                      pt: 0.25,
                      pb: 1,
                      mb: 0.5,
                      borderBottom: 'none',
                      boxShadow: 'none',
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
                  pb: 0.25,
                  pt: 0.125,
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
                  sx={{ color: colors.gray[400], display: 'block', mt: 0.5, mb: 0.125, ...appMobileType.captionDense }}
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
              color: colors.gray[400],
              display: 'block',
              mt: totalChargers > 0 ? 0.75 : 0,
              mb: 0,
              ...appMobileType.captionDense,
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}
          >
            * 충전기 상태 및 충전율 정보는 MVP용 시뮬레이션 데이터입니다.
          </Typography>

          <Box sx={{ mt: totalChargers > 0 ? 1 : 0 }}>
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
                pt: 0.25,
              }}
            >
              {filteredChargerRows.length === 0 ? (
                <Typography variant="body2" sx={{ color: colors.gray[500], py: 0.75, px: 0.125, ...appMobileType.secondary }}>
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
          pt: 1.5,
          mt: 0.5,
          borderTop: `1px dashed ${colors.gray[200]}`,
        }}
      >
        <Typography variant="subtitle2" component="h3" sx={ui.sectionBlockTitleSx}>
          장소 정보
        </Typography>
        <Box sx={{ mb: 1.25 }}>
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
        <Box sx={{ mb: 1.25 }}>
          <Typography variant="caption" component="p" sx={ui.metaFieldLabelSx}>
            이용시간
          </Typography>
          <Typography variant="body2" sx={ui.metaBodySx}>{station.useTm || '-'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 0.5 }}>
          <Typography variant="body2" sx={ui.metaBodySx}>
            <Box component="span" sx={{ color: colors.gray[500], fontWeight: 700, fontSize: 'inherit' }}>운영기관</Box>{' '}
            {station.busiNm}
          </Typography>
          {telno && (
            <Typography variant="body2" sx={ui.metaBodySx}>
              <Box component="span" sx={{ color: colors.gray[500], fontWeight: 700, fontSize: 'inherit' }}>전화</Box> {telno}
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
