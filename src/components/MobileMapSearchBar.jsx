import { useRef } from 'react'
import { Box, Chip, IconButton, InputAdornment, TextField } from '@mui/material'
import Close from '@mui/icons-material/Close'
import { EvBrandSearchLogo } from './EvBrandSearchLogo.jsx'
import { motion, radius, mobileMapChrome } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/** iOS Safari: input computed font-size < 16px 이면 포커스 시 페이지 자동 확대 */
const SEARCH_INPUT_FONT_PX = 16

const SUGGESTIONS = ['급속', '완속', '24시간', '환경부', '강남', '판교', '성수', '종로']

/**
 * 모바일 지도 상단 플로팅 탐색 바 + 상태 칩·추천(오버레이, 상단 고정 높이 불변)
 */
const QUICK_CHIP_H = 42
const QUICK_CHIP_FONT_PX = 14
const QUICK_CHIP_GAP_PX = 9
const QUICK_CHIP_PAD_X = 15

export function MobileMapSearchBar({
  value,
  onChange,
  onClear,
  onSubmit,
  focused,
  onFocus,
  onBlur,
  /** 추천 칩 선택 시 즉시 필터 반영(디바운스 생략) */
  onSuggestionPick,
  /** 비어 있지 않으면 필드 아래 상태 칩 */
  statusQuery = '',
  /** 적용 검색어와 동일한 칩에 선택 강조 */
  activeQuickQuery = '',
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
    <Box sx={{ position: 'relative', flex: 1, minWidth: 0, alignSelf: 'flex-start' }}>
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
            pl: '16px',
            pr: '10px',
            transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
            '& fieldset': { borderColor: tokens.control.searchBorder },
            '&:hover fieldset': { borderColor: tokens.border.strong },
            '&.Mui-focused fieldset': { borderColor: colors.blue.primary, borderWidth: 1 },
            alignItems: 'center',
            /* 포커스 시 높이·패딩 변화 없음(MUI small 기본 보정) */
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
                  mr: '11px',
                  ml: 0,
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  maxHeight: 'none',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 0,
                  }}
                  aria-hidden
                >
                  <EvBrandSearchLogo size={22} />
                </Box>
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

      {statusQuery.trim() ? (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            mt: 0.5,
            zIndex: 2,
            pointerEvents: 'auto',
            maxWidth: '100%',
          }}
        >
          <Chip
            label={statusQuery.trim()}
            size="small"
            onDelete={onClear}
            sx={{
              maxWidth: '100%',
              height: 28,
              fontWeight: 700,
              fontSize: '0.75rem',
              borderRadius: 9999,
              bgcolor: tokens.blue.muted,
              color: colors.blue.deep,
              border: `1px solid ${tokens.blue.borderSoft}`,
              '& .MuiChip-label': { px: 1.25, overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        </Box>
      ) : null}

      {focused && !value.trim() ? (
        <Box
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 0.75,
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: `${QUICK_CHIP_GAP_PX}px`,
            width: '100%',
            minWidth: 0,
            p: 1.25,
            borderRadius: `${radius.md}px`,
            bgcolor: tokens.bg.paper,
            boxShadow: tokens.shadow.float,
            border: `1px solid ${colors.gray[200]}`,
            pointerEvents: 'auto',
          }}
        >
          {SUGGESTIONS.map((label) => {
            const active = activeQuickQuery.trim() === label.trim()
            return (
              <Chip
                key={label}
                label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(label)}
                sx={{
                  height: QUICK_CHIP_H,
                  borderRadius: 9999,
                  fontSize: `${QUICK_CHIP_FONT_PX}px`,
                  fontWeight: 600,
                  bgcolor: active ? tokens.blue.mutedStrong : colors.gray[100],
                  color: active ? colors.blue.deep : colors.gray[800],
                  border: active ? `2px solid ${colors.blue.primary}` : `1px solid ${colors.gray[200]}`,
                  boxShadow: active ? `0 2px 10px ${tokens.blue.glowSoft}` : 'none',
                  transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                  '& .MuiChip-label': {
                    px: `${QUICK_CHIP_PAD_X}px`,
                    py: 0,
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
      ) : null}
    </Box>
  )
}
