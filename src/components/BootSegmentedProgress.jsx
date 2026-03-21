import { Box } from '@mui/material'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

const SEGMENTS = 20

/**
 * 부트 로딩 전용: 20칸(칸당 5%) 세그먼트 바. 높이 22px(부트 오버레이와 촘촘히 정렬).
 */
export function BootSegmentedProgress({ value = 0, indeterminate = false, reduceMotion = false, sx }) {
  const { tokens } = useEvTheme()
  const v = Math.min(100, Math.max(0, Number(value)))
  const filled = indeterminate ? 0 : Math.min(SEGMENTS, Math.floor(v / 5))

  return (
    <Box
      className="ev-boot-seg"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(v)}
      aria-busy={indeterminate ? true : undefined}
      aria-label={indeterminate ? '로딩 중' : `진행률 ${Math.round(v)}퍼센트`}
      sx={{
        display: 'flex',
        gap: '2px',
        width: '100%',
        maxWidth: 272,
        height: 22,
        mx: 'auto',
        ...sx,
      }}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const isFilled = !indeterminate && i < filled
        const showWave = indeterminate && !reduceMotion
        return (
          <Box
            key={i}
            className={showWave ? 'ev-boot-seg__cell ev-boot-seg__cell--wave' : 'ev-boot-seg__cell'}
            style={showWave ? { animationDelay: `${i * 65}ms` } : undefined}
            sx={{
              flex: 1,
              minWidth: 0,
              height: 22,
              borderRadius: '4px',
              bgcolor: isFilled
                ? tokens.blue.main
                : indeterminate
                  ? tokens.blue.muted
                  : tokens.bg.subtle,
              transition: indeterminate || reduceMotion ? 'none' : 'background-color 0.2s ease',
            }}
          />
        )
      })}
    </Box>
  )
}
