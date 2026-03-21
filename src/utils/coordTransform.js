/**
 * Web Mercator (EPSG:3857) 미터 좌표 → WGS84(lat, lng). WGS84 단순 취급 없음.
 */
export function webMercatorMetersToLatLng(x, y) {
  const numX = Number(x)
  const numY = Number(y)
  if (Number.isNaN(numX) || Number.isNaN(numY)) return null
  const maxExtent = 20037508.34
  if (Math.abs(numX) > maxExtent || Math.abs(numY) > maxExtent) return null
  const lng = (numX / maxExtent) * 180
  let lat = (numY / maxExtent) * 180
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Web Mercator (EPSG:3857) 좌표를 WGS84(lat, lng)로 변환.
 * 이미 도(°) 단위 쌍으로 보이면 변환 생략 (Safemap x/y 대용량 투영값은 별도 분기).
 */
export function webMercatorToLatLng(x, y) {
  const numX = Number(x)
  const numY = Number(y)
  if (Number.isNaN(numX) || Number.isNaN(numY)) return null
  const maxAbs = Math.max(Math.abs(numX), Math.abs(numY))
  // Safemap EV x/y(수백만) 등: WGS84(도)로 오인하지 않고 Mercator 역변환만
  if (maxAbs >= 1_000_000) {
    return webMercatorMetersToLatLng(numX, numY)
  }
  if (Math.abs(numX) <= 180 && Math.abs(numY) <= 90) {
    return { lat: numY, lng: numX }
  }
  return webMercatorMetersToLatLng(numX, numY)
}

/** 한반도 대략 (bounds 필터·휴리스틱용) */
export function isLatLngRoughlyKorea(lat, lng) {
  return lat >= 32.5 && lat <= 39.5 && lng >= 123.5 && lng <= 132.5
}

/**
 * Safemap IF_0042 등 목록 row → WGS84. x/y 투영·lat/lng 필드 혼재 대응.
 * @param {Record<string, unknown>} item
 * @returns {{ lat: number, lng: number } | null}
 */
export function safemapApiRowToLatLng(item) {
  if (!item || typeof item !== 'object') return null

  const pickNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  // --- 1) 명시적 WGS84 (다양한 키) ---
  const latCandidates = [
    item.lat,
    item.LAT,
    item.latitude,
    item.Latitude,
    item.yPos,
    item.ypoint,
    item.YPOINT,
    item.locationY,
  ]
  const lngCandidates = [
    item.lng,
    item.LNG,
    item.lon,
    item.longitude,
    item.Longitude,
    item.xPos,
    item.xpoint,
    item.XPOINT,
    item.locationX,
  ]
  let wLat = NaN
  let wLng = NaN
  for (const v of latCandidates) {
    if (v != null && v !== '') {
      wLat = pickNum(v)
      break
    }
  }
  for (const v of lngCandidates) {
    if (v != null && v !== '') {
      wLng = pickNum(v)
      break
    }
  }
  if (Number.isFinite(wLat) && Number.isFinite(wLng)) {
    let lat = wLat
    let lng = wLng
    // 필드에 위·경도가 뒤바뀐 경우만 교정 (경도 값이 lat 슬롯에 들어간 패턴)
    if (lat >= 120 && lat <= 135 && lng >= 33 && lng <= 43) {
      const t = lat
      lat = lng
      lng = t
    }
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }

  // --- 2) x / y (Web Mercator 미터) — Safemap 전기차 ---
  const rawX = item.x ?? item.X ?? item.mapx ?? item.MAPX ?? item.gpsX ?? item.coordX
  const rawY = item.y ?? item.Y ?? item.mapy ?? item.MAPY ?? item.gpsY ?? item.coordY

  const nx = pickNum(rawX)
  const ny = pickNum(rawY)
  if (Number.isFinite(nx) && Number.isFinite(ny) && Math.max(Math.abs(nx), Math.abs(ny)) >= 1_000_000) {
    let m = webMercatorMetersToLatLng(nx, ny)
    if (m && isLatLngRoughlyKorea(m.lat, m.lng)) return m
    m = webMercatorMetersToLatLng(ny, nx)
    if (m && isLatLngRoughlyKorea(m.lat, m.lng)) return m
    return webMercatorMetersToLatLng(nx, ny)
  }

  return null
}
