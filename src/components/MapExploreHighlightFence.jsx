import { Rectangle } from 'react-leaflet'

/**
 * 탐색 대상 지오펜스 시각 강조. overlayPane에 그려 마커(markerPane)보다 아래에 둠.
 * key(version)로 갱신 시 fade-in 애니메이션 재생.
 * @param {{ fenceFill: string, fenceFillOpacity: number, fenceStroke: string, fenceWeight: number, fenceStrokeOpacity: number }} mapTokens — semanticTokens.map
 */
export function MapExploreHighlightFence({ boundsLiteral, version = 0, mapTokens }) {
  if (!boundsLiteral?.southWest || !boundsLiteral?.northEast) return null
  const { southWest: sw, northEast: ne } = boundsLiteral
  const rectBounds = [
    [sw.lat, sw.lng],
    [ne.lat, ne.lng],
  ]
  const m = mapTokens
  return (
    <Rectangle
      key={version}
      bounds={rectBounds}
      pathOptions={{
        pane: 'overlayPane',
        className: 'ev-map-explore-fence',
        interactive: false,
        fillColor: m.fenceFill,
        fillOpacity: m.fenceFillOpacity,
        color: m.fenceStroke,
        weight: m.fenceWeight,
        opacity: m.fenceStrokeOpacity,
      }}
    />
  )
}
