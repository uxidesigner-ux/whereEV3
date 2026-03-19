import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, Button, useMediaQuery } from '@mui/material'
import Close from '@mui/icons-material/Close'
import Directions from '@mui/icons-material/Directions'
import Phone from '@mui/icons-material/Phone'
import { colors } from '../theme/dashboardTheme.js'

/**
 * 충전소 상세. 모바일에서는 하단 시트형(중앙 팝업 아님), 데스크탑에서는 중앙 Dialog.
 */
export function StationDetailModal({ open, station, onClose }) {
  const isMobile = useMediaQuery('(max-width: 900px)', { noSsr: true })

  if (!station) return null

  const address = station.adres || station.rnAdres || '-'
  const telno = station.telno?.trim() || ''
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`

  const content = (
    <>
      <Typography variant="body2" sx={{ color: colors.gray[700], mb: 0.5 }}>
        <strong>주소</strong> {address}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.gray[700], mb: 0.5 }}>
        <strong>운영기관</strong> {station.busiNm}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.gray[700], mb: 0.5 }}>
        <strong>충전기 타입</strong> {station.chgerTyLabel}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.gray[700], mb: 0.5 }}>
        <strong>이용시간</strong> {station.useTm || '-'}
      </Typography>
      {telno && (
        <Typography variant="body2" sx={{ color: colors.gray[700], mb: 1.5 }}>
          <strong>전화</strong> {telno}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<Directions />}
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ flex: 1, bgcolor: colors.blue.primary, '&:hover': { bgcolor: colors.blue.deep } }}
        >
          길찾기
        </Button>
        {telno && (
          <Button
            variant="outlined"
            startIcon={<Phone />}
            href={`tel:${telno}`}
            sx={{ flex: 1, borderColor: colors.gray[400], color: colors.gray[700] }}
          >
            전화
          </Button>
        )}
      </Box>
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={false}
      sx={
        isMobile
          ? {
              '& .MuiDialog-container': { alignItems: 'flex-end' },
              '& .MuiDialog-paper': { margin: 0, maxHeight: '85vh', borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' },
            }
          : undefined
      }
      slotProps={{ backdrop: { sx: isMobile ? { bgcolor: 'rgba(0,0,0,0.4)' } : {} } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pr: 1,
          borderBottom: `1px solid ${colors.gray[200]}`,
          pb: 1.5,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.gray[800], fontSize: '1rem' }}>
          {station.statNm}
        </Typography>
        <IconButton onClick={onClose} aria-label="닫기" size="small" sx={{ color: colors.gray[600] }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5, pb: 2 }}>{content}</DialogContent>
    </Dialog>
  )
}
