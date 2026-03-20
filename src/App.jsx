import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  useMediaQuery,
  IconButton,
  Chip,
  Button,
} from '@mui/material'
import EvStationIcon from '@mui/icons-material/EvStation'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import MapOutlined from '@mui/icons-material/MapOutlined'
import ViewList from '@mui/icons-material/ViewList'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Refresh from '@mui/icons-material/Refresh'
import { MapContainer, ZoomControl, Circle, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import {
  fetchEvChargers,
  fetchEvChargersProgressive,
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
import { groupChargerRowsByPlace } from './utils/evStationGroup.js'

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
import { zoomForHorizontalSpanMeters } from './utils/mapZoomMeters.js'
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
import { StatCard } from './components/StatCard.jsx'
import { SideOverlayPanel } from './components/SideOverlayPanel.jsx'
import { FilterModalSelect } from './components/FilterModalSelect.jsx'
import { StationListMobile } from './components/StationListMobile.jsx'
import { MobileMapSearchBar } from './components/MobileMapSearchBar.jsx'
import { MobileMapQuickSearchChipsRail } from './components/MobileMapQuickSearchChipsRail.jsx'
import { EvStationMapLayer } from './components/EvStationMapLayer.jsx'
import { MapMobileSearchViewportFitter } from './components/MapMobileSearchViewportFitter.jsx'
import { MapInitialGeolocation } from './components/MapInitialGeolocation.jsx'
import { StationDetailModal } from './components/StationDetailModal.jsx'
import { StationDetailFooterActions } from './components/StationDetailContent.jsx'
import { MobileBottomSheet } from './components/MobileBottomSheet.jsx'
import { MobileDetailSheetBody } from './components/MobileDetailSheetBody.jsx'
import { MobileFilterSheet } from './components/MobileFilterSheet.jsx'
import { ThemeAppearanceControl } from './components/ThemeAppearanceControl.jsx'

const SEOUL_CENTER = [37.5665, 126.978]

/** 지도 클러스터용 뷰포트 반영 지연(패닝 시 연산·마커 갱신 부담 완화) */
const MAP_CLUSTER_BOUNDS_DEBOUNCE_MS = 320

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

function LocationControl({ setUserLocation, setLocationError, setLocationLoading }) {
  const map = useMap()
  const setUserRef = useRef(setUserLocation)
  const setErrorRef = useRef(setLocationError)
  const setLoadingRef = useRef(setLocationLoading)
  useEffect(() => {
    setUserRef.current = setUserLocation
    setErrorRef.current = setLocationError
    setLoadingRef.current = setLocationLoading
  }, [setUserLocation, setLocationError, setLocationLoading])

  useEffect(() => {
    const LocControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-location')
        const btn = L.DomUtil.create('button', '', div)
        btn.type = 'button'
        btn.setAttribute('aria-label', '현재 위치')
        btn.innerHTML = '<span style="font-size:18px;line-height:1">⌖</span>'
        btn.style.cssText = 'width:30px;height:30px;border:none;border-radius:4px;background:#fff;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;padding:0'
        L.DomEvent.disableClickPropagation(btn)
        L.DomEvent.on(btn, 'click', () => {
          setLoadingRef.current(true)
          setErrorRef.current(null)
          if (!navigator.geolocation) {
            setErrorRef.current('이 브라우저는 위치 기능을 지원하지 않습니다.')
            setLoadingRef.current(false)
            return
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords
              setUserRef.current({ lat: latitude, lng: longitude })
              const w = map.getContainer()?.clientWidth || window.innerWidth
              const z = zoomForHorizontalSpanMeters(w, 100, latitude)
              map.setView([latitude, longitude], z)
              setErrorRef.current(null)
              setLoadingRef.current(false)
            },
            (err) => {
              const msg =
                err.code === 1
                  ? '위치 권한이 거부되었습니다.'
                  : err.code === 2
                    ? '위치를 찾을 수 없습니다.'
                    : '위치를 가져오는 중 오류가 발생했습니다.'
              setErrorRef.current(msg)
              setLoadingRef.current(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          )
        })
        return div
      },
    })
    const ctrl = new LocControl({ position: 'topright' })
    map.addControl(ctrl)
    return () => {
      map.removeControl(ctrl)
    }
  }, [map])
  return null
}

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

const BOUNDS_DEBOUNCE_MS = 200

function MapBoundsTracker({ setMapBounds }) {
  const map = useMap()
  useEffect(() => {
    const update = () => {
      const b = map.getBounds()
      setMapBounds({
        southWest: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
        northEast: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
      })
    }
    let timeoutId
    const debounced = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(update, BOUNDS_DEBOUNCE_MS)
    }
    update()
    map.on('moveend', debounced)
    map.on('zoomend', debounced)
    return () => {
      map.off('moveend', debounced)
      map.off('zoomend', debounced)
      clearTimeout(timeoutId)
    }
  }, [map, setMapBounds])
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
  const chartPalette = tokens.chartBlue
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [lastEvFetchAt, setLastEvFetchAt] = useState(null)
  const [detailRefreshing, setDetailRefreshing] = useState(false)
  const canRefetchEv = !!(import.meta.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
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
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [panelOpen, setPanelOpen] = useState(true)
  const panelW = isMobile ? 280 : 340

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
  /** 모바일 검색 확정(Enter·칩) 시 내 위치 기준 반경 단계 — 입력 디바운스와 분리 */
  const [mobileSearchGeo, setMobileSearchGeo] = useState(
    /** @type {null | { center: { lat: number, lng: number }, radiusKm: number, widenedHint: boolean }} */ (null),
  )
  const [confirmedMobileSearchQuery, setConfirmedMobileSearchQuery] = useState('')
  const commitMobileSearchRef = useRef(() => {})
  const sheetListScrollRef = useRef(null)
  /** 데스크톱 좌측 패널(SideOverlayPanel 루트) 스크롤 — 상세 닫기 후 복원 */
  const desktopPanelScrollRef = useRef(null)
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
    if (isMobileRef.current) setMobileSheetSnap('half')
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
    if (isMobile) {
      if (raw) {
        commitMobileSearchRef.current(raw)
        openMobileListSheetToHalf()
      } else {
        setConfirmedMobileSearchQuery('')
        setMobileSearchGeo(null)
      }
    } else {
      setConfirmedMobileSearchQuery('')
      setMobileSearchGeo(null)
      if (raw) setSearchViewportFitNonce((n) => n + 1)
    }
    if (raw && !isMobile) openMobileListSheetToHalf()
  }, [searchInput, isMobile, openMobileListSheetToHalf])

  const pickSearchSuggestion = useCallback(
    (text) => {
      const q = text.trim().toLowerCase()
      lastFittedSearchQueryRef.current = q
      setSearchInput(text)
      setSearchQuery(text)
      if (isMobile && text.trim()) {
        commitMobileSearchRef.current(text.trim())
      } else {
        setConfirmedMobileSearchQuery('')
        setMobileSearchGeo(null)
        if (text.trim()) setSearchViewportFitNonce((n) => n + 1)
      }
      if (text.trim()) openMobileListSheetToHalf()
    },
    [isMobile, openMobileListSheetToHalf],
  )

  /** 검색어가 있으면 포커스/제목이 충전소명에 묶이지 않도록 선택·상세 해제 */
  useEffect(() => {
    if (!isMobile) return
    if (!searchQuery.trim()) return
    setMapSelectedStation(null)
    mapSelectedStationRef.current = null
    setDetailStation(null)
    detailStationRef.current = null
  }, [searchQuery, isMobile])

  /** 검색 활성 시 클러스터 전용 목록 해제(검색 결과와 상태 혼동 방지) */
  useEffect(() => {
    if (!isMobile) return
    if (searchQuery.trim()) setClusterBrowseGrouped(null)
  }, [searchQuery, isMobile])

  /**
   * 데스크톱 전환 시 스택·플래그만 정리(히스토리 엔트리는 브라우저에 남을 수 있음).
   * 잔여 pushState는 전역 popstate(아래 effect)에서 열린 오버레이가 있으면 동기화한다.
   */
  useEffect(() => {
    if (isMobile) return
    overlayStackRef.current = []
    detailHistoryPushed.current = false
    filterHistoryPushed.current = false
  }, [isMobile])

  const restoreListAfterDetailClose = useCallback(() => {
    const anchorId = mapSelectedStationRef.current?.id
    const run = () => {
      const scrollEl = isMobileRef.current ? sheetListScrollRef.current : desktopPanelScrollRef.current
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
    const scrollSaveEl = isMobile ? sheetListScrollRef.current : desktopPanelScrollRef.current
    if (scrollSaveEl) savedListScrollTopRef.current = scrollSaveEl.scrollTop
    mapSelectedStationRef.current = s
    setMapSelectedStation(s)
    const cur = detailStationRef.current
    const wasOpen = !!cur
    const same = cur?.id === s.id
    if (isMobile) {
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
    }
    setDetailStation(s)
    detailStationRef.current = s
    if (isMobile) setMobileSheetSnap('half')
  }, [isMobile, mobileSheetSnap])

  const handleCloseDetail = useCallback(() => {
    if (isMobile && detailHistoryPushed.current) {
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
    if (isMobile) setMobileSheetSnap(sheetSnapBeforeDetailRef.current)
    restoreListAfterDetailClose()
  }, [isMobile, restoreListAfterDetailClose, closeDetailFromOverlay])

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
    if (isMobile && filterHistoryPushed.current) {
      try {
        window.history.back()
      } catch {
        overlayStackRef.current.pop()
        closeFilterFromOverlay()
      }
      return
    }
    setFilterDrawerOpen(false)
  }, [isMobile, closeFilterFromOverlay])

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
    if (isMobile && detailStationRef.current) return
    filterOpenPulseGuard.current = true
    if (isMobile) {
      try {
        window.history.pushState({ evOverlay: 'filter' }, '')
        overlayStackRef.current.push('filter')
        filterHistoryPushed.current = true
      } catch {
        filterHistoryPushed.current = false
      }
    }
    setFilterDrawerOpen(true)
    requestAnimationFrame(() => {
      filterOpenPulseGuard.current = false
    })
  }, [isMobile, filterDrawerOpen])

  /**
   * popstate: 히스토리 1스텝 = 오버레이 1단계.
   * - 모바일: overlayStackRef 와 push 순서를 맞춘다.
   * - 데스크톱: 모바일에서 쌓인 잔여 엔트리로 popstate만 오는 경우가 있어, 스택 없이도 UI 동기화.
   * 복구 시 시각적 쌓임(z-index)과 동일하게 상세(1400) > 필터(1200) → detail 먼저 닫기.
   */
  useEffect(() => {
    const onPop = () => {
      if (isMobileRef.current) {
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
        return
      }
      if (detailStationRef.current) {
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
  const [mapCenter, setMapCenter] = useState({ lat: SEOUL_CENTER[0], lng: SEOUL_CENTER[1] })
  const [liveMapBounds, setLiveMapBounds] = useState(null)
  /** 디바운스된 뷰포트 — 지도 마커/클러스터 계산에만 사용 */
  const [mapClusterBoundsRaw, setMapClusterBoundsRaw] = useState(null)
  const mapClusterDebouncePrimedRef = useRef(false)
  const [appliedMapBounds, setAppliedMapBounds] = useState(null)
  const liveMapBoundsRef = useRef(null)
  useEffect(() => {
    liveMapBoundsRef.current = liveMapBounds
  }, [liveMapBounds])

  useEffect(() => {
    if (!liveMapBounds) return undefined
    if (!mapClusterDebouncePrimedRef.current) {
      mapClusterDebouncePrimedRef.current = true
      setMapClusterBoundsRaw(liveMapBounds)
      return undefined
    }
    const id = window.setTimeout(() => setMapClusterBoundsRaw(liveMapBounds), MAP_CLUSTER_BOUNDS_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [liveMapBounds])

  const mapClusterBoundsPadded = useMemo(
    () => expandLiteralBounds(mapClusterBoundsRaw, 0.42),
    [mapClusterBoundsRaw]
  )

  /** 「이 지역 검색」: 영역 적용 + 목록 시트를 검색 결과 모드로(포커스·상세 초기화) */
  const applySearchAreaFromMap = useCallback(() => {
    setAppliedMapBounds(liveMapBoundsRef.current)
    setClusterBrowseGrouped(null)
    setConfirmedMobileSearchQuery('')
    setMobileSearchGeo(null)
    if (isMobile) {
      openMobileListSheetToHalf()
    }
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setDetailStation(null)
    detailStationRef.current = null
  }, [isMobile, openMobileListSheetToHalf])

  const handleClusterStationsTap = useCallback(({ stations }) => {
    if (!isMobile || !Array.isArray(stations) || stations.length === 0) return
    setDetailStation(null)
    detailStationRef.current = null
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setClusterBrowseGrouped(stations)
    setMobileSheetSnap('half')
  }, [isMobile])

  useEffect(() => {
    const key = (import.meta.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
    if (!key) {
      setLoading(false)
      if (import.meta.env.DEV) {
        const mock = getDevMockEvChargers()
        setApiError(null)
        setItems(mock)
        setTotalCount(mock.length)
        setLastEvFetchAt(new Date().toISOString())
        console.info(
          `[whereEV3] API 키 없음 — 로컬 대체 충전소 데이터 ${mock.length}건(dev-mock). 실제 Safemap 데이터는 .env.local의 VITE_SAFEMAP_SERVICE_KEY 설정 후 재시작하세요. (docs/DATA-SOURCES.md)`
        )
        return
      }
      setApiError('VITE_SAFEMAP_SERVICE_KEY를 .env 또는 .env.local에 설정해 주세요.')
      return
    }
    const ac = new AbortController()
    let cancelled = false
    let receivedFirstPage = false
    setLoading(true)
    setApiError(null)
    setItems([])

    ;(async () => {
      try {
        await fetchEvChargersProgressive({
          signal: ac.signal,
          numOfRows: 500,
          maxPages: 200,
          onPage: ({ batch, isFirst, totalCount, isLast }) => {
            if (cancelled) return
            if (isFirst) {
              receivedFirstPage = true
              setItems(batch)
              setTotalCount(totalCount != null ? totalCount : batch.length)
              setLoading(false)
            } else if (batch.length > 0) {
              setItems((prev) => [...prev, ...batch])
            }
            if (isLast && !cancelled) {
              setLastEvFetchAt(new Date().toISOString())
            }
          },
        })
      } catch (err) {
        if (!cancelled) {
          setApiError(err.message || '데이터를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled && !receivedFirstPage) setLoading(false)
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

  /** 초기: live 수신 시 applied가 없으면 적용. 이후는 버튼 탭 시에만 applied 갱신. */
  useEffect(() => {
    if (liveMapBounds && appliedMapBounds == null) setAppliedMapBounds(liveMapBounds)
  }, [liveMapBounds, appliedMapBounds])

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

  const clusterBrowseListSorted = useMemo(() => {
    if (clusterBrowseGrouped == null) return null
    const ref = userLocation || mapCenter
    const withDist = clusterBrowseGrouped.map((s) => ({
      ...s,
      distanceKm: haversineDistanceKm(ref.lat, ref.lng, s.lat, s.lng),
    }))
    let g = withDist
    if (mobileListAvailOnly) g = g.filter((s) => (s.statCounts['2'] ?? 0) > 0)
    const arr = [...g]
    if (mobileListSort === 'name') {
      arr.sort((a, b) => a.statNm.localeCompare(b.statNm, 'ko', { numeric: true }))
    } else {
      arr.sort((a, b) => a.distanceKm - b.distanceKm)
    }
    return arr
  }, [clusterBrowseGrouped, userLocation, mapCenter, mobileListAvailOnly, mobileListSort])

  const stationsForMobileListEffective =
    clusterBrowseListSorted != null ? clusterBrowseListSorted : stationsForMobileList

  const hasAvailInGroupedScope = useMemo(
    () => groupedItemsInScope.some((s) => (s.statCounts?.['2'] ?? 0) > 0),
    [groupedItemsInScope]
  )

  useEffect(() => {
    if (!hasAvailInGroupedScope && mobileListAvailOnly) setMobileListAvailOnly(false)
  }, [hasAvailInGroupedScope, mobileListAvailOnly])

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

  /**
   * 지도 전용: 현재 로드된 `items` 중 디바운스+패딩 뷰포트 안만 클러스터(성능).
   * 시트·필터 파이프라인은 그대로 `items` 기준. 선택 마커는 뷰 밖이어도 포함.
   */
  const groupedAllStationsForMap = useMemo(() => {
    let validItems = items.filter((r) => {
      const la = Number(r.lat)
      const ln = Number(r.lng)
      return Number.isFinite(la) && Number.isFinite(ln)
    })
    if (mapClusterBoundsPadded) {
      const b = L.latLngBounds(
        [mapClusterBoundsPadded.southWest.lat, mapClusterBoundsPadded.southWest.lng],
        [mapClusterBoundsPadded.northEast.lat, mapClusterBoundsPadded.northEast.lng]
      )
      validItems = validItems.filter((r) => b.contains([r.lat, r.lng]))
    }
    const grouped = groupChargerRowsByPlace(validItems)
    const sel = mapSelectedStation
    if (!sel) return grouped
    if (grouped.some((s) => s.id === sel.id)) return grouped
    return [sel, ...grouped]
  }, [items, mapSelectedStation, mapClusterBoundsPadded])

  /** live와 applied가 충분히 다를 때만 "이 지역 충전소 검색하기" 노출 (중심 거리 > 0.15km) */
  const showSearchAreaButton = useMemo(() => {
    if (!isMobile || !liveMapBounds || !appliedMapBounds) return false
    const liveCenter = {
      lat: (liveMapBounds.southWest.lat + liveMapBounds.northEast.lat) / 2,
      lng: (liveMapBounds.southWest.lng + liveMapBounds.northEast.lng) / 2,
    }
    const appliedCenter = {
      lat: (appliedMapBounds.southWest.lat + appliedMapBounds.northEast.lat) / 2,
      lng: (appliedMapBounds.southWest.lng + appliedMapBounds.northEast.lng) / 2,
    }
    return haversineDistanceKm(liveCenter.lat, liveCenter.lng, appliedCenter.lat, appliedCenter.lng) > 0.15
  }, [isMobile, liveMapBounds, appliedMapBounds])

  const kpis = useMemo(() => {
    const operators = new Set(filteredItems.map((s) => s.busiNm).filter(Boolean))
    const stations = new Set(filteredItems.map((s) => s.statId).filter(Boolean))
    const byType = {}
    filteredItems.forEach((s) => {
      const label = s.chgerTyLabel
      byType[label] = (byType[label] || 0) + 1
    })
    return {
      totalChargers: filteredItems.length,
      operatorCount: operators.size,
      stationCount: stations.size,
      byChgerTy: Object.entries(byType).map(([name, count]) => ({ name, count })),
    }
  }, [filteredItems])

  const operatorChartData = useMemo(() => {
    const count = {}
    filteredItems.forEach((s) => {
      const n = s.busiNm || '(미지정)'
      count[n] = (count[n] || 0) + 1
    })
    return Object.entries(count)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredItems])

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

  if (loading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: tokens.bg.app,
          zIndex: 2000,
        }}
      >
        <GlassPanel elevation="panel" sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={32} sx={{ color: tokens.blue.main }} />
          <Typography variant="body2" color="text.secondary">
            충전소 데이터 불러오는 중
          </Typography>
        </GlassPanel>
      </Box>
    )
  }

  const panelBodyContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <EvStationIcon sx={{ fontSize: 20, color: colors.blue.primary, flexShrink: 0 }} />
          <Typography variant="h6" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: colors.gray[800] }}>EV 충전소 인프라 현황</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
        <StatCard label="전체 충전기" value={kpis.totalChargers} />
        <StatCard label="운영기관 수" value={kpis.operatorCount} />
        <StatCard label="충전소 수" value={kpis.stationCount} />
        <StatCard label="충전기 타입" value={kpis.byChgerTy.length} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box>
          <Typography variant="caption" sx={{ color: colors.gray[700], fontWeight: 600, display: 'block', mb: 0.5 }}>충전기 타입</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {SPEED_FILTER_OPTIONS.map((opt) => {
              const v = opt.value
              const selected = filterSpeed === v
              return (
                <Chip key={v || 'all'} label={opt.label} size="small"
                  onClick={() => setFilterSpeed(v)}
                  sx={{
                    fontSize: '0.75rem',
                    height: 24,
                    bgcolor: selected ? colors.blue.primary : tokens.bg.raised,
                    color: selected ? tokens.text.onPrimary : colors.gray[700],
                    border: `1px solid ${selected ? colors.blue.primary : colors.gray[300]}`,
                    '&:hover': {
                      bgcolor: selected ? colors.blue.deep : tokens.bg.muted,
                      borderColor: selected ? colors.blue.deep : colors.gray[400],
                    },
                  }}
                />
              )
            })}
          </Box>
        </Box>
        <FilterModalSelect label="운영기관" value={filterBusiNm} onChange={setFilterBusiNm} options={filterOptions.busiNms} placeholder="전체" searchable />
        <FilterModalSelect label="지역" value={filterCtprvnCd} onChange={setFilterCtprvnCd} options={filterOptions.ctprvnCds} placeholder="미선택" />
        <FilterModalSelect label="상세 지역" value={filterSggCd} onChange={setFilterSggCd} options={filterOptions.sggCdsByCtprvn[filterCtprvnCd] ?? []} placeholder="미선택" disabled={!filterCtprvnCd} disabledMessage="지역을 먼저 선택해 주세요" />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography variant="subtitle2" sx={{ color: colors.gray[700], fontWeight: 600 }}>운영기관별 충전기 (Top 10)</Typography>
        <Box sx={{ width: '100%', height: 248, minHeight: 200 }}>
          {operatorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorChartData} layout="vertical" margin={{ top: 4, right: 8, left: 48, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={colors.gray[200]} horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke={colors.gray[400]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={44} tick={{ fontSize: 10 }} stroke={colors.gray[500]} />
                <Tooltip formatter={(v) => [`${v}대`, '']} contentStyle={{ borderRadius: radius.control, border: `1px solid ${colors.gray[200]}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
                <Bar dataKey="value" name="충전기" radius={[0, 3, 3, 0]}>
                  {operatorChartData.map((_, i) => (
                    <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="caption" sx={{ color: colors.gray[500], py: 2, display: 'block', textAlign: 'center' }}>필터 결과 없음</Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography variant="subtitle2" sx={{ color: colors.gray[700], fontWeight: 600 }}>충전기 타입 분포</Typography>
        <Box sx={{ width: '100%', height: 200, minHeight: 168 }}>
          {kpis.byChgerTy.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                <Pie data={kpis.byChgerTy} dataKey="count" nameKey="name" cx="50%" cy="42%" innerRadius={32} outerRadius={56} paddingAngle={1}>
                  {kpis.byChgerTy.map((_, i) => (
                    <Cell key={i} fill={chartPalette[i % chartPalette.length]} stroke={tokens.border.subtle} strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}대`, '']} contentStyle={{ borderRadius: radius.control, border: `1px solid ${colors.gray[200]}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
                <Legend verticalAlign="bottom" layout="horizontal" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="caption" sx={{ color: colors.gray[500], py: 2, display: 'block', textAlign: 'center' }}>데이터 없음</Typography>
          )}
        </Box>
      </Box>
      <ThemeAppearanceControl compact />
      <Box sx={{ flexShrink: 0, marginTop: 2, paddingTop: 1.5, borderTop: `1px solid ${colors.gray[200]}`, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.75rem', lineHeight: 1.4 }}>생활안전지도 API · 마커 클릭 시 상세</Typography>
        <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.75rem', lineHeight: 1.4 }}>
          표시 {filteredItems.length}건
          {totalCount != null && totalCount !== items.length && ` · 전체 약 ${totalCount}건`}
        </Typography>
        <Typography component="span" sx={{ color: colors.gray[400], fontSize: '0.7rem', lineHeight: 1.4, marginTop: 0.25 }}>© whereEV2 · Created by James</Typography>
      </Box>
    </Box>
  )

  const panelEl = isMobile
    ? (
        <MobileBottomSheet
          key={detailStation ? 'mobile-sheet-detail' : 'mobile-sheet-list'}
          topOffsetPx={sheetLayout.mobileTopBarStackPx}
          halfVhRatio={detailStation ? 0.7 : sheetLayout.halfVhRatio}
          halfMaxAvailableRatio={detailStation ? 1 : 0.68}
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
                        pb: 0.75,
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
                  aria-label="필터, 정렬 및 빠른 필터"
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
                  {[
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
                  ].map((c) => {
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
                  ? '「사용 가능만」을 끄거나 정렬을 바꿔 보세요.'
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
    : (
        <>
          {!panelOpen && (
            <IconButton
              onClick={() => setPanelOpen(true)}
              aria-label="패널 열기"
              size="small"
              sx={{
                position: 'absolute',
                left: spacing.lg,
                top: spacing.lg,
                zIndex: 1001,
                bgcolor: tokens.control.fabBg,
                color: tokens.text.primary,
                border: `1px solid ${tokens.border.strong}`,
                boxShadow: tokens.shadow.float,
                '& .MuiSvgIcon-root': { opacity: 1, color: 'inherit' },
                '&:hover': {
                  bgcolor: tokens.bg.muted,
                  borderColor: tokens.border.default,
                  boxShadow: tokens.shadow.float,
                },
              }}
            >
              <ChevronRight sx={{ fontSize: 22, color: 'inherit' }} />
            </IconButton>
          )}
          <Box
            sx={{
              position: 'absolute',
              left: spacing.lg,
              top: spacing.lg,
              bottom: spacing.lg,
              width: panelW,
              zIndex: 1000,
              transition: `transform ${motion.duration.panelSlide}ms ${motion.easing.panel}`,
              transform: panelOpen ? 'translateX(0)' : 'translateX(calc(-100% - 24px))',
            }}
          >
            <SideOverlayPanel
              scrollRef={desktopPanelScrollRef}
              side="left"
              width="100%"
              sx={{ left: 0, right: 'auto', top: 0, bottom: 0, width: '100%', maxWidth: '100%', position: 'absolute', gap: 0 }}
            >
              <IconButton
                className="ev-panel-toggle"
                onClick={() => setPanelOpen(false)}
                aria-label="패널 접기"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 10,
                }}
              >
                <ChevronLeft sx={{ fontSize: 22, color: tokens.text.primary }} />
              </IconButton>
              {panelBodyContent}
            </SideOverlayPanel>
          </Box>
        </>
      )

  return (
    <>
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
        }}
      >
        {/* 모바일: 상단 플로팅 크롬 — fixed + wrapper가 safe-area 흡수 (노치/다이내믹 아일랜드) */}
        {isMobile && (
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
        )}
        {/* Full-screen map */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
          }}
        >
          <MapContainer
            center={SEOUL_CENTER}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl={false}
          >
            <MapCenterTracker setMapCenter={setMapCenter} />
            <MapBoundsTracker setMapBounds={setLiveMapBounds} />
            <MapInitialGeolocation setUserLocation={setUserLocation} />
            <MapMobileSearchViewportFitter
              enabled={isMobile}
              fitNonce={searchViewportFitNonce}
              searchQuery={searchQuery}
              filteredItems={filteredItemsForScope}
              setAppliedMapBounds={setAppliedMapBounds}
              ignoreRegionKeywordBounds={isMobile}
            />
            <MapFocusOnStation selectedStation={mapSelectedStation} isMobile={isMobile} />
            <EvStationMapLayer
              stations={groupedAllStationsForMap}
              onDetailClick={openDetailPreserve}
              onClusterTap={handleClusterStationsTap}
              selectedId={mapSelectedStation?.id}
              isMobile={isMobile}
              defaultMarkerIcon={DEFAULT_MARKER_ICON}
              selectedMarkerIcon={SELECTED_MARKER_ICON}
              selectedMarkerIconMobile={MOBILE_PIN_SELECTED_MARKER_ICON}
              uiColors={colors}
              mapTileUrl={tokens.map.tileUrl}
              mapTileAttribution={tokens.map.tileAttribution}
            />
            {!isMobile && <ZoomControl position="topright" />}
            {!isMobile && (
              <LocationControl
                setUserLocation={setUserLocation}
                setLocationError={setLocationError}
                setLocationLoading={setLocationLoading}
              />
            )}
            {isMobile && (
              <MapGeolocationSync
                geoNonce={geoNonce}
                setUserLocation={setUserLocation}
                setLocationError={setLocationError}
                setLocationLoading={setLocationLoading}
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
          {(locationError || locationLoading) && (
            <Box
              sx={{
                position: 'absolute',
                top: isMobile
                  ? `calc(env(safe-area-inset-top, 0px) + ${sheetLayout.mobileTopBarStackPx}px)`
                  : 52,
                right: isMobile
                  ? `max(${sheetLayout.mobileTopBarInsetPx}px, env(safe-area-inset-right, 0px))`
                  : 14,
                zIndex: 500,
                maxWidth: isMobile
                  ? `calc(100% - ${2 * sheetLayout.mobileTopBarInsetPx}px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))`
                  : 'calc(100% - 24px)',
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
        {isMobile && mobileSearchResultsMode && mobileSheetSnap === 'full' && !mobileOverlayBlocking ? (
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

        {isMobile &&
        (showSearchAreaButton || (mobileSearchResultsMode && mobileSheetSnap === 'peek')) &&
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

        {/* 패널: 모바일 = 바텀시트, 데스크톱 = 좌측 패널 */}
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

        {!isMobile ? (
          <StationDetailModal
            open={!!detailStation}
            station={detailStation}
            onClose={closeDetailFromOverlay}
            onRefresh={canRefetchEv ? refreshEvData : undefined}
            refreshLoading={detailRefreshing}
            headerSubtitle={detailHeaderSubtitle}
            chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
          />
        ) : null}
      </Box>
    </>
  )
}

export default App
