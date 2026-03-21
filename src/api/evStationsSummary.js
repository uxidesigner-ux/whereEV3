/**
 * 배치 생성 `public/data/ev-stations-summary.json` 로드·파싱.
 * 정적 rows에 런타임에서만 `applyMvpChargerOverlay` 적용.
 */
import { applyMvpChargerOverlay } from '../data/chargerSessionMvp.js'
import { placeKey } from '../utils/geo.js'

export const EV_STATIONS_SUMMARY_PATH = '/data/ev-stations-summary.json'

/**
 * 요약 JSON URL. `VITE_EV_STATIONS_SUMMARY_URL`이 있으면 그 절대 URL을 쓴다 (외부 정적 호스팅 등).
 * 그때는 `vercel.json` CSP의 `connect-src`에 해당 호스트를 추가해야 fetch가 막히지 않는다.
 * @param {string} [baseUrl] Vite `import.meta.env.BASE_URL`
 */
export function resolveEvStationsSummaryUrl(baseUrl = import.meta.env.BASE_URL || '/') {
  const custom = String(import.meta.env.VITE_EV_STATIONS_SUMMARY_URL || '').trim()
  if (custom) return custom
  const base = String(baseUrl || '/')
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}data/ev-stations-summary.json`
}

/** @param {object} row */
function stripPriorMvpOverlay(row) {
  if (!row || typeof row !== 'object') return row
  const rest = { ...row }
  delete rest.apiStat
  return rest
}

/**
 * JSON에 이미 overlay가 들어간 예전 파일 호환: 제거 후 재적용.
 * @param {object[]} rows
 */
export function applyMvpOverlayToSummaryRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((r) => applyMvpChargerOverlay(stripPriorMvpOverlay(r)))
}

/**
 * @param {object} json
 * @returns {{ meta: object, generatedAt?: string, schemaVersion: number, places: object[], allStaticRows: object[], allRowsWithOverlay: object[] }}
 */
export function parseEvStationsSummaryJson(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('summary JSON 형식이 올바르지 않습니다.')
  }
  const schemaVersion = Number(json.schemaVersion) || 1
  let places = json.places

  if (!Array.isArray(places) && Array.isArray(json.rows)) {
    const byPlace = new Map()
    for (const r of json.rows) {
      const k = placeKey(r)
      if (!byPlace.has(k)) byPlace.set(k, [])
      byPlace.get(k).push(r)
    }
    places = Array.from(byPlace.entries()).map(([placeId, rows]) => ({
      placeId,
      stationName: rows[0]?.statNm,
      lat: rows[0]?.lat,
      lng: rows[0]?.lng,
      rows,
    }))
  }

  if (!Array.isArray(places)) {
    throw new Error('summary에 places(또는 rows) 배열이 없습니다.')
  }

  const allStaticRows = places.flatMap((p) => (Array.isArray(p.rows) ? p.rows : []))
  const allRowsWithOverlay = applyMvpOverlayToSummaryRows(allStaticRows)

  return {
    meta: json.meta && typeof json.meta === 'object' ? json.meta : {},
    generatedAt: json.generatedAt,
    schemaVersion,
    places,
    allStaticRows,
    allRowsWithOverlay,
  }
}

/** 게이트웨이/엣지 타임아웃 등 간헐 오류 — 짧은 대기 후 재시도 */
const SUMMARY_RETRYABLE_STATUS = new Set([502, 503, 504])

function summaryUrlWithoutQuery(url) {
  const s = String(url || '')
  const i = s.search(/[?#]/)
  return i === -1 ? s : s.slice(0, i)
}

/**
 * @param {{ url?: string, signal?: AbortSignal, cache?: RequestCache, maxAttempts?: number }} [opts]
 * - `maxAttempts`: 502/503/504 시 재시도 횟수(기본 2). 재시도 시 쿼리 제거·`no-store`로 엣지 캐시 꼬임 완화.
 */
export async function fetchEvStationsSummaryDataset(opts = {}) {
  const rawUrl = opts.url ?? resolveEvStationsSummaryUrl(import.meta.env.BASE_URL)
  const baseNoQuery = summaryUrlWithoutQuery(rawUrl)
  const signal = opts.signal
  const maxAttempts = Math.min(4, Math.max(1, opts.maxAttempts ?? 2))
  const firstCache = opts.cache ?? 'default'

  let lastStatus = 0
  let lastRes = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delayMs = 450 + attempt * 200
      await new Promise((r) => setTimeout(r, delayMs))
      if (signal?.aborted) {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }
    }

    const useUrl = attempt === 0 ? rawUrl : baseNoQuery
    const useCache = attempt > 0 ? 'no-store' : firstCache

    const res = await fetch(useUrl, { signal, cache: useCache })
    lastRes = res
    lastStatus = res.status

    if (res.ok) {
      const text = await res.text()
      if (text.startsWith('version https://git-lfs.github.com/spec/v1')) {
        throw new Error(
          '요약 JSON 대신 Git LFS 포인터만 받았습니다. Vercel이면 Project Settings → Git에서 Git LFS를 켜고 재배포하세요. 로컬이면 git lfs checkout public/data/ev-stations-summary.json 후 다시 빌드하세요.'
        )
      }
      let json
      try {
        json = JSON.parse(text)
      } catch (e) {
        const hint = text.length < 200 ? text.slice(0, 120) : ''
        throw new Error(
          hint
            ? `summary JSON 파싱 실패: ${e.message} (응답 앞부분: ${hint.replace(/\s+/g, ' ')})`
            : `summary JSON 파싱 실패: ${e.message}`
        )
      }
      return parseEvStationsSummaryJson(json)
    }

    const retryable = SUMMARY_RETRYABLE_STATUS.has(res.status)
    if (retryable && attempt < maxAttempts - 1) {
      try {
        await res.arrayBuffer()
      } catch {
        /* 본문 소비 실패는 무시 */
      }
      continue
    }
    break
  }

  const st = lastStatus || (lastRes ? lastRes.status : 0)
  if (SUMMARY_RETRYABLE_STATUS.has(st)) {
    throw new Error(
      `충전소 요약 데이터를 불러오지 못했습니다. (서버가 잠시 응답하지 않습니다. ${st} — 대용량 JSON 요청이 타임아웃된 경우가 많습니다. 잠시 후 새로고침하거나 다시 시도해 주세요.)`,
    )
  }
  throw new Error(`충전소 요약 데이터를 불러오지 못했습니다. (${st})`)
}
