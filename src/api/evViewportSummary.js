/**
 * Safemap EV 목록 API는 bbox 쿼리를 지원하지 않음.
 * 페이지 단위로 받은 뒤 클라이언트에서 viewport(bounds) 안만 누적하는 임시 summary 계층.
 * @see docs — 향후 서버에 bbox/summary 전용 API가 생기면 이 모듈만 교체하면 됨.
 */

import L from 'leaflet'
import {
  fetchEvChargersPage,
  normalizeCharger,
  extractListFromResponse,
} from './safemapEv.js'

/** @param {import('./safemapEv.js').BoundsLiteral | null | undefined} bounds */
export function literalBoundsContains(bounds, lat, lng) {
  if (!bounds?.southWest || !bounds?.northEast) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  try {
    return L.latLngBounds(
      [bounds.southWest.lat, bounds.southWest.lng],
      [bounds.northEast.lat, bounds.northEast.lng],
    ).contains([lat, lng])
  } catch {
    return false
  }
}

/**
 * @param {{ southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} boundsLiteral
 * @param {{
 *   numOfRows?: number
 *   maxPages?: number
 *   maxRowsInBounds?: number
 *   signal?: AbortSignal
 * }} [opts]
 * @returns {Promise<{ rows: object[], pagesScanned: number, truncated: boolean, totalReported: number | null }>}
 */
export async function fetchEvChargersSummaryForBounds(boundsLiteral, opts = {}) {
  const numOfRows = opts.numOfRows ?? 500
  const maxPages = opts.maxPages ?? 18
  const maxRowsInBounds = opts.maxRowsInBounds ?? 4000
  const signal = opts.signal

  const inBounds = []
  const seenId = new Set()
  let pagesScanned = 0
  let truncated = false
  let totalReported = null

  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) {
      return { rows: inBounds, pagesScanned, truncated: true, totalReported }
    }
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return { rows: inBounds, pagesScanned, truncated: true, totalReported }
    }
    const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalRaw != null) totalReported = Number(totalRaw)

    const list = extractListFromResponse(data)
    pagesScanned = page

    for (let i = 0; i < list.length; i += 1) {
      const n = normalizeCharger(list[i], inBounds.length + i)
      if (!n) continue
      if (!literalBoundsContains(boundsLiteral, n.lat, n.lng)) continue
      if (seenId.has(n.id)) continue
      seenId.add(n.id)
      inBounds.push(n)
      if (inBounds.length >= maxRowsInBounds) {
        truncated = true
        return { rows: inBounds, pagesScanned, truncated, totalReported }
      }
    }

    const shortPage = list.length < numOfRows
    const reachedTotal = totalReported != null && page * numOfRows >= totalReported
    if (shortPage || reachedTotal) {
      truncated = false
      break
    }
  }

  return { rows: inBounds, pagesScanned, truncated, totalReported }
}

/**
 * dev mock: bounds 안 행만 (비어 있으면 일부 샘플 유지해 지도가 텅 비지 않게)
 * @param {object[]} mockRows
 * @param {object} boundsLiteral
 */
export function filterDevMockRowsToBounds(mockRows, boundsLiteral) {
  const hit = (mockRows || []).filter((r) =>
    literalBoundsContains(boundsLiteral, Number(r.lat), Number(r.lng)),
  )
  if (hit.length > 0) return hit
  return (mockRows || []).slice(0, Math.min(6, mockRows.length))
}
