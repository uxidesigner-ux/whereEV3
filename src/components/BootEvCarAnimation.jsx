import { Box, useTheme } from '@mui/material'

/**
 * 부트 로딩: 정면 EV 실루엣 + 방지턱/서스펜션 루프 (CSS transform, prefers-reduced-motion)
 */
export function BootEvCarAnimation({ reduceMotion = false }) {
  const theme = useTheme()
  const lamp =
    theme.palette.mode === 'dark' ? 'rgba(226, 232, 240, 0.92)' : 'rgba(255, 255, 255, 0.95)'
  const glass = theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(15, 23, 42, 0.18)'
  const bodyShadow =
    theme.palette.mode === 'dark'
      ? 'drop-shadow(0 4px 14px rgba(37, 99, 235, 0.35))'
      : 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.28))'

  return (
    <Box
      className={reduceMotion ? 'ev-boot-car ev-boot-car--static' : 'ev-boot-car'}
      aria-hidden="true"
      sx={{
        width: '100%',
        maxWidth: 220,
        height: 92,
        position: 'relative',
        mx: 'auto',
        overflow: 'visible',
        color: 'primary.main',
      }}
    >
      <Box
        className="ev-boot-car__ground"
        sx={{
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: 8,
          height: 3,
          borderRadius: 999,
          bgcolor: 'action.disabledBackground',
          opacity: 0.5,
        }}
      />
      <Box
        className="ev-boot-car__body"
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 16,
          width: 132,
          height: 72,
          marginLeft: '-66px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          transformOrigin: '50% 100%',
          filter: bodyShadow,
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 100 56"
          sx={{
            width: '100%',
            height: 'auto',
            maxHeight: 72,
            display: 'block',
          }}
        >
          {/* 정면 EV 실루엣: 넓은 범퍼·낮은 후드·슬림 윈드실드·측미러·LED 스트립 램프 */}
          <path
            fill="currentColor"
            d="M 7 46 C 7 50.5 11 53 17 53 L 83 53 C 89 53 93 50.5 93 46
               L 92 35 C 91 24 81 13 64 10 L 50 8 L 36 10
               C 19 13 9 24 8 35 Z"
          />
          <path fill={glass} d="M 30 15 L 50 12 L 70 15 L 74 23 L 26 23 Z" />
          <path
            fill="currentColor"
            opacity={0.32}
            d="M 4 32 C 3 30 5 27 8 27 L 11 28 L 10 34 L 6 34 C 4 34 3 33 4 32 Z
               M 96 32 C 97 30 95 27 92 27 L 89 28 L 90 34 L 94 34 C 96 34 97 33 96 32 Z"
          />
          <rect x="21" y="41.5" width="21" height="3.4" rx="1.3" fill={lamp} />
          <rect x="58" y="41.5" width="21" height="3.4" rx="1.3" fill={lamp} />
        </Box>
      </Box>
    </Box>
  )
}
