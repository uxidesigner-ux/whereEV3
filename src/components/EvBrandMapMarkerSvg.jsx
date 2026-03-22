import { Box } from '@mui/material'

/**
 * 지도 기본 마커와 동일한 원 + 번개 (CSS 변수로 색).
 * @param {{ size?: number, className?: string, sx?: object }} props
 */
export function EvBrandMapMarkerSvg({ size = 22, className, sx }) {
  return (
    <Box
      component="svg"
      className={`ev-marker-brand-svg${className ? ` ${className}` : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden
      focusable="false"
      sx={{ display: 'block', width: size, height: size, flexShrink: 0, ...sx }}
    >
      <circle
        className="ev-marker-brand-circle"
        cx="40"
        cy="40"
        r="39.5"
        fill="var(--ev-search-area-marker-fill, var(--ev-map-marker-fill, #1F45FF))"
        stroke="var(--ev-search-area-marker-stroke, var(--ev-map-marker-stroke, #fff))"
        style={{ strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }}
      />
      <path
        d="M33.0072 19L29 43.15H37.0057L33.0072 61L52 35.8H43.0034L51.0004 19H33.0072Z"
        fill="var(--ev-search-area-marker-bolt, var(--ev-map-marker-bolt, #FCFC07))"
      />
    </Box>
  )
}
