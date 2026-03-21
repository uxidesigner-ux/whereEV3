import { Box } from '@mui/material'

/**
 * 부트 로딩: 경량 EV 실루엣 이동 루프 (CSS transform, prefers-reduced-motion 대응)
 */
export function BootEvCarAnimation({ reduceMotion = false }) {
  return (
    <Box
      className={reduceMotion ? 'ev-boot-car ev-boot-car--static' : 'ev-boot-car'}
      aria-hidden="true"
      sx={{
        width: '100%',
        maxWidth: 200,
        height: 56,
        position: 'relative',
        mx: 'auto',
        overflow: 'hidden',
      }}
    >
      <Box
        className="ev-boot-car__track"
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 10,
          height: 3,
          borderRadius: 999,
          bgcolor: 'action.disabledBackground',
          opacity: 0.45,
        }}
      />
      <Box
        className="ev-boot-car__vehicle"
        sx={{
          position: 'absolute',
          bottom: 14,
          left: '12%',
          width: 36,
          height: 22,
          borderRadius: '6px 8px 4px 4px',
          bgcolor: 'primary.main',
          boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 4,
            top: 4,
            width: 8,
            height: 10,
            borderRadius: 1,
            bgcolor: 'warning.light',
            opacity: 0.95,
          },
        }}
      />
      <Box
        className="ev-boot-car__bolt"
        sx={{
          position: 'absolute',
          bottom: 22,
          left: 'calc(12% + 22px)',
          fontSize: 12,
          fontWeight: 800,
          color: 'warning.light',
          textShadow: '0 0 6px rgba(250,204,21,0.5)',
          pointerEvents: 'none',
        }}
      >
        ⚡
      </Box>
    </Box>
  )
}
