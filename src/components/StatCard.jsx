import { Box, Typography } from '@mui/material'
import { GlassPanel } from './GlassPanel.jsx'
import { colors, motion } from '../theme/dashboardTheme.js'

/**
 * KPI용 컴팩트 스탯 카드. 제목-숫자 타이트, 작은 요약 카드 스타일.
 */
export function StatCard({ label, value, sx = {} }) {
  return (
    <GlassPanel
      elevation="card"
      sx={{
        padding: '8px 10px',
        minHeight: 0,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 0.5,
        transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
        ...sx,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: colors.gray[500],
          fontWeight: 500,
          fontSize: '0.7rem',
          lineHeight: 1.2,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="span"
        sx={{
          color: colors.blue.primary,
          fontWeight: 700,
          fontSize: '1.1rem',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </Typography>
    </GlassPanel>
  )
}
