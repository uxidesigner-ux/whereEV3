import { Box } from '@mui/material'
import { motion, spacing } from '../theme/dashboardTheme.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

const GLASS_PADDING = 20
const GLASS_RADIUS = 20

/**
 * 지도 위 블롱 UI. MuiBox-root 단일 컨테이너, padding 24px / border-radius 24px 고정.
 */
export function SideOverlayPanel({
  side = 'left',
  children,
  sx = {},
  width = 320,
  mobileHeight = '45vh',
  mobilePosition = 'top',
  /** 데스크톱 패널 본문 스크롤 컨테이너 (상세 닫기 후 위치 복원용) */
  scrollRef,
  ...rest
}) {
  const { tokens } = useEvTheme()
  const g = tokens.glass
  return (
    <Box
      ref={scrollRef}
      className="ev-glass-overlay"
      sx={{
        background: g.panelBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${g.panelBorder}`,
        boxShadow: g.panelShadow,
        borderRadius: GLASS_RADIUS,
        padding: GLASS_PADDING,
        position: 'absolute',
        top: spacing.lg,
        bottom: spacing.lg,
        [side]: spacing.lg,
        width: width,
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 1000,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
        transition: `background ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
        '&:hover': {
          background: g.panelHoverBg,
          boxShadow: g.panelHoverShadow,
        },
        '@media (max-width: 900px)': {
          left: spacing.lg,
          right: spacing.lg,
          width: 'auto',
          maxHeight: mobileHeight,
          minHeight: 240,
          ...(mobilePosition === 'top'
            ? { top: spacing.lg, bottom: 'auto' }
            : { top: 'auto', bottom: spacing.lg }),
        },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}
