import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useRef } from 'react'
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
  Modal,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import ExpandMore from '@mui/icons-material/ExpandMore'
import EvStationIcon from '@mui/icons-material/EvStation'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ChevronUp from '@mui/icons-material/KeyboardArrowUp'
import ChevronDown from '@mui/icons-material/KeyboardArrowDown'
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
import { fetchEvChargers } from './api/safemapEv.js'
import { haversineDistanceKm } from './utils/geo.js'
import { colors, spacing, radius, chartBlueScale, glass } from './theme/dashboardTheme.js'
import { GlassPanel } from './components/GlassPanel.jsx'
import { StatCard } from './components/StatCard.jsx'
import { SideOverlayPanel } from './components/SideOverlayPanel.jsx'
import { FilterModalSelect } from './components/FilterModalSelect.jsx'
import { StationListMobile } from './components/StationListMobile.jsx'
import { StationDetailModal } from './components/StationDetailModal.jsx'

const SEOUL_CENTER = [37.5665, 126.978]

const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colors.blue.primary },
    secondary: { main: colors.blue.deep },
    background: { default: colors.gray[100] },
    text: { primary: colors.gray[800], secondary: colors.gray[500] },
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans KR", system-ui, sans-serif',
    h6: { fontWeight: 600, color: colors.gray[800] },
    body2: { color: colors.gray[600] },
    caption: { color: colors.gray[500] },
  },
  shape: { borderRadius: radius.control },
})

L.Marker.prototype.options.icon = L.divIcon({
  className: 'ev-marker-simple',
  html: '<div class="ev-marker-simple-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function LocationControl({ setUserLocation, setLocationError, setLocationLoading }) {
  const map = useMap()
  const setUserRef = useRef(setUserLocation)
  const setErrorRef = useRef(setLocationError)
  const setLoadingRef = useRef(setLocationLoading)
  setUserRef.current = setUserLocation
  setErrorRef.current = setLocationError
  setLoadingRef.current = setLocationLoading

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

function MapFocusOnStation({ selectedStation }) {
  const map = useMap()
  useEffect(() => {
    if (selectedStation) map.flyTo([selectedStation.lat, selectedStation.lng], 16)
  }, [map, selectedStation])
  return null
}

function MapView({ stations, onDetailClick }) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]}>
          <Popup maxWidth={320}>
            <Box component="div" sx={{ fontFamily: muiTheme.typography.fontFamily }}>
              <Typography variant="subtitle2" sx={{ color: colors.blue.primary, fontWeight: 600, mb: 0.5 }}>
                {s.statNm}
              </Typography>
              <Typography variant="caption" display="block" sx={{ color: colors.gray[600] }}>
                운영기관 {s.busiNm} · {s.chgerTyLabel}
              </Typography>
              <Typography variant="caption" display="block" sx={{ color: colors.gray[500], mt: 0.5 }}>
                이용시간 {s.useTm || '-'} · 전화 {s.telno || '-'}
              </Typography>
              <Typography variant="caption" display="block" sx={{ color: colors.gray[500] }}>
                {s.adres || s.rnAdres || '-'}
              </Typography>
              {onDetailClick && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onDetailClick(s)}
                  sx={{ mt: 1, fontSize: '0.75rem' }}
                >
                  상세 보기
                </Button>
              )}
            </Box>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function App() {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [filterBusiNm, setFilterBusiNm] = useState('')
  const [filterChgerTy, setFilterChgerTy] = useState([]) // 다중 선택: string[]
  const [filterCtprvnCd, setFilterCtprvnCd] = useState('')
  const [filterSggCd, setFilterSggCd] = useState('')
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [panelOpen, setPanelOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const panelW = isMobile ? 280 : 340

  useEffect(() => {
    if (isMobile) setMobileSheetOpen(false)
  }, [isMobile])
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [mapCenter, setMapCenter] = useState({ lat: SEOUL_CENTER[0], lng: SEOUL_CENTER[1] })
  const [selectedStation, setSelectedStation] = useState(null)
  const [filterMoreOpen, setFilterMoreOpen] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(false)

  useEffect(() => {
    const key = import.meta.env.VITE_SAFEMAP_SERVICE_KEY
    if (!key) {
      setApiError('VITE_SAFEMAP_SERVICE_KEY를 .env 또는 .env.local에 설정해 주세요.')
      setLoading(false)
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
      })
      .catch((err) => {
        if (!cancelled) setApiError(err.message || '데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((s) => {
      if (filterBusiNm && s.busiNm !== filterBusiNm) return false
      if (filterChgerTy.length > 0 && !filterChgerTy.includes(String(s.chgerTy))) return false
      if (filterCtprvnCd && s.ctprvnCd !== filterCtprvnCd) return false
      if (filterSggCd && s.sggCd !== filterSggCd) return false
      return true
    })
  }, [items, filterBusiNm, filterChgerTy, filterCtprvnCd, filterSggCd])

  /** 모바일 목록용: 거리 기준 정렬. userLocation 있으면 내 위치, 없으면 지도 중심 기준. */
  const sortedItemsForMobile = useMemo(() => {
    const ref = userLocation || mapCenter
    const withDist = filteredItems.map((s) => ({
      ...s,
      distanceKm: haversineDistanceKm(ref.lat, ref.lng, s.lat, s.lng),
    }))
    return withDist.sort((a, b) => a.distanceKm - b.distanceKm)
  }, [filteredItems, userLocation, mapCenter])

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
    const chgerTys = [...new Set(items.map((s) => String(s.chgerTy)).filter(Boolean))].sort()
    const ctprvnCds = [...new Set(items.map((s) => s.ctprvnCd).filter(Boolean))].sort()
    const sggByCtprvn = {}
    items.forEach((s) => {
      if (!s.ctprvnCd || !s.sggCd) return
      if (!sggByCtprvn[s.ctprvnCd]) sggByCtprvn[s.ctprvnCd] = new Set()
      sggByCtprvn[s.ctprvnCd].add(s.sggCd)
    })
    Object.keys(sggByCtprvn).forEach((k) => {
      sggByCtprvn[k] = [...sggByCtprvn[k]].sort().map((v) => ({ value: v, label: v }))
    })
    return {
      busiNms: busiNms.map((v) => ({ value: v, label: v })),
      chgerTys: chgerTys.map((v) => ({
        value: v,
        label: items.find((s) => String(s.chgerTy) === v)?.chgerTyLabel ?? v,
      })),
      ctprvnCds: ctprvnCds.map((v) => ({ value: v, label: v })),
      sggCdsByCtprvn: sggByCtprvn,
    }
  }, [items])

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
            {filterOptions.chgerTys.map((opt) => {
              const v = opt.value ?? opt
              const selected = filterChgerTy.includes(v)
              return (
                <Chip key={v} label={opt.label ?? v} size="small"
                  onClick={() => setFilterChgerTy((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
                  sx={{ fontSize: '0.75rem', height: 24, bgcolor: selected ? colors.blue.primary : 'rgba(255,255,255,0.6)', color: selected ? colors.white : colors.gray[700], border: `1px solid ${selected ? colors.blue.primary : colors.gray[300]}`, '&:hover': { bgcolor: selected ? colors.blue.deep : 'rgba(255,255,255,0.9)', borderColor: selected ? colors.blue.deep : colors.gray[400] } }}
                />
              )
            })}
          </Box>
        </Box>
        <FilterModalSelect label="운영기관" value={filterBusiNm} onChange={setFilterBusiNm} options={filterOptions.busiNms} placeholder="전체" searchable />
        <FilterModalSelect label="시도코드" value={filterCtprvnCd} onChange={setFilterCtprvnCd} options={filterOptions.ctprvnCds} placeholder="미선택" />
        <FilterModalSelect label="시군구코드" value={filterSggCd} onChange={setFilterSggCd} options={filterOptions.sggCdsByCtprvn[filterCtprvnCd] ?? []} placeholder="미선택" disabled={!filterCtprvnCd} disabledMessage="시도 먼저 선택" />
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

  const MOBILE_SHEET_HEADER_PX = 56

  const panelEl = isMobile
    ? (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '16px 16px 0 0',
            ...glass.panel,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            height: mobileSheetOpen ? '60vh' : MOBILE_SHEET_HEADER_PX,
            maxHeight: mobileSheetOpen ? '65vh' : MOBILE_SHEET_HEADER_PX,
            minHeight: mobileSheetOpen ? '55vh' : MOBILE_SHEET_HEADER_PX,
            transition: 'height 0.3s ease, max-height 0.3s ease, min-height 0.3s ease',
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.5,
              py: 1,
              minHeight: MOBILE_SHEET_HEADER_PX,
              boxSizing: 'border-box',
              borderBottom: mobileSheetOpen ? `1px solid ${colors.gray[200]}` : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <EvStationIcon sx={{ fontSize: 20, color: colors.blue.primary, flexShrink: 0 }} />
              <Typography variant="h6" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: colors.gray[800], lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userLocation ? '내 주변 충전소' : '현재 지도 영역'} · {sortedItemsForMobile.length}곳
              </Typography>
            </Box>
            <IconButton
              onClick={() => setMobileSheetOpen((prev) => !prev)}
              aria-label={mobileSheetOpen ? '패널 닫기' : '패널 열기'}
              size="small"
              sx={{
                flexShrink: 0,
                width: 36,
                height: 36,
                bgcolor: '#fff',
                color: colors.gray[900],
                border: `1px solid ${colors.gray[400]}`,
                boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
                '& .MuiSvgIcon-root': { opacity: 1, color: 'inherit' },
                '&:hover': { bgcolor: colors.gray[50], borderColor: colors.gray[500], boxShadow: '0 2px 12px rgba(0,0,0,0.18)' },
              }}
            >
              {mobileSheetOpen ? <ChevronDown sx={{ fontSize: 22, color: 'inherit' }} /> : <ChevronUp sx={{ fontSize: 22, color: 'inherit' }} />}
            </IconButton>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              px: 2,
              pb: 2,
              pt: 0.5,
              display: mobileSheetOpen ? 'block' : 'none',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: colors.gray[700], fontWeight: 600, display: 'block', mb: 0.5 }}>충전기 타입</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {filterOptions.chgerTys.map((opt) => {
                    const v = opt.value ?? opt
                    const selected = filterChgerTy.includes(v)
                    return (
                      <Chip
                        key={v}
                        label={opt.label ?? v}
                        size="small"
                        onClick={() => setFilterChgerTy((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
                        sx={{ fontSize: '0.75rem', height: 24, bgcolor: selected ? colors.blue.primary : 'rgba(255,255,255,0.6)', color: selected ? colors.white : colors.gray[700], border: `1px solid ${selected ? colors.blue.primary : colors.gray[300]}`, '&:hover': { bgcolor: selected ? colors.blue.deep : 'rgba(255,255,255,0.9)', borderColor: selected ? colors.blue.deep : colors.gray[400] } }}
                      />
                    )
                  })}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip label="가까운 순" size="small" sx={{ fontSize: '0.75rem', height: 24, bgcolor: colors.blue.muted, color: colors.blue.deep, border: `1px solid ${colors.blue.primary}` }} />
                <Button size="small" variant="text" onClick={() => setFilterMoreOpen(true)} sx={{ fontSize: '0.75rem', color: colors.gray[600], minWidth: 0, px: 0.5 }}>
                  필터 더 보기
                </Button>
              </Box>
              <StationListMobile
                stations={sortedItemsForMobile}
                selectedId={selectedStation?.id}
                onSelect={(s) => setSelectedStation(s)}
              />
              <Accordion expanded={statsExpanded} onChange={(_, exp) => setStatsExpanded(exp)} disableGutters sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, py: 0, '& .MuiAccordionSummary-content': { my: 0.75 } }}>
                  <Typography variant="subtitle2" sx={{ color: colors.gray[700], fontWeight: 600 }}>통계 보기</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, px: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                    <StatCard label="전체 충전기" value={kpis.totalChargers} />
                    <StatCard label="운영기관 수" value={kpis.operatorCount} />
                    <StatCard label="충전소 수" value={kpis.stationCount} />
                    <StatCard label="충전기 타입" value={kpis.byChgerTy.length} />
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ color: colors.gray[700], fontWeight: 600, display: 'block', mb: 0.5 }}>운영기관별 충전기 (Top 10)</Typography>
                    <Box sx={{ width: '100%', height: 200 }}>
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
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: colors.gray[700], fontWeight: 600, display: 'block', mb: 0.5 }}>충전기 타입 분포</Typography>
                    <Box sx={{ width: '100%', height: 168 }}>
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
                </AccordionDetails>
              </Accordion>
              <Box sx={{ flexShrink: 0, marginTop: 1, paddingTop: 1.5, borderTop: `1px solid ${colors.gray[200]}`, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.75rem', lineHeight: 1.4 }}>생활안전지도 API · 마커 클릭 시 상세</Typography>
                <Typography variant="caption" sx={{ color: colors.gray[500], fontSize: '0.75rem', lineHeight: 1.4 }}>
                  표시 {filteredItems.length}건
                  {totalCount != null && totalCount !== items.length && ` · 전체 약 ${totalCount}건`}
                </Typography>
                <Typography component="span" sx={{ color: colors.gray[400], fontSize: '0.7rem', lineHeight: 1.4, marginTop: 0.25 }}>© whereEV2 · Created by James</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
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
              transition: 'transform 0.3s ease',
              transform: panelOpen ? 'translateX(0)' : 'translateX(calc(-100% - 24px))',
            }}
          >
            <SideOverlayPanel side="left" width="100%" sx={{ left: 0, right: 'auto', top: 0, bottom: 0, width: '100%', maxWidth: '100%', position: 'absolute', gap: 0 }}>
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
      <Box
        sx={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 9999,
          background: '#111827',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        whereEV2 TEST BUILD
      </Box>
      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* v2 식별: 지도 좌상단 작은 표시 */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 400,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.85)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.65rem', fontWeight: 600, color: colors.gray[600], letterSpacing: '0.02em' }}>
            whereEV2
          </Typography>
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
            center={SEOUL_CENTER}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl={false}
          >
            <MapCenterTracker setMapCenter={setMapCenter} />
            <MapFocusOnStation selectedStation={selectedStation} />
            <MapView stations={filteredItems} onDetailClick={(s) => setSelectedStation(s)} />
            <ZoomControl position="topright" />
            <LocationControl
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
              </>
            )}
          </MapContainer>
          {(locationError || locationLoading) && (
            <Box
              sx={{
                position: 'absolute',
                top: 52,
                right: 14,
                zIndex: 500,
                maxWidth: 'calc(100% - 24px)',
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
                    fontSize: '0.75rem',
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

        {/* 패널: 모바일 = 바텀시트, 데스크톱 = 좌측 패널 */}
        {panelEl}

        <StationDetailModal open={!!selectedStation} station={selectedStation} onClose={() => setSelectedStation(null)} />

        <Modal open={filterMoreOpen} onClose={() => setFilterMoreOpen(false)}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: 360,
              maxHeight: '80vh',
              overflow: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              p: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>필터 더 보기</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <FilterModalSelect label="운영기관" value={filterBusiNm} onChange={setFilterBusiNm} options={filterOptions.busiNms} placeholder="전체" searchable />
              <FilterModalSelect label="시도코드" value={filterCtprvnCd} onChange={setFilterCtprvnCd} options={filterOptions.ctprvnCds} placeholder="미선택" />
              <FilterModalSelect label="시군구코드" value={filterSggCd} onChange={setFilterSggCd} options={filterOptions.sggCdsByCtprvn[filterCtprvnCd] ?? []} placeholder="미선택" disabled={!filterCtprvnCd} disabledMessage="시도 먼저 선택" />
            </Box>
            <Button variant="contained" onClick={() => setFilterMoreOpen(false)} sx={{ mt: 2, width: '100%' }}>적용</Button>
          </Box>
        </Modal>
      </Box>
    </ThemeProvider>
  )
}

export default App
