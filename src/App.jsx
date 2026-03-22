import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Button,
  Fade,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MapOutlined from '@mui/icons-material/MapOutlined'
import ViewList from '@mui/icons-material/ViewList'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Refresh from '@mui/icons-material/Refresh'
import { MapContainer, Circle, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  aggregateStatCounts,
  getLatestStatUpdDt,
  formatStatSummary,
  formatAddressBlockLines,
} from './api/safemapEv.js'
import { filterNormalizedRowsToBounds } from './api/evViewportSummary.js'
import { assignFullEvCatalogWithIndex } from './utils/evCatalogSpatialIndex.js'
import { fetchEvStationsSummaryDataset, resolveEvStationsSummaryUrl } from './api/evStationsSummary.js'
import { fetchDetailRowsForStatId, clearDetailRowsCache } from './api/evPlaceDetail.js'
import { getDevMockEvChargers } from './dev/mockEvChargers.js'
import {
  haversineDistanceKm,
  placeKey,
  formatListSummary,
  summarizeSpeedCategories,
  pickShortLocationHint,
  formatDistanceKm,
} from './utils/geo.js'
import { groupChargerRowsByPlaceMapLite } from './utils/evStationGroup.js'

/** 상세/마커 동기화용: 동일 장소(placeKey) 행으로 그룹 객체 재구성 */
function buildPlaceGroupFromRows(rows, distanceKmPreserve) {
  if (!rows?.length) return null
  const first = rows[0]
  const statCounts = aggregateStatCounts(rows)
  let adres = ''
  let rnAdres = ''
  for (const r of rows) {
    if (!adres && (r.adres || '').trim()) adres = (r.adres || '').trim()
    if (!rnAdres && (r.rnAdres || '').trim()) rnAdres = (r.rnAdres || '').trim()
    if (adres && rnAdres) break
  }
  return {
    id: placeKey(first),
    statNm: first.statNm,
    lat: first.lat,
    lng: first.lng,
    distanceKm: distanceKmPreserve != null ? distanceKmPreserve : 0,
    totalChargers: rows.length,
    statCounts,
    statSummary: formatStatSummary(statCounts),
    latestStatUpdDt: getLatestStatUpdDt(rows),
    busiNm: formatListSummary(rows.map((r) => r.busiNm), 2),
    chgerTyLabel: formatListSummary(rows.map((r) => r.displayChgerLabel ?? r.chgerTyLabel), 2),
    rows,
    adres: adres || (first.adres || '').trim(),
    rnAdres: rnAdres || (first.rnAdres || '').trim(),
    useTm: first.useTm,
    telno: first.telno,
    speedBadge: summarizeSpeedCategories(rows),
    locationHint: pickShortLocationHint(rows, first),
  }
}

function rowsMatchingDetailStation(prev, flatItems) {
  if (!prev || !flatItems?.length) return []
  const key = Array.isArray(prev.rows) && prev.rows.length ? prev.id : placeKey(prev)
  return flatItems.filter((r) => placeKey(r) === key)
}
import { cssEscapeAttr } from './utils/cssEscape.js'
import { buildRegionFilterOptions } from './utils/regionDisplay.js'
import { itemMatchesEvSearchQuery } from './utils/evSearch.js'
import {
  pickMobileSearchRadiusTier,
  squareBoundsLiteralAroundCenter,
} from './utils/mobileRadiusSearch.js'
import { MOBILE_QUICK_SEARCH_PLACE_PRESETS } from './utils/mobileQuickSearchPlacePresets.js'
import { zoomForHorizontalSpanMeters } from './utils/mapZoomMeters.js'
import { computeBootLeafletView, GWANGHWAMUN_FALLBACK, mapBootstrapWidthPx } from './utils/mapInitialView.js'
import {
  spacing,
  radius,
  motion,
  sheetLayout,
  mobileMapChrome,
  appMobileType,
} from './theme/dashboardTheme.js'
import { useEvTheme } from './theme/ThemeModeProvider.jsx'
import { StationListMobile } from './components/StationListMobile.jsx'
import { MobileMapSearchBar } from './components/MobileMapSearchBar.jsx'
import { MobileMapQuickSearchChipsRail } from './components/MobileMapQuickSearchChipsRail.jsx'
import { EvStationMapLayer } from './components/EvStationMapLayer.jsx'
import { EvStationBootCirclePaint } from './components/EvStationBootCirclePaint.jsx'
import { MapBootMarkerReady } from './components/MapBootMarkerReady.jsx'
import { MapMobileSearchViewportFitter } from './components/MapMobileSearchViewportFitter.jsx'
import { MapSearchAreaLoadingOverlay } from './components/MapSearchAreaLoadingOverlay.jsx'
import { StationDetailFooterActions } from './components/StationDetailContent.jsx'
import { MobileBottomSheet } from './components/MobileBottomSheet.jsx'
import { MobileDetailSheetBody } from './components/MobileDetailSheetBody.jsx'
import { MobileFilterSheet } from './components/MobileFilterSheet.jsx'
import {
  telemetryAppMount,
  telemetryLocationResolved,
  telemetryItemsReady,
  telemetryMapLayerStations,
  telemetryBootOverlayHidden,
  logMapLayerStationsSummary,
} from './dev/mapMarkerTelemetry.js'
import { MapMarkerDomTelemetry } from './dev/MapMarkerDomTelemetry.jsx'
import {
  parseEvMapDiag,
  logDiag,
  diagMapLayerRefChanges,
  diagEvLayerMountCount,
  diagIconResolveCountRef,
  evMapDiagHarnessBootMarkerCount,
} from './dev/evMapDiag.js'
import {
  viewportSummaryTelemetry,
  viewportSummaryMarkFetchStart,
  viewportSummaryMarkAbort,
  viewportSummaryMarkStale,
  viewportSummaryMarkApplied,
} from './dev/viewportSummaryTelemetry.js'
import { MapLeafletExperiments } from './dev/MapLeafletExperiments.jsx'
import { MapMarkerProofLayers } from './components/MapMarkerProofLayers.jsx'
import { searchAreaTimingMetrics, searchAreaTimingLog } from './dev/mapSearchAreaTiming.js'
import {
  isEvPipelineLogEnabled,
  logEvPipelineFetchDone,
  logEvPipelineReactPipeline,
  logEvPipelineFirstMarker,
  evPipelineSlowHint,
} from './dev/evPipelinePerfLog.js'
import { EvPipelineDebugPanel } from './dev/EvPipelineDebugPanel.jsx'
import { BootEvCarAnimation } from './components/BootEvCarAnimation.jsx'
import { BootSegmentedProgress } from './components/BootSegmentedProgress.jsx'

/**
 * @param {React.Dispatch<React.SetStateAction<number>>} setProgress
 */
function easeBootProgress(setProgress, from, to, durationMs) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / Math.max(1, durationMs))
      const ease = 1 - (1 - u) ** 2
      setProgress(from + (to - from) * ease)
      if (u < 1) requestAnimationFrame(tick)
      else {
        setProgress(to)
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/** 부트 종료: 90%대→100% 자연스럽게 (ease-out cubic) */
function easeBootProgressEaseOutCubic(setProgress, from, to, durationMs) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / Math.max(1, durationMs))
      const ease = 1 - (1 - u) ** 3
      setProgress(from + (to - from) * ease)
      if (u < 1) requestAnimationFrame(tick)
      else {
        setProgress(to)
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/**
 * ev-stations-summary.json fetch 동안 세그먼트 바가 멈춘 것처럼 보이지 않게,
 * 약 0.5초마다 1%씩 상한(71%)까지 올림. 완료 후 72% 단계로 이어짐.
 * @param {React.Dispatch<React.SetStateAction<number>>} setProgress
 * @returns {() => void}
 */
function startBootSummaryFetchProgressCreep(setProgress) {
  const CAP = 71
  const id = window.setInterval(() => {
    setProgress((p) => {
      if (p >= CAP) return p
      return p + 1
    })
  }, 520)
  return () => window.clearInterval(id)
}

function getBootstrapGeolocationPosition() {
  return new Promise((resolve) => {
    const fallback = () =>
      resolve({
        lat: GWANGHWAMUN_FALLBACK.lat,
        lng: GWANGHWAMUN_FALLBACK.lng,
        usedGeo: false,
      })
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fallback()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          usedGeo: true,
        })
      },
      () => fallback(),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    )
  })
}

/** 클러스터 묶음 시트 빠른 필터용 */
function clusterGroupedHasFastCharging(s) {
  const badge = (s.speedBadge || '').trim()
  if (badge.includes('급속')) return true
  const rows = Array.isArray(s.rows) ? s.rows : []
  return rows.some((r) => r.speedCategory === '급속')
}

function clusterGroupedMatchesBusiNm(s, needle) {
  if (!needle) return true
  const rows = Array.isArray(s.rows) ? s.rows : []
  return rows.some((r) => (r.busiNm || '').trim() === needle)
}

/** 모바일: LayerGroup만 쓸 때 한 번에 올릴 마커 상한(성능). 전국 캐시+뷰포트 필터 후에도 고밀도 대응 */
const MOBILE_MAP_MARKER_CAP = 360
/** 뷰포트 내 전체 행에 가깝게 그룹 입력(캐시 기반 완전성 우선, 저사양에서는 여전히 부담 가능) */
const MAP_GROUP_INPUT_ROW_CAP = 6000

/** 부트 오버레이 안내 문구 순환(1.6~2.2초 간격은 App에서 prefers-reduced-motion 반영) */
const BOOT_LOADING_ROTATION_MESSAGES = [
  '내 주변 충전소를 찾고 있어요',
  '충전 가능한 위치를 불러오는 중이에요',
  '가까운 충전소 정보를 정리하고 있어요',
  '지도를 준비하고 있어요',
  '곧 충전소가 표시돼요',
]

/** 모바일 상세 시트 헤더 좌우 인셋 (MUI spacing 2.5 ≈ 20px) */
const MOBILE_DETAIL_HEADER_GUTTER = 2.5
/** 상세 full 헤더 앱바 높이에 맞춘 최소 높이 */
const MOBILE_DETAIL_FULL_HEADER_MIN_H = 56

/** 브랜드 원형 마커: r=39.5, stroke·fill은 CSS 변수(라이트 흰 테두리 / 다크 검정 테두리) */
const EV_MAP_MARKER_SVG = `<svg class="ev-marker-brand-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false"><circle class="ev-marker-brand-circle" cx="40" cy="40" r="39.5" fill="var(--ev-map-marker-fill, #1F45FF)" stroke="var(--ev-map-marker-stroke, #fff)"/><path d="M33.0072 19L29 43.15H37.0057L33.0072 61L52 35.8H43.0034L51.0004 19H33.0072Z" fill="var(--ev-map-marker-bolt, #FCFC07)"/></svg>`

const DEFAULT_MARKER_ICON = L.divIcon({
  className: 'ev-marker ev-marker-default',
  html: `<span class="ev-marker-brand">${EV_MAP_MARKER_SVG}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})
const SELECTED_MARKER_ICON = L.divIcon({
  className: 'ev-marker ev-marker-selected',
  html: `<span class="ev-marker-brand">${EV_MAP_MARKER_SVG}</span>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
})
/** 모바일: 팝업 없이 선택 시 pin형 액티브 마커 (아래 뾰족) */
const MOBILE_PIN_SELECTED_MARKER_ICON = L.divIcon({
  className: 'ev-marker ev-marker-pin-selected',
  html: `<div class="ev-marker-pin" aria-hidden="true"><div class="ev-marker-pin-body">${EV_MAP_MARKER_SVG}</div><span class="ev-marker-pin-tip"></span></div>`,
  iconSize: [48, 56],
  iconAnchor: [24, 56],
})

/** 상단/패널 충전 타입 필터: 사용자 용어(급속·완속) 단순화 */
const SPEED_FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: '급속', label: '급속' },
  { value: '완속', label: '완속' },
]

/** 모바일 상단「내 위치」와 동일 동작. geoNonce가 바뀔 때마다 한 번 실행. */
function MapGeolocationSync({ geoNonce, setUserLocation, setLocationError, setLocationLoading }) {
  const map = useMap()
  useEffect(() => {
    if (!geoNonce) return
    setLocationLoading(true)
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('이 브라우저는 위치 기능을 지원하지 않습니다.')
      setLocationLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude })
        const w = map.getContainer()?.clientWidth || window.innerWidth
        const z = zoomForHorizontalSpanMeters(w, 100, latitude)
        map.setView([latitude, longitude], z)
        setLocationError(null)
        setLocationLoading(false)
      },
      (err) => {
        const msg =
          err.code === 1
            ? '위치 권한이 거부되었습니다.'
            : err.code === 2
              ? '위치를 찾을 수 없습니다.'
              : '위치를 가져오는 중 오류가 발생했습니다.'
        setLocationError(msg)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [geoNonce, map, setUserLocation, setLocationError, setLocationLoading])
  return null
}

function MapCenterTracker({ setMapCenter }) {
  const map = useMap()
  useEffect(() => {
    const update = () => {
      const c = map.getCenter()
      setMapCenter({ lat: c.lat, lng: c.lng })
    }
    map.on('moveend', update)
    update()
    return () => map.off('moveend', update)
  }, [map, setMapCenter])
  return null
}

/** @param {{ setMapBounds: function, syncRef?: object, boundsQuietMs?: number }} props */
function MapBoundsTracker({ setMapBounds, syncRef, boundsQuietMs = 0 }) {
  const map = useMap()
  const quietUntilRef = useRef(0)
  useEffect(() => {
    if (boundsQuietMs > 0) {
      quietUntilRef.current = performance.now() + boundsQuietMs
      if (import.meta.env.DEV) logDiag('MapBoundsTracker quiet window', `${boundsQuietMs}ms`)
    }
  }, [map, boundsQuietMs])

  const pushBounds = useCallback(() => {
    const b = map.getBounds()
    const literal = {
      southWest: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
      northEast: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
    }
    if (syncRef) syncRef.current = literal
    setMapBounds(literal)
  }, [map, setMapBounds, syncRef])

  useEffect(() => {
    const update = () => {
      if (quietUntilRef.current && performance.now() < quietUntilRef.current) return
      pushBounds()
    }
    update()
    /** 패닝·줌 시 즉시 갱신 — 마커는 `appliedMapBounds` 기준이라 여기 값만으로는 갱신되지 않음 */
    map.on('moveend', update)
    map.on('zoomend', update)
    return () => {
      map.off('moveend', update)
      map.off('zoomend', update)
    }
  }, [map, pushBounds])

  useEffect(() => {
    if (boundsQuietMs <= 0) return undefined
    const t = window.setTimeout(() => {
      quietUntilRef.current = 0
      pushBounds()
      if (import.meta.env.DEV) logDiag('MapBoundsTracker quiet end flush', '')
    }, boundsQuietMs)
    return () => window.clearTimeout(t)
  }, [boundsQuietMs, pushBounds])

  return null
}

/** MapContainer 안에서 마운트 1회 로그 (remount 추적) */
function MapContainerMountProbe() {
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    logDiag('MapContainer subtree mount', '')
    return () => logDiag('MapContainer subtree UNMOUNT', '')
  }, [])
  return null
}

const MAP_FOCUS_EDGE_PAD_PX = 56

function MapFocusOnStation({ selectedStation, isMobile }) {
  const map = useMap()
  const lastFocusedIdRef = useRef(null)
  useEffect(() => {
    if (!selectedStation) {
      lastFocusedIdRef.current = null
      return
    }
    const id = selectedStation.id
    if (id === lastFocusedIdRef.current) return
    lastFocusedIdRef.current = id
    const ll = [selectedStation.lat, selectedStation.lng]
    if (isMobile) {
      const run = () => {
        if (!map.getContainer()) return
        const pt = map.latLngToContainerPoint(ll)
        const size = map.getSize()
        const pad = MAP_FOCUS_EDGE_PAD_PX
        const inside =
          pt.x >= pad && pt.x <= size.x - pad && pt.y >= pad && pt.y <= size.y - pad
        if (!inside) {
          map.panTo(ll, { animate: true, duration: 0.35, easeLinearity: 0.35 })
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(run))
      return
    }
    map.flyTo(ll, 16)
  }, [map, selectedStation, isMobile])
  return null
}

function LocationRipple({ userLocation }) {
  const map = useMap()
  const [point, setPoint] = useState(null)
  const update = useCallback(() => {
    if (!userLocation) return
    const p = map.latLngToContainerPoint([userLocation.lat, userLocation.lng])
    setPoint({ x: p.x, y: p.y })
  }, [map, userLocation])
  useEffect(() => {
    if (!userLocation) return
    update()
    map.on('moveend', update)
    map.on('zoomend', update)
    map.on('resize', update)
    return () => {
      map.off('moveend', update)
      map.off('zoomend', update)
      map.off('resize', update)
    }
  }, [map, userLocation, update])
  if (!userLocation || !point) return null
  return (
    <div
      className="ev-location-ripple-wrapper"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 450,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: point.x,
          top: point.y,
          transform: 'translate(-50%, -50%)',
          width: 1,
          height: 1,
        }}
      >
        <span className="ev-location-ripple" />
      </div>
    </div>
  )
}

/**
 * 퀵 검색 지명 칩: flyTo 후 getBounds()로 부모에 전달 → summary·applied 동기화.
 * @param {{ lat: number, lng: number, zoom: number, nonce: number } | null} request
 */
function MapChipViewportJump({ request, onComplete }) {
  const map = useMap()
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!request) return undefined
    const { lat, lng, zoom } = request
    let cancelled = false
    let finished = false
    const readBoundsLiteral = () => {
      try {
        const bb = map.getBounds()
        return {
          southWest: { lat: bb.getSouthWest().lat, lng: bb.getSouthWest().lng },
          northEast: { lat: bb.getNorthEast().lat, lng: bb.getNorthEast().lng },
        }
      } catch {
        return null
      }
    }
    const finishOnce = () => {
      if (cancelled || finished) return
      finished = true
      onCompleteRef.current(readBoundsLiteral())
    }
    const onMoveEnd = () => {
      map.off('moveend', onMoveEnd)
      finishOnce()
    }
    map.on('moveend', onMoveEnd)
    try {
      map.flyTo([lat, lng], zoom, { duration: 0.45 })
    } catch {
      map.off('moveend', onMoveEnd)
      finishOnce()
    }
    const safety = window.setTimeout(() => {
      map.off('moveend', onMoveEnd)
      finishOnce()
    }, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(safety)
      map.off('moveend', onMoveEnd)
    }
  }, [request, map])

  return null
}

/** `?evDiag=raw20` — 클러스터·bounds 그룹핑 우회 없이 items 좌표만 빨간 점으로 확인 */
function EvMapDiagnosticRawDots({ rows }) {
  const slice = useMemo(() => {
    const out = []
    for (const r of rows || []) {
      if (out.length >= 20) break
      const la = Number(r.lat)
      const ln = Number(r.lng)
      if (Number.isFinite(la) && Number.isFinite(ln)) out.push({ la, ln, id: r?.id, i: out.length })
    }
    return out
  }, [rows])
  if (!slice.length) return null
  return (
    <>
      {slice.map((p) => (
        <CircleMarker
          key={`ev-raw20-${String(p.id ?? p.i)}`}
          center={[p.la, p.ln]}
          radius={7}
          pathOptions={{
            color: '#b91c1c',
            fillColor: '#fecaca',
            fillOpacity: 0.95,
            weight: 2,
          }}
        />
      ))}
    </>
  )
}

function App() {
  const { tokens, colors, resolvedMode, togglePreference } = useEvTheme()
  const [items, setItems] = useState([])
  const [, setTotalCount] = useState(null)
  const [bootOverlayOpen, setBootOverlayOpen] = useState(true)
  const [awaitingInitialMapPaint, setAwaitingInitialMapPaint] = useState(false)
  const [bootProgress, setBootProgress] = useState(0)
  const [bootStageMessage, setBootStageMessage] = useState('시작하는 중')
  const [bootLinearIndeterminate, setBootLinearIndeterminate] = useState(false)
  /** 부트 마커 DOM 게이트 실패 시 오버레이에 재시도 노출 */
  const [bootMarkerGateFailed, setBootMarkerGateFailed] = useState(false)
  const [bootMessageIndex, setBootMessageIndex] = useState(0)
  const [bootReduceMotion, setBootReduceMotion] = useState(false)
  /** 첫 마커 이후 ~1s 마무리 연출 중(순환 문구 대신 단계 메시지) */
  const [bootFinalizing, setBootFinalizing] = useState(false)
  /** 부트 종료 직전 차·프로그레스·문구 페이드아웃 */
  const [bootChromeVisible, setBootChromeVisible] = useState(true)
  const bootReduceMotionRef = useRef(false)
  /** DEV proof: API 1페이지 샘플 좌표 → CircleMarker 직접 렌더 */
  const [mapProofApiDots, setMapProofApiDots] = useState([])
  const bootMapPaintedRef = useRef(false)
  const bootViewportForRetryRef = useRef(
    /** @type {null | { southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} */ (
      null
    ),
  )
  const itemsRef = useRef(items)
  /** summary JSON(+ MVP overlay) 전체 충전기 행. 뷰포트 `items`는 여기서 필터 */
  const fullEvCatalogRef = useRef(/** @type {object[] | null} */ (null))
  /** 대용량 카탈로그 뷰포트 필터용 공간 그리드( `assignFullEvCatalogWithIndex`와 동기 ) */
  const evSpatialIndexRef = useRef(/** @type {null | { queryBounds: (b: object) => object[] }} */ (null))
  const mapLayerStationsLenRef = useRef(0)
  /** 부트 summary bbox와 일치시키기: onBootMapPaintReady의 좁은 getBounds()로 applied를 덮어쓰지 않음 */
  const suppressBootMapBoundsSnapshotRef = useRef(false)
  const [leafletInitial, setLeafletInitial] = useState(() =>
    computeBootLeafletView(GWANGHWAMUN_FALLBACK.lat, GWANGHWAMUN_FALLBACK.lng),
  )
  const [apiError, setApiError] = useState(null)
  const [lastEvFetchAt, setLastEvFetchAt] = useState(null)
  const [detailRefreshing, setDetailRefreshing] = useState(false)
  const hasSafemapServiceKey = !!(import.meta.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
  const evMapDiag = useMemo(() => parseEvMapDiag(), [])
  const evMapDiagRef = useRef(evMapDiag)
  evMapDiagRef.current = evMapDiag

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setBootReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    bootReduceMotionRef.current = bootReduceMotion
  }, [bootReduceMotion])

  useEffect(() => {
    if (bootOverlayOpen) setBootChromeVisible(true)
  }, [bootOverlayOpen])
  const harnessBootMarkerCount = useMemo(
    () => evMapDiagHarnessBootMarkerCount(evMapDiag),
    [evMapDiag],
  )
  /** 지도·목록 동일 summary 소스 — 지도만 deferred 하면 첫 페인트가 밀리고 부트 타이밍이 꼬여 제거함 */
  const itemsForMapMarkers = items
  const [filterBusiNm, setFilterBusiNm] = useState('')
  const [filterSpeed, setFilterSpeed] = useState('') // '' | '급속' | '완속'
  const [filterCtprvnCd, setFilterCtprvnCd] = useState('')
  const [filterSggCd, setFilterSggCd] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchBarFocused, setSearchBarFocused] = useState(false)
  const [searchViewportFitNonce, setSearchViewportFitNonce] = useState(0)
  /** 지명 퀵 칩: flyTo 요청(null이면 대기 없음) */
  const [chipViewportJumpRequest, setChipViewportJumpRequest] = useState(null)
  const chipJumpPresetRef = useRef(null)
  /** 칩/Enter로 맞춤한 직후, debounce 지역 fit 중복 방지 */
  const lastFittedSearchQueryRef = useRef('')
  const searchQuerySyncRef = useRef(searchQuery)
  const [geoNonce, setGeoNonce] = useState(0)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  /** 제품은 모바일 전용 */
  const isMobile = true

  /**
   * 모바일 상태 전이(데이터 파이프라인은 유지)
   * - mapSelectedStation: 목록·마커 선택, 지도 flyTo, 마커 강조
   * - detailStation: 상세 모달 전용(팝업「상세」·목록 chevron에서만 진입)
   * - 목록 본문 탭: map만 갱신, 열려 있던 상세는 닫힘
   */
  const [mapSelectedStation, setMapSelectedStation] = useState(null)
  const [detailStation, setDetailStation] = useState(null)
  const detailStationRef = useRef(null)
  /** 목록 시트 스냅: 상세 진입/복귀 시에도 부모가 유지 */
  const [mobileSheetSnap, setMobileSheetSnap] = useState(/** @type {'closed' | 'peek' | 'half' | 'full'} */ ('closed'))
  /** 상세 진입 직전 목록 시트 스냅 — 닫을 때 복원 */
  const sheetSnapBeforeDetailRef = useRef(/** @type {'closed' | 'half' | 'full'} */ ('closed'))
  const [mobileListSort, setMobileListSort] = useState(/** @type {'distance' | 'name'} */ ('distance'))
  const [mobileListAvailOnly, setMobileListAvailOnly] = useState(false)
  /** 클러스터 탭으로 연 목록(지도 묶음 전용 — 상세·검색 파이프라인과 분리) */
  const [clusterBrowseGrouped, setClusterBrowseGrouped] = useState(null)
  /** 묶음 시트 전용 빠른 필터(전역 필터 시트와 분리) */
  const [clusterRailFastOnly, setClusterRailFastOnly] = useState(false)
  const [clusterRailMin2Chargers, setClusterRailMin2Chargers] = useState(false)
  const [clusterRailBusiNm, setClusterRailBusiNm] = useState('')
  /** 모바일 검색 확정(Enter·칩) 시 내 위치 기준 반경 단계 — 입력 디바운스와 분리 */
  const [mobileSearchGeo, setMobileSearchGeo] = useState(
    /** @type {null | { center: { lat: number, lng: number }, radiusKm: number, widenedHint: boolean }} */ (null),
  )
  const [confirmedMobileSearchQuery, setConfirmedMobileSearchQuery] = useState('')
  const commitMobileSearchRef = useRef(() => {})
  const sheetListScrollRef = useRef(null)
  const savedListScrollTopRef = useRef(0)
  const mapSelectedStationRef = useRef(null)
  const isMobileRef = useRef(isMobile)
  const detailHistoryPushed = useRef(false)
  const filterHistoryPushed = useRef(false)
  /** popstate 한 번에 닫을 오버레이 종류 (push 순서) */
  const overlayStackRef = useRef(/** @type {('detail'|'filter')[]} */ ([]))
  /** 연속 탭으로 필터 히스토리가 중복 push 되지 않도록 */
  const filterOpenPulseGuard = useRef(false)
  const filterDrawerOpenRef = useRef(filterDrawerOpen)
  const [mobileSheetHeightPx, setMobileSheetHeightPx] = useState(0)
  const handleSheetSnapHeightPx = useCallback((px) => {
    setMobileSheetHeightPx(px)
  }, [])

  const openMobileListSheetToHalf = useCallback(() => {
    setMobileSheetSnap('half')
  }, [])

  useEffect(() => {
    telemetryAppMount()
  }, [])

  useEffect(() => {
    mapSelectedStationRef.current = mapSelectedStation
  }, [mapSelectedStation])

  useEffect(() => {
    detailStationRef.current = detailStation
  }, [detailStation])

  useEffect(() => {
    isMobileRef.current = isMobile
  }, [isMobile])

  useEffect(() => {
    filterDrawerOpenRef.current = filterDrawerOpen
  }, [filterDrawerOpen])

  useEffect(() => {
    searchQuerySyncRef.current = searchQuery
  }, [searchQuery])

  /** 모바일 탐색: 입력은 즉시 UI, 목록·마커 필터는 짧게 디바운스 */
  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput), 140)
    return () => clearTimeout(id)
  }, [searchInput])

  const clearNavSearch = useCallback(() => {
    setSearchInput('')
    setSearchQuery('')
    lastFittedSearchQueryRef.current = ''
    setClusterBrowseGrouped(null)
    setConfirmedMobileSearchQuery('')
    setMobileSearchGeo(null)
    if (isMobileRef.current) setMobileSheetSnap('closed')
  }, [])

  const flushSearchFromInput = useCallback(() => {
    const raw = searchInput.trim()
    lastFittedSearchQueryRef.current = raw.toLowerCase()
    setSearchQuery(searchInput)
    if (raw) {
      commitMobileSearchRef.current(raw)
      openMobileListSheetToHalf()
    } else {
      setConfirmedMobileSearchQuery('')
      setMobileSearchGeo(null)
    }
  }, [searchInput, openMobileListSheetToHalf])

  const pickSearchSuggestion = useCallback(
    (text) => {
      const q = text.trim().toLowerCase()
      lastFittedSearchQueryRef.current = q
      setSearchInput(text)
      setSearchQuery(text)
      if (text.trim()) {
        commitMobileSearchRef.current(text.trim())
        openMobileListSheetToHalf()
      } else {
        setConfirmedMobileSearchQuery('')
        setMobileSearchGeo(null)
      }
    },
    [openMobileListSheetToHalf],
  )

  /** 검색어가 있으면 포커스/제목이 충전소명에 묶이지 않도록 선택·상세 해제 */
  useEffect(() => {
    if (!searchQuery.trim()) return
    setMapSelectedStation(null)
    mapSelectedStationRef.current = null
    setDetailStation(null)
    detailStationRef.current = null
  }, [searchQuery])

  /** 검색 활성 시 클러스터 전용 목록 해제(검색 결과와 상태 혼동 방지) */
  useEffect(() => {
    if (searchQuery.trim()) setClusterBrowseGrouped(null)
  }, [searchQuery])

  const restoreListAfterDetailClose = useCallback(() => {
    const anchorId = mapSelectedStationRef.current?.id
    const run = () => {
      const scrollEl = sheetListScrollRef.current
      if (!scrollEl) return
      scrollEl.scrollTop = savedListScrollTopRef.current
      if (anchorId != null && anchorId !== '') {
        const q = `[data-ev-station-id="${cssEscapeAttr(String(anchorId))}"]`
        scrollEl.querySelector(q)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(run))
  }, [])

  const closeDetailFromOverlay = useCallback(() => {
    detailHistoryPushed.current = false
    setDetailStation(null)
    detailStationRef.current = null
    if (isMobileRef.current) setMobileSheetSnap(sheetSnapBeforeDetailRef.current)
    restoreListAfterDetailClose()
  }, [restoreListAfterDetailClose])

  const closeFilterFromOverlay = useCallback(() => {
    filterHistoryPushed.current = false
    setFilterDrawerOpen(false)
  }, [])

  const openDetailPreserve = useCallback((s) => {
    setClusterBrowseGrouped(null)
    const scrollSaveEl = sheetListScrollRef.current
    if (scrollSaveEl) savedListScrollTopRef.current = scrollSaveEl.scrollTop
    mapSelectedStationRef.current = s
    setMapSelectedStation(s)
    const cur = detailStationRef.current
    const wasOpen = !!cur
    const same = cur?.id === s.id
    if (!wasOpen) {
      sheetSnapBeforeDetailRef.current = mobileSheetSnap
      try {
        window.history.pushState({ evOverlay: 'detail' }, '')
        overlayStackRef.current.push('detail')
        detailHistoryPushed.current = true
      } catch {
        detailHistoryPushed.current = false
      }
    } else if (!same) {
      try {
        window.history.replaceState({ evOverlay: 'detail' }, '')
      } catch {
        /* noop */
      }
    }
    setDetailStation(s)
    detailStationRef.current = s
    setMobileSheetSnap('half')

    const statId = s.rows?.[0]?.statId
    if (hasSafemapServiceKey && statId) {
      void (async () => {
        const openId = s.id
        try {
          const rows = await fetchDetailRowsForStatId({
            statId: String(statId),
            seedRows: s.rows || [],
            maxPages: 24,
          })
          const preserveKm = s.distanceKm != null && !Number.isNaN(s.distanceKm) ? s.distanceKm : undefined
          const next = buildPlaceGroupFromRows(rows, preserveKm)
          if (detailStationRef.current?.id !== openId) return
          setDetailStation(next)
          detailStationRef.current = next
          const sel = mapSelectedStationRef.current
          if (sel?.id === openId) {
            setMapSelectedStation(next)
            mapSelectedStationRef.current = next
          }
        } catch {
          /* summary만으로 유지 */
        }
      })()
    }
  }, [mobileSheetSnap, hasSafemapServiceKey])

  const openDetailPreserveRef = useRef(null)
  openDetailPreserveRef.current = openDetailPreserve

  const mapLayerStationsByIdRef = useRef(/** @type {Map<string, unknown>} */ (new Map()))
  const onMapMarkerPickId = useCallback((id) => {
    const s = mapLayerStationsByIdRef.current.get(id)
    const fn = openDetailPreserveRef.current
    if (s && fn) fn(s)
  }, [])

  const handleCloseDetail = useCallback(() => {
    if (detailHistoryPushed.current) {
      try {
        window.history.back()
      } catch {
        overlayStackRef.current.pop()
        closeDetailFromOverlay()
      }
      return
    }
    setDetailStation(null)
    detailStationRef.current = null
    setMobileSheetSnap(sheetSnapBeforeDetailRef.current)
    restoreListAfterDetailClose()
  }, [restoreListAfterDetailClose, closeDetailFromOverlay])

  /** 상세 열린 상태에서 시트를 closed로 끌어내리면 상세 닫기(히스토리와 동기) */
  const handleMobileSheetSnapChange = useCallback(
    (next) => {
      if (detailStationRef.current && next === 'closed') {
        handleCloseDetail()
        return
      }
      setMobileSheetSnap(next)
    },
    [handleCloseDetail],
  )

  const closeFilterDrawer = useCallback(() => {
    if (filterHistoryPushed.current) {
      try {
        window.history.back()
      } catch {
        overlayStackRef.current.pop()
        closeFilterFromOverlay()
      }
      return
    }
    setFilterDrawerOpen(false)
  }, [closeFilterFromOverlay])

  /** 필터 시트「적용하기」: draft 반영 후 히스토리 스택과 동기화하며 닫기 */
  const applyMobileFilters = useCallback(
    (draft) => {
      setMobileListSort(draft.sort)
      setMobileListAvailOnly(draft.availOnly)
      setFilterSpeed(draft.speed)
      setFilterBusiNm(draft.busiNm)
      setFilterCtprvnCd(draft.ctprvnCd)
      setFilterSggCd(draft.sggCd)
      if (isMobileRef.current && filterHistoryPushed.current) {
        try {
          window.history.back()
        } catch {
          overlayStackRef.current.pop()
          closeFilterFromOverlay()
        }
      } else {
        setFilterDrawerOpen(false)
      }
    },
    [closeFilterFromOverlay]
  )

  const openFilterDrawer = useCallback(() => {
    if (filterDrawerOpen || filterOpenPulseGuard.current) return
    /** 상세가 열린 상태에서 필터를 push하면 스택이 [detail,filter]가 되어, 이후 back이 필터를 먼저 닫아 상세 X와 어긋난다. */
    if (detailStationRef.current) return
    filterOpenPulseGuard.current = true
    try {
      window.history.pushState({ evOverlay: 'filter' }, '')
      overlayStackRef.current.push('filter')
      filterHistoryPushed.current = true
    } catch {
      filterHistoryPushed.current = false
    }
    setFilterDrawerOpen(true)
    requestAnimationFrame(() => {
      filterOpenPulseGuard.current = false
    })
  }, [filterDrawerOpen])

  /**
   * popstate: 히스토리 1스텝 = 오버레이 1단계 (overlayStackRef 와 push 순서 일치).
   */
  useEffect(() => {
    const onPop = () => {
      const top = overlayStackRef.current.pop()
      if (top === 'detail') {
        closeDetailFromOverlay()
      } else if (top === 'filter') {
        closeFilterFromOverlay()
      } else if (detailStationRef.current) {
        closeDetailFromOverlay()
      } else if (filterDrawerOpenRef.current) {
        closeFilterFromOverlay()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeDetailFromOverlay, closeFilterFromOverlay])

  /** 상세·필터가 막을 때는 FAB를 끄고, 해제 후 exit 타이밍 뒤에 다시 드러냄 */
  const mobileOverlayBlocking = !!(detailStation || filterDrawerOpen)
  const [fabReveal, setFabReveal] = useState(true)
  const fabWasBlockedRef = useRef(mobileOverlayBlocking)
  useEffect(() => {
    if (mobileOverlayBlocking) {
      setFabReveal(false)
      fabWasBlockedRef.current = true
      return undefined
    }
    if (fabWasBlockedRef.current) {
      fabWasBlockedRef.current = false
      setFabReveal(false)
      const delay = motion.duration.exit + motion.duration.fabReveal
      const id = window.setTimeout(() => setFabReveal(true), delay)
      return () => window.clearTimeout(id)
    }
    setFabReveal(true)
    return undefined
  }, [mobileOverlayBlocking])
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState({
    lat: GWANGHWAMUN_FALLBACK.lat,
    lng: GWANGHWAMUN_FALLBACK.lng,
  })
  const [liveMapBounds, setLiveMapBounds] = useState(null)
  const [appliedMapBounds, setAppliedMapBounds] = useState(null)
  const liveMapBoundsRef = useRef(null)
  useEffect(() => {
    liveMapBoundsRef.current = liveMapBounds
  }, [liveMapBounds])

  const appliedMapBoundsRef = useRef(null)
  useEffect(() => {
    appliedMapBoundsRef.current = appliedMapBounds
  }, [appliedMapBounds])

  /** 「이 지역 검색」summary 전용 로딩(초기 부트 오버레이와 분리) */
  const [mapSearchAreaLoading, setMapSearchAreaLoading] = useState(false)
  const summaryFetchAbortRef = useRef(null)
  /** 완료 시점에 더 최신 요청이 있으면 setItems 등 무시 */
  const summaryFetchGenerationRef = useRef(0)
  const itemsRenderSigRef = useRef('')
  const searchAreaAwaitingMarkersRef = useRef(null)
  /** evPipeline: fetch 직후 스냅샷 → 첫 마커 로그와 병합 */
  const lastEvPipelineFetchRef = useRef(
    /** @type {null | { phase: string, fetchEndT: number, fetchMs: number, rawRowsScanned: number | null, normalizeOk: number | null, normalizeNull: number | null, boundsInsideRows: number, pagesScanned: number, gen: number }} */ (
      null
    ),
  )
  const pipelineReactLogPendingRef = useRef(false)
  const bootMarkerWaitT0Ref = useRef(/** @type {number | null} */ (null))
  const searchAreaClickT0Ref = useRef(/** @type {number | null} */ (null))
  const mapPipelineCountsRef = useRef({
    adapted: 0,
    grouped: 0,
    afterCap: 0,
    final: 0,
  })
  const runViewportSummaryFetchRef = useRef(
    /** @returns {Promise<{ ok: boolean, rows?: object[], rowCount?: number }>} */ async () => ({ ok: false }),
  )
  useEffect(
    () => () => {
      summaryFetchAbortRef.current?.abort()
    },
    [],
  )

  /** @param {null | { southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} boundsFromMap */
  const onBootMapPaintReady = useCallback((boundsFromMap) => {
    if (bootMapPaintedRef.current) return
    bootMapPaintedRef.current = true
    if (!suppressBootMapBoundsSnapshotRef.current) {
      const b = boundsFromMap ?? liveMapBoundsRef.current
      if (b) setAppliedMapBounds(b)
    }
    suppressBootMapBoundsSnapshotRef.current = false
    setBootMarkerGateFailed(false)
    const now = performance.now()
    const f = lastEvPipelineFetchRef.current
    const mw = bootMarkerWaitT0Ref.current
    const fetchEndToFirstPaintMs =
      f?.fetchEndT != null ? Math.round(now - f.fetchEndT) : null
    logEvPipelineFirstMarker({
      phase: 'boot',
      fetchMs: f?.fetchMs ?? null,
      rawRowsScanned: f?.rawRowsScanned ?? null,
      normalizeOk: f?.normalizeOk ?? null,
      boundsInsideRows: itemsRef.current?.length ?? 0,
      adaptedValidCoords: mapPipelineCountsRef.current.adapted,
      groupedPlaces: mapPipelineCountsRef.current.grouped,
      renderableAfterCap: mapPipelineCountsRef.current.afterCap,
      finalRenderedMarkers: mapLayerStationsLenRef.current,
      markerWaitMs: mw != null ? Math.round(now - mw) : null,
      fetchEndToFirstPaintMs,
      clickToFirstPaintMs: null,
      slowHint: evPipelineSlowHint(f?.fetchMs ?? 0, fetchEndToFirstPaintMs),
    })
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- 부트 단계 증명
      console.info('[bootMarkerPipeline] first-marker-visible', {
        ts: now,
        mapLayerCount: mapLayerStationsLenRef.current,
        itemsCount: itemsRef.current?.length ?? 0,
      })
    }
    viewportSummaryTelemetry('boot', 'marker-visible', {})
    setBootLinearIndeterminate(false)
    setBootProgress(88)
    setBootStageMessage('지도에 마커를 확인했어요. 표시를 마무리하는 중이에요')
    setBootFinalizing(true)

    void (async () => {
      const reduce = bootReduceMotionRef.current
      try {
        if (reduce) {
          setBootProgress(100)
          setBootStageMessage('준비했어요')
          await new Promise((r) => setTimeout(r, 280))
          setBootChromeVisible(false)
          await new Promise((r) => setTimeout(r, 220))
        } else {
          await easeBootProgressEaseOutCubic(setBootProgress, 88, 100, 980)
          setBootStageMessage('준비했어요')
          await new Promise((r) => setTimeout(r, 140))
          setBootChromeVisible(false)
          await new Promise((r) => setTimeout(r, 400))
        }
      } finally {
        viewportSummaryTelemetry('boot', 'boot-overlay-off', {})
        setAwaitingInitialMapPaint(false)
        setBootOverlayOpen(false)
        setBootFinalizing(false)
        setBootChromeVisible(true)
      }
    })()
  }, [])

  const onBootMapPaintTimeout = useCallback(() => {
    viewportSummaryTelemetry('boot', 'marker-wait-timeout', {})
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- 부트 단계 증명
      console.warn('[bootMarkerPipeline] marker-wait-timeout', {
        items: itemsRef.current?.length ?? 0,
        mapLayerStations: mapLayerStationsLenRef.current,
      })
    }
    setBootMarkerGateFailed(true)
    setBootLinearIndeterminate(false)
    setBootProgress(72)
    setBootStageMessage(
      '지도에 마커를 표시하는 데 시간이 걸리고 있어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    )
    setAwaitingInitialMapPaint(false)
  }, [])

  const handleBootMarkerRetry = useCallback(async () => {
    bootMapPaintedRef.current = false
    setBootMarkerGateFailed(false)
    setBootLinearIndeterminate(false)
    setBootProgress(72)
    bootMarkerWaitT0Ref.current = performance.now()
    setAwaitingInitialMapPaint(true)
    const v = bootViewportForRetryRef.current
    if (v) {
      assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, null)
      await runViewportSummaryFetchRef.current({
        reason: 'boot',
        viewport: v,
        showLoading: false,
      })
    }
    viewportSummaryTelemetry('boot', 'marker-retry', {})
  }, [])

  /**
   * viewport summary 단일 진입점 (boot / 이 지역 검색 / 칩 / 검색 fit / 새로고침).
   * @param {{
   *   reason: 'boot' | 'search-area' | 'suggestion-chip' | 'search' | 'refresh',
   *   viewport: { southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } } | null,
   *   showLoading?: boolean,
   *   signal?: AbortSignal,
   * }} args
   * @returns {Promise<{ ok: boolean, rows?: object[], rowCount?: number }>}
   */
  const runViewportSummaryFetch = useCallback(
    async ({
      reason,
      viewport,
      showLoading = false,
      signal: externalSignal,
      timingSession = null,
    }) => {
      if (!viewport) {
        viewportSummaryTelemetry(reason, 'skip-no-viewport', {})
        return { ok: false }
      }
      const gen = (summaryFetchGenerationRef.current += 1)
      viewportSummaryMarkFetchStart()
      viewportSummaryTelemetry(reason, 'fetch-start', { gen })
      if (import.meta.env.DEV) {
        searchAreaTimingMetrics.fetchesStarted += 1
        if (timingSession) searchAreaTimingLog(timingSession, 'fetch-start', { gen, reason })
      }

      let signal = externalSignal
      if (!signal) {
        summaryFetchAbortRef.current?.abort()
        const ac = new AbortController()
        summaryFetchAbortRef.current = ac
        signal = ac.signal
      }

      if (showLoading) {
        setMapSearchAreaLoading(true)
        viewportSummaryTelemetry(reason, 'loading-on', { gen })
        if (import.meta.env.DEV && timingSession) searchAreaTimingLog(timingSession, 'loading-overlay-on', { gen })
      }
      setApiError(null)
      const t0 = performance.now()

      try {
        const summaryUrl = resolveEvStationsSummaryUrl(import.meta.env.BASE_URL)
        const diag = evMapDiagRef.current
        const devProof = import.meta.env.DEV && (diag.apiProof || diag.proof)

        const applyRowsAndTelemetry = (rows, fetchMs, pagesScanned, rawApprox, note) => {
          if (signal.aborted) {
            viewportSummaryMarkAbort()
            if (import.meta.env.DEV) searchAreaTimingMetrics.aborts += 1
            viewportSummaryTelemetry(reason, 'fetch-aborted', { gen })
            return { ok: false }
          }
          if (summaryFetchGenerationRef.current !== gen) {
            viewportSummaryMarkStale()
            if (import.meta.env.DEV) searchAreaTimingMetrics.staleDrops += 1
            viewportSummaryTelemetry(reason, 'stale-drop', { gen, current: summaryFetchGenerationRef.current })
            return { ok: false }
          }
          setItems(rows)
          const sig = `${rows.length}:${rows[0]?.id ?? ''}`
          if (import.meta.env.DEV && itemsRenderSigRef.current !== sig) {
            itemsRenderSigRef.current = sig
            searchAreaTimingMetrics.renderSourceChanges += 1
          }
          setTotalCount(rows.length)
          setLastEvFetchAt(new Date().toISOString())
          clearDetailRowsCache()
          viewportSummaryMarkApplied()
          if (import.meta.env.DEV && timingSession) {
            searchAreaTimingLog(timingSession, 'adapter-done-render-source-set', { gen, rowCount: rows.length })
          }
          const fetchEndT = performance.now()
          if (isEvPipelineLogEnabled() && (reason === 'boot' || reason === 'search-area')) {
            lastEvPipelineFetchRef.current = {
              phase: reason,
              fetchEndT,
              fetchMs,
              rawRowsScanned: rawApprox,
              normalizeOk: fullEvCatalogRef.current?.length ?? null,
              normalizeNull: null,
              boundsInsideRows: rows.length,
              pagesScanned,
              gen,
            }
            logEvPipelineFetchDone({
              phase: reason,
              fetchMs,
              rawRowsScanned: rawApprox,
              normalizeOk: fullEvCatalogRef.current?.length ?? null,
              normalizeNull: null,
              boundsInsideRows: rows.length,
              pagesScanned,
              note: note || 'summary 데이터에서 뷰포트 필터',
            })
            pipelineReactLogPendingRef.current = true
          }
          viewportSummaryTelemetry(reason, 'state-applied', {
            gen,
            n: rows.length,
            pages: pagesScanned,
            ms: fetchMs,
          })
          return { ok: true, rows, rowCount: rows.length }
        }

        if (reason === 'refresh') {
          const ds = await fetchEvStationsSummaryDataset({
            url: summaryUrl,
            signal,
            cache: 'no-store',
            maxAttempts: 2,
          })
          if (signal.aborted) {
            viewportSummaryMarkAbort()
            return { ok: false }
          }
          assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, ds.allRowsWithOverlay)
          if (summaryFetchGenerationRef.current !== gen) {
            viewportSummaryMarkStale()
            return { ok: false }
          }
        } else if (fullEvCatalogRef.current == null) {
          try {
            const ds = await fetchEvStationsSummaryDataset({ url: summaryUrl, signal, maxAttempts: 2 })
            if (signal.aborted) {
              viewportSummaryMarkAbort()
              return { ok: false }
            }
            assignFullEvCatalogWithIndex(
              fullEvCatalogRef,
              evSpatialIndexRef,
              import.meta.env.DEV && ds.allRowsWithOverlay.length === 0
                ? getDevMockEvChargers()
                : ds.allRowsWithOverlay,
            )
          } catch (loadErr) {
            if (import.meta.env.DEV) {
              assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, getDevMockEvChargers())
            } else {
              throw loadErr
            }
          }
        }

        if (showLoading) {
          await new Promise((r) => requestAnimationFrame(r))
          await new Promise((r) => requestAnimationFrame(r))
        }
        const catalog = fullEvCatalogRef.current ?? []
        const idx = evSpatialIndexRef.current
        const rows = idx ? idx.queryBounds(viewport) : filterNormalizedRowsToBounds(catalog, viewport)
        const fetchMs = Math.round(performance.now() - t0)

        if (import.meta.env.DEV && timingSession) {
          searchAreaTimingLog(timingSession, 'fetch-response-received', { gen, fetchMs, rows: rows.length })
        }

        if (devProof && catalog.length) {
          const dots = catalog
            .filter((x) => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)))
            .slice(0, 20)
            .map((x) => ({ id: x.id, lat: x.lat, lng: x.lng }))
          setMapProofApiDots(dots)
        }

        if (import.meta.env.DEV && (diag.pipeline || diag.countTrace)) {
          // eslint-disable-next-line no-console -- count trace
          console.info('[mapCountTrace] summary', {
            reason,
            catalogRows: catalog.length,
            viewportRows: rows.length,
          })
        }

        return applyRowsAndTelemetry(
          rows,
          fetchMs,
          0,
          catalog.length,
          reason === 'refresh' ? 'summary JSON 재로드·뷰포트 필터' : 'summary 메모리·뷰포트 필터',
        )
      } catch (err) {
        if (!signal.aborted && summaryFetchGenerationRef.current === gen) {
          setApiError(err.message || '데이터를 불러오지 못했습니다.')
          viewportSummaryTelemetry(reason, 'error', { gen, msg: String(err?.message || err) })
        }
        return { ok: false }
      } finally {
        if (showLoading) {
          setMapSearchAreaLoading(false)
          viewportSummaryTelemetry(reason, 'loading-off', { gen })
          if (import.meta.env.DEV && timingSession) searchAreaTimingLog(timingSession, 'loading-overlay-off', { gen })
        }
      }
    },
    [],
  )

  runViewportSummaryFetchRef.current = runViewportSummaryFetch

  const onSearchViewportBoundsApplied = useCallback(
    (boundsLiteral) => {
      if (!boundsLiteral) return
      void runViewportSummaryFetch({ reason: 'search', viewport: boundsLiteral, showLoading: true })
    },
    [runViewportSummaryFetch],
  )

  /** 「이 지역 검색」: viewport summary 재조회 + 적용 영역 동기화 */
  const applySearchAreaFromMap = useCallback(async () => {
    const b = liveMapBoundsRef.current
    if (!b) return
    if (mapSearchAreaLoading) {
      if (import.meta.env.DEV) searchAreaTimingMetrics.duplicateClickIgnored += 1
      return
    }
    const clickT0 = performance.now()
    if (isEvPipelineLogEnabled()) {
      searchAreaClickT0Ref.current = clickT0
    }
    const timingSession = import.meta.env.DEV ? { t0: clickT0 } : null
    if (import.meta.env.DEV) {
      searchAreaTimingMetrics.buttonClicks += 1
      searchAreaTimingLog(timingSession, 'search-area-button-click')
    }
    viewportSummaryTelemetry('search-area', 'button-click', {})
    if (import.meta.env.DEV || isEvPipelineLogEnabled()) {
      searchAreaAwaitingMarkersRef.current = { t0: performance.now() }
    }
    await runViewportSummaryFetch({
      reason: 'search-area',
      viewport: b,
      showLoading: true,
      timingSession,
    })
    setAppliedMapBounds(b)
    setClusterBrowseGrouped(null)
    setConfirmedMobileSearchQuery('')
    setMobileSearchGeo(null)
    openMobileListSheetToHalf()
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setDetailStation(null)
    detailStationRef.current = null
    if (import.meta.env.DEV && timingSession) {
      searchAreaTimingLog(timingSession, 'search-area-flow-end', {
        metrics: { ...searchAreaTimingMetrics },
      })
    }
  }, [openMobileListSheetToHalf, runViewportSummaryFetch, mapSearchAreaLoading])

  const handleChipViewportJumpComplete = useCallback(
    (boundsLiteral) => {
      setChipViewportJumpRequest(null)
      const meta = chipJumpPresetRef.current
      chipJumpPresetRef.current = null
      if (!boundsLiteral || !meta) return
      viewportSummaryTelemetry('suggestion-chip', 'map-bounds-ready', { label: meta.label })
      setAppliedMapBounds(boundsLiteral)
      setClusterBrowseGrouped(null)
      setConfirmedMobileSearchQuery(meta.label)
      setSearchQuery(meta.label)
      setSearchInput(meta.label)
      setMobileSearchGeo({
        center: { lat: meta.lat, lng: meta.lng },
        radiusKm: 14,
        widenedHint: false,
      })
      mapSelectedStationRef.current = null
      setMapSelectedStation(null)
      setDetailStation(null)
      detailStationRef.current = null
      void runViewportSummaryFetch({
        reason: 'suggestion-chip',
        viewport: boundsLiteral,
        showLoading: true,
      })
    },
    [runViewportSummaryFetch],
  )

  const handleMobileQuickSearchPick = useCallback(
    (text) => {
      const raw = text.trim()
      const preset = MOBILE_QUICK_SEARCH_PLACE_PRESETS[raw]
      if (preset) {
        viewportSummaryTelemetry('suggestion-chip', 'chip-click', { label: raw })
        setSearchInput(text)
        setSearchQuery(text)
        setConfirmedMobileSearchQuery(raw)
        setClusterBrowseGrouped(null)
        mapSelectedStationRef.current = null
        setMapSelectedStation(null)
        setDetailStation(null)
        detailStationRef.current = null
        chipJumpPresetRef.current = { lat: preset.lat, lng: preset.lng, label: raw }
        setChipViewportJumpRequest({
          lat: preset.lat,
          lng: preset.lng,
          zoom: preset.zoom ?? 14,
          nonce: Date.now(),
        })
        openMobileListSheetToHalf()
        return
      }
      pickSearchSuggestion(text)
    },
    [pickSearchSuggestion, openMobileListSheetToHalf],
  )

  const handleClusterStationsTap = useCallback(({ stations }) => {
    if (!Array.isArray(stations) || stations.length === 0) return
    setDetailStation(null)
    detailStationRef.current = null
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setClusterBrowseGrouped(stations)
    setMobileSheetSnap('half')
  }, [])

  useEffect(() => {
    summaryFetchAbortRef.current?.abort()
    const ac = new AbortController()
    summaryFetchAbortRef.current = ac
    let cancelled = false

    ;(async () => {
      setBootProgress(0)
      setBootStageMessage('시작하는 중')

      setBootStageMessage('현재 위치를 확인하고 있어요')
      const pLoc = easeBootProgress(setBootProgress, 0, 32, 480)
      const pos = await getBootstrapGeolocationPosition()
      await pLoc
      if (cancelled) return
      telemetryLocationResolved(pos.usedGeo)

      setBootProgress(40)
      setBootStageMessage(
        pos.usedGeo
          ? '내 위치를 확인했어요. 충전소 요약 데이터를 불러오고 있어요'
          : '위치를 사용할 수 없어 기본 위치로 시작해요. 충전소 요약 데이터를 불러오고 있어요',
      )
      const view = computeBootLeafletView(pos.lat, pos.lng, mapBootstrapWidthPx())
      setLeafletInitial(view)
      if (pos.usedGeo) setUserLocation({ lat: pos.lat, lng: pos.lng })
      else setUserLocation(null)

      const initialViewportB = squareBoundsLiteralAroundCenter(pos.lat, pos.lng, 32)
      bootViewportForRetryRef.current = initialViewportB

      const summaryUrl = resolveEvStationsSummaryUrl(import.meta.env.BASE_URL)
      const bootT0 = performance.now()

      const enterMarkerWait = (boundsLiteral) => {
        suppressBootMapBoundsSnapshotRef.current = true
        setAppliedMapBounds(boundsLiteral)
        setBootLinearIndeterminate(false)
        setBootProgress(88)
        setBootStageMessage('현재 지역 충전소를 지도에 올리는 중이에요. 첫 마커가 보이면 완료돼요')
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- 부트 단계 증명
          console.info('[bootTiming] enter-marker-ready-wait', {
            phase: 'ev-summary-json',
            fetchMs: Math.round(performance.now() - bootT0),
            catalogSize: fullEvCatalogRef.current?.length ?? 0,
          })
        }
        if (cancelled) return
        bootMarkerWaitT0Ref.current = performance.now()
        setAwaitingInitialMapPaint(true)
        viewportSummaryTelemetry('boot', 'awaiting-map-paint', {})
      }

      const applyViewportFromCatalog = (boundsLiteral) => {
        const idx = evSpatialIndexRef.current
        const scoped = idx
          ? idx.queryBounds(boundsLiteral)
          : filterNormalizedRowsToBounds(fullEvCatalogRef.current || [], boundsLiteral)
        setItems(scoped)
        setTotalCount(scoped.length)
        setLastEvFetchAt(new Date().toISOString())
        clearDetailRowsCache()
        viewportSummaryMarkApplied()
        return scoped
      }

      const logPipelineBoot = (fetchMs, rawApprox, rowsInView) => {
        if (!isEvPipelineLogEnabled()) return
        const fetchEndT = performance.now()
        lastEvPipelineFetchRef.current = {
          phase: 'boot',
          fetchEndT,
          fetchMs,
          rawRowsScanned: rawApprox,
          normalizeOk: fullEvCatalogRef.current?.length ?? null,
          normalizeNull: null,
          boundsInsideRows: rowsInView,
          pagesScanned: 0,
          gen: summaryFetchGenerationRef.current,
        }
        logEvPipelineFetchDone({
          phase: 'boot',
          fetchMs,
          rawRowsScanned: rawApprox,
          normalizeOk: fullEvCatalogRef.current?.length ?? null,
          normalizeNull: null,
          boundsInsideRows: rowsInView,
          pagesScanned: 0,
          note: 'summary JSON 로드 후 뷰포트 필터',
        })
        pipelineReactLogPendingRef.current = true
      }

      setApiError(null)
      setItems([])
      viewportSummaryTelemetry('boot', 'ev-summary-bootstrap', {})

      try {
        setBootStageMessage('충전소 요약 정보를 불러오는 중이에요')
        await easeBootProgress(setBootProgress, 40, 62, 360)
        if (cancelled || ac.signal.aborted) return

        const stopSummaryCreep = startBootSummaryFetchProgressCreep(setBootProgress)
        let ds = null
        try {
          try {
            ds = await fetchEvStationsSummaryDataset({ url: summaryUrl, signal: ac.signal, maxAttempts: 2 })
          } catch (e) {
            if (import.meta.env.DEV) {
              assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, getDevMockEvChargers())
              viewportSummaryTelemetry('boot', 'mock-summary-fallback-dev', {})
              // eslint-disable-next-line no-console -- DEV 안내
              console.info('[whereEV3] summary JSON 로드 실패 — DEV mock 사용:', e?.message || e)
            } else {
              throw e
            }
          }
        } finally {
          stopSummaryCreep()
        }

        if (ds) {
          if (import.meta.env.DEV && ds.allRowsWithOverlay.length === 0) {
            assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, getDevMockEvChargers())
            viewportSummaryTelemetry('boot', 'empty-summary-use-mock-dev', {})
          } else {
            assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, ds.allRowsWithOverlay)
          }
        }

        if (cancelled || ac.signal.aborted) return

        setBootStageMessage('현재 지역에 맞는 충전소를 골라 지도에 올리는 중이에요')
        setBootProgress(72)
        await new Promise((r) => requestAnimationFrame(r))

        const scoped = applyViewportFromCatalog(initialViewportB)
        setBootProgress(78)
        const fetchMs = Math.round(performance.now() - bootT0)
        logPipelineBoot(fetchMs, fullEvCatalogRef.current?.length ?? 0, scoped.length)

        enterMarkerWait(initialViewportB)
      } catch (err) {
        if (!cancelled && !ac.signal.aborted) {
          setApiError(err.message || '데이터를 불러오지 못했습니다.')
          assignFullEvCatalogWithIndex(fullEvCatalogRef, evSpatialIndexRef, null)
          setItems([])
          setTotalCount(null)
          setBootLinearIndeterminate(false)
          setBootProgress(100)
          setBootStageMessage('충전소 목록을 불러오지 못했어요')
          setAwaitingInitialMapPaint(false)
          setBootOverlayOpen(false)
          viewportSummaryTelemetry('boot', 'summary-load-failed', { msg: String(err?.message || err) })
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [])

  const refreshEvData = useCallback(async () => {
    const b = appliedMapBoundsRef.current || liveMapBoundsRef.current
    if (!b) return
    setDetailRefreshing(true)
    viewportSummaryTelemetry('refresh', 'start', {})
    try {
      const result = await runViewportSummaryFetch({ reason: 'refresh', viewport: b, showLoading: false })
      if (!result?.ok || !Array.isArray(result.rows)) return
      const list = result.rows
      const prev = detailStationRef.current
      if (prev) {
        const matched = rowsMatchingDetailStation(prev, list)
        const prevKey = Array.isArray(prev.rows) && prev.rows.length ? prev.id : placeKey(prev)
        if (matched.length === 0) {
          setDetailStation(null)
          detailStationRef.current = null
          const sel = mapSelectedStationRef.current
          if (sel) {
            const selKey = Array.isArray(sel.rows) && sel.rows.length ? sel.id : placeKey(sel)
            if (selKey === prevKey) {
              setMapSelectedStation(null)
              mapSelectedStationRef.current = null
            }
          }
        } else {
          const preserveKm = Array.isArray(prev.rows) && prev.rows.length ? prev.distanceKm : undefined
          const next =
            matched.length === 1 ? matched[0] : buildPlaceGroupFromRows(matched, preserveKm)
          setDetailStation(next)
          detailStationRef.current = next
          const sel = mapSelectedStationRef.current
          if (sel) {
            const selKey = Array.isArray(sel.rows) && sel.rows.length ? sel.id : placeKey(sel)
            if (selKey === prevKey) {
              setMapSelectedStation(next)
              mapSelectedStationRef.current = next
            }
          }
        }
      }
    } catch (err) {
      setApiError(err.message || '데이터를 불러오지 못했습니다.')
    } finally {
      setDetailRefreshing(false)
      viewportSummaryTelemetry('refresh', 'done', {})
    }
  }, [runViewportSummaryFetch])

  const itemsMatchingChipsOnly = useMemo(() => {
    return items.filter((s) => {
      if (filterBusiNm && s.busiNm !== filterBusiNm) return false
      if (filterSpeed && s.speedCategory !== filterSpeed) return false
      if (filterCtprvnCd && s.ctprvnCd !== filterCtprvnCd) return false
      if (filterSggCd && s.sggCd !== filterSggCd) return false
      return true
    })
  }, [items, filterBusiNm, filterSpeed, filterCtprvnCd, filterSggCd])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return itemsMatchingChipsOnly.filter((s) => {
      if (q && !itemMatchesEvSearchQuery(s, q)) return false
      return true
    })
  }, [itemsMatchingChipsOnly, searchQuery])

  const mobileGeoActive =
    isMobile &&
    mobileSearchGeo != null &&
    confirmedMobileSearchQuery.trim() !== '' &&
    searchQuery.trim() === confirmedMobileSearchQuery.trim()

  const filteredItemsForScope = useMemo(() => {
    if (!mobileGeoActive || !mobileSearchGeo) return filteredItems
    const { center, radiusKm } = mobileSearchGeo
    return filteredItems.filter(
      (s) =>
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        haversineDistanceKm(center.lat, center.lng, s.lat, s.lng) <= radiusKm,
    )
  }, [mobileGeoActive, mobileSearchGeo, filteredItems])

  commitMobileSearchRef.current = (rawQuery) => {
    const raw = rawQuery.trim()
    if (!isMobile || !raw) return
    setConfirmedMobileSearchQuery(raw)
    const center = userLocation || mapCenter
    const q = raw.toLowerCase()
    const textRows = itemsMatchingChipsOnly.filter((s) => itemMatchesEvSearchQuery(s, q))
    const picked = pickMobileSearchRadiusTier(textRows, center)
    setMobileSearchGeo({
      center: { lat: center.lat, lng: center.lng },
      radiusKm: picked.radiusKm,
      widenedHint: picked.widenedHint,
    })
    if (picked.matches.length === 0) {
      const padKm = Math.min(Number.isFinite(picked.radiusKm) ? picked.radiusKm : 8, 8)
      const b = squareBoundsLiteralAroundCenter(center.lat, center.lng, Math.max(padKm, 1))
      setAppliedMapBounds(b)
      void runViewportSummaryFetch({ reason: 'search', viewport: b, showLoading: false })
    } else {
      setSearchViewportFitNonce((n) => n + 1)
    }
  }

  /** 현재 적용된 검색 영역(applied bounds) 내 충전소만. 헤더 N·지도·목록 공통 기준. */
  const itemsInScope = useMemo(() => {
    if (!appliedMapBounds) return []
    const b = L.latLngBounds(
      [appliedMapBounds.southWest.lat, appliedMapBounds.southWest.lng],
      [appliedMapBounds.northEast.lat, appliedMapBounds.northEast.lng]
    )
    return filteredItemsForScope.filter((s) => b.contains([s.lat, s.lng]))
  }, [filteredItemsForScope, appliedMapBounds])

  /** 모바일 목록용: itemsInScope를 거리순 정렬. userLocation 있으면 내 위치, 없으면 지도 중심 기준. */
  const sortedItemsInScope = useMemo(() => {
    const ref = userLocation || mapCenter
    return itemsInScope
      .map((s) => ({
        ...s,
        distanceKm: haversineDistanceKm(ref.lat, ref.lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [itemsInScope, userLocation, mapCenter])

  /** 모바일 전용: 같은 장소(statNm+좌표)별로 그룹. 헤더 N·목록·마커를 장소 수 기준으로 통일. */
  const groupedItemsInScope = useMemo(() => {
    const byKey = new Map()
    for (const row of sortedItemsInScope) {
      const key = placeKey(row)
      if (!byKey.has(key)) byKey.set(key, { rows: [], distanceKm: row.distanceKm })
      byKey.get(key).rows.push(row)
    }
    return Array.from(byKey.entries())
      .map(([id, { rows, distanceKm }]) => {
        const first = rows[0]
        const statCounts = aggregateStatCounts(rows)
        let adres = ''
        let rnAdres = ''
        for (const r of rows) {
          if (!adres && (r.adres || '').trim()) adres = (r.adres || '').trim()
          if (!rnAdres && (r.rnAdres || '').trim()) rnAdres = (r.rnAdres || '').trim()
          if (adres && rnAdres) break
        }
        return {
          id,
          statNm: first.statNm,
          lat: first.lat,
          lng: first.lng,
          distanceKm,
          totalChargers: rows.length,
          statCounts,
          statSummary: formatStatSummary(statCounts),
          latestStatUpdDt: getLatestStatUpdDt(rows),
          busiNm: formatListSummary(rows.map((r) => r.busiNm), 2),
          chgerTyLabel: formatListSummary(rows.map((r) => r.displayChgerLabel ?? r.chgerTyLabel), 2),
          speedBadge: summarizeSpeedCategories(rows),
          locationHint: pickShortLocationHint(rows, first),
          rows,
          adres: adres || (first.adres || '').trim(),
          rnAdres: rnAdres || (first.rnAdres || '').trim(),
          useTm: first.useTm,
          telno: first.telno,
        }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [sortedItemsInScope])

  /** 목록 시트: 정렬·빠른 필터(사용 가능만) 적용 후 표시 */
  const stationsForMobileList = useMemo(() => {
    let g = groupedItemsInScope
    if (mobileListAvailOnly) g = g.filter((s) => (s.statCounts['2'] ?? 0) > 0)
    const arr = [...g]
    if (mobileListSort === 'name') {
      arr.sort((a, b) => a.statNm.localeCompare(b.statNm, 'ko', { numeric: true }))
    } else {
      arr.sort((a, b) => a.distanceKm - b.distanceKm)
    }
    return arr
  }, [groupedItemsInScope, mobileListAvailOnly, mobileListSort])

  const clusterBrowseActive = Array.isArray(clusterBrowseGrouped) && clusterBrowseGrouped.length > 0

  const clusterOperatorTop = useMemo(() => {
    if (!clusterBrowseGrouped?.length) return []
    const counts = new Map()
    for (const s of clusterBrowseGrouped) {
      for (const r of s.rows || []) {
        const b = (r.busiNm || '').trim()
        if (b) counts.set(b, (counts.get(b) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .slice(0, 4)
      .map(([name]) => name)
  }, [clusterBrowseGrouped])

  const hasAvailInCluster = useMemo(
    () => (clusterBrowseGrouped || []).some((s) => (s.statCounts?.['2'] ?? 0) > 0),
    [clusterBrowseGrouped],
  )
  const hasFastInCluster = useMemo(
    () => (clusterBrowseGrouped || []).some((s) => clusterGroupedHasFastCharging(s)),
    [clusterBrowseGrouped],
  )
  const hasMultiChargerInCluster = useMemo(
    () => (clusterBrowseGrouped || []).some((s) => (s.totalChargers ?? 0) >= 2),
    [clusterBrowseGrouped],
  )

  const clusterBrowseListSorted = useMemo(() => {
    if (clusterBrowseGrouped == null) return null
    const ref = userLocation || mapCenter
    const withDist = clusterBrowseGrouped.map((s) => ({
      ...s,
      distanceKm: haversineDistanceKm(ref.lat, ref.lng, s.lat, s.lng),
    }))
    let g = withDist
    if (mobileListAvailOnly) g = g.filter((s) => (s.statCounts['2'] ?? 0) > 0)
    if (clusterRailFastOnly) g = g.filter((s) => clusterGroupedHasFastCharging(s))
    if (clusterRailMin2Chargers) g = g.filter((s) => (s.totalChargers ?? 0) >= 2)
    if (clusterRailBusiNm) g = g.filter((s) => clusterGroupedMatchesBusiNm(s, clusterRailBusiNm))
    const arr = [...g]
    if (mobileListSort === 'name') {
      arr.sort((a, b) => a.statNm.localeCompare(b.statNm, 'ko', { numeric: true }))
    } else {
      arr.sort((a, b) => a.distanceKm - b.distanceKm)
    }
    return arr
  }, [
    clusterBrowseGrouped,
    userLocation,
    mapCenter,
    mobileListAvailOnly,
    mobileListSort,
    clusterRailFastOnly,
    clusterRailMin2Chargers,
    clusterRailBusiNm,
  ])

  const stationsForMobileListEffective =
    clusterBrowseListSorted != null ? clusterBrowseListSorted : stationsForMobileList

  const hasAvailInGroupedScope = useMemo(
    () => groupedItemsInScope.some((s) => (s.statCounts?.['2'] ?? 0) > 0),
    [groupedItemsInScope]
  )

  useEffect(() => {
    if (!hasAvailInGroupedScope && mobileListAvailOnly) setMobileListAvailOnly(false)
  }, [hasAvailInGroupedScope, mobileListAvailOnly])

  useEffect(() => {
    if (clusterBrowseActive && !hasAvailInCluster && mobileListAvailOnly) setMobileListAvailOnly(false)
  }, [clusterBrowseActive, hasAvailInCluster, mobileListAvailOnly])

  useEffect(() => {
    if (clusterBrowseActive && clusterRailFastOnly && !hasFastInCluster) setClusterRailFastOnly(false)
  }, [clusterBrowseActive, clusterRailFastOnly, hasFastInCluster])

  useEffect(() => {
    if (clusterBrowseActive && clusterRailMin2Chargers && !hasMultiChargerInCluster) {
      setClusterRailMin2Chargers(false)
    }
  }, [clusterBrowseActive, clusterRailMin2Chargers, hasMultiChargerInCluster])

  useEffect(() => {
    setClusterRailFastOnly(false)
    setClusterRailMin2Chargers(false)
    setClusterRailBusiNm('')
  }, [clusterBrowseGrouped])

  /**
   * 모바일 목록이 비었을 때 메시지(원인별). filteredItems → itemsInScope → grouped 파이프라인 유지.
   */
  const mobileListEmptyInfo = useMemo(() => {
    if (!isMobile || appliedMapBounds == null) return null
    const q = searchQuery.trim()
    if (items.length === 0) {
      return {
        variant: 'no_data',
        title: '불러온 충전소가 없습니다',
        subtitle: '네트워크·API 키를 확인한 뒤 다시 시도해 주세요.',
      }
    }
    if (q && filteredItems.length === 0) {
      return {
        variant: 'no_filter',
        title: '검색 결과가 없어요',
        subtitle: '다른 지역명·충전소명을 입력하거나, 검색어를 지우고 다시 확인해 보세요.',
      }
    }
    if (filteredItems.length === 0) {
      return {
        variant: 'no_filter',
        title: '조건에 맞는 충전소가 없습니다',
        subtitle: '검색어를 지우거나 필터를 느슨하게 조정해 보세요.',
      }
    }
    if (q && itemsInScope.length === 0) {
      return {
        variant: 'no_in_view',
        title: '현재 지도 범위에서는 찾을 수 없어요',
        subtitle: '지도를 옮긴 뒤「이 지역 검색」으로 다시 맞춰 보거나, 검색어를 조정해 보세요.',
      }
    }
    if (itemsInScope.length === 0) {
      return {
        variant: 'no_in_view',
        title: '이 지도 범위에는 표시할 곳이 없습니다',
        subtitle: '지도를 옮긴 뒤「이 지역 검색」으로 영역을 맞춰 주세요.',
      }
    }
    return null
  }, [isMobile, appliedMapBounds, items.length, filteredItems.length, itemsInScope.length, searchQuery])

  /** 목록 시트 헤더: 단일 소스 (detail → stationFocus → searchResults). 접힘/펼침은 레이아웃만 담당 */
  const listSheetHeaderMode = useMemo(() => {
    if (detailStation) return 'detail'
    if (searchQuery.trim()) return 'searchResults'
    if (clusterBrowseActive) return 'clusterBrowse'
    if (mapSelectedStation) return 'stationFocus'
    return 'searchResults'
  }, [detailStation, mapSelectedStation, searchQuery, clusterBrowseActive])

  const searchNavActive = searchQuery.trim().length > 0
  /** 모바일: 검색 결과 전용 시트 레이아웃(상세와 분리 — 상세 시 엔 false) */
  const mobileSearchResultsMode = isMobile && searchNavActive && !detailStation

  /** 검색 종료 시 peek 스냅 제거(검색 결과 모드 전용 디텐트) */
  useEffect(() => {
    if (!isMobile) return
    if (!searchNavActive && mobileSheetSnap === 'peek') {
      setMobileSheetSnap('closed')
    }
  }, [isMobile, searchNavActive, mobileSheetSnap])

  /** 큰 제목 대신 한 줄 메타(탐색 control rail 상단) */
  const searchRangeWidenedHint =
    searchNavActive && mobileGeoActive && mobileSearchGeo?.widenedHint === true

  const listSheetMetaLine = useMemo(() => {
    if (appliedMapBounds == null) return '지도 영역 준비 중…'
    if (searchNavActive) {
      const base = `검색 결과 ${stationsForMobileListEffective.length}곳`
      return searchRangeWidenedHint ? `${base} · 주변을 넓혀 찾았어요` : base
    }
    if (clusterBrowseActive) return `이 구역 묶음 ${stationsForMobileListEffective.length}곳`
    return `이 지역 ${stationsForMobileListEffective.length}곳`
  }, [
    appliedMapBounds,
    searchNavActive,
    searchRangeWidenedHint,
    clusterBrowseActive,
    stationsForMobileListEffective.length,
  ])

  /** 마커 상한 초과 시 정렬 기준: 적용 영역 중심 우선(팬만 하고 버튼 안 누른 경우 live와 어긋나지 않게) */
  const mapViewCenterForMarkers = useMemo(() => {
    if (appliedMapBounds) {
      return {
        lat: (appliedMapBounds.southWest.lat + appliedMapBounds.northEast.lat) / 2,
        lng: (appliedMapBounds.southWest.lng + appliedMapBounds.northEast.lng) / 2,
      }
    }
    if (liveMapBounds) {
      return {
        lat: (liveMapBounds.southWest.lat + liveMapBounds.northEast.lat) / 2,
        lng: (liveMapBounds.southWest.lng + liveMapBounds.northEast.lng) / 2,
      }
    }
    const [la, ln] = leafletInitial.center
    return { lat: la, lng: ln }
  }, [appliedMapBounds, liveMapBounds, leafletInitial.center])

  /** 지도 전용 파이프라인: 목록/시트 bounds 필터와 분리(마커 누락 방지) */
  const mapSummaryStationsRaw = itemsForMapMarkers
  const mapSummaryStationsAdapted = useMemo(
    () =>
      mapSummaryStationsRaw.filter((r) => {
        const la = Number(r.lat)
        const ln = Number(r.lng)
        return Number.isFinite(la) && Number.isFinite(ln)
      }),
    [mapSummaryStationsRaw],
  )

  const mapRenderableStations = useMemo(() => {
    let rows = mapSummaryStationsAdapted
    if (rows.length > MAP_GROUP_INPUT_ROW_CAP) {
      const { lat, lng } = mapViewCenterForMarkers
      rows = [...rows]
        .map((r) => ({ r, d: haversineDistanceKm(r.lat, r.lng, lat, lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MAP_GROUP_INPUT_ROW_CAP)
        .map(({ r }) => r)
    }
    return groupChargerRowsByPlaceMapLite(rows)
  }, [mapSummaryStationsAdapted, mapViewCenterForMarkers])

  const mapRenderedMarkers = useMemo(() => {
    const cap = MOBILE_MAP_MARKER_CAP
    const src = mapRenderableStations
    if (src.length <= cap) return src
    const { lat, lng } = mapViewCenterForMarkers
    return [...src]
      .map((s) => ({ s, d: haversineDistanceKm(s.lat, s.lng, lat, lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, cap)
      .map(({ s }) => s)
  }, [mapRenderableStations, mapViewCenterForMarkers])

  const mapRenderedMarkersWithSelection = useMemo(() => {
    const sel = mapSelectedStation
    if (!sel) return mapRenderedMarkers
    if (mapRenderedMarkers.some((s) => s.id === sel.id)) return mapRenderedMarkers
    return [sel, ...mapRenderedMarkers]
  }, [mapRenderedMarkers, mapSelectedStation])

  const mapLayerStationsComputed = mapRenderedMarkersWithSelection

  const freezeSnapRef = useRef(/** @type {null | unknown[]} */ (null))
  const freezeUntilRef = useRef(0)
  const freezeOnceRef = useRef(false)
  const [freezeReleaseTick, setFreezeReleaseTick] = useState(0)

  useEffect(() => {
    if (!evMapDiag.freeze1500 || freezeOnceRef.current) return undefined
    if (mapLayerStationsComputed.length === 0) return undefined
    freezeOnceRef.current = true
    freezeSnapRef.current = mapLayerStationsComputed.slice(0, 24)
    freezeUntilRef.current = performance.now() + 1500
    if (import.meta.env.DEV) {
      logDiag('freeze1500 snap', `n=${freezeSnapRef.current.length}`)
    }
    setFreezeReleaseTick((x) => x + 1)
    window.setTimeout(() => {
      freezeSnapRef.current = null
      freezeUntilRef.current = 0
      setFreezeReleaseTick((x) => x + 1)
      if (import.meta.env.DEV) logDiag('freeze1500 end', '')
    }, 1500)
    return undefined
  }, [evMapDiag.freeze1500, mapLayerStationsComputed])

  const mapLayerStations = useMemo(() => {
    if (
      evMapDiag.freeze1500 &&
      freezeSnapRef.current &&
      performance.now() < freezeUntilRef.current
    ) {
      return freezeSnapRef.current
    }
    return mapLayerStationsComputed
    // freezeReleaseTick: freeze 만료 시 동일 computed라도 재평가
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 트리거
  }, [mapLayerStationsComputed, evMapDiag.freeze1500, freezeReleaseTick])

  useEffect(() => {
    mapLayerStationsLenRef.current = mapLayerStations.length
  }, [mapLayerStations.length])

  useEffect(() => {
    if (!pipelineReactLogPendingRef.current) return
    pipelineReactLogPendingRef.current = false
    const f = lastEvPipelineFetchRef.current
    if (!f || (f.phase !== 'boot' && f.phase !== 'search-area')) return
    const now = performance.now()
    mapPipelineCountsRef.current = {
      adapted: mapSummaryStationsAdapted.length,
      grouped: mapRenderableStations.length,
      afterCap: mapRenderedMarkers.length,
      final: mapLayerStations.length,
    }
    logEvPipelineReactPipeline({
      phase: f.phase,
      msSinceFetchEnd: Math.round(now - f.fetchEndT),
      fetchMsSnapshot: f.fetchMs,
      rawRowsScanned: f.rawRowsScanned,
      normalizeOk: f.normalizeOk,
      boundsInsideRows: items.length,
      adaptedValidCoords: mapSummaryStationsAdapted.length,
      groupedPlaces: mapRenderableStations.length,
      renderableAfterCap: mapRenderedMarkers.length,
      finalRenderedMarkers: mapLayerStations.length,
      note:
        'fetch 끝~이 로그: React 메모(그룹·거리캡)·커밋. finalRenderedMarkers===0이면 좌표/그룹/캡·부트 게이트를 의심.',
    })
  }, [
    items.length,
    mapSummaryStationsAdapted.length,
    mapRenderableStations.length,
    mapRenderedMarkers.length,
    mapLayerStations.length,
  ])

  const prevMapLayerArrRef = useRef(/** @type {unknown[] | null} */ (null))
  const prevMapLayerIds20Ref = useRef('')
  useEffect(() => {
    if (!import.meta.env.DEV || !evMapDiag.track) return
    const arr = mapLayerStations
    const ids20 = arr
      .slice(0, 20)
      .map((s) => s.id)
      .join('|')
    if (prevMapLayerArrRef.current !== arr) {
      diagMapLayerRefChanges.current += 1
      logDiag(
        `mapLayerStations[] ref #${diagMapLayerRefChanges.current}`,
        `len=${arr.length} ids20eq=${ids20 === prevMapLayerIds20Ref.current}`,
      )
      prevMapLayerArrRef.current = arr
    }
    prevMapLayerIds20Ref.current = ids20
  }, [mapLayerStations, evMapDiag.track])

  const prevMapLayerLenRef = useRef(-1)
  useEffect(() => {
    telemetryMapLayerStations(mapLayerStations.length, prevMapLayerLenRef.current)
    prevMapLayerLenRef.current = mapLayerStations.length
  }, [mapLayerStations])

  const itemsReadyLoggedRef = useRef(false)
  useEffect(() => {
    if (items.length > 0 && !itemsReadyLoggedRef.current) {
      itemsReadyLoggedRef.current = true
      telemetryItemsReady(items.length)
    }
  }, [items.length])

  useEffect(() => {
    const m = new Map()
    for (const s of mapLayerStations) {
      m.set(s.id, s)
    }
    mapLayerStationsByIdRef.current = m
  }, [mapLayerStations])

  const prevBootOpenRef = useRef(bootOverlayOpen)
  useEffect(() => {
    if (prevBootOpenRef.current && !bootOverlayOpen) {
      telemetryBootOverlayHidden()
      logMapLayerStationsSummary()
      if (import.meta.env.DEV && evMapDiag.track) {
        logDiag('diag@overlayOff', {
          mapLayerRefChanges: diagMapLayerRefChanges.current,
          evLayerMounts: diagEvLayerMountCount.current,
          iconResolves: diagIconResolveCountRef.current,
        })
      }
    }
    prevBootOpenRef.current = bootOverlayOpen
  }, [bootOverlayOpen, evMapDiag.track])

  const mapBootDiagPrevAwaitingRef = useRef(false)
  useEffect(() => {
    if (!import.meta.env.DEV) {
      mapBootDiagPrevAwaitingRef.current = awaitingInitialMapPaint
      return
    }
    if (mapBootDiagPrevAwaitingRef.current && !awaitingInitialMapPaint) {
      console.debug('[whereEV3] map sources after initial map paint', {
        items: items.length,
        filteredItems: filteredItems.length,
        itemsInScope: itemsInScope.length,
        mapSummaryStationsAdapted: mapSummaryStationsAdapted.length,
        mapRenderableStations: mapRenderableStations.length,
        mapRenderedMarkers: mapRenderedMarkers.length,
        mapLayerStations: mapLayerStations.length,
        appliedMapBounds: !!appliedMapBounds,
      })
    }
    mapBootDiagPrevAwaitingRef.current = awaitingInitialMapPaint
  }, [
    awaitingInitialMapPaint,
    items.length,
    filteredItems.length,
    itemsInScope.length,
    mapSummaryStationsAdapted.length,
    mapRenderableStations.length,
    mapRenderedMarkers.length,
    mapLayerStations.length,
    appliedMapBounds,
  ])

  /** 오버레이가 열릴 때마다 순환 문구 인덱스 리셋 */
  const prevBootOverlayOpenRef = useRef(false)
  useEffect(() => {
    if (bootOverlayOpen && !prevBootOverlayOpenRef.current) setBootMessageIndex(0)
    prevBootOverlayOpenRef.current = bootOverlayOpen
  }, [bootOverlayOpen])

  /** 부트 로딩 중 안내 문구 순환(1.6~2.2s, reduced-motion 시 느리게) */
  useEffect(() => {
    if (!bootOverlayOpen || bootMarkerGateFailed || bootFinalizing) return undefined
    const ms = bootReduceMotion ? 4200 : 1900
    const id = window.setInterval(() => {
      setBootMessageIndex((i) => (i + 1) % BOOT_LOADING_ROTATION_MESSAGES.length)
    }, ms)
    return () => window.clearInterval(id)
  }, [bootOverlayOpen, bootMarkerGateFailed, bootReduceMotion, bootFinalizing])

  /** 72% 마커 대기 구간이 길면 진행 바만 indeterminate로 전환(문구는 순환 유지) */
  useEffect(() => {
    if (!bootOverlayOpen || !awaitingInitialMapPaint) return undefined
    if (bootProgress < 72 || bootProgress >= 88) return undefined
    const id = window.setTimeout(() => setBootLinearIndeterminate(true), 10000)
    return () => window.clearTimeout(id)
  }, [bootOverlayOpen, awaitingInitialMapPaint, bootProgress])

  const bootMarkerWaitEnterLoggedRef = useRef(false)
  useEffect(() => {
    if (!awaitingInitialMapPaint) {
      bootMarkerWaitEnterLoggedRef.current = false
      return
    }
    if (bootMarkerWaitEnterLoggedRef.current) return
    bootMarkerWaitEnterLoggedRef.current = true
    const t0 = performance.now()
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- 부트 마커 파이프라인 계측
      console.info('[bootMarkerPipeline] marker-wait-enter', {
        t0,
        rawRows: items.length,
        adaptedValidCoords: mapSummaryStationsAdapted.length,
        renderCandidates: mapRenderableStations.length,
        finalMarkerCount: mapLayerStations.length,
      })
    }
  }, [
    awaitingInitialMapPaint,
    items.length,
    mapSummaryStationsAdapted.length,
    mapRenderableStations.length,
    mapLayerStations.length,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV || !evMapDiag.countTrace) return
    // eslint-disable-next-line no-console -- 단계별 count 증명
    console.info('[mapCountTrace] render-pipeline', {
      rawRows: mapSummaryStationsRaw.length,
      adaptedRows: mapSummaryStationsAdapted.length,
      validCoords: mapSummaryStationsAdapted.length,
      preFilterRenderCandidates: mapRenderableStations.length,
      postBoundsVisible: '(map path: bounds filter bypass)',
      clusterInput: mapRenderableStations.length,
      finalRenderedMarkers: mapLayerStations.length,
    })
  }, [
    evMapDiag.countTrace,
    mapSummaryStationsRaw.length,
    mapSummaryStationsAdapted.length,
    mapRenderableStations.length,
    mapLayerStations.length,
  ])

  useEffect(() => {
    const pending = searchAreaAwaitingMarkersRef.current
    if (!pending) return
    if (mapLayerStations.length === 0) return
    if (import.meta.env.DEV) {
      searchAreaTimingLog(pending, 'first-marker-visible', { n: mapLayerStations.length })
    }
    if (isEvPipelineLogEnabled()) {
      const now = performance.now()
      const f = lastEvPipelineFetchRef.current
      const clickT = searchAreaClickT0Ref.current
      const fetchEndToFirstPaintMs =
        f?.phase === 'search-area' && f.fetchEndT != null ? Math.round(now - f.fetchEndT) : null
      logEvPipelineFirstMarker({
        phase: 'search-area',
        fetchMs: f?.phase === 'search-area' ? f.fetchMs : null,
        rawRowsScanned: f?.phase === 'search-area' ? f.rawRowsScanned : null,
        normalizeOk: f?.phase === 'search-area' ? f.normalizeOk : null,
        boundsInsideRows: items.length,
        adaptedValidCoords: mapSummaryStationsAdapted.length,
        groupedPlaces: mapRenderableStations.length,
        renderableAfterCap: mapRenderedMarkers.length,
        finalRenderedMarkers: mapLayerStations.length,
        markerWaitMs: null,
        fetchEndToFirstPaintMs,
        clickToFirstPaintMs: clickT != null ? Math.round(now - clickT) : null,
        slowHint: evPipelineSlowHint(
          f?.phase === 'search-area' ? f.fetchMs ?? 0 : 0,
          fetchEndToFirstPaintMs,
        ),
      })
    }
    searchAreaAwaitingMarkersRef.current = null
  }, [
    mapLayerStations.length,
    items.length,
    mapSummaryStationsAdapted.length,
    mapRenderableStations.length,
    mapRenderedMarkers.length,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (mapSearchAreaLoading) return
    const pending = searchAreaAwaitingMarkersRef.current
    if (pending && mapLayerStations.length === 0) {
      searchAreaTimingLog(pending, 'search-area-loading-off-zero-markers', {})
      searchAreaAwaitingMarkersRef.current = null
    }
  }, [mapSearchAreaLoading, mapLayerStations.length])

  /** 현재 화면 bounds가 적용 영역과 다를 때만「이 지역 검색」노출 (이동·줌 반영) */
  const showSearchAreaButton = useMemo(() => {
    if (!liveMapBounds || !appliedMapBounds) return false
    const thr = 0.00008
    const a = appliedMapBounds
    const l = liveMapBounds
    return (
      Math.abs(a.southWest.lat - l.southWest.lat) > thr ||
      Math.abs(a.southWest.lng - l.southWest.lng) > thr ||
      Math.abs(a.northEast.lat - l.northEast.lat) > thr ||
      Math.abs(a.northEast.lng - l.northEast.lng) > thr
    )
  }, [liveMapBounds, appliedMapBounds])

  useEffect(() => {
    setFilterSggCd('')
  }, [filterCtprvnCd])

  useEffect(() => {
    if (!locationError) return
    const t = setTimeout(() => setLocationError(null), 5000)
    return () => clearTimeout(t)
  }, [locationError])

  const filterOptions = useMemo(() => {
    const busiNms = [...new Set(items.map((s) => s.busiNm).filter(Boolean))].sort()
    const region = buildRegionFilterOptions(items)
    return {
      busiNms: busiNms.map((v) => ({ value: v, label: v })),
      ctprvnCds: region.ctprvnCds,
      sggCdsByCtprvn: region.sggCdsByCtprvn,
    }
  }, [items])

  const detailHeaderSubtitle = useMemo(() => {
    if (!detailStation) return ''
    const st = (detailStation.latestStatUpdDt || detailStation.statUpdDt || '').trim()
    if (st) return `공공데이터 목록 갱신 시각 ${st}`
    if (lastEvFetchAt) {
      try {
        const d = new Date(lastEvFetchAt)
        return `목록 조회 ${d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      } catch {
        return ''
      }
    }
    return ''
  }, [detailStation, lastEvFetchAt])

  /** 헤더 2행: 거리·주소(가독 secondary) — 갱신 시각과 분리 */
  const detailHeaderLocationLine = useMemo(() => {
    if (!detailStation) return ''
    const parts = []
    const dist = formatDistanceKm(detailStation.distanceKm)
    if (dist) parts.push(dist)
    const addrLines = formatAddressBlockLines(detailStation)
    if (addrLines[0]) parts.push(addrLines[0])
    return parts.join(' · ')
  }, [detailStation])

  const chargerSummaryUpdatedInHeader = useMemo(
    () => !!(detailStation && (detailStation.latestStatUpdDt || detailStation.statUpdDt)),
    [detailStation]
  )

  const panelEl = (
        <MobileBottomSheet
          key={detailStation ? 'mobile-sheet-detail' : 'mobile-sheet-list'}
          topOffsetPx={sheetLayout.mobileTopBarStackPx}
          halfVhRatio={detailStation ? 0.7 : sheetLayout.halfVhRatio}
          halfMaxAvailableRatio={detailStation ? 1 : 0.68}
          scrollContentTopDense={!!detailStation}
          scrollBodyPaddingTop={detailStation ? 0 : undefined}
          snap={mobileSheetSnap}
          onSnapChange={handleMobileSheetSnapChange}
          listScrollRef={sheetListScrollRef}
          onSnapHeightPxChange={handleSheetSnapHeightPx}
          pullBodyToExpandWhenHalf={!!detailStation}
          peekVhRatio={mobileSearchResultsMode ? sheetLayout.searchResultsPeekVhRatio : null}
          capFullBelowTopOffset={mobileSearchResultsMode}
          immersiveFull={!mobileSearchResultsMode}
          allowPeekBodyExpand={mobileSearchResultsMode}
          footer={
            detailStation ? (
              <StationDetailFooterActions station={detailStation} variant="sheet" />
            ) : null
          }
          renderHeader={({ snap, sheetDragHandlers }) => {
            if (snap === 'closed') return null
            const d = detailStation
            if (d) {
              if (snap === 'full') {
                return (
                  <Box sx={{ bgcolor: tokens.bg.subtle, borderBottom: `1px solid ${tokens.border.subtle}` }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 1,
                        px: MOBILE_DETAIL_HEADER_GUTTER,
                        py: 1.125,
                        minHeight: MOBILE_DETAIL_FULL_HEADER_MIN_H,
                        boxSizing: 'border-box',
                      }}
                    >
                      <IconButton
                        onClick={handleCloseDetail}
                        aria-label="뒤로"
                        size="small"
                        sx={{
                          color: tokens.text.secondary,
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          minHeight: 40,
                          p: 0,
                          borderRadius: radius.md,
                          mt: 0.125,
                        }}
                      >
                        <ArrowBack sx={{ fontSize: 22 }} />
                      </IconButton>
                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 0.125 }}>
                        <Typography
                          id="ev-mobile-detail-title"
                          variant="h6"
                          component="h2"
                          sx={{
                            color: tokens.text.primary,
                            ...appMobileType.detailSheetTitle,
                          }}
                        >
                          {d.statNm}
                        </Typography>
                        {detailHeaderLocationLine ? (
                          <Typography
                            variant="body2"
                            sx={{
                              display: 'block',
                              mt: 0.5,
                              color: tokens.text.secondary,
                              lineHeight: 1.45,
                              fontWeight: 500,
                              fontSize: '0.8125rem',
                              wordBreak: 'break-word',
                            }}
                          >
                            {detailHeaderLocationLine}
                          </Typography>
                        ) : null}
                        {detailHeaderSubtitle ? (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              mt: detailHeaderLocationLine ? 0.35 : 0.5,
                              color: tokens.text.tertiary,
                              fontSize: '0.75rem',
                              lineHeight: 1.4,
                              fontWeight: 500,
                            }}
                          >
                            {detailHeaderSubtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        onClick={() => void refreshEvData()}
                        disabled={detailRefreshing}
                        aria-label="충전소 요약 데이터 새로고침"
                        size="small"
                        sx={{
                          color: tokens.text.secondary,
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          minHeight: 40,
                          p: 0,
                          borderRadius: radius.md,
                          mt: 0.125,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {detailRefreshing ? (
                          <CircularProgress size={20} thickness={5} sx={{ color: colors.blue.primary }} />
                        ) : (
                          <Refresh sx={{ fontSize: 22 }} />
                        )}
                      </IconButton>
                    </Box>
                  </Box>
                )
              }
              /* half: 뒤로가기 없음 — full에서만 노출. 헤더 전체를 드래그해 half→full */
              return (
                <Box
                  sx={{ bgcolor: tokens.bg.subtle, borderBottom: `1px solid ${tokens.border.subtle}` }}
                  data-ev-list-header-mode="detail"
                >
                  <Box
                    {...sheetDragHandlers}
                    sx={{
                      touchAction: 'none',
                      cursor: 'grab',
                      pt: 1,
                      pb: 1.25,
                      '&:active': { cursor: 'grabbing' },
                    }}
                  >
                    <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border.strong, mx: 'auto', opacity: 0.55 }} aria-hidden />
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        px: MOBILE_DETAIL_HEADER_GUTTER,
                        pt: 0.875,
                        pb: 0.25,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" component="h2" sx={{ color: tokens.text.primary, ...appMobileType.detailSheetTitle }}>
                          {d.statNm}
                        </Typography>
                        {detailHeaderLocationLine ? (
                          <Typography
                            variant="body2"
                            sx={{
                              display: 'block',
                              mt: 0.45,
                              color: tokens.text.secondary,
                              lineHeight: 1.45,
                              fontWeight: 500,
                              fontSize: '0.8125rem',
                              wordBreak: 'break-word',
                            }}
                          >
                            {detailHeaderLocationLine}
                          </Typography>
                        ) : null}
                        {detailHeaderSubtitle ? (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              mt: detailHeaderLocationLine ? 0.35 : 0.45,
                              color: tokens.text.tertiary,
                              fontSize: '0.75rem',
                              lineHeight: 1.4,
                              fontWeight: 500,
                            }}
                          >
                            {detailHeaderSubtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        onClick={() => void refreshEvData()}
                        disabled={detailRefreshing}
                        aria-label="충전소 요약 데이터 새로고침"
                        size="small"
                        sx={{
                          color: tokens.text.secondary,
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          minHeight: 40,
                          p: 0,
                          mt: 0.125,
                          borderRadius: radius.md,
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {detailRefreshing ? (
                          <CircularProgress size={20} thickness={5} sx={{ color: colors.blue.primary }} />
                        ) : (
                          <Refresh sx={{ fontSize: 22 }} />
                        )}
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              )
            }
            if (snap === 'full') {
              return (
                <Box sx={{ bgcolor: colors.white, borderBottom: `1px solid ${colors.gray[200]}` }} data-ev-list-header-mode={listSheetHeaderMode}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.75, minHeight: 48 }}>
                    <IconButton
                      onClick={() => setMobileSheetSnap('half')}
                      aria-label="목록으로 돌아가기"
                      size="small"
                      sx={{ color: colors.gray[700] }}
                    >
                      <ArrowBack />
                    </IconButton>
                    <Typography
                      component="div"
                      aria-live="polite"
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 700,
                        fontSize: '1rem',
                        letterSpacing: '-0.02em',
                        color: colors.gray[800],
                      }}
                    >
                      {listSheetMetaLine}
                    </Typography>
                  </Box>
                </Box>
              )
            }
            return (
              <Box
                data-ev-list-header-mode={listSheetHeaderMode}
                sx={{
                  bgcolor: colors.gray[50],
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                }}
              >
                <Box
                  {...sheetDragHandlers}
                  sx={{
                    touchAction: 'none',
                    cursor: 'grab',
                    pt: 1,
                    '&:active': { cursor: 'grabbing' },
                  }}
                >
                  <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: colors.gray[300], mx: 'auto', mb: 1.25 }} aria-hidden />
                  <Typography
                    component="div"
                    aria-live="polite"
                    sx={{
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      color: colors.gray[600],
                      px: 2.5,
                      lineHeight: 1.4,
                    }}
                  >
                    {listSheetMetaLine}
                  </Typography>
                </Box>
                <Box
                  role="toolbar"
                  aria-label={clusterBrowseActive ? '묶음 결과 빠른 필터' : '필터, 정렬 및 빠른 필터'}
                  onPointerDown={(e) => e.stopPropagation()}
                  sx={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: '9px',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    px: 2.5,
                    pt: 1.5,
                    pb: 1.5,
                    mt: 1,
                    bgcolor: 'transparent',
                  }}
                >
                  {(
                    clusterBrowseActive
                      ? [
                          {
                            key: 'dist',
                            kind: 'toggle',
                            label: '가까운 순',
                            on: mobileListSort === 'distance',
                            disabled: false,
                            onClick: () => setMobileListSort('distance'),
                          },
                          {
                            key: 'name',
                            kind: 'toggle',
                            label: '이름순',
                            on: mobileListSort === 'name',
                            disabled: false,
                            onClick: () => setMobileListSort('name'),
                          },
                          {
                            key: 'avail',
                            kind: 'toggle',
                            label: '사용 가능만',
                            on: mobileListAvailOnly,
                            disabled: !hasAvailInCluster,
                            onClick: () => {
                              if (!hasAvailInCluster) return
                              setMobileListAvailOnly((v) => !v)
                            },
                          },
                          {
                            key: 'cFast',
                            kind: 'toggle',
                            label: '급속만',
                            on: clusterRailFastOnly,
                            disabled: !hasFastInCluster,
                            onClick: () => {
                              if (!hasFastInCluster) return
                              setClusterRailFastOnly((v) => !v)
                            },
                          },
                          {
                            key: 'c2plus',
                            kind: 'toggle',
                            label: '2대 이상',
                            on: clusterRailMin2Chargers,
                            disabled: !hasMultiChargerInCluster,
                            onClick: () => {
                              if (!hasMultiChargerInCluster) return
                              setClusterRailMin2Chargers((v) => !v)
                            },
                          },
                          ...(clusterOperatorTop.length > 1
                            ? [
                                {
                                  key: 'busiAll',
                                  kind: 'toggle',
                                  label: '전체 기관',
                                  on: !clusterRailBusiNm,
                                  disabled: false,
                                  onClick: () => setClusterRailBusiNm(''),
                                },
                                ...clusterOperatorTop.map((name) => ({
                                  key: `busi-${name}`,
                                  kind: 'toggle',
                                  label: name.length > 11 ? `${name.slice(0, 10)}…` : name,
                                  on: clusterRailBusiNm === name,
                                  disabled: false,
                                  onClick: () => setClusterRailBusiNm((cur) => (cur === name ? '' : name)),
                                })),
                              ]
                            : []),
                        ]
                      : [
                          {
                            key: 'filterSheet',
                            kind: 'sheet',
                            label: '필터',
                            disabled: !!detailStation,
                            onClick: () => openFilterDrawer(),
                          },
                          {
                            key: 'dist',
                            kind: 'toggle',
                            label: '가까운 순',
                            on: mobileListSort === 'distance',
                            disabled: false,
                            onClick: () => setMobileListSort('distance'),
                          },
                          {
                            key: 'name',
                            kind: 'toggle',
                            label: '이름순',
                            on: mobileListSort === 'name',
                            disabled: false,
                            onClick: () => setMobileListSort('name'),
                          },
                          {
                            key: 'fast',
                            kind: 'toggle',
                            label: '급속',
                            on: filterSpeed === '급속',
                            disabled: false,
                            onClick: () => setFilterSpeed((v) => (v === '급속' ? '' : '급속')),
                          },
                          {
                            key: 'avail',
                            kind: 'toggle',
                            label: '사용 가능만',
                            on: mobileListAvailOnly,
                            disabled: !hasAvailInGroupedScope,
                            onClick: () => {
                              if (!hasAvailInGroupedScope) return
                              setMobileListAvailOnly((v) => !v)
                            },
                          },
                        ]
                  ).map((c) => {
                    if (c.kind === 'sheet') {
                      return (
                        <Chip
                          key={c.key}
                          label={c.label}
                          disabled={c.disabled}
                          onClick={c.disabled ? undefined : c.onClick}
                          aria-label={
                            c.disabled ? '상세를 닫은 뒤 필터를 사용할 수 있습니다' : '전체 필터·지역 등 더 보기'
                          }
                          sx={{
                            flexShrink: 0,
                            height: 44,
                            fontSize: '0.875rem',
                            lineHeight: 1.2,
                            fontWeight: 700,
                            borderRadius: 9999,
                            bgcolor: c.disabled ? colors.gray[50] : tokens.bg.muted,
                            color: c.disabled ? colors.gray[400] : colors.gray[800],
                            border: `1px solid ${c.disabled ? colors.gray[200] : colors.gray[300]}`,
                            boxShadow: 'none',
                            opacity: c.disabled ? 0.85 : 1,
                            transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                            '& .MuiChip-label': { px: '16px', py: 0 },
                            '&:hover': {
                              bgcolor: c.disabled ? colors.gray[50] : colors.gray[200],
                              borderColor: c.disabled ? colors.gray[200] : colors.gray[400],
                            },
                          }}
                        />
                      )
                    }
                    return (
                      <Chip
                        key={c.key}
                        label={c.label}
                        disabled={c.disabled}
                        onClick={c.disabled ? undefined : c.onClick}
                        sx={{
                          flexShrink: 0,
                          height: 44,
                          fontSize: '0.875rem',
                          lineHeight: 1.2,
                          fontWeight: c.on ? 700 : 600,
                          borderRadius: 9999,
                          bgcolor: c.disabled
                            ? colors.gray[50]
                            : c.on
                              ? tokens.blue.mutedStrong
                              : tokens.bg.muted,
                          color: c.disabled ? colors.gray[400] : c.on ? colors.blue.deep : colors.gray[800],
                          border: `1px solid ${
                            c.disabled ? colors.gray[200] : c.on ? colors.blue.primary : colors.gray[300]
                          }`,
                          boxShadow: 'none',
                          opacity: c.disabled ? 0.85 : 1,
                          transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                          '& .MuiChip-label': { px: '16px', py: 0 },
                          '&:hover': {
                            bgcolor: c.disabled
                              ? colors.gray[50]
                              : c.on
                                ? tokens.blue.muted
                                : colors.gray[200],
                            borderColor: c.disabled
                              ? colors.gray[200]
                              : c.on
                                ? colors.blue.deep
                                : colors.gray[400],
                          },
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            )
          }}
        >
          {detailStation ? (
            <MobileDetailSheetBody station={detailStation} chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader} />
          ) : (
            <StationListMobile
              key={`scope-${clusterBrowseActive ? `cluster-${clusterBrowseGrouped.map((s) => s.id).join(',')}` : appliedMapBounds ? [appliedMapBounds.southWest.lat, appliedMapBounds.southWest.lng, appliedMapBounds.northEast.lat, appliedMapBounds.northEast.lng].join(',') : 'none'}`}
              stations={stationsForMobileListEffective}
              selectedId={mapSelectedStation?.id}
              loadingBounds={appliedMapBounds == null}
              loadingHint="지도에 적용할 검색 영역을 준비하는 중입니다."
              emptyMessage={
                clusterBrowseActive && stationsForMobileListEffective.length === 0
                  ? '이 묶음에서 조건에 맞는 충전소가 없습니다'
                  : groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                    ? '이 조건에 맞는 충전소가 없습니다'
                    : (mobileListEmptyInfo?.title ?? '표시할 충전소가 없습니다')
              }
              emptySubMessage={
                clusterBrowseActive && stationsForMobileListEffective.length === 0
                  ? '위 빠른 필터(급속만·2대 이상·기관)를 바꾸거나「사용 가능만」을 끄고 다시 확인해 보세요.'
                  : groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                    ? '빠른 필터를 바꾸거나 전체 필터에서 조건을 조정해 보세요.'
                    : mobileListEmptyInfo?.subtitle
              }
              emptyVariant={
                clusterBrowseActive && stationsForMobileListEffective.length === 0
                  ? 'no_filter'
                  : groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                    ? 'no_filter'
                    : (mobileListEmptyInfo?.variant ?? 'no_in_view')
              }
              onOpenDetail={openDetailPreserve}
            />
          )}
        </MobileBottomSheet>
  )

  const bootPct = Math.min(100, Math.max(0, Math.round(bootProgress)))

  return (
    <>
      {bootOverlayOpen ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: resolvedMode === 'dark' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.5)',
            px: 2.5,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 300,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 1,
            }}
          >
            {bootMarkerGateFailed ? (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.45,
                  px: 0.5,
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                {bootStageMessage}
              </Typography>
            ) : (
              <Fade in={bootChromeVisible} timeout={bootReduceMotion ? 0 : 420}>
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 1,
                  }}
                >
                  <BootEvCarAnimation reduceMotion={bootReduceMotion} />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      width: '100%',
                      maxWidth: 272,
                      mt: -0.25,
                    }}
                  >
                    <BootSegmentedProgress
                      value={bootPct}
                      indeterminate={bootLinearIndeterminate}
                      reduceMotion={bootReduceMotion}
                      sx={{ flex: 1, minWidth: 0, maxWidth: 'none', mx: 0 }}
                    />
                    {!bootLinearIndeterminate ? (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{
                          flexShrink: 0,
                          color: 'rgba(255,255,255,0.92)',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: '2.35em',
                          textAlign: 'right',
                          lineHeight: 1.2,
                        }}
                      >
                        {bootPct}%
                      </Typography>
                    ) : null}
                  </Box>
                  {bootFinalizing ? (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.45,
                        px: 0.5,
                        mt: -0.125,
                        minHeight: '2.75em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.88)',
                      }}
                    >
                      {bootStageMessage}
                    </Typography>
                  ) : (
                    <Fade in timeout={bootReduceMotion ? 0 : 320} key={bootMessageIndex}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          lineHeight: 1.45,
                          px: 0.5,
                          mt: -0.125,
                          minHeight: '2.75em',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.78)',
                        }}
                      >
                        {BOOT_LOADING_ROTATION_MESSAGES[bootMessageIndex % BOOT_LOADING_ROTATION_MESSAGES.length]}
                      </Typography>
                    </Fade>
                  )}
                </Box>
              </Fade>
            )}
            {bootMarkerGateFailed ? (
              <BootSegmentedProgress indeterminate reduceMotion={bootReduceMotion} sx={{ maxWidth: 272, mx: 0 }} />
            ) : null}
            {bootMarkerGateFailed ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 280, mt: 0.25 }}>
                <Button
                  type="button"
                  variant="contained"
                  size="medium"
                  onClick={() => void handleBootMarkerRetry()}
                  sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700 }}
                >
                  다시 시도
                </Button>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  onClick={() => {
                    setBootMarkerGateFailed(false)
                    setBootOverlayOpen(false)
                    bootMapPaintedRef.current = true
                  }}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.78)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  닫고 지도만 보기
                </Button>
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}
      {import.meta.env.DEV && (
        <Box
          sx={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 9999,
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            bgcolor: 'rgba(17,24,39,0.75)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          v3
        </Box>
      )}
      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          '@supports (height: 100dvh)': {
            height: '100dvh',
          },
          overflow: 'hidden',
          overscrollBehavior: 'none',
          overscrollBehaviorY: 'none',
        }}
      >
        {/* 상단 플로팅 크롬 — fixed + wrapper가 safe-area 흡수 (노치/다이내믹 아일랜드) */}
        <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 450,
              boxSizing: 'border-box',
              pt: `calc(env(safe-area-inset-top, 0px) + ${mobileMapChrome.safeAreaInnerTopPad}px)`,
              pl: `max(${mobileMapChrome.padX}px, env(safe-area-inset-left, 0px))`,
              pr: `max(${mobileMapChrome.padX}px, env(safe-area-inset-right, 0px))`,
              pb: `${mobileMapChrome.padY}px`,
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                minWidth: 0,
                gap: 0,
                pointerEvents: 'auto',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: `${mobileMapChrome.rowGap}px`,
                  width: '100%',
                  minWidth: 0,
                }}
              >
              <MobileMapSearchBar
                value={searchInput}
                onChange={setSearchInput}
                onClear={clearNavSearch}
                onSubmit={flushSearchFromInput}
                focused={searchBarFocused}
                onFocus={() => setSearchBarFocused(true)}
                onBlur={() => setSearchBarFocused(false)}
                onSuggestionPick={pickSearchSuggestion}
                activeQuickQuery={searchQuery}
                searchResultsMode={mobileSearchResultsMode}
                onSearchBack={clearNavSearch}
                embedQuickChips={false}
                suppressQuickChips={
                  searchBarFocused ||
                  (!!detailStation && mobileSheetSnap === 'full') ||
                  (mobileSearchResultsMode && mobileSheetSnap === 'full')
                }
              />
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  flexShrink: 0,
                  mt: 0,
                  gap: `${mobileMapChrome.rowGap}px`,
                }}
              >
                <IconButton
                  onClick={() => setGeoNonce((n) => n + 1)}
                  aria-label="현재 위치로 이동"
                  sx={{
                    width: mobileMapChrome.fabSize,
                    height: mobileMapChrome.fabSize,
                    minWidth: mobileMapChrome.fabSize,
                    minHeight: mobileMapChrome.fabSize,
                    boxSizing: 'border-box',
                    bgcolor: tokens.control.fabBg,
                    border: `1px solid ${tokens.control.fabBorder}`,
                    borderRadius: '50%',
                    color: tokens.text.primary,
                    boxShadow: tokens.shadow.float,
                    transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, color 0.2s ease, background-color 0.2s ease`,
                    '&:hover': {
                      bgcolor: tokens.bg.raised,
                      boxShadow: `${tokens.shadow.float}, 0 0 20px ${tokens.blue.glowSoft}`,
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${tokens.blue.main}`,
                      outlineOffset: 2,
                    },
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  <MyLocationIcon sx={{ fontSize: 24 }} />
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => togglePreference()}
                  aria-label={resolvedMode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                  sx={{
                    width: mobileMapChrome.fabSize,
                    height: mobileMapChrome.fabSize,
                    minWidth: mobileMapChrome.fabSize,
                    minHeight: mobileMapChrome.fabSize,
                    boxSizing: 'border-box',
                    bgcolor: tokens.control.fabBg,
                    border: `1px solid ${tokens.control.fabBorder}`,
                    borderRadius: '50%',
                    color: tokens.text.primary,
                    boxShadow: tokens.shadow.float,
                    transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, color 0.2s ease, background-color 0.2s ease`,
                    '&:hover': {
                      bgcolor: tokens.bg.raised,
                      boxShadow: `${tokens.shadow.float}, 0 0 20px ${tokens.blue.glowSoft}`,
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${tokens.blue.main}`,
                      outlineOffset: 2,
                    },
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  {resolvedMode === 'dark' ? (
                    <DarkModeOutlined sx={{ fontSize: 22 }} aria-hidden />
                  ) : (
                    <LightModeOutlined sx={{ fontSize: 22 }} aria-hidden />
                  )}
                </IconButton>
              </Box>
              </Box>
              {!searchBarFocused &&
              !(!!detailStation && mobileSheetSnap === 'full') &&
              !(mobileSearchResultsMode && mobileSheetSnap === 'full') ? (
                <MobileMapQuickSearchChipsRail
                  variant="fullBleed"
                  activeQuickQuery={searchQuery}
                  onSuggestionPick={handleMobileQuickSearchPick}
                />
              ) : null}
            </Box>
          </Box>
        {/* Full-screen map */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
          }}
        >
          <MapContainer
            center={leafletInitial.center}
            zoom={leafletInitial.zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl={false}
          >
            <MapCenterTracker setMapCenter={setMapCenter} />
            <MapBoundsTracker
              setMapBounds={setLiveMapBounds}
              syncRef={liveMapBoundsRef}
              boundsQuietMs={evMapDiag.nobounds1500 ? 1500 : 0}
            />
            <MapChipViewportJump
              request={chipViewportJumpRequest}
              onComplete={handleChipViewportJumpComplete}
            />
            {import.meta.env.DEV ? <MapMarkerDomTelemetry /> : null}
            {import.meta.env.DEV ? <MapContainerMountProbe /> : null}
            {import.meta.env.DEV && evMapDiag.anyLeafletHarness ? <MapLeafletExperiments /> : null}
            <MapBootMarkerReady
              active={awaitingInitialMapPaint}
              center={leafletInitial.center}
              zoom={leafletInitial.zoom}
              itemsLength={items.length}
              markerCount={harnessBootMarkerCount ?? mapLayerStations.length}
              expectedMarkerIcons={harnessBootMarkerCount ?? mapLayerStations.length}
              skipDomIconCountGate={import.meta.env.DEV && evMapDiag.anyLeafletHarness}
              firstPaintMaxWaitMs={90000}
              onTimeout={evMapDiag.anyLeafletHarness ? undefined : onBootMapPaintTimeout}
              onReady={onBootMapPaintReady}
            />
            {import.meta.env.DEV && (evMapDiag.proof || evMapDiag.apiProof) ? (
              <MapMarkerProofLayers
                showHardcoded={evMapDiag.proof}
                apiFirst20={evMapDiag.apiProof ? mapProofApiDots : []}
              />
            ) : null}
            <MapMobileSearchViewportFitter
              enabled
              fitNonce={searchViewportFitNonce}
              searchQuery={searchQuery}
              filteredItems={filteredItemsForScope}
              setAppliedMapBounds={setAppliedMapBounds}
              ignoreRegionKeywordBounds
              onBoundsAppliedFromSearch={onSearchViewportBoundsApplied}
            />
            <MapFocusOnStation selectedStation={mapSelectedStation} isMobile={isMobile} />
            <EvStationMapLayer
              stations={
                evMapDiag.anyLeafletHarness ? [] : awaitingInitialMapPaint ? [] : mapLayerStations
              }
              variant="full"
              onDetailClickById={onMapMarkerPickId}
              onClusterTap={handleClusterStationsTap}
              selectedId={mapSelectedStation?.id}
              isMobile={isMobile}
              defaultMarkerIcon={DEFAULT_MARKER_ICON}
              selectedMarkerIcon={SELECTED_MARKER_ICON}
              selectedMarkerIconMobile={MOBILE_PIN_SELECTED_MARKER_ICON}
              uiColors={colors}
              mapTileUrl={tokens.map.tileUrl}
              mapTileAttribution={tokens.map.tileAttribution}
              markerClusterChunked
              removeOutsideVisibleBounds={false}
              diagnosticLightMarkers={import.meta.env.DEV && evMapDiag.light}
              diagnosticTrack={import.meta.env.DEV && evMapDiag.track}
            />
            <EvStationBootCirclePaint
              active={awaitingInitialMapPaint && !evMapDiag.anyLeafletHarness}
              stations={mapLayerStations}
              max={120}
            />
            {import.meta.env.DEV && evMapDiag.raw20 ? <EvMapDiagnosticRawDots rows={items} /> : null}
            <MapGeolocationSync
              geoNonce={geoNonce}
              setUserLocation={setUserLocation}
              setLocationError={setLocationError}
              setLocationLoading={setLocationLoading}
            />
            {!userLocation && (
              <CircleMarker
                center={leafletInitial.center}
                radius={5}
                pathOptions={{
                  color: tokens.map.userCircle,
                  fillColor: tokens.map.userCircle,
                  fillOpacity: 0.4,
                  weight: 2,
                  opacity: 0.95,
                }}
              />
            )}
            {userLocation && (
              <>
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={80}
                  pathOptions={{
                    color: tokens.map.userCircle,
                    fillColor: tokens.map.userCircle,
                    fillOpacity: tokens.map.userFillOpacity,
                    weight: 2,
                  }}
                />
                <CircleMarker
                  center={[userLocation.lat, userLocation.lng]}
                  radius={6}
                  pathOptions={{
                    color: tokens.map.userCircle,
                    fillColor: tokens.map.userCircle,
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
                <LocationRipple userLocation={userLocation} />
              </>
            )}
          </MapContainer>
          <MapSearchAreaLoadingOverlay
            open={mapSearchAreaLoading}
            style={
              resolvedMode === 'dark'
                ? {
                    '--ev-search-area-dim': 'rgba(0,0,0,0.52)',
                    '--ev-search-area-title': 'rgba(255,255,255,0.96)',
                    '--ev-search-area-subtitle': 'rgba(255,255,255,0.72)',
                    '--ev-search-area-bolt': colors.blue.primary,
                  }
                : {
                    '--ev-search-area-dim': 'rgba(15,23,42,0.44)',
                    '--ev-search-area-title': 'rgba(255,255,255,0.98)',
                    '--ev-search-area-subtitle': 'rgba(255,255,255,0.74)',
                    '--ev-search-area-bolt': colors.blue.primary,
                  }
            }
          />
          {(locationError || locationLoading) && (
            <Box
              sx={{
                position: 'absolute',
                top: `calc(env(safe-area-inset-top, 0px) + ${sheetLayout.mobileTopBarStackPx}px)`,
                right: `max(${sheetLayout.mobileTopBarInsetPx}px, env(safe-area-inset-right, 0px))`,
                zIndex: 500,
                maxWidth: `calc(100% - ${2 * sheetLayout.mobileTopBarInsetPx}px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))`,
              }}
            >
              {locationLoading && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: tokens.bg.raised,
                    border: `1px solid ${tokens.border.default}`,
                    boxShadow: tokens.shadow.card,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: tokens.text.secondary,
                  }}
                >
                  <CircularProgress size={14} sx={{ color: colors.blue.primary }} />
                  위치 찾는 중…
                </Box>
              )}
              {locationError && !locationLoading && (
                <Alert
                  severity="warning"
                  onClose={() => setLocationError(null)}
                  sx={{
                    py: 0,
                    '& .MuiAlert-message': { fontSize: '0.75rem' },
                  }}
                >
                  {locationError}
                </Alert>
              )}
            </Box>
          )}
        </Box>

        {/* Global error */}
        {apiError && (
          <Box
            sx={{
              position: 'absolute',
              top: spacing.lg,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1100,
              minWidth: 320,
              maxWidth: '90vw',
            }}
          >
            <Alert
              severity="error"
              sx={{
                background: tokens.glass.panelBg,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${tokens.glass.panelBorder}`,
                boxShadow: tokens.glass.panelShadow,
                borderRadius: radius.glass,
              }}
            >
              {apiError}
            </Alert>
          </Box>
        )}

        {/*
          레이어: 지도 < 목록시트(1000) < FAB(1001) < 필터 차단(1150) < 필터(1200) < 상세(1400).
          필터 열림 시 투명 레이어로 지도 제스처를 확실히 삼킴(백드롭 틈 대비).
          FAB는 오버레이 해제 후 exit + fabReveal ms 뒤 페이드인해 시트 전환과 어긋남 완화.
        */}
        {mobileSearchResultsMode && mobileSheetSnap === 'full' && !mobileOverlayBlocking ? (
          <Box
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: `max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))`,
              display: 'flex',
              justifyContent: 'center',
              paddingLeft: `max(12px, env(safe-area-inset-left, 0px))`,
              paddingRight: `max(12px, env(safe-area-inset-right, 0px))`,
              zIndex: 1100,
              pointerEvents: 'auto',
            }}
          >
            <Button
              variant="contained"
              startIcon={<MapOutlined sx={{ fontSize: 20 }} />}
              onClick={() => setMobileSheetSnap('peek')}
              sx={{
                display: 'inline-flex',
                width: 'auto',
                minWidth: 0,
                px: 2.75,
                py: 1.125,
                borderRadius: 9999,
                boxShadow: '0 4px 16px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.12)',
                bgcolor: colors.blue.primary,
                fontWeight: 700,
                fontSize: '0.8125rem',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                '& .MuiButton-startIcon': { ml: 0, mr: 0.5 },
                '&:hover': {
                  bgcolor: colors.blue.deep,
                  boxShadow: '0 5px 18px rgba(37,99,235,0.4), 0 2px 10px rgba(0,0,0,0.14)',
                },
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              지도보기
            </Button>
          </Box>
        ) : null}

        {(showSearchAreaButton || (mobileSearchResultsMode && mobileSheetSnap === 'peek')) &&
        !mobileOverlayBlocking ? (
          <Box
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              paddingLeft: `max(12px, env(safe-area-inset-left, 0px))`,
              paddingRight: `max(12px, env(safe-area-inset-right, 0px))`,
              bottom: `calc(${mobileSheetHeightPx}px + env(safe-area-inset-bottom, 0px) + 8px)`,
              zIndex: 1001,
              opacity: fabReveal ? 1 : 0,
              transform: fabReveal ? 'translateY(0)' : 'translateY(10px)',
              pointerEvents: fabReveal ? 'auto' : 'none',
              transition: [
                `bottom ${motion.duration.sheet}ms ${motion.easing.standard}`,
                `opacity ${motion.duration.enter}ms ${motion.easing.standard}`,
                `transform ${motion.duration.enter}ms ${motion.easing.standard}`,
              ].join(', '),
            }}
          >
            {mobileSearchResultsMode && mobileSheetSnap === 'peek' ? (
              <Button
                variant="contained"
                startIcon={<ViewList sx={{ fontSize: 20 }} />}
                onClick={() => setMobileSheetSnap('half')}
                sx={{
                  display: 'inline-flex',
                  width: 'auto',
                  minWidth: 0,
                  px: 2.75,
                  py: 1.125,
                  borderRadius: 9999,
                  boxShadow: '0 4px 16px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.12)',
                  bgcolor: colors.blue.primary,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                  '& .MuiButton-startIcon': { ml: 0, mr: 0.5 },
                  '&:hover': {
                    bgcolor: colors.blue.deep,
                    boxShadow: '0 5px 18px rgba(37,99,235,0.4), 0 2px 10px rgba(0,0,0,0.14)',
                  },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                목록 보기
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<SearchIcon sx={{ fontSize: 20 }} />}
                onClick={() => void applySearchAreaFromMap()}
                disabled={mapSearchAreaLoading}
                sx={{
                  display: 'inline-flex',
                  width: 'auto',
                  minWidth: 0,
                  px: 2.75,
                  py: 1.125,
                  borderRadius: 9999,
                  boxShadow: '0 4px 16px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.12)',
                  bgcolor: colors.blue.primary,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                  '& .MuiButton-startIcon': { ml: 0, mr: 0.5 },
                  '&:hover': {
                    bgcolor: colors.blue.deep,
                    boxShadow: '0 5px 18px rgba(37,99,235,0.4), 0 2px 10px rgba(0,0,0,0.14)',
                  },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                이 지역 검색
              </Button>
            )}
          </Box>
        ) : null}

        <EvPipelineDebugPanel />

        {panelEl}

        <MobileFilterSheet
          open={filterDrawerOpen}
          onClose={closeFilterDrawer}
          onApply={applyMobileFilters}
          listSort={mobileListSort}
          listAvailOnly={mobileListAvailOnly}
          hasAvailInGroupedScope={hasAvailInGroupedScope}
          speedOptions={SPEED_FILTER_OPTIONS}
          filterSpeed={filterSpeed}
          filterBusiNm={filterBusiNm}
          busiOptions={filterOptions.busiNms}
          filterCtprvnCd={filterCtprvnCd}
          ctprvnOptions={filterOptions.ctprvnCds}
          filterSggCd={filterSggCd}
          sggCdsByCtprvn={filterOptions.sggCdsByCtprvn}
        />
      </Box>
    </>
  )
}

export default App
