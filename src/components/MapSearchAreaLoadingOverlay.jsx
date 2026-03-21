import { Box, Typography } from '@mui/material'
import FlashOn from '@mui/icons-material/FlashOn'
import './MapSearchAreaLoadingOverlay.css'

/**
 * 「이 지역 검색」summary fetch 전용 로딩 — 초기 부트 오버레이와 분리.
 */
export function MapSearchAreaLoadingOverlay({
  open,
  title = '이 지역 충전소를 불러오는 중이에요',
  subtitle = '전기가 연결되는 동안 잠시만 기다려 주세요',
  /** root에 직접 넣는 CSS 변수 객체 (예: { '--ev-search-area-dim': '...' }) */
  style: rootStyle = {},
}) {
  if (!open) return null

  return (
    <Box
      className="ev-map-search-loading-root"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={rootStyle}
    >
      <Box className="ev-map-search-loading-content">
        <Box className="ev-map-search-lightnings" aria-hidden>
          <FlashOn className="ev-map-search-bolt ev-map-search-bolt--1" />
          <FlashOn className="ev-map-search-bolt ev-map-search-bolt--2" />
          <FlashOn className="ev-map-search-bolt ev-map-search-bolt--3" />
        </Box>
        <Typography className="ev-map-search-title" component="p">
          {title}
        </Typography>
        <Typography className="ev-map-search-subtitle" component="p">
          {subtitle}
        </Typography>
      </Box>
    </Box>
  )
}
