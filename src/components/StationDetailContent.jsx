import { Typography, Box, Button } from '@mui/material'
import Directions from '@mui/icons-material/Directions'
import Phone from '@mui/icons-material/Phone'
import { colors, radius, motion } from '../theme/dashboardTheme.js'
import { getStatLabel } from '../api/safemapEv.js'

/**
 * 충전소 상세 본문(데스크톱 Dialog / 모바일 시트 공용).
 * station: 그룹(rows, totalChargers, …) 또는 단일 row.
 */
export function StationDetailContent({ station, stackActions = false }) {
  if (!station) return null

  const address = station.adres || station.rnAdres || '-'
  const telno = station.telno?.trim() || ''
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`

  const totalChargers = station.totalChargers ?? (station.rows ? station.rows.length : 1)
  const statCounts = station.statCounts ?? (station.stat != null && station.stat !== '' ? { [String(station.stat)]: 1 } : {})
  const latestStatUpdDt = station.latestStatUpdDt ?? (station.statUpdDt || '')
  const statOrder = ['2', '3', '5', '4', '1', '9']

  return (
    <>
      {totalChargers > 0 && (
        <Box sx={{ mb: 1.25, p: 1, borderRadius: `${radius.sm}px`, bgcolor: colors.gray[50], border: `1px solid ${colors.gray[200]}` }}>
          <Typography variant="caption" sx={{ color: colors.gray[500], fontWeight: 600, display: 'block', mb: 0.5 }}>충전기 현황</Typography>
          <Typography variant="body2" sx={{ color: colors.gray[800], fontWeight: 600 }}>총 {totalChargers}대</Typography>
          {Object.keys(statCounts).length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
              {[...statOrder, ...Object.keys(statCounts).filter((c) => !statOrder.includes(c))].filter((code) => statCounts[code] > 0).map((code) => (
                <Typography key={code} variant="caption" sx={{ color: colors.gray[700], fontSize: '0.8125rem' }}>
                  {getStatLabel(code)} {statCounts[code]}대
                </Typography>
              ))}
            </Box>
          )}
          {latestStatUpdDt && (
            <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', mt: 0.5 }}>상태 갱신: {latestStatUpdDt}</Typography>
          )}
        </Box>
      )}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: colors.gray[500], fontWeight: 600, display: 'block', mb: 0.25 }}>주소</Typography>
        <Typography variant="body2" sx={{ color: colors.gray[800], lineHeight: 1.5, wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {address}
        </Typography>
      </Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: colors.gray[500], fontWeight: 600, display: 'block', mb: 0.25 }}>이용시간</Typography>
        <Typography variant="body2" sx={{ color: colors.gray[800] }}>{station.useTm || '-'}</Typography>
      </Box>
      <Box sx={{ py: 1, borderTop: `1px solid ${colors.gray[200]}`, borderBottom: `1px solid ${colors.gray[200]}`, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="body2" sx={{ color: colors.gray[600], fontSize: '0.8125rem' }}><strong>운영기관</strong> {station.busiNm}</Typography>
        <Typography variant="body2" sx={{ color: colors.gray[600], fontSize: '0.8125rem' }}><strong>충전기</strong> {station.displayChgerLabel ?? station.chgerTyLabel}</Typography>
        {telno && <Typography variant="body2" sx={{ color: colors.gray[600], fontSize: '0.8125rem' }}><strong>전화</strong> {telno}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: stackActions ? 'column' : 'row', gap: 1, mt: 2, pt: 1 }}>
        <Button
          variant="contained"
          startIcon={<Directions />}
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            flex: 1,
            minHeight: 46,
            py: 1,
            borderRadius: `${radius.sm}px`,
            bgcolor: colors.blue.primary,
            fontWeight: 600,
            fontSize: stackActions ? '0.875rem' : undefined,
            textTransform: 'none',
            transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
            '&:hover': { bgcolor: colors.blue.deep },
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          길찾기
        </Button>
        {telno && (
          <Button
            variant="outlined"
            startIcon={<Phone />}
            href={`tel:${telno}`}
            sx={{
              flex: 1,
              minHeight: 46,
              py: 1,
              borderRadius: `${radius.sm}px`,
              borderColor: colors.gray[300],
              color: colors.gray[800],
              fontWeight: 600,
              fontSize: stackActions ? '0.875rem' : undefined,
              textTransform: 'none',
              transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            전화
          </Button>
        )}
      </Box>
    </>
  )
}
