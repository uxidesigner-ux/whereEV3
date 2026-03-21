/**
 * 상세 시트용: 동일 statId(충전소) 충전기 행을 API 목록에서 모은다.
 * Safemap에 단일 충전소 detail 엔드포인트가 없어, 목록 페이지를 순회하는 임시 계층.
 * 같은 place(statId) 재요청은 메모리 캐시로 막는다.
 */

import { fetchEvChargersPage, normalizeCharger, extractListFromResponse } from './safemapEv.js'

/** @type {Map<string, object[]>} statId → flat rows */
const rowsByStatIdCache = new Map()

function mergeRowsById(existing, incoming) {
  const byId = new Map()
  for (const r of existing || []) {
    if (r?.id != null) byId.set(String(r.id), r)
  }
  for (const r of incoming || []) {
    if (r?.id != null) byId.set(String(r.id), r)
  }
  return [...byId.values()]
}

/**
 * @param {{ statId: string, seedRows?: object[], maxPages?: number, signal?: AbortSignal }} opts
 * @returns {Promise<object[]>}
 */
export async function fetchDetailRowsForStatId(opts) {
  const statId = opts.statId != null ? String(opts.statId).trim() : ''
  if (!statId) return opts.seedRows || []

  const cached = rowsByStatIdCache.get(statId)
  if (cached && cached.length > 0) {
    return mergeRowsById(cached, opts.seedRows)
  }

  const maxPages = opts.maxPages ?? 24
  const signal = opts.signal
  let collected = [...(opts.seedRows || [])]
  const seenChger = new Set(collected.map((r) => String(r.id)))

  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) break
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows: 500 })
    if (signal?.aborted) break
    const list = extractListFromResponse(data)
    let added = 0
    for (let i = 0; i < list.length; i += 1) {
      const n = normalizeCharger(list[i], collected.length + i)
      if (!n) continue
      if (String(n.statId || '').trim() !== statId) continue
      const id = String(n.id)
      if (seenChger.has(id)) continue
      seenChger.add(id)
      collected.push(n)
      added += 1
    }
    if (list.length < 500) break
    if (added === 0 && page > 2) break
  }

  rowsByStatIdCache.set(statId, collected)
  return collected
}

export function clearDetailRowsCache() {
  rowsByStatIdCache.clear()
}

export function primeDetailRowsCache(statId, rows) {
  const s = statId != null ? String(statId).trim() : ''
  if (!s || !rows?.length) return
  rowsByStatIdCache.set(s, mergeRowsById(rowsByStatIdCache.get(s) || [], rows))
}
