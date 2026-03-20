import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  createTheme,
  ThemeProvider,
  CssBaseline,
  CircularProgress,
  Alert,
  useMediaQuery,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material'
import EvStationIcon from '@mui/icons-material/EvStation'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ChevronUp from '@mui/icons-material/KeyboardArrowUp'
import ChevronDown from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import TuneIcon from '@mui/icons-material/Tune'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Circle, CircleMarker, useMap } from 'react-leaflet'
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
  aggregateStatCounts,
  getLatestStatUpdDt,
  formatStatSummary,
} from './api/safemapEv.js'
import { getDevMockEvChargers } from './dev/mockEvChargers.js'
import {
  haversineDistanceKm,
  placeKey,
  formatListSummary,
  formatDistanceKm,
  summarizeSpeedCategories,
  pickShortLocationHint,
} from './utils/geo.js'

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
import {
  appMobileType,
  colors,
  spacing,
  radius,
  chartBlueScale,
  glass,
  motion,
  sheetLayout,
  mobileMapChrome,
} from './theme/dashboardTheme.js'
import { GlassPanel } from './components/GlassPanel.jsx'
import { StatCard } from './components/StatCard.jsx'
import { SideOverlayPanel } from './components/SideOverlayPanel.jsx'
import { FilterModalSelect } from './components/FilterModalSelect.jsx'
import { StationListMobile } from './components/StationListMobile.jsx'
import { StationDetailModal } from './components/StationDetailModal.jsx'
import { StationDetailSheet } from './components/StationDetailSheet.jsx'
import { MobileBottomSheet } from './components/MobileBottomSheet.jsx'
import { MobileFilterSheet } from './components/MobileFilterSheet.jsx'

const SEOUL_CENTER = [37.5665, 126.978]

const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.blue.primary },
    secondary: { main: colors.blue.deep },
    background: { default: colors.gray[100], paper: colors.white },
    text: { primary: colors.gray[800], secondary: colors.gray[500] },
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans KR", system-ui, sans-serif',
    h6: { fontWeight: 600, color: colors.gray[800] },
    body2: { color: colors.gray[600] },
    caption: { color: colors.gray[500] },
  },
  shape: { borderRadius: radius.control },
  transitions: {
    easing: { easeOut: motion.easing.standard, sharp: motion.easing.emphasized },
    duration: { enteringScreen: motion.duration.enter, leavingScreen: motion.duration.exit, standard: motion.duration.sheet },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
        },
      },
    },
    MuiDialog: {
      defaultProps: { scroll: 'paper' },
    },
  },
})

const DEFAULT_MARKER_ICON = L.divIcon({
  className: 'ev-marker ev-marker-default',
  html: '<span class="ev-marker-dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})
const SELECTED_MARKER_ICON = L.divIcon({
  className: 'ev-marker ev-marker-selected',
  html: '<span class="ev-marker-dot"></span>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
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
              map.setView([latitude, longitude], 15)
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
        map.setView([latitude, longitude], 15)
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

function MapFocusOnStation({ selectedStation }) {
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
    map.flyTo([selectedStation.lat, selectedStation.lng], 16)
  }, [map, selectedStation])
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

function mapPopupDistOrHint(s) {
  if (s.distanceKm != null && !Number.isNaN(s.distanceKm)) return formatDistanceKm(s.distanceKm)
  return (s.locationHint || '').trim()
}

function mapPopupMetaLine(s) {
  const speed = (s.speedBadge || s.speedCategory || '').trim()
  const busi = (s.busiNm || '').trim() || '—'
  return speed ? `${busi} · ${speed}` : busi
}

function MapView({ stations, onDetailClick, selectedId, isMobile, defaultMarkerIcon, selectedMarkerIcon }) {
  const icon = (id) => (selectedId === id ? selectedMarkerIcon : defaultMarkerIcon)
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {stations.map((s) => {
        const hint = mapPopupDistOrHint(s)
        const meta = mapPopupMetaLine(s)
        const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={icon(s.id)}>
            <Popup maxWidth={isMobile ? 196 : 260}>
              <Box
                component="div"
                sx={{
                  fontFamily: muiTheme.typography.fontFamily,
                  margin: '-4px -6px',
                  minWidth: isMobile ? 0 : 200,
                }}
              >
                <Typography
                  component="div"
                  sx={{
                    fontWeight: 700,
                    fontSize: isMobile ? '0.8125rem' : '0.875rem',
                    color: colors.gray[900],
                    lineHeight: 1.25,
                  }}
                >
                  {s.statNm}
                </Typography>
                {hint ? (
                  <Typography component="div" sx={{ fontSize: '0.6875rem', color: colors.gray[500], mt: 0.2, lineHeight: 1.35 }}>
                    {hint}
                  </Typography>
                ) : null}
                <Typography component="div" sx={{ fontSize: '0.6875rem', color: colors.gray[600], mt: 0.15, lineHeight: 1.35 }}>
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
                        color: colors.blue.primary,
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
                      color: colors.gray[700],
                      textTransform: 'none',
                    }}
                  >
                    길찾기
                  </Button>
                </Box>
              </Box>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

function App() {
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
  const [searchQuery, setSearchQuery] = useState('')
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
  const [mobileSheetSnap, setMobileSheetSnap] = useState(/** @type {'collapsed' | 'half' | 'full'} */ ('collapsed'))
  /** 상세 진입 직전 목록 시트 스냅 — 닫을 때 복원 */
  const sheetSnapBeforeDetailRef = useRef(/** @type {'collapsed' | 'half' | 'full'} */ ('half'))
  const [mobileListSort, setMobileListSort] = useState(/** @type {'distance' | 'name'} */ ('distance'))
  const [mobileListAvailOnly, setMobileListAvailOnly] = useState(false)
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
  const [mobileSheetHeightPx, setMobileSheetHeightPx] = useState(sheetLayout.collapsedPx)
  const handleSheetSnapHeightPx = useCallback((px) => {
    setMobileSheetHeightPx(px)
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
    if (isMobile) setMobileSheetSnap('collapsed')
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
  const [appliedMapBounds, setAppliedMapBounds] = useState(null)
  const liveMapBoundsRef = useRef(null)
  useEffect(() => {
    liveMapBoundsRef.current = liveMapBounds
  }, [liveMapBounds])

  /** 「이 지역 검색」: 영역 적용 + 목록 시트를 검색 결과 모드로(포커스·상세 초기화) */
  const applySearchAreaFromMap = useCallback(() => {
    setAppliedMapBounds(liveMapBoundsRef.current)
    mapSelectedStationRef.current = null
    setMapSelectedStation(null)
    setDetailStation(null)
    detailStationRef.current = null
  }, [])

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
    let cancelled = false
    setLoading(true)
    setApiError(null)
    fetchEvChargers({ pageNo: 1, numOfRows: 200, maxPages: 3 })
      .then(({ items: list, totalCount: total }) => {
        if (cancelled) return
        setItems(list)
        setTotalCount(total)
        setLastEvFetchAt(new Date().toISOString())
      })
      .catch((err) => {
        if (!cancelled) setApiError(err.message || '데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const refreshEvData = useCallback(async () => {
    if (!canRefetchEv) return
    setDetailRefreshing(true)
    setApiError(null)
    try {
      const { items: list, totalCount: total } = await fetchEvChargers({ pageNo: 1, numOfRows: 200, maxPages: 3 })
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

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return items.filter((s) => {
      if (filterBusiNm && s.busiNm !== filterBusiNm) return false
      if (filterSpeed && s.speedCategory !== filterSpeed) return false
      if (filterCtprvnCd && s.ctprvnCd !== filterCtprvnCd) return false
      if (filterSggCd && s.sggCd !== filterSggCd) return false
      if (q) {
        const hay = [s.statNm, s.adres, s.rnAdres, s.busiNm, s.chgerNm, s.outputKw]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, filterBusiNm, filterSpeed, filterCtprvnCd, filterSggCd, searchQuery])

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
    return filteredItems.filter((s) => b.contains([s.lat, s.lng]))
  }, [filteredItems, appliedMapBounds])

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
    if (items.length === 0) {
      return {
        variant: 'no_data',
        title: '불러온 충전소가 없습니다',
        subtitle: '네트워크·API 키를 확인한 뒤 다시 시도해 주세요.',
      }
    }
    if (filteredItems.length === 0) {
      return {
        variant: 'no_filter',
        title: '조건에 맞는 충전소가 없습니다',
        subtitle: '검색어를 지우거나 필터를 느슨하게 조정해 보세요.',
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
  }, [isMobile, appliedMapBounds, items.length, filteredItems.length, itemsInScope.length])

  /** 목록 시트 헤더: 단일 소스 (detail → stationFocus → searchResults). 접힘/펼침은 레이아웃만 담당 */
  const listSheetHeaderMode = useMemo(() => {
    if (detailStation) return 'detail'
    if (mapSelectedStation) return 'stationFocus'
    return 'searchResults'
  }, [detailStation, mapSelectedStation])

  const listSheetHeaderTitle = useMemo(() => {
    if (listSheetHeaderMode === 'detail' && detailStation) return detailStation.statNm
    if (listSheetHeaderMode === 'stationFocus' && mapSelectedStation) return mapSelectedStation.statNm
    if (appliedMapBounds == null) return '지도 영역 확인 중…'
    return `이 지역 충전소 ${stationsForMobileList.length}곳`
  }, [listSheetHeaderMode, detailStation, mapSelectedStation, appliedMapBounds, stationsForMobileList.length])

  /** 지도 마커용: 데스크탑=filteredItems, 모바일=applied 기준 groupedItemsInScope(1장소 1마커). 선택된 충전소는 범위 밖이어도 포함. */
  const displayStationsForMap = useMemo(() => {
    const base = isMobile
      ? (appliedMapBounds ? groupedItemsInScope : [])
      : filteredItems
    if (mapSelectedStation && !base.some((s) => s.id === mapSelectedStation.id)) {
      return [mapSelectedStation, ...base]
    }
    return base
  }, [isMobile, appliedMapBounds, groupedItemsInScope, filteredItems, mapSelectedStation])

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
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: colors.gray[100],
            zIndex: 2000,
          }}
        >
          <GlassPanel elevation="panel" sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={32} sx={{ color: colors.blue.primary }} />
            <Typography variant="body2" color="text.secondary">
              충전소 데이터 불러오는 중
            </Typography>
          </GlassPanel>
        </Box>
      </ThemeProvider>
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
                  sx={{ fontSize: '0.75rem', height: 24, bgcolor: selected ? colors.blue.primary : 'rgba(255,255,255,0.6)', color: selected ? colors.white : colors.gray[700], border: `1px solid ${selected ? colors.blue.primary : colors.gray[300]}`, '&:hover': { bgcolor: selected ? colors.blue.deep : 'rgba(255,255,255,0.9)', borderColor: selected ? colors.blue.deep : colors.gray[400] } }}
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
                    <Cell key={i} fill={chartBlueScale[i % chartBlueScale.length]} />
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
                    <Cell key={i} fill={chartBlueScale[i % chartBlueScale.length]} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
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
          key="mobile-bottom-sheet"
          topOffsetPx={sheetLayout.mobileTopBarStackPx}
          collapsedPx={sheetLayout.collapsedPx}
          halfVhRatio={sheetLayout.halfVhRatio}
          snap={mobileSheetSnap}
          onSnapChange={setMobileSheetSnap}
          listScrollRef={sheetListScrollRef}
          onSnapHeightPxChange={handleSheetSnapHeightPx}
          renderHeader={({ snap, cycleSnap }) => (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                boxSizing: 'border-box',
                minHeight: 88,
                pt: 1,
                userSelect: 'none',
                bgcolor: colors.gray[50],
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                }}
                aria-hidden
              >
                <Box
                  sx={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: colors.gray[300],
                    mb: 1.75,
                  }}
                />
              </Box>
              <Box
                sx={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  columnGap: 1,
                  alignSelf: 'stretch',
                  px: 2,
                  /* 제목 블록과 정리선 사이 호흡 */
                  pb: '18px',
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <EvStationIcon sx={{ fontSize: 20, color: colors.gray[600], flexShrink: 0 }} />
                  <Typography
                    variant="h6"
                    component="div"
                    data-ev-list-header-mode={listSheetHeaderMode}
                    sx={{
                      color: colors.gray[800],
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      ...appMobileType.listSheetTitle,
                    }}
                  >
                    {listSheetHeaderTitle}
                  </Typography>
                </Box>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    cycleSnap()
                  }}
                  aria-label={snap === 'collapsed' ? '목록 펼치기' : snap === 'full' ? '시트 접기' : '시트 크기 전환'}
                  size="small"
                  sx={{
                    gridColumn: 2,
                    justifySelf: 'end',
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    minHeight: 40,
                    p: 0,
                    bgcolor: colors.white,
                    color: colors.gray[800],
                    border: `1px solid ${colors.gray[200]}`,
                    transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, transform ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '& .MuiSvgIcon-root': { opacity: 1, color: 'inherit' },
                    '&:hover': { bgcolor: colors.gray[50], borderColor: colors.gray[300] },
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  {snap === 'collapsed' ? <ChevronUp sx={{ fontSize: 22, color: 'inherit' }} /> : <ChevronDown sx={{ fontSize: 22, color: 'inherit' }} />}
                </IconButton>
              </Box>
              <Box
                component="div"
                aria-hidden
                sx={{
                  height: 1,
                  flexShrink: 0,
                  bgcolor: 'rgba(15, 23, 42, 0.07)',
                  width: '100%',
                }}
              />
            </Box>
          )}
          renderToolbar={() => (
            <Box
              role="toolbar"
              aria-label="목록 정렬 및 빠른 필터"
              sx={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '10px',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {[
                { key: 'dist', label: '가까운 순', on: mobileListSort === 'distance', disabled: false, onClick: () => setMobileListSort('distance') },
                { key: 'name', label: '이름순', on: mobileListSort === 'name', disabled: false, onClick: () => setMobileListSort('name') },
                {
                  key: 'fast',
                  label: '급속',
                  on: filterSpeed === '급속',
                  disabled: false,
                  onClick: () => setFilterSpeed((v) => (v === '급속' ? '' : '급속')),
                },
                {
                  key: 'avail',
                  label: '사용 가능만',
                  on: mobileListAvailOnly,
                  disabled: !hasAvailInGroupedScope,
                  onClick: () => {
                    if (!hasAvailInGroupedScope) return
                    setMobileListAvailOnly((v) => !v)
                  },
                },
              ].map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  disabled={c.disabled}
                  onClick={c.disabled ? undefined : c.onClick}
                  sx={{
                    flexShrink: 0,
                    height: 42,
                    fontSize: '0.875rem',
                    lineHeight: 1.25,
                    fontWeight: c.on ? 600 : 500,
                    borderRadius: 9999,
                    bgcolor: c.disabled ? colors.gray[100] : c.on ? colors.blue.primary : colors.white,
                    color: c.disabled ? colors.gray[400] : c.on ? colors.white : colors.gray[700],
                    border: `1px solid ${
                      c.disabled ? colors.gray[200] : c.on ? colors.blue.primary : colors.gray[200]
                    }`,
                    opacity: c.disabled ? 0.85 : 1,
                    transition: `background-color ${motion.duration.enter}ms ${motion.easing.standard}, color ${motion.duration.enter}ms ${motion.easing.standard}, border-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '& .MuiChip-label': { px: '15px', py: 0 },
                    '&:hover': {
                      bgcolor: c.disabled
                        ? colors.gray[100]
                        : c.on
                          ? colors.blue.deep
                          : colors.gray[50],
                      borderColor: c.disabled
                        ? colors.gray[200]
                        : c.on
                          ? colors.blue.deep
                          : colors.gray[300],
                    },
                  }}
                />
              ))}
            </Box>
          )}
        >
          <StationListMobile
            key={`scope-${appliedMapBounds ? [appliedMapBounds.southWest.lat, appliedMapBounds.southWest.lng, appliedMapBounds.northEast.lat, appliedMapBounds.northEast.lng].join(',') : 'none'}`}
            stations={stationsForMobileList}
            selectedId={mapSelectedStation?.id}
            loadingBounds={appliedMapBounds == null}
            loadingHint="지도에 적용할 검색 영역을 준비하는 중입니다."
            emptyMessage={
              groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                ? '이 조건에 맞는 충전소가 없습니다'
                : (mobileListEmptyInfo?.title ?? '표시할 충전소가 없습니다')
            }
            emptySubMessage={
              groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                ? '빠른 필터를 바꾸거나 전체 필터에서 조건을 조정해 보세요.'
                : mobileListEmptyInfo?.subtitle
            }
            emptyVariant={
              groupedItemsInScope.length > 0 && stationsForMobileList.length === 0
                ? 'no_filter'
                : (mobileListEmptyInfo?.variant ?? 'no_in_view')
            }
            onOpenDetail={openDetailPreserve}
          />
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
                bgcolor: '#fff',
                color: colors.gray[900],
                border: `1px solid ${colors.gray[400]}`,
                boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                '& .MuiSvgIcon-root': { opacity: 1, color: 'inherit' },
                '&:hover': { bgcolor: colors.gray[50], borderColor: colors.gray[500], boxShadow: '0 2px 12px rgba(0,0,0,0.16)' },
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
                <ChevronLeft sx={{ fontSize: 22, color: '#111827' }} />
              </IconButton>
              {panelBodyContent}
            </SideOverlayPanel>
          </Box>
        </>
      )

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
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
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: `${mobileMapChrome.rowGap}px`,
                pointerEvents: 'auto',
              }}
            >
              <TextField
                size="small"
                placeholder="충전소·주소 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="충전소 검색"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: mobileMapChrome.searchPillH,
                  '& .MuiOutlinedInput-root': {
                    height: mobileMapChrome.searchPillH,
                    minHeight: mobileMapChrome.searchPillH,
                    boxSizing: 'border-box',
                    fontSize: appMobileType.searchField.fontSize,
                    bgcolor: colors.white,
                    borderRadius: radius.full,
                    boxShadow: mobileMapChrome.floatShadow,
                    pl: '18px',
                    pr: '18px',
                    transition: `box-shadow ${motion.duration.enter}ms ${motion.easing.standard}, background-color ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '& fieldset': { borderColor: 'rgba(15,23,42,0.06)' },
                    '&:hover': {
                      boxShadow: '0 6px 28px rgba(15, 23, 42, 0.14), 0 2px 12px rgba(15, 23, 42, 0.09)',
                    },
                    '&:hover fieldset': { borderColor: 'rgba(15,23,42,0.1)' },
                    '&.Mui-focused fieldset': { borderColor: colors.blue.primary, borderWidth: 1 },
                    alignItems: 'center',
                  },
                  '& .MuiInputBase-input': {
                    py: 0,
                    height: `${mobileMapChrome.searchPillH}px`,
                    boxSizing: 'border-box',
                    lineHeight: `${mobileMapChrome.searchPillH}px`,
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.5, ml: -0.25 }}>
                        <SearchIcon sx={{ fontSize: 22, color: colors.gray[500] }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: `${mobileMapChrome.fabGap}px`,
                  flexShrink: 0,
                  /* Leaflet 줌(우하단)과 겹침 완화: 상단 우측 스택 */
                  mt: 0,
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
                    bgcolor: colors.white,
                    border: '1px solid rgba(15,23,42,0.06)',
                    borderRadius: '50%',
                    color: colors.gray[800],
                    boxShadow: mobileMapChrome.floatShadow,
                    transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '&:hover': {
                      bgcolor: colors.white,
                      boxShadow: '0 6px 28px rgba(15, 23, 42, 0.14), 0 2px 12px rgba(15, 23, 42, 0.09)',
                    },
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  <MyLocationIcon sx={{ fontSize: 24 }} />
                </IconButton>
                <IconButton
                  onClick={openFilterDrawer}
                  aria-label={detailStation ? '상세를 닫은 뒤 필터를 사용할 수 있습니다' : '필터'}
                  disabled={!!detailStation}
                  sx={{
                    width: mobileMapChrome.fabSize,
                    height: mobileMapChrome.fabSize,
                    minWidth: mobileMapChrome.fabSize,
                    minHeight: mobileMapChrome.fabSize,
                    boxSizing: 'border-box',
                    bgcolor: colors.white,
                    border: '1px solid rgba(15,23,42,0.06)',
                    borderRadius: '50%',
                    color: colors.gray[800],
                    boxShadow: mobileMapChrome.floatShadow,
                    transition: `transform ${motion.duration.enter}ms ${motion.easing.standard}, box-shadow ${motion.duration.enter}ms ${motion.easing.standard}`,
                    '&:hover': {
                      bgcolor: colors.white,
                      boxShadow: '0 6px 28px rgba(15, 23, 42, 0.14), 0 2px 12px rgba(15, 23, 42, 0.09)',
                    },
                    '&:active': { transform: 'scale(0.96)' },
                    '&.Mui-disabled': {
                      bgcolor: colors.gray[100],
                      color: colors.gray[400],
                      boxShadow: 'none',
                      borderColor: colors.gray[200],
                    },
                  }}
                >
                  <TuneIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Box>
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
            <MapFocusOnStation selectedStation={mapSelectedStation} />
            <MapView
                stations={displayStationsForMap}
                onDetailClick={openDetailPreserve}
                selectedId={mapSelectedStation?.id}
                isMobile={isMobile}
                defaultMarkerIcon={DEFAULT_MARKER_ICON}
                selectedMarkerIcon={SELECTED_MARKER_ICON}
              />
            <ZoomControl position={isMobile ? 'bottomright' : 'topright'} />
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
                    color: colors.blue.primary,
                    fillColor: colors.blue.primary,
                    fillOpacity: 0.25,
                    weight: 2,
                  }}
                />
                <CircleMarker
                  center={[userLocation.lat, userLocation.lng]}
                  radius={6}
                  pathOptions={{
                    color: colors.blue.primary,
                    fillColor: colors.blue.primary,
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
                    bgcolor: 'rgba(255,255,255,0.92)',
                    boxShadow: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: colors.gray[700],
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
                ...glass.panel,
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
        {isMobile && showSearchAreaButton && !mobileOverlayBlocking && (
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
          </Box>
        )}

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

        {isMobile ? (
          <StationDetailSheet
            open={!!detailStation}
            station={detailStation}
            onClose={handleCloseDetail}
            onRefresh={canRefetchEv ? refreshEvData : undefined}
            refreshLoading={detailRefreshing}
            headerSubtitle={detailHeaderSubtitle}
            chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
          />
        ) : (
          <StationDetailModal
            open={!!detailStation}
            station={detailStation}
            onClose={closeDetailFromOverlay}
            onRefresh={canRefetchEv ? refreshEvData : undefined}
            refreshLoading={detailRefreshing}
            headerSubtitle={detailHeaderSubtitle}
            chargerSummaryUpdatedInHeader={chargerSummaryUpdatedInHeader}
          />
        )}
      </Box>
    </ThemeProvider>
  )
}

export default App
