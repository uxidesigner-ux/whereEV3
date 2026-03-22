import { Box } from '@mui/material'
import { EvBrandMapMarkerSvg } from './EvBrandMapMarkerSvg.jsx'

/**
 * 「이 지역 검색」로딩용 — 지도 마커와 동일한 원+번개 3개 + 기존 nudge 애니메이션.
 */
export function EvMapStyleBoltCluster() {
  return (
    <Box className="ev-map-search-lightnings" aria-hidden>
      <Box className="ev-map-search-bolt ev-map-search-bolt--1">
        <EvBrandMapMarkerSvg size={26} />
      </Box>
      <Box className="ev-map-search-bolt ev-map-search-bolt--2">
        <EvBrandMapMarkerSvg size={18} />
      </Box>
      <Box className="ev-map-search-bolt ev-map-search-bolt--3">
        <EvBrandMapMarkerSvg size={16} />
      </Box>
    </Box>
  )
}
