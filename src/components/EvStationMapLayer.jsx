import { useCallback, useMemo, memo, useEffect } from 'react'
import { LayerGroup, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Box, Button, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { formatDistanceKm } from '../utils/geo.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'
import { telemetryMarkerComponentRender } from '../dev/mapMarkerTelemetry.js'
import {
  logDiag,
  diagEvLayerMountCount,
  diagIconResolveCountRef,
} from '../dev/evMapDiag.js'

/** 진단용: 브랜드 SVG 없이 최소 divIcon */
const LEAFLET_LIGHT_MARKER_ICON = L.divIcon({
  className: 'ev-marker-light-diag',
  html: '<div style="width:11px;height:11px;background:#2563eb;border-radius:50%;border:1px solid #fff;box-sizing:border-box"></div>',
  iconSize: [11, 11],
  iconAnchor: [5, 5],
})

function mapPopupDistOrHint(s) {
  if (s.distanceKm != null && !Number.isNaN(s.distanceKm)) return formatDistanceKm(s.distanceKm)
  return (s.locationHint || '').trim()
}

function mapPopupMetaLine(s) {
  const speed = (s.speedBadge || s.speedCategory || '').trim()
  const busi = (s.busiNm || '').trim() || '—'
  return speed ? `${busi} · ${speed}` : busi
}

/**
 * 모바일: Popup 없음 · props 안정화로 부모 리렌더 시 불필요한 Leaflet 갱신 감소
 */
const EvStationMapMarkerLite = memo(
  function EvStationMapMarkerLite({
    id,
    lat,
    lng,
    selected,
    defaultIcon,
    selectedIcon,
    selectedIconMobile,
    isMobile,
    onPickId,
    iconDiag,
  }) {
    if (import.meta.env.DEV) telemetryMarkerComponentRender()
    if (iconDiag) {
      // eslint-disable-next-line react-hooks/immutability -- 진단 전역 ref 카운터
      diagIconResolveCountRef.current += 1
    }

    const icon =
      selected && isMobile && selectedIconMobile
        ? selectedIconMobile
        : selected
          ? selectedIcon
          : defaultIcon

    const handlers = useMemo(
      () =>
        isMobile && onPickId
          ? {
              click: () => {
                onPickId(id)
              },
            }
          : undefined,
      [isMobile, onPickId, id],
    )

    return (
      <Marker
        position={[lat, lng]}
        icon={icon}
        zIndexOffset={selected ? 700 : 0}
        eventHandlers={handlers}
      />
    )
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.lat === next.lat &&
    prev.lng === next.lng &&
    prev.selected === next.selected &&
    prev.isMobile === next.isMobile &&
    prev.defaultIcon === next.defaultIcon &&
    prev.selectedIcon === next.selectedIcon &&
    prev.selectedIconMobile === next.selectedIconMobile &&
    prev.onPickId === next.onPickId &&
    prev.iconDiag === next.iconDiag,
)

/**
 * 전체(또는 전달된) 충전소 분포: 타일 + 마커 클러스터.
 * 시트/필터와 별도 데이터(stations)를 받아 지도만 담당.
 * @param {'lite' | 'full'} variant lite=비클러스터 즉시 페인트, full=MarkerClusterGroup
 */
export function EvStationMapLayer({
  stations,
  onDetailClick,
  /** 모바일 경량 마커: id만 넘김 — 상세 시트는 부모가 최신 station 맵으로 조회 */
  onDetailClickById,
  onClusterTap,
  selectedId,
  isMobile,
  defaultMarkerIcon,
  selectedMarkerIcon,
  selectedMarkerIconMobile,
  uiColors,
  mapTileUrl,
  mapTileAttribution,
  /** false면 초기 마커를 한 번에 올려 체감 지연 완화(대량일 때만 true 권장) */
  markerClusterChunked = true,
  /** true면 화면 밖 마커를 클러스터에서 제거(대량 시 유리). 초기 페인트에서 마커가 비는 경우가 있어 기본은 false */
  removeOutsideVisibleBounds = false,
  variant = 'full',
  /** DEV evDiag=light: 브랜드 divIcon 대신 최소 원형 아이콘 */
  diagnosticLightMarkers = false,
  /** DEV evDiag=track: 레이어 마운트·아이콘 resolve 횟수 로그 */
  diagnosticTrack = false,
}) {
  const map = useMap()
  const muiThemeLocal = useTheme()
  const { colors, resolvedMode } = useEvTheme()

  useEffect(() => {
    if (!import.meta.env.DEV || !diagnosticTrack) return undefined
    diagEvLayerMountCount.current += 1
    logDiag('EvStationMapLayer mount', String(diagEvLayerMountCount.current))
    return () => {
      logDiag('EvStationMapLayer unmount', '')
    }
  }, [diagnosticTrack])

  const iconCreateFunction = useCallback(
    (cluster) => {
      const count = cluster.getChildCount()
      const tier = count < 10 ? 'sm' : count < 100 ? 'md' : 'lg'
      const dim = tier === 'sm' ? 40 : tier === 'md' ? 48 : 56
      const fontPx = tier === 'sm' ? 12 : tier === 'md' ? 13 : 14
      const label = count > 999 ? '999+' : String(count)
      const bg = colors.blue.primary
      const fg = '#ffffff'
      const ring = resolvedMode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)'
      return L.divIcon({
        html: `<div class="ev-cluster-disc" style="width:${dim}px;height:${dim}px;background:${bg};color:${fg};font-size:${fontPx}px;border:2px solid ${ring}">${label}</div>`,
        className: 'ev-marker-cluster-wrap',
        iconSize: L.point(dim, dim),
        iconAnchor: L.point(dim / 2, dim / 2),
      })
    },
    [colors.blue.primary, resolvedMode],
  )

  /** lite: 개별 경량 마커만. full: MarkerClusterGroup + 숫자 클러스터(모바일도 동일). */
  const useLiteMarkers = Boolean(isMobile && onDetailClickById && variant === 'lite')

  const liteDefaultIcon = diagnosticLightMarkers ? LEAFLET_LIGHT_MARKER_ICON : defaultMarkerIcon
  const liteSelectedIcon = diagnosticLightMarkers ? LEAFLET_LIGHT_MARKER_ICON : selectedMarkerIcon
  const liteSelectedMobile = diagnosticLightMarkers ? LEAFLET_LIGHT_MARKER_ICON : selectedMarkerIconMobile

  const markerNodesLite = useMemo(() => {
    if (!useLiteMarkers) return null
    return stations.map((s) => (
      <EvStationMapMarkerLite
        key={s.id}
        id={s.id}
        lat={s.lat}
        lng={s.lng}
        selected={selectedId === s.id}
        defaultIcon={liteDefaultIcon}
        selectedIcon={liteSelectedIcon}
        selectedIconMobile={liteSelectedMobile}
        isMobile={isMobile}
        onPickId={onDetailClickById}
        iconDiag={diagnosticTrack}
      />
    ))
  }, [
    useLiteMarkers,
    stations,
    selectedId,
    liteDefaultIcon,
    liteSelectedIcon,
    liteSelectedMobile,
    isMobile,
    onDetailClickById,
    diagnosticTrack,
  ])

  const iconFor = useCallback(
    (id) => {
      if (selectedId !== id) return defaultMarkerIcon
      return isMobile && selectedMarkerIconMobile ? selectedMarkerIconMobile : selectedMarkerIcon
    },
    [selectedId, isMobile, selectedMarkerIconMobile, defaultMarkerIcon, selectedMarkerIcon],
  )

  const markerNodesDesktop = useMemo(() => {
    if (useLiteMarkers) return null
    return stations.map((s) => {
      const hint = mapPopupDistOrHint(s)
      const meta = mapPopupMetaLine(s)
      const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
      return (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          evStation={s}
          icon={iconFor(s.id)}
          zIndexOffset={selectedId === s.id ? 700 : 0}
          eventHandlers={
            isMobile && (onDetailClick || onDetailClickById)
              ? {
                  click: () => {
                    if (onDetailClick) onDetailClick(s)
                    else if (onDetailClickById) onDetailClickById(s.id)
                  },
                }
              : undefined
          }
        >
          {!isMobile ? (
            <Popup maxWidth={260}>
              <Box
                component="div"
                sx={{
                  fontFamily: muiThemeLocal.typography.fontFamily,
                  margin: '-4px -6px',
                  minWidth: 200,
                }}
              >
                <Typography
                  component="div"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: uiColors.gray[900],
                    lineHeight: 1.25,
                  }}
                >
                  {s.statNm}
                </Typography>
                {hint ? (
                  <Typography
                    component="div"
                    sx={{ fontSize: '0.6875rem', color: uiColors.gray[500], mt: 0.2, lineHeight: 1.35 }}
                  >
                    {hint}
                  </Typography>
                ) : null}
                <Typography
                  component="div"
                  sx={{ fontSize: '0.6875rem', color: uiColors.gray[600], mt: 0.15, lineHeight: 1.35 }}
                >
                  {meta}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                  {onDetailClick ? (
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      onClick={() => onDetailClick(s)}
                      sx={{
                        minWidth: 0,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        py: 0.2,
                        px: 0.5,
                        color: uiColors.blue.primary,
                        textTransform: 'none',
                      }}
                    >
                      상세
                    </Button>
                  ) : null}
                  <Button
                    component="a"
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="text"
                    size="small"
                    sx={{
                      minWidth: 0,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      py: 0.2,
                      px: 0.5,
                      color: uiColors.gray[700],
                      textTransform: 'none',
                    }}
                  >
                    길찾기
                  </Button>
                </Box>
              </Box>
            </Popup>
          ) : null}
        </Marker>
      )
    })
  }, [
    useLiteMarkers,
    stations,
    iconFor,
    selectedId,
    isMobile,
    onDetailClick,
    onDetailClickById,
    muiThemeLocal.typography.fontFamily,
    uiColors,
  ])

  const markerNodes = useLiteMarkers ? markerNodesLite : markerNodesDesktop

  const clusterClickHandler = useCallback(
    (e) => {
      const layer = e.layer
      if (!layer) return
      const bounds = typeof layer.getBounds === 'function' ? layer.getBounds() : null
      const raw = typeof layer.getAllChildMarkers === 'function' ? layer.getAllChildMarkers() : []
      const picked = []
      const seen = new Set()
      for (const m of raw) {
        const st = m.options?.evStation
        if (st?.id != null && st.id !== '') {
          if (!seen.has(st.id)) {
            seen.add(st.id)
            picked.push(st)
          }
        }
      }
      if (picked.length === 0 && stations?.length && bounds?.isValid?.()) {
        for (const s of stations) {
          if (s?.id != null && bounds.contains([s.lat, s.lng]) && !seen.has(s.id)) {
            seen.add(s.id)
            picked.push(s)
          }
        }
      }
      if (picked.length > 0 && typeof onClusterTap === 'function') {
        onClusterTap({ stations: picked, bounds })
      }
      if (map && bounds?.isValid?.() && picked.length > 0) {
        const center = bounds.getCenter()
        if (!map.getBounds().contains(center)) {
          map.panTo(center, { animate: true, duration: 0.2 })
        }
      }
    },
    [stations, onClusterTap, map],
  )

  return (
    <>
      <TileLayer attribution={mapTileAttribution} url={mapTileUrl} subdomains="abcd" maxZoom={20} />
      {variant === 'lite' ? (
        <LayerGroup>{markerNodes}</LayerGroup>
      ) : (
        <MarkerClusterGroup
          chunkedLoading={markerClusterChunked}
          chunkInterval={markerClusterChunked ? 90 : 0}
          chunkDelay={markerClusterChunked ? 24 : 0}
          maxClusterRadius={72}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick={false}
          disableClusteringAtZoom={17}
          removeOutsideVisibleBounds={removeOutsideVisibleBounds}
          iconCreateFunction={iconCreateFunction}
          onClick={clusterClickHandler}
        >
          {markerNodes}
        </MarkerClusterGroup>
      )}
    </>
  )
}
