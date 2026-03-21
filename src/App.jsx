import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useRef, useCallback, useDeferredValue } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Alert,
  IconButton,
  Chip,
  Button,
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
  fetchEvChargers,
  fetchEvChargersFirstPageBatch,
  fetchEvChargersProgressiveContinue,
  aggregateStatCounts,
  getLatestStatUpdDt,
  formatStatSummary,
} from './api/safemapEv.js'
import { getDevMockEvChargers } from './dev/mockEvChargers.js'
import {
  haversineDistanceKm,
  placeKey,
  formatListSummary,
  summarizeSpeedCategories,
  pickShortLocationHint,
  expandLiteralBounds,
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

/**
 * API 정렬이 비지리적이어서 뷰포트·부트 반경 안에 충전소가 없을 때 — 지도에 실제로 보이는 중심 기준 가까운 행만 잘라 그룹.
 */
function groupedNearestPlacesForMap(items, centerLat, centerLng, maxRows) {
  if (!items.length || !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return []
  const rows = items
    .filter((r) => {
      const la = Number(r.lat)
      const ln = Number(r.lng)
      return Number.isFinite(la) && Number.isFinite(ln)
    })
    .map((r) => ({
      r,
      d: haversineDistanceKm(Number(r.lat), Number(r.lng), centerLat, centerLng),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, maxRows))
    .map(({ r }) => r)
  return groupChargerRowsByPlaceMapLite(rows)
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
import { GlassPanel } from './components/GlassPanel.jsx'
import { StationListMobile } from './components/StationListMobile.jsx'
import { MobileMapSearchBar } from './components/MobileMapSearchBar.jsx'
import { MobileMapQuickSearchChipsRail } from './components/MobileMapQuickSearchChipsRail.jsx'
import { EvStationMapLayer } from './components/EvStationMapLayer.jsx'
import { MapBootMarkerReady } from './components/MapBootMarkerReady.jsx'
import { MapMobileSearchViewportFitter } from './components/MapMobileSearchViewportFitter.jsx'
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
  diagGroupedBaseComputeCount,
  diagMapLayerRefChanges,
  diagEvLayerMountCount,
  diagIconResolveCountRef,
  evMapDiagHarnessBootMarkerCount,
} from './dev/evMapDiag.js'
import { MapLeafletExperiments } from './dev/MapLeafletExperiments.jsx'

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

/** 부트 앵커(내 위치 또는 광화문) 주변 우선 표시용 — 반경 제한 없이 가까운 행부터 */
const MAP_ANCHOR_NEAREST_MAX_ROWS = 640
/** 모바일: LayerGroup만 쓸 때 한 번에 올릴 마커 상한(성능) */
const MOBILE_MAP_MARKER_CAP = 260
/** 부트 직후 첫 페인트: 근접 순으로 이 개수만 먼저 올린 뒤 idle로 상한까지 확장 */
const MAP_MARKER_INITIAL_PAINT_CAP = 44
/** 적용 영역 안 raw 행이 많을 때 그룹핑 전 거리순 상한(프로그레시브 대량 items CPU 완화) */
const MAP_GROUP_INPUT_ROW_CAP = 2000

/** 부트 중 지도·마커 대기 시 로딩 문구 순환 */
const BOOT_MAP_WAIT_MESSAGES = [
  '지도 위에 충전소 마커를 그리는 중이에요',
  '가까운 충전소를 찾아 표시하고 있어요',
  '지도와 마커 위치를 맞추는 중이에요',
  '충전소 아이콘을 하나씩 올리고 있어요',
  '잠시만요, 곧 지도에서 확인하실 수 있어요',
  '내 주변(또는 시작 위치) 기준으로 불러오는 중이에요',
  '네트워크와 화면이 준비될 때까지 기다려 주세요',
  '거의 다 됐어요, 마커를 확인하는 중이에요',
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

function App() {
  const { tokens, colors, resolvedMode, togglePreference } = useEvTheme()
  const [items, setItems] = useState([])
  const [, setTotalCount] = useState(null)
  const [bootOverlayOpen, setBootOverlayOpen] = useState(true)
  const [awaitingInitialMapPaint, setAwaitingInitialMapPaint] = useState(false)
  /** 부트 직후 짧게 마커 상한을 낮춘 뒤 idle에서 `MOBILE_MAP_MARKER_CAP`까지 확장 */
  const [markerPaintPhase, setMarkerPaintPhase] = useState(/** @type {'initial' | 'full'} */ ('full'))
  const [bootProgress, setBootProgress] = useState(0)
  const [bootStageMessage, setBootStageMessage] = useState('시작하는 중')
  const bootMapPaintedRef = useRef(false)
  const [leafletInitial, setLeafletInitial] = useState(() =>
    computeBootLeafletView(GWANGHWAMUN_FALLBACK.lat, GWANGHWAMUN_FALLBACK.lng),
  )
  const [apiError, setApiError] = useState(null)
  const [lastEvFetchAt, setLastEvFetchAt] = useState(null)
  const [detailRefreshing, setDetailRefreshing] = useState(false)
  const canRefetchEv = !!(import.meta.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
  const evMapDiag = useMemo(() => parseEvMapDiag(), [])
  const harnessBootMarkerCount = useMemo(
    () => evMapDiagHarnessBootMarkerCount(evMapDiag),
    [evMapDiag],
  )
  /** 목록·필터는 즉시 `items`, 지도 그룹핑만 낮은 우선순위로 따라가 progressive churn 완화 */
  const itemsDeferredForMap = useDeferredValue(items)
  /** 부트 오버레이가 떠 있는 동안은 지도용 입력을 지연 없이 유지(첫 마커·bounds 반영). 이후 deferred로 churn 완화 */
  const itemsForMapMarkers =
    evMapDiag.noDefer || bootOverlayOpen ? items : itemsDeferredForMap
  const [filterBusiNm, setFilterBusiNm] = useState('')
  const [filterSpeed, setFilterSpeed] = useState('') // '' | '급속' | '완속'
  const [filterCtprvnCd, setFilterCtprvnCd] = useState('')
  const [filterSggCd, setFilterSggCd] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchBarFocused, setSearchBarFocused] = useState(false)
  const [searchViewportFitNonce, setSearchViewportFitNonce] = useState(0)
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
  }, [mobileSheetSnap])

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

  /** 목록·지도 마커 공통: 적용된 화면 영역(「이 지역 검색」 또는 부트 완료 시 스냅) */
  const appliedMapBoundsPadded = useMemo(
    () => (appliedMapBounds ? expandLiteralBounds(appliedMapBounds, 0.42) : null),
    [appliedMapBounds],
  )

  /** @param {null | { southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} boundsFromMap */
  const onBootMapPaintReady = useCallback((boundsFromMap) => {
    if (bootMapPaintedRef.current) return
    bootMapPaintedRef.current = true
    const b = boundsFromMap ?? liveMapBoundsRef.current
    if (b) setAppliedMapBounds(b)
    setBootProgress(100)
    setBootStageMessage('준비했어요')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAwaitingInitialMapPaint(false)
        setBootOverlayOpen(false)
      })
    })
  }, [])

  /** 「이 지역 검색」: 현재 보고 있는 지도 영역으로만 마커·목록 갱신 */
  const applySearchAreaFromMap = useCallback(() => {
    setAppliedMapBounds(liveMapBoundsRef.current)
    setClusterBrowseGrouped(null)
    setConfirmedMobileSearchQuery('')
    setMobileSearchGeo(null)
    openMobileListSheetToHalf()
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setDetailStation(null)
    detailStationRef.current = null
  }, [openMobileListSheetToHalf])

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
    const ac = new AbortController()
    let cancelled = false

    ;(async () => {
      const key = (import.meta.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
      setBootProgress(0)
      setBootStageMessage('시작하는 중')

      setBootStageMessage('현재 위치를 확인하고 있어요')
      const pLoc = easeBootProgress(setBootProgress, 0, 22, 640)
      const pos = await getBootstrapGeolocationPosition()
      await pLoc
      if (cancelled) return
      telemetryLocationResolved(pos.usedGeo)

      setBootProgress(25)
      setBootStageMessage(
        pos.usedGeo
          ? '내 위치를 확인했어요. 주변 충전소 정보를 불러오고 있어요'
          : '위치를 사용할 수 없어 기본 위치로 시작해요. 주변 충전소 정보를 불러오고 있어요',
      )
      const view = computeBootLeafletView(pos.lat, pos.lng, mapBootstrapWidthPx())
      setLeafletInitial(view)
      if (pos.usedGeo) setUserLocation({ lat: pos.lat, lng: pos.lng })
      else setUserLocation(null)

      if (!key) {
        await easeBootProgress(setBootProgress, 25, 72, 480)
        if (cancelled) return
        if (import.meta.env.DEV) {
          const mock = getDevMockEvChargers()
          setApiError(null)
          setItems(mock)
          setTotalCount(mock.length)
          setLastEvFetchAt(new Date().toISOString())
          console.info(
            `[whereEV3] API 키 없음 — 로컬 대체 충전소 데이터 ${mock.length}건(dev-mock). 실제 Safemap 데이터는 .env.local의 VITE_SAFEMAP_SERVICE_KEY 설정 후 재시작하세요. (docs/DATA-SOURCES.md)`
          )
        } else {
          setApiError('VITE_SAFEMAP_SERVICE_KEY를 .env 또는 .env.local에 설정해 주세요.')
          setItems([])
          setTotalCount(null)
        }
        setBootStageMessage('지도와 충전소 마커를 표시하는 중이에요')
        await easeBootProgress(setBootProgress, 72, 82, 520)
        if (cancelled) return
        setAwaitingInitialMapPaint(true)
        return
      }

      setApiError(null)
      setItems([])
      const pFetch = easeBootProgress(setBootProgress, 25, 72, 3200)
      let first = /** @type {Awaited<ReturnType<typeof fetchEvChargersFirstPageBatch>> | null} */ (null)
      try {
        first = await fetchEvChargersFirstPageBatch({ numOfRows: 500, signal: ac.signal })
      } catch (err) {
        if (!cancelled) setApiError(err.message || '데이터를 불러오지 못했습니다.')
      }
      await pFetch
      if (cancelled) return

      if (first && !first.aborted) {
        setItems(first.batch)
        setTotalCount(first.totalCount != null ? first.totalCount : first.batch.length)
      }

      setBootStageMessage('지도와 충전소 마커를 표시하는 중이에요')
      await easeBootProgress(setBootProgress, 72, 82, 560)
      if (cancelled) return
      setAwaitingInitialMapPaint(true)

      if (first && !first.aborted && !first.isLast) {
        fetchEvChargersProgressiveContinue({
          startPage: 2,
          initialGlobalIndex: first.loadedCount,
          numOfRows: 500,
          maxPages: 200,
          signal: ac.signal,
          seedTotalCount: first.totalCount,
          onPage: async ({ batch, isLast }) => {
            if (cancelled) return
            if (batch.length) setItems((prev) => [...prev, ...batch])
            if (isLast && !cancelled) setLastEvFetchAt(new Date().toISOString())
          },
        }).catch(() => {})
      } else if (first && !first.aborted && first.isLast) {
        setLastEvFetchAt(new Date().toISOString())
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [])

  const refreshEvData = useCallback(async () => {
    if (!canRefetchEv) return
    setDetailRefreshing(true)
    setApiError(null)
    try {
      const { items: list, totalCount: total } = await fetchEvChargers({ pageNo: 1, numOfRows: 500, maxPages: 200 })
      setItems(list)
      if (total != null) setTotalCount(total)
      setLastEvFetchAt(new Date().toISOString())
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
    }
  }, [canRefetchEv])

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
      setAppliedMapBounds(squareBoundsLiteralAroundCenter(center.lat, center.lng, Math.max(padKm, 1)))
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

  /**
   * 지도 앵커: 위치 성공 시 `leafletInitial`=내 좌표, 실패 시 광화문. 항상 이 점에 가까운 충전소를 먼저 그린다.
   */
  const mapAnchorStations = useMemo(() => {
    const [la, ln] = leafletInitial.center
    if (!Number.isFinite(la) || !Number.isFinite(ln) || itemsForMapMarkers.length === 0) return []
    return groupedNearestPlacesForMap(itemsForMapMarkers, la, ln, MAP_ANCHOR_NEAREST_MAX_ROWS)
  }, [itemsForMapMarkers, leafletInitial.center])

  /**
   * 지도 마커(선택 제외): 적용 영역 + 그룹핑 입력 행 상한 — `items` 대량 증가 시 CPU 제한.
   * 선택 병합은 아래 별도 메모로 분리해 탭 시 전체 그룹 재계산을 피함.
   */
  const groupedAllStationsForMapBase = useMemo(() => {
    if (!appliedMapBoundsPadded) return []
    let validItems = itemsForMapMarkers.filter((r) => {
      const la = Number(r.lat)
      const ln = Number(r.lng)
      return Number.isFinite(la) && Number.isFinite(ln)
    })
    const b = L.latLngBounds(
      [appliedMapBoundsPadded.southWest.lat, appliedMapBoundsPadded.southWest.lng],
      [appliedMapBoundsPadded.northEast.lat, appliedMapBoundsPadded.northEast.lng],
    )
    validItems = validItems.filter((r) => b.contains([r.lat, r.lng]))
    if (validItems.length > MAP_GROUP_INPUT_ROW_CAP) {
      const centerLat = (appliedMapBoundsPadded.southWest.lat + appliedMapBoundsPadded.northEast.lat) / 2
      const centerLng = (appliedMapBoundsPadded.southWest.lng + appliedMapBoundsPadded.northEast.lng) / 2
      validItems = [...validItems]
        .map((r) => ({ r, d: haversineDistanceKm(r.lat, r.lng, centerLat, centerLng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MAP_GROUP_INPUT_ROW_CAP)
        .map(({ r }) => r)
    }
    const grouped = groupChargerRowsByPlaceMapLite(validItems)
    if (import.meta.env.DEV && evMapDiag.track) {
      diagGroupedBaseComputeCount.current += 1
      logDiag(
        `groupedAllStationsForMapBase compute #${diagGroupedBaseComputeCount.current}`,
        `places=${grouped.length} rowsIn=${validItems.length} itemsMap=${itemsForMapMarkers.length}`,
      )
    }
    return grouped
  }, [itemsForMapMarkers, appliedMapBoundsPadded, evMapDiag.track])

  const groupedAllStationsForMap = useMemo(() => {
    const grouped = groupedAllStationsForMapBase
    const sel = mapSelectedStation
    if (!sel) return grouped
    if (grouped.some((s) => s.id === sel.id)) return grouped
    return [sel, ...grouped]
  }, [groupedAllStationsForMapBase, mapSelectedStation])

  /**
   * 지도 마커 소스: 평소는 적용 영역만. 부트 중 applied 아직 없으면 앵커 근처만 임시 표시.
   */
  const mapStations = useMemo(() => {
    const viewportGrouped = groupedAllStationsForMap
    if (awaitingInitialMapPaint) {
      if (viewportGrouped.length > 0) return viewportGrouped
      return mapAnchorStations
    }
    return viewportGrouped
  }, [awaitingInitialMapPaint, groupedAllStationsForMap, mapAnchorStations])

  const mapLayerStationsComputed = useMemo(() => {
    const cap =
      markerPaintPhase === 'initial' ? MAP_MARKER_INITIAL_PAINT_CAP : MOBILE_MAP_MARKER_CAP
    const src = mapStations
    if (src.length <= cap) return src
    const { lat, lng } = mapViewCenterForMarkers
    return [...src]
      .map((s) => ({ s, d: haversineDistanceKm(s.lat, s.lng, lat, lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, cap)
      .map(({ s }) => s)
  }, [mapStations, mapViewCenterForMarkers, markerPaintPhase])

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

  const prevAwaitingMapPaintRef = useRef(awaitingInitialMapPaint)
  useEffect(() => {
    const was = prevAwaitingMapPaintRef.current
    prevAwaitingMapPaintRef.current = awaitingInitialMapPaint
    if (was && !awaitingInitialMapPaint) {
      setMarkerPaintPhase('initial')
      let cancelled = false
      const done = () => {
        if (!cancelled) setMarkerPaintPhase('full')
      }
      let idleId = null
      let timeoutId = null
      if (typeof requestIdleCallback === 'function') {
        idleId = requestIdleCallback(done, { timeout: 280 })
      } else {
        timeoutId = window.setTimeout(done, 120)
      }
      return () => {
        cancelled = true
        if (idleId != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
        if (timeoutId != null) window.clearTimeout(timeoutId)
      }
    }
    return undefined
  }, [awaitingInitialMapPaint])

  const appliedBoundsApplyCountRef = useRef(0)
  useEffect(() => {
    if (!appliedMapBounds) return
    appliedBoundsApplyCountRef.current += 1
    if (appliedBoundsApplyCountRef.current > 1) setMarkerPaintPhase('full')
  }, [appliedMapBounds])

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
          groupedBaseComputes: diagGroupedBaseComputeCount.current,
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
        mapStations: mapStations.length,
        mapLayerStations: mapLayerStations.length,
        mapAnchorStations: mapAnchorStations.length,
        groupedAllStationsForMap: groupedAllStationsForMap.length,
        appliedMapBounds: !!appliedMapBounds,
      })
    }
    mapBootDiagPrevAwaitingRef.current = awaitingInitialMapPaint
  }, [
    awaitingInitialMapPaint,
    items.length,
    filteredItems.length,
    itemsInScope.length,
    mapStations.length,
    mapLayerStations.length,
    mapAnchorStations.length,
    groupedAllStationsForMap.length,
    appliedMapBounds,
  ])

  /** 지도·마커 부트 대기 중 로딩 문구 순환 */
  useEffect(() => {
    if (!bootOverlayOpen || !awaitingInitialMapPaint) return undefined
    let idx = 0
    const id = window.setInterval(() => {
      idx = (idx + 1) % BOOT_MAP_WAIT_MESSAGES.length
      setBootStageMessage(BOOT_MAP_WAIT_MESSAGES[idx])
    }, 2400)
    return () => window.clearInterval(id)
  }, [bootOverlayOpen, awaitingInitialMapPaint])

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
                  <Box sx={{ bgcolor: tokens.bg.subtle, borderBottom: `1px solid ${colors.gray[200]}` }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 1,
                        px: MOBILE_DETAIL_HEADER_GUTTER,
                        py: 1,
                        minHeight: MOBILE_DETAIL_FULL_HEADER_MIN_H,
                        boxSizing: 'border-box',
                      }}
                    >
                      <IconButton
                        onClick={handleCloseDetail}
                        aria-label="뒤로"
                        size="small"
                        sx={{
                          color: colors.gray[700],
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          minHeight: 40,
                          p: 0,
                          borderRadius: radius.md,
                        }}
                      >
                        <ArrowBack sx={{ fontSize: 24 }} />
                      </IconButton>
                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 0.25 }}>
                        <Typography
                          id="ev-mobile-detail-title"
                          variant="h6"
                          component="h2"
                          sx={{
                            color: colors.gray[900],
                            ...appMobileType.detailSheetTitle,
                            lineHeight: 1.35,
                            fontWeight: 700,
                          }}
                        >
                          {d.statNm}
                        </Typography>
                        {detailHeaderSubtitle ? (
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', mt: 0.25, color: colors.gray[500], ...appMobileType.detailSheetSubtitle, lineHeight: 1.35 }}
                          >
                            {detailHeaderSubtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        onClick={() => canRefetchEv && refreshEvData()}
                        disabled={!canRefetchEv || detailRefreshing}
                        aria-label={canRefetchEv ? '충전소 데이터 새로고침' : '새로고침을 사용할 수 없습니다'}
                        size="small"
                        sx={{
                          color: colors.gray[600],
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          minHeight: 40,
                          p: 0,
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
                )
              }
              /* half: 뒤로가기 없음 — full에서만 노출. 헤더 전체를 드래그해 half→full */
              return (
                <Box
                  sx={{ bgcolor: tokens.bg.subtle, borderBottom: `1px solid ${colors.gray[200]}` }}
                  data-ev-list-header-mode="detail"
                >
                  <Box
                    {...sheetDragHandlers}
                    sx={{
                      touchAction: 'none',
                      cursor: 'grab',
                      pt: 1,
                      pb: 0.75,
                      '&:active': { cursor: 'grabbing' },
                    }}
                  >
                    <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: colors.gray[300], mx: 'auto' }} aria-hidden />
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        px: MOBILE_DETAIL_HEADER_GUTTER,
                        pt: 0.75,
                        pb: 0,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          component="h2"
                          sx={{ fontWeight: 700, color: colors.gray[900], fontSize: '1.0625rem', lineHeight: 1.35 }}
                        >
                          {d.statNm}
                        </Typography>
                        {detailHeaderSubtitle ? (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: colors.gray[500], lineHeight: 1.35 }}>
                            {detailHeaderSubtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        onClick={() => canRefetchEv && refreshEvData()}
                        disabled={!canRefetchEv || detailRefreshing}
                        aria-label={canRefetchEv ? '충전소 데이터 새로고침' : '새로고침을 사용할 수 없습니다'}
                        size="small"
                        sx={{
                          color: colors.gray[600],
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
            bgcolor: resolvedMode === 'dark' ? 'rgba(0, 0, 0, 0.48)' : 'rgba(15, 23, 42, 0.14)',
            px: 2.5,
          }}
        >
          <GlassPanel
            elevation="panel"
            sx={{
              width: '100%',
              maxWidth: 380,
              borderRadius: '32px',
              p: 3,
              pt: 3.25,
              pb: 3.25,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.45, px: 0.75 }}>
              {bootStageMessage}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={bootPct}
              sx={{
                width: '100%',
                maxWidth: 288,
                height: 7,
                borderRadius: 999,
                bgcolor: tokens.bg.subtle,
                '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: tokens.blue.main },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {bootPct}%
            </Typography>
          </GlassPanel>
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
                  onSuggestionPick={pickSearchSuggestion}
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
              /** 전부(최대 260) DOM 반영까지 기다리면 체감 지연이 커짐 — 첫 배치만 확인 */
              paintSatisfiedIconCap={40}
              markerIconsMaxWaitMs={2200}
              onReady={onBootMapPaintReady}
            />
            <MapMobileSearchViewportFitter
              enabled
              fitNonce={searchViewportFitNonce}
              searchQuery={searchQuery}
              filteredItems={filteredItemsForScope}
              setAppliedMapBounds={setAppliedMapBounds}
              ignoreRegionKeywordBounds
            />
            <MapFocusOnStation selectedStation={mapSelectedStation} isMobile={isMobile} />
            <EvStationMapLayer
              stations={evMapDiag.anyLeafletHarness ? [] : mapLayerStations}
              variant="lite"
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
              markerClusterChunked={false}
              removeOutsideVisibleBounds={false}
              diagnosticLightMarkers={import.meta.env.DEV && evMapDiag.light}
              diagnosticTrack={import.meta.env.DEV && evMapDiag.track}
            />
            <MapGeolocationSync
              geoNonce={geoNonce}
              setUserLocation={setUserLocation}
              setLocationError={setLocationError}
              setLocationLoading={setLocationLoading}
            />
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
                onClick={applySearchAreaFromMap}
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
