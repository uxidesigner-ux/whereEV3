import { useRef } from 'react'
import { Box, Chip, IconButton, InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import Close from '@mui/icons-material/Close'
import { appMobileType, colors, motion, radius, mobileMapChrome } from '../theme/dashboardTheme.js'

const SUGGESTIONS = ['급속', '완속', '24시간', '환경부', '강남', '판교']

/**
 * 모바일 지도 상단 플로팅 탐색 바 + 상태 칩·추천(오버레이, 상단 고정 높이 불변)
 */
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
}) {
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
    if (onSuggestionPick) onSuggestionPick(text)
    else onChange(text)
    onSubmit?.()
  }

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
            boxSizing: 'border-box',
            fontSize: appMobileType.searchField.fontSize,
            bgcolor: colors.white,
            borderRadius: radius.full,
            boxShadow: focused
              ? '0 6px 28px rgba(15, 23, 42, 0.16), 0 0 0 2px rgba(37, 99, 235, 0.22)'
              : mobileMapChrome.floatShadow,
            pl: '16px',
            pr: '10px',
            transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
            '& fieldset': { borderColor: 'rgba(15,23,42,0.06)' },
            '&:hover fieldset': { borderColor: 'rgba(15,23,42,0.1)' },
            '&.Mui-focused fieldset': { borderColor: colors.blue.primary, borderWidth: 1 },
            alignItems: 'center',
          },
          '& .MuiInputBase-input': {
            py: 0,
            height: `${mobileMapChrome.searchPillH}px`,
            boxSizing: 'border-box',
            lineHeight: `${mobileMapChrome.searchPillH}px`,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0.5, ml: -0.25 }}>
                <SearchIcon sx={{ fontSize: 22, color: focused ? colors.blue.primary : colors.gray[500] }} />
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
              bgcolor: 'rgba(37, 99, 235, 0.1)',
              color: colors.blue.deep,
              border: `1px solid rgba(37, 99, 235, 0.28)`,
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
            mt: 0.5,
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            maxWidth: 'min(100%, calc(100vw - 120px))',
            p: 1,
            borderRadius: `${radius.md}px`,
            bgcolor: 'rgba(255,255,255,0.98)',
            boxShadow: mobileMapChrome.floatShadow,
            border: `1px solid ${colors.gray[200]}`,
            pointerEvents: 'auto',
          }}
        >
          {SUGGESTIONS.map((label) => (
            <Chip
              key={label}
              label={label}
              size="small"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(label)}
              sx={{
                height: 30,
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 9999,
                bgcolor: colors.gray[100],
                color: colors.gray[700],
                border: `1px solid ${colors.gray[200]}`,
                '& .MuiChip-label': { px: 1.25 },
                '&:hover': { bgcolor: colors.gray[200] },
              }}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
