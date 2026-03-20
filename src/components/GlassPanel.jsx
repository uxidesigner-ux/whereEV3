import { Box } from '@mui/material'
import { radius } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/**
 * Liquid glass 스타일 패널 (라이트/다크 토큰).
 */
export function GlassPanel({ children, sx = {}, elevation = 'panel', ...rest }) {
  const { tokens } = useEvTheme()
  const base =
    elevation === 'card'
      ? {
          background: tokens.glass.panelBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${tokens.glass.panelBorder}`,
          boxShadow: tokens.shadow.card,
        }
      : {
          background: tokens.glass.panelBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${tokens.glass.panelBorder}`,
          boxShadow: tokens.glass.panelShadow,
        }
  const borderRadius = radius.glass
  return (
    <Box
      sx={{
        ...base,
        borderRadius,
        transition: 'background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}
