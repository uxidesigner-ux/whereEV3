import { useEffect, useMemo, useState, createContext, useContext } from 'react'
import { Typography, Box, Button, Chip, Stack, LinearProgress, Collapse } from '@mui/material'
import ExpandMore from '@mui/icons-material/ExpandMore'
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
import { getSpeedCategory } from '../api/evChargerTy.js'
import { getChargerSessionForUi } from '../data/chargerSessionMvp.js'
import { ChargerTypeGlyph } from './ChargerTypeGlyph.jsx'
import {
  EvUserGlyphBatteryBrick,
  EvUserGlyphBolt,
  EvUserGlyphMapPin,
  EvUserGlyphCarFront,
} from './EvUserProvidedIcons.jsx'

/**
 * 상세 시트 헤더 상태 칩 옆 전용 (본문에는 상태 칩만 한 번 표시).
 * - 사용 가능: 차량
 * - 사용 중: 번개
 * - 점검: 충전기 본체
 * - 기타: 핀
 */
function detailSheetStatusGlyph(stat) {
  const s = String(stat ?? '').trim()
  if (s === '2') return EvUserGlyphCarFront
  if (s === '3') return EvUserGlyphBolt
  if (s === '5') return EvUserGlyphBatteryBrick
  return EvUserGlyphMapPin
}

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
        border: `1px solid ${tokens.blue.borderSoft}`,
        bgcolor: tokens.blue.mutedStrong,
        color: colors.blue.deep,
        boxShadow: `0 2px 10px ${tokens.blue.glowSoft}, 0 0 0 1px ${colors.blue.primary}22`,
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
        boxShadow: `0 2px 10px rgba(22, 163, 74, 0.18)`,
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
        boxShadow: `0 2px 10px rgba(245, 158, 11, 0.22)`,
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
        boxShadow: `0 2px 8px rgba(15, 23, 42, 0.08)`,
      },
    },
  }
  /** 앱 시트 셀: 과한 플로팅 카드 느낌 완화 */
  const chargerCard =
    resolvedMode === 'dark'
      ? {
          bgcolor: tokens.bg.raised,
          border: `1px solid rgba(255,255,255,0.07)`,
          boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 2px 10px rgba(0,0,0,0.35)',
        }
      : {
          bgcolor: tokens.bg.subtle,
          border: `1px solid ${tokens.border.subtle}`,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
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

/** 상태 요약 세그먼트: 숫자 중심·라벨은 약한 대문자( opacity 금지, 톤은 색만 ) */
function StatFilterChip({ count, segmentLabel, selected, disabled, onClick, paletteKey }) {
  const { statFilterPalettes, tokens } = useStationDetailUi()
  const pal = statFilterPalettes[paletteKey]
  const tone = selected ? pal.active : pal.idle
  return (
    <Chip
      label={
        <Box
          component="span"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.2,
            py: 0.2,
            minWidth: 40,
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '1.1875rem',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
              color: 'inherit',
            }}
          >
            {count}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: '0.625rem',
              fontWeight: selected ? 700 : 600,
              lineHeight: 1.2,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: selected ? 'inherit' : tokens.text.tertiary,
            }}
          >
            {segmentLabel}
          </Typography>
        </Box>
      }
      size="medium"
      clickable={!disabled}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={{
        flexShrink: 0,
        height: 'auto',
        minHeight: 52,
        borderRadius: `${radius.md}px`,
        transition: `border-color ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
        '& .MuiChip-label': {
          px: 1.35,
          py: 0.55,
          display: 'block',
        },
        ...tone,
        ...(disabled
          ? {
              opacity: 0.38,
              cursor: 'not-allowed',
              pointerEvents: 'none',
              boxShadow: 'none',
              filter: 'none',
            }
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
        letterSpacing: '0.05em',
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: tokens.text.secondary,
        textTransform: 'uppercase',
      }}
    >
      <Box component="span" sx={{ fontWeight: 700, color: tokens.text.primary }}>
        충전기
      </Box>
      <Box component="span" sx={{ color: tokens.text.muted, fontWeight: 600, mx: 0.45 }}>
        ·
      </Box>
      <Box component="span" sx={{ fontWeight: 600, color: tokens.text.secondary }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontWeight: 600, color: tokens.text.tertiary, ml: 0.35, fontVariantNumeric: 'tabular-nums' }}>
        {count}대
      </Box>
    </Typography>
  )
}

/** 어코디언 헤더 한 줄: 빈 값은 토막 생략(「—」 연속 방지) */
function buildChargerHeaderSummaryLine(row, outDisp) {
  const speedLabel = row.speedCategory || getSpeedCategory(row.chgerTy)
  const segs = [speedLabel]
  const out = (outDisp || '').trim()
  if (out) segs.push(out)
  const conn = (row.chgerTyLabel || '').trim()
  if (conn) segs.push(conn)
  return segs.join(' · ')
}

/** 3단 정보 모듈 한 칸 — 아이콘·라벨·값(칩형) 정렬 통일 */
function ChargerMetricCell({ label, icon, valueNode, valuePillSx, tokens, cellBorder, cellBg }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0.45,
        p: 0.75,
        borderRadius: `${radius.md}px`,
        border: `1px solid ${cellBorder}`,
        bgcolor: cellBg,
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 20,
          flexShrink: 0,
          color: tokens.text.secondary,
          opacity: 0.92,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'center',
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.text.muted,
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          px: 0.5,
          py: 0.5,
          borderRadius: `${radius.sm}px`,
          ...valuePillSx,
        }}
      >
        {valueNode}
      </Box>
    </Box>
  )
}

function ChargerCard({ row, idx }) {
  const { colors, chipSx, tokens, chargerCard, resolvedMode } = useStationDetailUi()
  const [expanded, setExpanded] = useState(false)
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

  const headerSummaryLine = buildChargerHeaderSummaryLine(row, outDisp)
  const typeLabel = row.displayChgerLabel ?? row.chgerTyLabel ?? '—'

  const isDark = resolvedMode === 'dark'
  const cellBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(55, 65, 81, 0.2)'
  const cellBg = isDark ? 'rgba(0,0,0,0.18)' : 'rgba(249, 250, 251, 0.95)'
  const valuePillNeutral = {
    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.97)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : tokens.border.subtle}`,
  }

  const headerChipSx = {
    ...chip.sx,
    flexShrink: 0,
    height: 26,
    maxHeight: 26,
    borderRadius: 999,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    maxWidth: 'min(56%, 132px)',
    boxShadow: 'none',
    '& .MuiChip-label': { px: 1, py: 0, overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 },
  }

  const StatusGlyph = detailSheetStatusGlyph(stat)
  const useBarGradient = `linear-gradient(90deg, ${tokens.status.use.fg} 0%, ${colors.blue.primary} 55%, ${colors.blue.light} 100%)`

  const valueTypographySx = {
    m: 0,
    width: '100%',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
    color: tokens.text.primary,
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  }

  const rowKey = row.id ?? row.chgerId ?? idx
  const headerDomId = `ev-charger-acc-h-${rowKey}`
  const panelDomId = `ev-charger-acc-p-${rowKey}`
  const collapseMs = { enter: motion.duration.enter, exit: motion.duration.exit }

  const toggleExpanded = () => setExpanded((v) => !v)

  return (
    <Box
      sx={{
        mb: 1.75,
        borderRadius: `${radius.lg}px`,
        bgcolor: chargerCard.bgcolor,
        boxShadow: chargerCard.boxShadow,
        ...(chargerCard.border ? { border: chargerCard.border } : {}),
        overflow: 'hidden',
        transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
      }}
    >
      {/* 헤더: 전체 탭으로 토글 — 제목·요약(왼) / 상태·chevron(오른) */}
      <Box
        component="button"
        type="button"
        id={headerDomId}
        aria-expanded={expanded}
        aria-controls={panelDomId}
        aria-label={expanded ? `${title}, 상세 접기` : `${title}, 상세 펼치기`}
        onClick={toggleExpanded}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          m: 0,
          p: { xs: 1.25, sm: 1.375 },
          textAlign: 'left',
          cursor: 'pointer',
          border: 'none',
          bgcolor: 'transparent',
          font: 'inherit',
          color: 'inherit',
          WebkitTapHighlightColor: 'transparent',
          '&:focus-visible': {
            outline: `2px solid ${tokens.border.strong}`,
            outlineOffset: 2,
          },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, pr: 0.75 }}>
          <Typography
            variant="subtitle2"
            component="h3"
            title={title}
            sx={{
              ...appMobileType.chargerCardTitle,
              color: tokens.text.primary,
              fontSize: { xs: '1rem', sm: '0.9375rem' },
              fontWeight: 800,
              lineHeight: 1.3,
              letterSpacing: '-0.024em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            title={headerSummaryLine}
            sx={{
              display: 'block',
              mt: 0.35,
              color: tokens.text.secondary,
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1.4,
              letterSpacing: '0.01em',
              wordBreak: 'break-word',
            }}
          >
            {headerSummaryLine}
          </Typography>
        </Box>
        <Box
          aria-hidden
          sx={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            flexShrink: 0,
            gap: 0,
            pl: 0.5,
            pr: 0.125,
            py: 0.25,
            minHeight: 36,
            borderRadius: `${radius.md}px`,
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.045)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'}`,
            pointerEvents: 'none',
          }}
        >
          <Chip label={chip.label} size="small" sx={headerChipSx} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              flexShrink: 0,
            }}
          >
            <ExpandMore
              sx={{
                display: 'block',
                color: tokens.text.muted,
                fontSize: 22,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: `transform ${collapseMs.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}`,
              }}
            />
          </Box>
        </Box>
      </Box>

      <Collapse in={expanded} timeout={collapseMs} unmountOnExit>
        <Box
          id={panelDomId}
          role="region"
          aria-labelledby={headerDomId}
          sx={{
            px: { xs: 1.375, sm: 1.5 },
            pt: 0,
            pb: { xs: 1.375, sm: 1.5 },
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}`,
          }}
        >
          {/* 핵심 3단: 커넥터 · 출력 · 상태 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 0.625,
              pt: 1.125,
            }}
          >
            <ChargerMetricCell
              label="커넥터"
              tokens={tokens}
              cellBorder={cellBorder}
              cellBg={cellBg}
              valuePillSx={valuePillNeutral}
              icon={<ChargerTypeGlyph chgerTy={row.chgerTy} size={18} sx={{ display: 'block' }} />}
              valueNode={
                <Typography component="p" title={String(typeLabel)} sx={{ ...valueTypographySx, fontWeight: 600 }}>
                  {typeLabel}
                </Typography>
              }
            />
            <ChargerMetricCell
              label="출력"
              tokens={tokens}
              cellBorder={cellBorder}
              cellBg={cellBg}
              valuePillSx={valuePillNeutral}
              icon={<EvUserGlyphBolt size={18} sx={{ display: 'block' }} />}
              valueNode={<Typography component="p" sx={valueTypographySx}>{outDisp || '—'}</Typography>}
            />
            <ChargerMetricCell
              label="상태"
              tokens={tokens}
              cellBorder={cellBorder}
              cellBg={cellBg}
              valuePillSx={{
                bgcolor: chip.sx.bgcolor,
                border: chip.sx.border,
              }}
              icon={
                <StatusGlyph
                  size={18}
                  sx={{
                    color: chip.sx.color,
                    opacity: 0.95,
                  }}
                />
              }
              valueNode={
                <Typography
                  component="p"
                  sx={{
                    ...valueTypographySx,
                    color: chip.sx.color,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {chip.label}
                </Typography>
              }
            />
          </Box>

          {showSessionPanel ? (
            <Box
              sx={{
                mt: 1.375,
                p: { xs: 1.25, sm: 1.375 },
                borderRadius: `${radius.md}px`,
                border: `1px solid ${tokens.status.use.border}`,
                bgcolor: tokens.status.use.rowBg,
                boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 2px 10px rgba(245, 158, 11, 0.08)',
              }}
            >
              {showChargeBar ? (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 1.125,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: tokens.status.use.fg,
                        letterSpacing: '0.02em',
                        pt: 0.25,
                      }}
                    >
                      충전 중
                    </Typography>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography
                        component="div"
                        sx={{
                          fontSize: '1.875rem',
                          fontWeight: 800,
                          lineHeight: 1,
                          letterSpacing: '-0.04em',
                          fontVariantNumeric: 'tabular-nums',
                          color: tokens.text.primary,
                        }}
                      >
                        {chargePair.current}%
                      </Typography>
                      <Typography
                        component="div"
                        sx={{
                          mt: 0.35,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: tokens.text.tertiary,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        목표 {chargePair.target}%
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress
                    className="ev-charger-session-progress"
                    variant="determinate"
                    value={chargePair.barValue}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(245, 158, 11, 0.15)',
                      overflow: 'hidden',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: useBarGradient,
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.65,
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
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 1,
                    mt: showChargeBar ? 1.125 : 0,
                    pt: showChargeBar ? 1 : 0,
                    borderTop: showChargeBar ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.2)'}` : 'none',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: tokens.text.tertiary,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    남은 시간 · 완료 예상
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: tokens.text.primary,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      lineHeight: 1.4,
                      fontVariantNumeric: 'tabular-nums',
                      textAlign: 'right',
                    }}
                  >
                    {timeLine}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          ) : null}

          {stat === '2' && !showSessionPanel ? (
            <Box
              sx={{
                mt: 1.25,
                p: 1,
                borderRadius: `${radius.md}px`,
                bgcolor: tokens.status.avail.rowBg,
                border: `1px solid ${tokens.status.avail.border}`,
              }}
            >
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45, color: tokens.status.avail.fg }}>
                지금 바로 충전할 수 있어요.
              </Typography>
            </Box>
          ) : null}

          {stat === '5' ? (
            <Box
              sx={{
                mt: 1.25,
                p: 1,
                borderRadius: `${radius.md}px`,
                bgcolor: tokens.status.maint.rowBg,
                border: `1px solid ${tokens.status.maint.border}`,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 0.875,
              }}
            >
              <EvUserGlyphBatteryBrick
                size={22}
                sx={{ color: tokens.status.maint.fg, opacity: 0.85, flexShrink: 0, mt: 0.125 }}
              />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45, color: tokens.text.secondary }}>
                점검으로 현재 이용할 수 없습니다.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Collapse>
    </Box>
  )
}

const FOOTER_BTN_SX = {
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 48,
  maxHeight: 48,
  py: 0,
  px: { xs: 1.125, sm: 1.25 },
  borderRadius: `${radius.md}px`,
  fontWeight: 600,
  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
  lineHeight: 1.2,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  justifyContent: 'center',
  '& .MuiButton-startIcon': {
    marginRight: { xs: 0.45, sm: 0.6 },
    marginLeft: 0,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1,
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
        /* 시트: MobileBottomSheet footer 슬롯이 px·border·safe-area 처리 */
        pt: isSheet ? 0 : 1.25,
        pb: isSheet ? 0 : 1.5,
        px: isSheet ? 0 : undefined,
        bgcolor: isSheet ? 'transparent' : tokens.bg.subtle,
        borderTop: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: { xs: 0.875, sm: 1 },
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
              minWidth: 108,
              borderColor: tokens.border.default,
              bgcolor: tokens.bg.paper,
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
            boxShadow: `0 1px 4px rgba(31, 69, 255, 0.22)`,
            transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
            '&:hover': { bgcolor: colors.blue.deep, boxShadow: `0 3px 10px ${tokens.blue.glowSoft}` },
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
                      pb: 1,
                      mb: 0,
                      borderBottom: `1px solid ${tokens.border.subtle}`,
                      boxShadow: `0 8px 16px -10px ${resolvedMode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(15,23,42,0.1)'}`,
                    }
                  : {}
              }
            >
              <Box sx={stickyRail ? {} : { mx: -2, px: 2 }}>
                <Box
                  sx={{
                    borderRadius: `${radius.lg}px`,
                    border: `1px solid ${tokens.border.subtle}`,
                    bgcolor: tokens.bg.subtle,
                    p: 0.5,
                  }}
                >
                  <Box
                    role="tablist"
                    aria-label="충전기 상태 요약"
                    sx={{
                      display: 'flex',
                      flexWrap: 'nowrap',
                      alignItems: 'center',
                      gap: 0.5,
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      WebkitOverflowScrolling: 'touch',
                      py: 0.25,
                      scrollbarWidth: 'none',
                      '&::-webkit-scrollbar': { display: 'none' },
                    }}
                  >
                    <StatFilterChip
                      count={totalChargers}
                      segmentLabel="전체"
                      paletteKey="all"
                      selected={chargerStatFilter === 'all'}
                      disabled={totalChargers === 0}
                      onClick={() => setStatFilter('all')}
                    />
                    <StatFilterChip
                      count={cAvail}
                      segmentLabel="사용 가능"
                      paletteKey="avail"
                      selected={chargerStatFilter === '2'}
                      disabled={cAvail === 0}
                      onClick={() => setStatFilter('2')}
                    />
                    <StatFilterChip
                      count={cUse}
                      segmentLabel="사용 중"
                      paletteKey="use"
                      selected={chargerStatFilter === '3'}
                      disabled={cUse === 0}
                      onClick={() => setStatFilter('3')}
                    />
                    <StatFilterChip
                      count={cMaint}
                      segmentLabel="점검중"
                      paletteKey="maint"
                      selected={chargerStatFilter === '5'}
                      disabled={cMaint === 0}
                      onClick={() => setStatFilter('5')}
                    />
                  </Box>
                </Box>
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
              mt: totalChargers > 0 ? 1.125 : 0,
              mb: 0,
              ...appMobileType.captionDense,
              fontStyle: 'italic',
              lineHeight: 1.45,
              opacity: 0.92,
            }}
          >
            * 충전기 상태 및 충전율 정보는 MVP용 시뮬레이션 데이터입니다.
          </Typography>

          <Box sx={{ mt: totalChargers > 0 ? 1.375 : 0 }}>
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
