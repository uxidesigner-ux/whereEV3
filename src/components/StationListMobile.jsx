import { Box, Typography } from '@mui/material'
import { colors } from '../theme/dashboardTheme.js'
import { formatDistanceKm } from '../utils/geo.js'

/**
 * 모바일 시트용 충전소 목록. 정렬된 배열을 받아 표시.
 * 각 아이템: statNm, busiNm·chgerTyLabel, 거리(있을 때)
 */
export function StationListMobile({ stations = [], selectedId, onSelect }) {
  if (!stations.length) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          조건에 맞는 충전소가 없습니다.
        </Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {stations.map((s) => {
        const isSelected = selectedId != null && s.id === selectedId
        return (
          <Box
            key={s.id}
            component="button"
            type="button"
            onClick={() => onSelect(s)}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              p: 1.25,
              borderRadius: 1.5,
              border: `1px solid ${isSelected ? colors.blue.primary : colors.gray[200]}`,
              bgcolor: isSelected ? colors.blue.muted : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
              '&:hover': { bgcolor: colors.gray[50], borderColor: colors.gray[300] },
              '&:active': { bgcolor: colors.gray[100] },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.gray[800], lineHeight: 1.3 }}>
              {s.statNm}
            </Typography>
            <Typography variant="caption" sx={{ color: colors.gray[600], display: 'block', mt: 0.25 }}>
              {s.busiNm} · {s.chgerTyLabel}
            </Typography>
            {s.distanceKm != null && (
              <Typography variant="caption" sx={{ color: colors.gray[500], display: 'block', mt: 0.25 }}>
                {formatDistanceKm(s.distanceKm)}
              </Typography>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
