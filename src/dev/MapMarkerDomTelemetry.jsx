import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { startMarkerIconMilestones, telemetryMapReady } from './mapMarkerTelemetry.js'

/** Leaflet mount 직후 DOM 마커 아이콘 개수 폴링 (DEV only) */
export function MapMarkerDomTelemetry() {
  const map = useMap()
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    telemetryMapReady()
    return startMarkerIconMilestones(() => map)
  }, [map])
  return null
}
