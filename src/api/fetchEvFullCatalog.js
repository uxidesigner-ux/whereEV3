/**
 * Safemap IF_0042 전역 목록을 페이지 끝까지 수집(중복 id 제거).
 * bbox API가 없으므로 전국 순회 후 클라이언트에서 뷰포트 필터링한다.
 */

import {
  fetchEvChargersPage,
  normalizeCharger,
  extractListFromResponse,
} from './safemapEv.js'

export const FULL_CATALOG_NUM_OF_ROWS = 500
/** totalCount 미확인 시에도 상한 방지 */
export const FULL_CATALOG_MAX_PAGES = 2000

/**
 * @param {{
 *   signal?: AbortSignal
 *   numOfRows?: number
 *   maxPages?: number
 *   onProgress?: (p: {
 *     pageIndex: number
 *     estimatedTotalPages: number | null
 *     normalizedUniqueCount: number
 *     rawPageRows: number
 *   }) => void
 * }} [opts]
 */
export async function fetchEvChargersFullCatalog(opts = {}) {
  const numOfRows = opts.numOfRows ?? FULL_CATALOG_NUM_OF_ROWS
  const maxPages = opts.maxPages ?? FULL_CATALOG_MAX_PAGES
  const signal = opts.signal
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null

  const byId = new Map()
  let page = 1
  let totalReported = null

  while (page <= maxPages) {
    if (signal?.aborted) {
      return {
        aborted: true,
        items: [...byId.values()],
        pagesScanned: page - 1,
        totalReported,
        normalizedUniqueCount: byId.size,
      }
    }

    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return {
        aborted: true,
        items: [...byId.values()],
        pagesScanned: page - 1,
        totalReported,
        normalizedUniqueCount: byId.size,
      }
    }

    const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalRaw != null) totalReported = Number(totalRaw)

    const list = extractListFromResponse(data)
    const baseIndex = byId.size
    for (let i = 0; i < list.length; i += 1) {
      const n = normalizeCharger(list[i], baseIndex + i)
      if (!n?.id) continue
      if (!byId.has(n.id)) byId.set(n.id, n)
    }

    let estimatedTotalPages = null
    if (totalReported != null && totalReported > 0) {
      estimatedTotalPages = Math.max(1, Math.ceil(totalReported / numOfRows))
    }

    if (onProgress) {
      onProgress({
        pageIndex: page,
        estimatedTotalPages,
        normalizedUniqueCount: byId.size,
        rawPageRows: list.length,
      })
    }

    const shortPage = list.length < numOfRows
    const reachedTotal = totalReported != null && page * numOfRows >= totalReported
    if (shortPage || reachedTotal) break
    page += 1
  }

  return {
    aborted: false,
    items: [...byId.values()],
    pagesScanned: page,
    totalReported,
    normalizedUniqueCount: byId.size,
  }
}
