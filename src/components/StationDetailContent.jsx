import { useEffect, useMemo } from 'react'
import { Typography, Box, Button, Chip, Stack, LinearProgress } from '@mui/material'
import Directions from '@mui/icons-material/Directions'
import Phone from '@mui/icons-material/Phone'
import { colors, radius, motion } from '../theme/dashboardTheme.js'
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

const chipSx = {
  avail: { bgcolor: 'rgba(22,163,74,0.14)', color: '#166534', fontWeight: 700, border: '1px solid rgba(22,163,74,0.35)' },
  use: { bgcolor: 'rgba(245,158,11,0.16)', color: '#b45309', fontWeight: 700, border: '1px solid rgba(217,119,6,0.4)' },
  maint: { bgcolor: colors.gray[200], color: colors.gray[600], fontWeight: 700, border: `1px solid ${colors.gray[300]}` },
}

/** 상태 필터 칩: 비선택 톤 + 선택 시 강조 */
const statFilterPalettes = {
  all: {
    idle: { border: `1px solid ${colors.gray[300]}`, bgcolor: colors.white, color: colors.gray[700] },
    active: {
      border: `2px solid ${colors.blue.primary}`,
      bgcolor: 'rgba(37,99,235,0.16)',
      color: colors.blue.deep,
      boxShadow: '0 1px 6px rgba(37,99,235,0.28), 0 0 0 1px rgba(37,99,235,0.2)',
    },
  },
  avail: {
    idle: { border: '1px solid rgba(22,163,74,0.35)', bgcolor: 'rgba(22,163,74,0.08)', color: '#166534' },
    active: {
      border: '2px solid #15803d',
      bgcolor: 'rgba(22,163,74,0.28)',
      color: '#14532d',
      boxShadow: '0 1px 6px rgba(22,163,74,0.28), 0 0 0 1px rgba(22,163,74,0.2)',
    },
  },
  use: {
    idle: { border: '1px solid rgba(217,119,6,0.45)', bgcolor: 'rgba(245,158,11,0.1)', color: '#b45309' },
    active: {
      border: '2px solid #c2410c',
      bgcolor: 'rgba(245,158,11,0.26)',
      color: '#9a3412',
      boxShadow: '0 1px 6px rgba(217,119,6,0.3), 0 0 0 1px rgba(217,119,6,0.22)',
    },
  },
  maint: {
    idle: { border: `1px solid ${colors.gray[300]}`, bgcolor: colors.gray[100], color: colors.gray[600] },
    active: {
      border: `2px solid ${colors.gray[500]}`,
      bgcolor: colors.gray[200],
      color: colors.gray[800],
      boxShadow: `0 1px 5px rgba(0,0,0,0.08), 0 0 0 1px ${colors.gray[300]}`,
    },
  },
}

/** 앱형 가로 레일용 pill 칩 (높이 36~40px, 한 줄 스크롤) */
function StatFilterChip({ label, selected, disabled, onClick, paletteKey }) {
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
        height: 38,
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: selected ? 800 : 600,
        letterSpacing: selected ? '0.01em' : '0.005em',
        transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, transform ${motion.duration.enter}ms ${motion.easing.standard}`,
        '& .MuiChip-label': { px: 1.35, py: 0 },
        ...tone,
        ...(selected && !disabled
          ? { transform: 'scale(1.02)', zIndex: 1 }
          : {}),
        ...(disabled
          ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', boxShadow: 'none', transform: 'none' }
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
  const label = chargerFilterLabel(filter)
  const count = filter === 'all' ? totalChargers : filteredCount
  return (
    <Typography
      variant="caption"
      component="div"
      sx={{
        display: 'block',
        mb: 0.625,
        fontSize: '0.72rem',
        lineHeight: 1.4,
        letterSpacing: '0.02em',
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
    return { label: getStatLabel(row.stat), sx: { bgcolor: colors.gray[100], color: colors.gray[800], fontWeight: 600, border: `1px solid ${colors.gray[250]}` } }
  }
  const chip = chipForStat()

  const cardBorder =
    stat === '2' ? 'rgba(22,163,74,0.22)' : stat === '3' ? 'rgba(245,158,11,0.28)' : stat === '5' ? colors.gray[250] : colors.gray[200]
  const cardBg =
    stat === '2' ? 'rgba(22,163,74,0.03)' : stat === '3' ? 'rgba(245,158,11,0.04)' : stat === '5' ? colors.gray[50] : colors.white

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
          <Typography variant="caption" sx={{ color: colors.gray[800], fontWeight: 800, fontSize: '0.75rem', display: 'block' }}>
            {title}
          </Typography>
        </Box>
        <Chip label={chip.label} size="small" sx={{ ...chip.sx, flexShrink: 0, height: 26, fontSize: '0.7rem' }} />
      </Stack>

      <Box sx={{ mb: stat === '3' && (showChargeBar || timeLine) ? 1 : stat === '5' ? 0.75 : 0 }}>
        <Typography variant="body2" sx={{ color: colors.gray[700], fontSize: '0.8125rem', lineHeight: 1.45 }}>
          타입 {typeLabel}
        </Typography>
        <Typography variant="body2" sx={{ color: colors.gray[700], fontSize: '0.8125rem', lineHeight: 1.45 }}>
          출력 {outDisp || '—'}
        </Typography>
      </Box>

      {stat === '3' && showChargeBar && (
        <Box sx={{ mb: timeLine ? 0.75 : 0 }}>
          <Typography variant="body2" sx={{ color: colors.gray[800], fontWeight: 600, fontSize: '0.8125rem', mb: 0.5 }}>
            현재 {chargePair.current}% / 목표 {chargePair.target}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={chargePair.barValue}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(245,158,11,0.2)',
              '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: colors.blue.primary },
            }}
          />
          <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.65rem', display: 'block', mt: 0.35 }}>
            목표 충전량 대비 진행 · MVP 세션 데이터
          </Typography>
        </Box>
      )}

      {stat === '3' && timeLine && (
        <Typography variant="body2" sx={{ color: colors.gray[800], fontWeight: 600, fontSize: '0.875rem' }}>
          {timeLine}
        </Typography>
      )}

      {stat === '5' && (
        <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.75rem', display: 'block' }}>
          점검으로 현재 이용할 수 없습니다.
        </Typography>
      )}
    </Box>
  )
}

const metaLabelSx = { color: colors.gray[400], fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.02em' }
const metaBodySx = { color: colors.gray[600], fontSize: '0.8125rem', lineHeight: 1.5 }

/**
 * 충전소 상세 본문(데스크톱 Dialog / 모바일 시트 공용).
 * station: 그룹(rows, totalChargers, …) 또는 단일 row.
 * @param {boolean} [chargerSummaryUpdatedInHeader] — true면 필터 블록 하단의 상태 갱신 문구 숨김(헤더에 표시될 때).
 * @param {'all'|'2'|'3'|'5'} [chargerStatFilter]
 * @param {(v: 'all'|'2'|'3'|'5') => void} [onChargerStatFilterChange]
 */
export function StationDetailContent({
  station,
  stackActions = false,
  chargerSummaryUpdatedInHeader = false,
  chargerStatFilter = 'all',
  onChargerStatFilterChange,
}) {
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
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`

  const addressLines = formatAddressBlockLines(station)
  const addressDisplay = addressLines.length ? addressLines.join('\n') : null

  /** 시트·다이얼로그 본문 px:2와 맞춰 하단 액션 영역만 가로 풀폭 톤 */
  const footerBleed = { mx: -2, px: 2 }

  return (
    <>
      {chargerRows.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          {totalChargers > 0 && (
            <Box>
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
                  mx: -2,
                  px: 2,
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
                  sx={{ color: colors.gray[400], display: 'block', fontSize: '0.62rem', mt: 0.5, mb: 0.125, lineHeight: 1.35 }}
                >
                  상태 갱신 {latestStatUpdDt}
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ mt: totalChargers > 0 ? 1 : 0 }}>
            <ChargerListHeading
              filter={chargerStatFilter}
              totalChargers={totalChargers}
              filteredCount={filteredChargerRows.length}
            />
            <Box
              sx={{
                maxHeight: stackActions ? 280 : 240,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
                pr: 0.25,
                pt: 0.25,
              }}
            >
              {filteredChargerRows.length === 0 ? (
                <Typography variant="body2" sx={{ color: colors.gray[500], fontSize: '0.8125rem', py: 0.75, px: 0.125 }}>
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
        <Typography variant="caption" sx={{ ...metaLabelSx, display: 'block', mb: 1 }}>
          장소 정보
        </Typography>
        <Box sx={{ mb: 1.25 }}>
          <Typography variant="caption" sx={{ ...metaLabelSx, display: 'block', mb: 0.2 }}>
            주소
          </Typography>
          <Typography
            variant="body2"
            sx={{
              ...metaBodySx,
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
            }}
          >
            {addressDisplay || '등록된 주소가 없습니다. 원본 API에 주소 필드가 없을 수 있습니다.'}
          </Typography>
        </Box>
        <Box sx={{ mb: 1.25 }}>
          <Typography variant="caption" sx={{ ...metaLabelSx, display: 'block', mb: 0.2 }}>
            이용시간
          </Typography>
          <Typography variant="body2" sx={metaBodySx}>{station.useTm || '-'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 0.5 }}>
          <Typography variant="body2" sx={metaBodySx}>
            <Box component="span" sx={{ color: colors.gray[400], fontWeight: 600 }}>운영기관</Box> {station.busiNm}
          </Typography>
          {telno && (
            <Typography variant="body2" sx={metaBodySx}>
              <Box component="span" sx={{ color: colors.gray[400], fontWeight: 600 }}>전화</Box> {telno}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          ...footerBleed,
          mt: 2,
          pt: 1.5,
          pb: stackActions ? 'calc(10px + env(safe-area-inset-bottom, 0px))' : 1.5,
          borderTop: `1px solid ${colors.gray[200]}`,
          bgcolor: colors.gray[50],
        }}
      >
        <Typography variant="caption" sx={{ ...metaLabelSx, display: 'block', mb: 1, color: colors.gray[500] }}>
          이동·문의
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: stackActions ? 'column' : 'row', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Directions />}
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              flex: 1,
              minHeight: 48,
              py: 1.125,
              borderRadius: `${radius.sm}px`,
              bgcolor: colors.blue.primary,
              fontWeight: 600,
              fontSize: stackActions ? '0.875rem' : undefined,
              textTransform: 'none',
              boxShadow: '0 1px 4px rgba(37,99,235,0.25)',
              transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
              '&:hover': { bgcolor: colors.blue.deep, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            충전소 위치 길찾기
          </Button>
          {telno && (
            <Button
              variant="outlined"
              startIcon={<Phone />}
              href={`tel:${telno}`}
              sx={{
                flex: 1,
                minHeight: 48,
                py: 1.125,
                borderRadius: `${radius.sm}px`,
                borderColor: colors.gray[300],
                bgcolor: colors.white,
                color: colors.gray[800],
                fontWeight: 600,
                fontSize: stackActions ? '0.875rem' : undefined,
                textTransform: 'none',
                transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              전화
            </Button>
          )}
        </Box>
      </Box>
    </>
  )
}
