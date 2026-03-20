import { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { StationDetailContent } from './StationDetailContent.jsx'

/**
 * 모바일 통합 바텀 시트 스크롤 영역 안의 상세 본문(CTA는 시트 footer 슬롯).
 */
export function MobileDetailSheetBody({
  station,
  chargerSummaryUpdatedInHeader = false,
}) {
  const [chargerStatFilter, setChargerStatFilter] = useState(/** @type {'all' | '2' | '3' | '5'} */ ('all'))
  useEffect(() => {
    if (station) setChargerStatFilter('all')
  }, [station])

  if (!station) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <StationDetailContent
        station={station}
        stackActions
        detachedFooter
        chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
        chargerStatFilter={chargerStatFilter}
        onChargerStatFilterChange={setChargerStatFilter}
      />
    </Box>
  )
}
