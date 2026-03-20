import { Rectangle } from 'react-leaflet'

/**
 * 탐색 대상 지오펜스 시각 강조. overlayPane에 그려 마커(markerPane)보다 아래에 둠.
 * key(version)로 갱신 시 fade-in 애니메이션 재생.
 */
export function MapExploreHighlightFence({ boundsLiteral, version = 0 }) {
  if (!boundsLiteral?.southWest || !boundsLiteral?.northEast) return null
  const { southWest: sw, northEast: ne } = boundsLiteral
  const rectBounds = [
    [sw.lat, sw.lng],
    [ne.lat, ne.lng],
  ]
  return (
    <Rectangle
      key={version}
      bounds={rectBounds}
      pathOptions={{
        pane: 'overlayPane',
        className: 'ev-map-explore-fence',
        interactive: false,
        fillColor: '#434a58',
        fillOpacity: 0.19,
        color: '#5a6274',
        weight: 1.5,
        opacity: 0.58,
      }}
    />
  )
}
