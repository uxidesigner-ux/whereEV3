import { useSyncExternalStore } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { subscribeEvPipelineDebug, getEvPipelineDebugSnapshot } from './evPipelineDebugStore.js'
import { isEvPipelineLogEnabled, EV_PIPELINE_LOG_LABELS } from './evPipelinePerfLog.js'

function fmt(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v || '—'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/**
 * ?evPipeline=1 전용: 지도 위 고정 하단 패널 (실측 숫자)
 */
export function EvPipelineDebugPanel() {
  const theme = useTheme()
  const snap = useSyncExternalStore(
    subscribeEvPipelineDebug,
    getEvPipelineDebugSnapshot,
    () => ({}),
  )

  if (!isEvPipelineLogEnabled()) return null

  const isDark = theme.palette.mode === 'dark'
  const panelBg = isDark ? 'rgba(15,23,42,0.94)' : 'rgba(248,250,252,0.96)'
  const panelFg = isDark ? theme.palette.grey[100] : theme.palette.text.primary
  const panelBorder = isDark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.12)'

  const rows = [
    ['phase', snap.evPhase],
    ['fetchMs', snap.fetchMs],
    ['rawRowsScanned', snap.rawRowsScanned],
    ['boundsInsideRows', snap.boundsInsideRows],
    ['adaptedValidCoords', snap.adaptedValidCoords],
    ['groupedPlaces', snap.groupedPlaces],
    ['renderableAfterCap', snap.renderableAfterCap],
    ['finalRenderedMarkers', snap.finalRenderedMarkers],
    ['markerWaitMs', snap.markerWaitMs],
    ['fetchEndToFirstPaintMs', snap.fetchEndToFirstPaintMs],
    ['clickToFirstPaintMs', snap.clickToFirstPaintMs],
    ['msSinceFetchEnd(②)', snap.msSinceFetchEnd],
    ['slowHint', snap.slowHint],
  ]

  const samples = Array.isArray(snap.adapterSamples) ? snap.adapterSamples : []

  return (
    <Box
      data-ev-pipeline-debug="1"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 13000,
        maxHeight: '38vh',
        overflow: 'auto',
        px: 1,
        py: 0.75,
        bgcolor: panelBg,
        color: panelFg,
        borderTop: `1px solid ${panelBorder}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10,
        lineHeight: 1.35,
        pointerEvents: 'auto',
        WebkitOverflowScrolling: 'touch',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        {EV_PIPELINE_LOG_LABELS.fetchDone}
        {EV_PIPELINE_LOG_LABELS.reactPipeline}
        {EV_PIPELINE_LOG_LABELS.firstMarker}
        {EV_PIPELINE_LOG_LABELS.adapterSamples}
      </span>
      <Typography component="div" sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, color: 'inherit' }}>
        evPipeline (?evPipeline=1)
      </Typography>
      {rows.map(([k, v]) => (
        <div key={k}>
          <strong>{k}</strong>: {fmt(v)}
        </div>
      ))}
      {samples.length > 0 ? (
        <>
          <Typography component="div" sx={{ fontSize: 10, fontWeight: 700, mt: 0.5, mb: 0.25, color: 'inherit' }}>
            adapter-samples
          </Typography>
          {samples.map((s, i) => (
            <div key={i}>
              {i + 1}. x={fmt(s.rawX)} y={fmt(s.rawY)} → lat={fmt(s.adaptedLat)} lng={fmt(s.adaptedLng)} valid=
              {fmt(s.valid)} korea={fmt(s.korea)} boundsInside={fmt(s.boundsInside)}
            </div>
          ))}
        </>
      ) : null}
    </Box>
  )
}
