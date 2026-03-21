import { LayerGroup, CircleMarker } from 'react-leaflet'

/**
 * 부트 단계에서 클러스터보다 먼저 확실히 페인트되도록 SVG CircleMarker만 사용.
 * `pathOptions.className`은 SVG path/circle에 붙어 MapBootMarkerReady가 DOM 존재를 감지할 수 있게 함.
 */
export function EvStationBootCirclePaint({ active, stations, max = 100 }) {
  if (!active || !stations?.length) return null
  const list = stations.slice(0, Math.max(1, max))
  return (
    <LayerGroup>
      {list.map((s) => (
        <CircleMarker
          key={`boot-paint-${s.id}`}
          center={[s.lat, s.lng]}
          radius={8}
          pathOptions={{
            className: 'ev-map-boot-paint',
            color: '#1e40af',
            fillColor: '#3b82f6',
            fillOpacity: 0.88,
            weight: 2,
            opacity: 1,
          }}
        />
      ))}
    </LayerGroup>
  )
}
