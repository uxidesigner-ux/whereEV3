import { Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material'
import Close from '@mui/icons-material/Close'
import { colors, motion } from '../theme/dashboardTheme.js'
import { StationDetailContent } from './StationDetailContent.jsx'

/**
 * 데스크톱 전용: 충전소 상세 중앙 Dialog. 모바일은 StationDetailSheet 사용.
 */
export function StationDetailModal({ open, station, onClose }) {
  if (!station) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: { sx: { bgcolor: 'rgba(15,23,42,0.35)' } },
        transition: {
          timeout: { enter: motion.duration.enter, exit: motion.duration.exit },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pr: 1,
          pt: 1.5,
          pb: 1.5,
          borderBottom: `1px solid ${colors.gray[200]}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.gray[800], fontSize: '1rem' }}>
          {station.statNm}
        </Typography>
        <IconButton onClick={onClose} aria-label="닫기" size="small" sx={{ color: colors.gray[600] }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5, pb: 2, px: 2 }}>
        <StationDetailContent station={station} stackActions={false} />
      </DialogContent>
    </Dialog>
  )
}
