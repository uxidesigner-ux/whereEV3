import { useCallback } from 'react'
import { Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { Box, Button, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { formatDistanceKm } from '../utils/geo.js'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

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
 * 전체(또는 전달된) 충전소 분포: 타일 + 마커 클러스터.
 * 시트/필터와 별도 데이터(stations)를 받아 지도만 담당.
 */
export function EvStationMapLayer({
  stations,
  onDetailClick,
  selectedId,
  isMobile,
  defaultMarkerIcon,
  selectedMarkerIcon,
  selectedMarkerIconMobile,
  uiColors,
  mapTileUrl,
  mapTileAttribution,
}) {
  const muiThemeLocal = useTheme()
  const { colors, resolvedMode } = useEvTheme()

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
    [colors.blue.primary, resolvedMode]
  )

  const iconFor = (id) => {
    if (selectedId !== id) return defaultMarkerIcon
    return isMobile && selectedMarkerIconMobile ? selectedMarkerIconMobile : selectedMarkerIcon
  }

  return (
    <>
      <TileLayer attribution={mapTileAttribution} url={mapTileUrl} subdomains="abcd" maxZoom={20} />
      <MarkerClusterGroup
        chunkedLoading
        chunkInterval={180}
        chunkDelay={40}
        maxClusterRadius={72}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick={false}
        disableClusteringAtZoom={17}
        removeOutsideVisibleBounds
        iconCreateFunction={iconCreateFunction}
        onClusterClick={(e) => {
          const layer = e.layer
          if (layer && typeof layer.zoomToBounds === 'function') {
            layer.zoomToBounds({ padding: [56, 56], maxZoom: 17 })
          }
        }}
      >
        {stations.map((s) => {
          const hint = mapPopupDistOrHint(s)
          const meta = mapPopupMetaLine(s)
          const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={iconFor(s.id)}
              zIndexOffset={selectedId === s.id ? 700 : 0}
              eventHandlers={
                isMobile && onDetailClick
                  ? {
                      click: () => {
                        onDetailClick(s)
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
        })}
      </MarkerClusterGroup>
    </>
  )
}
