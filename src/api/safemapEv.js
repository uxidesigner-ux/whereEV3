/**
 * 생활안전지도(Safemap) 전기차충전소 API
 * 문서: https://www.safemap.go.kr/opna/data/dataViewRenew.do?objtId=118
 */

import { safemapApiRowToLatLng } from '../utils/coordTransform.js'
import { applyMvpChargerOverlay } from '../data/chargerSessionMvp.js'

const SAFEMAP_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SAFEMAP_API_BASE
    ? import.meta.env.VITE_SAFEMAP_API_BASE.replace(/\/$/, '')
    : 'https://www.safemap.go.kr'
const SAFEMAP_EV_LIST_PATH = '/openapi2/IF_0042'
const SAFEMAP_EV_LIST_URL = `${SAFEMAP_BASE}${SAFEMAP_EV_LIST_PATH}`

/** chger_ty 코드 → 한글 라벨 (기술 용어) */
export const CHGER_TY_LABELS = {
  1: 'DC차데모',
  2: 'AC완속',
  3: 'DC차데모+AC3상',
  4: 'DC콤보',
  5: 'DC차데모+DC콤보',
  6: 'DC차데모+AC3상+DC콤보',
  7: 'AC3상',
  8: 'DC콤보(완속)',
  9: 'NACS',
  10: 'DC콤보+NACS',
}

/** chger_ty 코드 → 사용자 용어 (급속/완속). AC·완속 계열=완속, DC·NACS 계열=급속. */
export const CHGER_TY_TO_SPEED = {
  1: '급속',   // DC차데모
  2: '완속',   // AC완속
  3: '급속',   // DC차데모+AC3상
  4: '급속',   // DC콤보
  5: '급속',   // DC차데모+DC콤보
  6: '급속',   // DC차데모+AC3상+DC콤보
  7: '완속',   // AC3상
  8: '완속',   // DC콤보(완속)
  9: '급속',   // NACS
  10: '급속',  // DC콤보+NACS
}

export function getChgerTyLabel(code) {
  const c = code != null ? String(code).trim() : ''
  return CHGER_TY_LABELS[c] ?? `타입${c || '?'}`
}

/** 코드 → 급속/완속. 미매핑은 '급속'으로 처리. */
export function getSpeedCategory(code) {
  const c = code != null ? String(code).trim() : ''
  return CHGER_TY_TO_SPEED[c] ?? '급속'
}

/** 사용자 표시용: "급속 (DC콤보)" 형태. */
export function getDisplayChgerLabel(code) {
  const label = getChgerTyLabel(code)
  const speed = getSpeedCategory(code)
  return `${speed} (${label})`
}

/** 충전기 상태(stat) 코드 → 한글 라벨. 공공 API 공통 코드 기준. */
export const STAT_LABELS = {
  1: '통신이상',
  2: '사용 가능',
  3: '사용 중',
  4: '운영중지',
  5: '점검중',
  9: '상태미확인',
}

export function getStatLabel(code) {
  const c = code != null ? String(code).trim() : ''
  return STAT_LABELS[c] ?? (c ? `상태${c}` : '—')
}

/**
 * stat 코드별 개수 객체에서 요약 문자열 생성.
 * @param {Record<string, number>} statCounts - { '2': 4, '3': 2, ... }
 * @param {string[]} order - 표시할 코드 순서(우선 노출할 것 먼저). 기본: 사용 가능(2), 사용 중(3), 점검중(5), 운영중지(4), 통신이상(1), 상태미확인(9)
 */
export function formatStatSummary(statCounts, order = ['2', '3', '5', '4', '1', '9']) {
  if (!statCounts || typeof statCounts !== 'object') return ''
  const parts = order
    .filter((code) => statCounts[code] > 0)
    .map((code) => `${getStatLabel(code)} ${statCounts[code]}`)
  return parts.join(' · ')
}

/** row 배열에서 stat 코드별 개수 집계. */
export function aggregateStatCounts(rows) {
  const counts = {}
  for (const r of rows || []) {
    const s = String(r.stat ?? '').trim()
    if (s) counts[s] = (counts[s] || 0) + 1
  }
  return counts
}

/** row 배열에서 가장 최근 statUpdDt (문자열 비교). */
export function getLatestStatUpdDt(rows) {
  const withDt = (rows || []).filter((r) => r.statUpdDt)
  if (!withDt.length) return ''
  withDt.sort((a, b) => String(b.statUpdDt || '').localeCompare(String(a.statUpdDt || '')))
  return withDt[0].statUpdDt
}

/** 그룹/단일 충전소에서 표시용 주소 후보 행 목록 */
function addressSourceRows(station) {
  if (!station) return []
  if (Array.isArray(station.rows) && station.rows.length) return station.rows
  return [station]
}

/**
 * 목록 한 줄용: 도로명 우선, 없으면 지번·기타 (행 순회).
 */
export function pickPrimaryAddress(station) {
  for (const r of addressSourceRows(station)) {
    const rn = (r.rnAdres || '').trim()
    if (rn) return rn
  }
  for (const r of addressSourceRows(station)) {
    const a = (r.adres || '').trim()
    if (a) return a
  }
  return ''
}

/**
 * 상세용: 행 순서대로 고유 주소 문자열 (지번·도로명 구분 없이 API 필드 순; 중복 문구 제거).
 */
export function formatAddressBlockLines(station) {
  const lines = []
  const seen = new Set()
  for (const r of addressSourceRows(station)) {
    for (const raw of [r.adres, r.rnAdres]) {
      const t = (raw || '').trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        lines.push(t)
      }
    }
  }
  return lines
}

/** stat=사용 중(3)일 때만 의미 있음. 원본에 명시된 값이 있을 때만 문자열 반환(추정 없음). */
export function formatChargerExplicitTime(row) {
  if (!row || String(row.stat).trim() !== '3') return null
  const raw = row.remainingMinutesRaw
  if (raw !== '' && raw != null) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return `약 ${n}분`
  }
  const end = (row.expectedEndAt || '').trim()
  if (end) return `종료 ${end}`
  return null
}

/** API가 명시한 충전 진행률(0~100)만. 없으면 null — 추정 금지. */
export function parseExplicitProgressPercent(row) {
  if (!row) return null
  const v = row.progressPercent
  if (v === '' || v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

/** 사용 중(3)이면서 남은 분 또는 종료 시각이 원본에 있을 때(세션 힌트). 진행률 없을 때 인디터미넛 바용. */
export function hasChargerExplicitSessionHint(row) {
  if (!row || String(row.stat).trim() !== '3') return false
  const raw = row.remainingMinutesRaw
  if (raw !== '' && raw != null) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return true
  }
  return !!(row.expectedEndAt || '').trim()
}

function parseExplicitPercent0to100(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

/**
 * 목표 충전량(100%) 대비 현재 도달 비율용. current·target 둘 다 API에 있을 때만 반환(추정 금지).
 * barValue = min(100, current/target*100) — 예: 40/80 → 50, 64/80 → 80.
 */
export function parseExplicitChargePercentPair(row) {
  if (!row) return null
  const current = parseExplicitPercent0to100(row.currentChargePercent)
  const target = parseExplicitPercent0to100(row.targetChargePercent)
  if (current == null || target == null) return null
  if (target <= 0) return null
  const barValue = Math.min(100, Math.max(0, (current / target) * 100))
  return { current, target, barValue }
}

/**
 * API 원본 항목을 앱에서 쓰는 형태로 정규화.
 * 좌표는 `safemapApiRowToLatLng`(x/y 투영·WGS84 필드 혼재)로 단일 정규화.
 */
function get(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  return ''
}

export function normalizeCharger(item, index) {
  if (!item || typeof item !== 'object') return null
  const converted = safemapApiRowToLatLng(item)
  if (!converted) {
    const rawX = item.x ?? item.X
    const rawY = item.y ?? item.Y
    console.warn(
      '[Safemap EV] 좌표 변환 실패, 마커 제외:',
      get(item, 'stat_nm', 'statNm', 'stat_id', 'statId') || index,
      { x: rawX, y: rawY, keys: import.meta.env.DEV ? Object.keys(item).slice(0, 24) : undefined },
    )
    return null
  }
  const chgerTyCode = get(item, 'chger_ty', 'chgerTy') || ''
  const chgerTyLabel = getChgerTyLabel(chgerTyCode)
  const base = {
    /** 데이터 출처 구분: UI는 표시하지 않으나 mock/API 구분·디버깅용 */
    dataSource: 'safemap',
    id: get(item, 'chger_id', 'chgerId', 'objt_id', 'objtId') || `ev-${index}`,
    statId: get(item, 'stat_id', 'statId'),
    statNm: get(item, 'stat_nm', 'statNm') || '이름 없음',
    chgerId: get(item, 'chger_id', 'chgerId'),
    /** API 원본 stat — `applyMvpChargerOverlay`에서 `apiStat`로 보존, UI용 `stat`은 MVP 시드값 */
    stat: get(item, 'stat'),
    statUpdDt: get(item, 'stat_upd_dt', 'statUpdDt'),
    chgerTy: chgerTyCode,
    chgerTyLabel,
    speedCategory: getSpeedCategory(chgerTyCode),
    displayChgerLabel: getDisplayChgerLabel(chgerTyCode),
    useTm: get(item, 'use_tm', 'useTm'),
    busiId: get(item, 'busi_id', 'busiId'),
    busiNm: get(item, 'busi_nm', 'busiNm') || '-',
    telno: get(item, 'telno'),
    /** 지번·기타 주소 (도로명은 rnAdres에만 — 과거에는 rn을 adres에 넣어 도로명이 중복·누락처럼 보일 수 있었음). API에 주소가 없으면 빈 값 — 역지오코딩은 별도 범위. */
    adres: get(
      item,
      'adres',
      'addr',
      'address',
      'stat_addr',
      'statAddr',
      'jibun_addr',
      'jibunAddr',
      'lot_addr',
      'lotAddr',
      'location',
      'daddr',
      'detail_addr',
      'detailAddr'
    ),
    rnAdres: get(item, 'rn_adres', 'rnAdres', 'road_addr', 'roadAddr', 'road_address', 'roadAddress', 'new_addr', 'newAddr'),
    chgerNm: get(item, 'chger_nm', 'chgerNm', 'chger_name', 'chgerName'),
    outputKw: get(
      item,
      'output',
      'output_kw',
      'outputKw',
      'chger_kw',
      'chgerKw',
      'chg_kw',
      'chgKw',
      'power',
      'eltv_spd',
      'eltvSpd',
      'chger_out_put',
      'chgerOutPut',
      'delng'
    ),
    /**
     * 진행률·잔여시간·종료예정 등「세션」성 필드는 공공데이터 row에 넣지 않는다(MVP 분리).
     * UI는 `src/data/chargerSessionMvp.js`의 getChargerSessionForUi 만 사용.
     */
    ctprvnCd: get(item, 'ctprvn_cd', 'ctprvnCd'),
    sggCd: get(item, 'sgg_cd', 'sggCd'),
    /** API에 있으면 필터·표시에 우선 사용 */
    ctprvnNm: get(item, 'ctprvn_nm', 'ctprvnNm'),
    sggNm: get(item, 'sgg_nm', 'sggNm'),
    emdCd: get(item, 'emd_cd', 'emdCd'),
    lat: converted.lat,
    lng: converted.lng,
  }
  return applyMvpChargerOverlay(base)
}

/**
 * 한 페이지 조회
 */
export async function fetchEvChargersPage({ pageNo = 1, numOfRows = 100 } = {}) {
  const key = import.meta.env.VITE_SAFEMAP_SERVICE_KEY
  if (!key) throw new Error('VITE_SAFEMAP_SERVICE_KEY가 설정되지 않았습니다. .env 또는 .env.local을 확인하세요.')
  const base = SAFEMAP_EV_LIST_URL.replace(/\?$/, '')
  const rest = new URLSearchParams({
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    returnType: 'json',
  }).toString()
  const url = `${base}?serviceKey=${encodeURIComponent(key)}&${rest}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Safemap API 오류: ${res.status} ${res.statusText}. ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data
}

/**
 * 응답에서 목록 배열 추출 (JSON 구조에 따라 유연하게)
 */
export function extractListFromResponse(data) {
  if (!data) return []
  const body = data.response?.body ?? data.body ?? data
  const items = body.items ?? body.item ?? (Array.isArray(body) ? body : [])
  const list = Array.isArray(items) ? items : items.item ? [].concat(items.item) : []
  return list
}

/**
 * 전체 데이터 로드 (페이지네이션 순회).
 * totalCount가 있으면 그만큼만, 없으면 1페이지만.
 */
export async function fetchEvChargers({ pageNo = 1, numOfRows = 100, maxPages = 50 } = {}) {
  const all = []
  let page = pageNo
  let totalCount = null

  while (page <= maxPages) {
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (import.meta.env.DEV && page === 1) {
      console.log('[Safemap EV] API 응답 구조(1페이지):', data)
    }
    const list = extractListFromResponse(data)
    const total = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (total != null) totalCount = Number(total)
    list.forEach((item, i) => {
      const normalized = normalizeCharger(item, all.length + i)
      if (normalized) all.push(normalized)
    })
    if (list.length < numOfRows) break
    if (totalCount != null && all.length >= totalCount) break
    page += 1
  }

  return { items: all, totalCount: totalCount ?? all.length }
}

/**
 * 페이지 단위 점진 로드: 첫 페이지 직후 콜백으로 UI를 먼저 열고, 이어서 순차 fetch.
 * 서버 bbox 미지원 시 전국 데이터는 결국 전부 받되, 체감 TTFB·첫 페인트를 줄인다.
 * @param {{ numOfRows?: number, maxPages?: number, signal?: AbortSignal, onPage?: (p: { batch: object[], pageIndex: number, isFirst: boolean, totalCount: number | null, isLast: boolean }) => void | Promise<void> }} opts
 */
export async function fetchEvChargersProgressive({
  numOfRows = 500,
  maxPages = 200,
  signal,
  onPage,
} = {}) {
  let page = 1
  let globalIndex = 0
  let reportedTotal = null

  while (page <= maxPages) {
    if (signal?.aborted) {
      return { aborted: true, loadedCount: globalIndex, totalCount: reportedTotal }
    }
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return { aborted: true, loadedCount: globalIndex, totalCount: reportedTotal }
    }
    const list = extractListFromResponse(data)
    const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalRaw != null) reportedTotal = Number(totalRaw)

    const batch = []
    for (let i = 0; i < list.length; i++) {
      const n = normalizeCharger(list[i], globalIndex + i)
      if (n) batch.push(n)
    }

    const shortPage = list.length < numOfRows
    const reachedTotal =
      reportedTotal != null && globalIndex + batch.length >= reportedTotal
    const isLast = shortPage || reachedTotal || page >= maxPages

    if (onPage) {
      await onPage({
        batch,
        pageIndex: page,
        isFirst: page === 1,
        totalCount: reportedTotal,
        isLast,
      })
    }

    globalIndex += batch.length
    if (isLast) break
    page += 1
  }

  return { aborted: false, loadedCount: globalIndex, totalCount: reportedTotal ?? globalIndex }
}

/**
 * 앱 부트스트랩: 1페이지만 받은 뒤 지도를 띄우고, 나머지는 백그라운드에서 이어 받는다.
 */
export async function fetchEvChargersFirstPageBatch({ numOfRows = 500, signal } = {}) {
  if (signal?.aborted) {
    return { aborted: true, batch: [], totalCount: null, isLast: true, loadedCount: 0 }
  }
  const data = await fetchEvChargersPage({ pageNo: 1, numOfRows })
  if (signal?.aborted) {
    return { aborted: true, batch: [], totalCount: null, isLast: true, loadedCount: 0 }
  }
  const list = extractListFromResponse(data)
  const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
  const reportedTotal = totalRaw != null ? Number(totalRaw) : null
  const batch = []
  for (let i = 0; i < list.length; i++) {
    const n = normalizeCharger(list[i], i)
    if (n) batch.push(n)
  }
  const shortPage = list.length < numOfRows
  const reachedTotal = reportedTotal != null && batch.length >= reportedTotal
  const isLast = shortPage || reachedTotal
  return {
    aborted: false,
    batch,
    totalCount: reportedTotal,
    isLast,
    loadedCount: batch.length,
  }
}

/**
 * 2페이지부터 순차 로드 (부트스트랩 1페이지 이후 전용).
 */
export async function fetchEvChargersProgressiveContinue({
  startPage = 2,
  initialGlobalIndex = 0,
  numOfRows = 500,
  maxPages = 200,
  signal,
  onPage,
  seedTotalCount = null,
} = {}) {
  let page = startPage
  let globalIndex = initialGlobalIndex
  let reportedTotal = seedTotalCount

  while (page <= maxPages) {
    if (signal?.aborted) {
      return { aborted: true, loadedCount: globalIndex, totalCount: reportedTotal }
    }
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return { aborted: true, loadedCount: globalIndex, totalCount: reportedTotal }
    }
    const list = extractListFromResponse(data)
    const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalRaw != null) reportedTotal = Number(totalRaw)

    const batch = []
    for (let i = 0; i < list.length; i++) {
      const n = normalizeCharger(list[i], globalIndex + i)
      if (n) batch.push(n)
    }

    const shortPage = list.length < numOfRows
    const reachedTotal =
      reportedTotal != null && globalIndex + batch.length >= reportedTotal
    const isLast = shortPage || reachedTotal || page >= maxPages

    if (onPage) {
      await onPage({
        batch,
        pageIndex: page,
        isFirst: false,
        totalCount: reportedTotal,
        isLast,
      })
    }

    globalIndex += batch.length
    if (isLast) break
    page += 1
  }

  return { aborted: false, loadedCount: globalIndex, totalCount: reportedTotal ?? globalIndex }
}
