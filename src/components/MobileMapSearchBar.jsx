import { createElement, useRef } from 'react'
import { Box, Chip, IconButton, InputAdornment, TextField } from '@mui/material'
import Close from '@mui/icons-material/Close'
import ArrowBack from '@mui/icons-material/ArrowBack'
import FlashOn from '@mui/icons-material/FlashOn'
import ElectricalServices from '@mui/icons-material/ElectricalServices'
import Schedule from '@mui/icons-material/Schedule'
import Business from '@mui/icons-material/Business'
import LocationOn from '@mui/icons-material/LocationOn'
import { EvBrandSearchLogo } from './EvBrandSearchLogo.jsx'
import { motion, radius, mobileMapChrome } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/** iOS Safari: input computed font-size < 16px 이면 포커스 시 페이지 자동 확대 */
const SEARCH_INPUT_FONT_PX = 16

const ICON_SX = { fontSize: 16 }

/** 퀵 검색: 라벨 + 의미 아이콘 */
const QUICK_SUGGESTIONS = [
  { label: '급속', Icon: FlashOn },
  { label: '완속', Icon: ElectricalServices },
  { label: '24시간', Icon: Schedule },
  { label: '환경부', Icon: Business },
  { label: '강남', Icon: LocationOn },
  { label: '판교', Icon: LocationOn },
  { label: '성수', Icon: LocationOn },
  { label: '종로', Icon: LocationOn },
]

const QUICK_CHIP_H = 42
const QUICK_CHIP_FONT_PX = 14
const QUICK_CHIP_GAP_PX = 8
const QUICK_ICON_TEXT_GAP_PX = 7
const QUICK_CHIP_PAD_X = 14

/**
 * 모바일 지도 상단 플로팅 탐색 바 + (옵션) 퀵 검색 레일
 */
export function MobileMapSearchBar({
  value,
  onChange,
  onClear,
  onSubmit,
  focused,
  onFocus,
  onBlur,
  onSuggestionPick,
  activeQuickQuery = '',
  /** 검색 포커스(키보드) 또는 상세 full 등에서 퀵칩 숨김 */
  suppressQuickChips = false,
  /** false면 퀵칩을 부모(전체 폭 레일 등)에서만 렌더 */
  embedQuickChips = true,
  /** 검색 결과 모드: leading 로고 대신 뒤로(검색 종료) */
  searchResultsMode = false,
  onSearchBack,
}) {
  const { colors, tokens } = useEvTheme()
  const blurTimer = useRef(0)

  const handleBlur = () => {
    blurTimer.current = window.setTimeout(() => {
      onBlur?.()
    }, 160)
  }

  const handleFocus = () => {
    window.clearTimeout(blurTimer.current)
    onFocus?.()
  }

  const applySuggestion = (text) => {
    if (onSuggestionPick) {
      onSuggestionPick(text)
      return
    }
    onChange(text)
    onSubmit?.()
  }

  const searchFocusShadow = tokens.shadow.searchFocused
  const searchIdleShadow = tokens.shadow.float

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <TextField
        size="small"
        placeholder="충전소명 · 지역 · 급속/완속 검색"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit?.()
          }
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="지도에서 충전소 찾기"
        sx={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          height: mobileMapChrome.searchPillH,
          '& .MuiOutlinedInput-root': {
            height: mobileMapChrome.searchPillH,
            minHeight: mobileMapChrome.searchPillH,
            maxHeight: mobileMapChrome.searchPillH,
            boxSizing: 'border-box',
            fontSize: `${SEARCH_INPUT_FONT_PX}px`,
            bgcolor: tokens.control.searchBg,
            borderRadius: radius.full,
            boxShadow: focused ? searchFocusShadow : searchIdleShadow,
            pl: '12px',
            pr: '10px',
            transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
            '& fieldset': { borderColor: tokens.control.searchBorder },
            '&:hover fieldset': { borderColor: tokens.border.strong },
            '&.Mui-focused fieldset': { borderColor: colors.blue.primary, borderWidth: 1 },
            alignItems: 'center',
            '&.Mui-focused': {
              minHeight: mobileMapChrome.searchPillH,
              height: mobileMapChrome.searchPillH,
            },
          },
          '& .MuiOutlinedInput-input': {
            py: 0,
            px: 0,
            height: `${mobileMapChrome.searchPillH}px`,
            minHeight: `${mobileMapChrome.searchPillH}px`,
            maxHeight: `${mobileMapChrome.searchPillH}px`,
            boxSizing: 'border-box',
            fontSize: `${SEARCH_INPUT_FONT_PX}px`,
            lineHeight: `${mobileMapChrome.searchPillH}px`,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment
                position="start"
                sx={{
                  mr: searchResultsMode ? '8px' : '12px',
                  ml: 0,
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  maxHeight: 'none',
                }}
              >
                {searchResultsMode && onSearchBack ? (
                  <IconButton
                    type="button"
                    size="small"
                    aria-label="검색 결과 닫기"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSearchBack()}
                    sx={{
                      p: 0.5,
                      ml: -0.5,
                      color: colors.gray[700],
                      borderRadius: radius.md,
                    }}
                  >
                    <ArrowBack sx={{ fontSize: 22 }} />
                  </IconButton>
                ) : (
                  <Box
                    component="span"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: mobileMapChrome.searchPillH,
                      lineHeight: 0,
                    }}
                    aria-hidden
                  >
                    <EvBrandSearchLogo />
                  </Box>
                )}
              </InputAdornment>
            ),
            endAdornment: value.trim() ? (
              <InputAdornment position="end" sx={{ mr: 0 }}>
                <IconButton
                  type="button"
                  size="small"
                  aria-label="검색어 지우기"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onClear()}
                  sx={{ p: 0.5, color: colors.gray[500] }}
                >
                  <Close sx={{ fontSize: 20 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {!suppressQuickChips && embedQuickChips ? (
        <Box
          component="nav"
          aria-label="빠른 검색 제안"
          sx={{
            mt: 1,
            width: '100%',
            minWidth: 0,
            mx: 0,
            px: 0,
            pointerEvents: 'auto',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: `${QUICK_CHIP_GAP_PX}px`,
              width: 'max-content',
              minWidth: '100%',
              pr: '2px',
              boxSizing: 'border-box',
            }}
          >
            {QUICK_SUGGESTIONS.map(({ label, Icon }) => {
              const active = activeQuickQuery.trim() === label.trim()
              return (
                <Chip
                  key={label}
                  icon={createElement(Icon, {
                    sx: { ...ICON_SX, color: active ? colors.blue.deep : colors.gray[600] },
                    'aria-hidden': true,
                  })}
                  label={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(label)}
                  sx={{
                    flexShrink: 0,
                    height: QUICK_CHIP_H,
                    borderRadius: 9999,
                    fontSize: `${QUICK_CHIP_FONT_PX}px`,
                    fontWeight: 600,
                    bgcolor: active ? tokens.blue.mutedStrong : colors.gray[100],
                    color: active ? colors.blue.deep : colors.gray[800],
                    border: active ? `1px solid ${colors.blue.primary}` : `1px solid ${colors.gray[200]}`,
                    boxShadow: 'none',
                    transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '& .MuiChip-icon': {
                      marginLeft: '10px',
                      marginRight: `${QUICK_ICON_TEXT_GAP_PX}px`,
                    },
                    '& .MuiChip-label': {
                      px: `${QUICK_CHIP_PAD_X}px`,
                      py: 0,
                      pl: 0,
                    },
                    '&:hover': {
                      bgcolor: active ? tokens.blue.muted : colors.gray[200],
                      borderColor: active ? colors.blue.deep : colors.gray[300],
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                  }}
                />
              )
            })}
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
