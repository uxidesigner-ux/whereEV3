import { LayerGroup, Marker, CircleMarker } from 'react-leaflet'

/** 광화문 광장 인근 기준점 */
const PROOF_GWANGHWAMUN = [37.5759, 126.9768]
const PROOF_FIVE_NEAR = [
  [37.5765, 126.9775],
  [37.5753, 126.9758],
  [37.5761, 126.9782],
  [37.5748, 126.977],
  [37.5756, 126.9762],
]

/**
 * A: Leaflet 기본 Marker 1개 (광화문) — icon 미지정 = 브라우저 기본 마커 경로
 * B: CircleMarker 5개
 * C: API에서 온 좌표 샘플( bounds 우회 검증용 )
 */
export function MapMarkerProofLayers({ showHardcoded, apiFirst20 }) {
  return (
    <LayerGroup>
      {showHardcoded ? (
        <>
          <Marker position={PROOF_GWANGHWAMUN} />
          {PROOF_FIVE_NEAR.map((ll, i) => (
            <CircleMarker
              key={`proof5-${i}`}
              center={ll}
              radius={9}
              pathOptions={{
                color: '#7c3aed',
                fillColor: '#ddd6fe',
                fillOpacity: 0.9,
                weight: 2,
              }}
            />
          ))}
        </>
      ) : null}
      {(apiFirst20 || []).map((p, i) => (
        <CircleMarker
          key={`proof-api-${p.id ?? i}`}
          center={[p.lat, p.lng]}
          radius={7}
          pathOptions={{
            color: '#047857',
            fillColor: '#6ee7b7',
            fillOpacity: 0.95,
            weight: 2,
          }}
        />
      ))}
    </LayerGroup>
  )
}
