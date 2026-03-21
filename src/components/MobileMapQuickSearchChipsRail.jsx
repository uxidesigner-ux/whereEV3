import { createElement } from 'react'
import { Box, Chip } from '@mui/material'
import FlashOn from '@mui/icons-material/FlashOn'
import ElectricalServices from '@mui/icons-material/ElectricalServices'
import Schedule from '@mui/icons-material/Schedule'
import Business from '@mui/icons-material/Business'
import LocationOn from '@mui/icons-material/LocationOn'
import { motion } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

const ICON_SX = { fontSize: 16 }

/** 퀵 검색: 라벨 + 의미 아이콘. 지명(강남·판교·성수·종로)은 `utils/mobileQuickSearchPlacePresets.js` 키와 동일해야 함 */
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

export const MOBILE_QUICK_SEARCH_CHIP_H = 42

const QUICK_CHIP_FONT_PX = 14
const QUICK_CHIP_GAP_PX = 9
const QUICK_ICON_TEXT_GAP_PX = 7
const QUICK_CHIP_PAD_X = 14

/**
 * 가로 스크롤 퀵 검색 칩 레일.
 * @param {'inset' | 'fullBleed'} [variant] inset: 부모 폭, fullBleed: 뷰포트 폭 + 좌우 마스크
 */
export function MobileMapQuickSearchChipsRail({
  activeQuickQuery = '',
  onSuggestionPick,
  variant = 'inset',
}) {
  const { colors, tokens } = useEvTheme()

  const applySuggestion = (text) => {
    onSuggestionPick?.(text)
  }

  const outerSx =
    variant === 'fullBleed'
      ? {
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          position: 'relative',
          left: 0,
          pointerEvents: 'auto',
        }
      : {
          width: '100%',
          minWidth: 0,
          pointerEvents: 'auto',
        }

  return (
    <Box component="nav" aria-label="빠른 검색 제안" sx={{ ...outerSx, mt: 1 }}>
      <Box
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          ...(variant === 'fullBleed'
            ? {
                maskImage: 'linear-gradient(to right, transparent 0px, black 14px, black calc(100% - 14px), transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0px, black 14px, black calc(100% - 14px), transparent 100%)',
              }
            : {}),
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
            minWidth: variant === 'fullBleed' ? '100%' : '100%',
            pl: variant === 'fullBleed' ? 'max(12px, env(safe-area-inset-left, 0px))' : 0,
            pr: variant === 'fullBleed' ? 'max(12px, env(safe-area-inset-right, 0px))' : '2px',
            pb: '2px',
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
                  height: MOBILE_QUICK_SEARCH_CHIP_H,
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
    </Box>
  )
}
