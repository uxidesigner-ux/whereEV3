/**
 * 배치 생성 `public/data/ev-stations-summary.json` 로드·파싱.
 * 정적 rows에 런타임에서만 `applyMvpChargerOverlay` 적용.
 */
import { applyMvpChargerOverlay } from '../data/chargerSessionMvp.js'
import { placeKey } from '../utils/geo.js'

export const EV_STATIONS_SUMMARY_PATH = '/data/ev-stations-summary.json'

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

/**
 * @param {{ url?: string, signal?: AbortSignal }} [opts]
 */
export async function fetchEvStationsSummaryDataset(opts = {}) {
  const url = opts.url ?? EV_STATIONS_SUMMARY_PATH
  const res = await fetch(url, { signal: opts.signal })
  if (!res.ok) {
    throw new Error(`충전소 요약 데이터를 불러오지 못했습니다. (${res.status})`)
  }
  const text = await res.text()
  if (text.startsWith('version https://git-lfs.github.com/spec/v1')) {
    throw new Error(
      '요약 JSON 대신 Git LFS 포인터만 받았습니다. 배포 빌드에 git lfs pull이 필요하거나, 로컬에서 git lfs checkout public/data/ev-stations-summary.json 후 다시 빌드하세요.'
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
