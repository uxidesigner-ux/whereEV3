#!/usr/bin/env node
/**
 * IF_0042 전 페이지 수집 → 장소 단위 summary JSON (public/data/ev-stations-summary.json).
 * 사용: VITE_SAFEMAP_SERVICE_KEY 또는 SAFEMAP_SERVICE_KEY(CI 별칭), .env.local / 환경변수.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { normalizeChargerCore } from '../src/api/evChargerNormalizeCore.js'
import {
  aggregateStatCounts,
  formatStatSummary,
  getLatestStatUpdDt,
  pickPrimaryAddress,
} from '../src/api/safemapEv.js'
import { isLatLngRoughlyKorea } from '../src/utils/coordTransform.js'
import { placeKey, formatListSummary, pickShortLocationHint, summarizeSpeedCategories } from '../src/utils/geo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_PATH = join(ROOT, 'public', 'data', 'ev-stations-summary.json')

const NUM_OF_ROWS = 500
const MAX_PAGES = 2500
const MAX_RETRIES = 4
const BASE_DELAY_MS = 900

function loadDotEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    try {
      const text = readFileSync(join(ROOT, name), 'utf8')
      for (const line of text.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq <= 0) continue
        const k = t.slice(0, eq).trim()
        let v = t.slice(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!process.env[k]) process.env[k] = v
      }
    } catch {
      /* 없음 */
    }
  }
}

function extractListFromResponse(data) {
  if (!data) return []
  const body = data.response?.body ?? data.body ?? data
  const items = body.items ?? body.item ?? (Array.isArray(body) ? body : [])
  const list = Array.isArray(items) ? items : items.item ? [].concat(items.item) : []
  return list
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function serviceKey() {
  return (process.env.VITE_SAFEMAP_SERVICE_KEY || process.env.SAFEMAP_SERVICE_KEY || '').trim()
}

async function fetchPage(pageNo) {
  const key = serviceKey()
  if (!key) {
    throw new Error(
      'VITE_SAFEMAP_SERVICE_KEY(또는 CI용 SAFEMAP_SERVICE_KEY)가 없습니다. .env.local 또는 환경변수를 설정하세요.',
    )
  }
  const apiBase = (process.env.VITE_SAFEMAP_API_BASE || 'https://www.safemap.go.kr').replace(/\/$/, '')
  const qs = new URLSearchParams({
    serviceKey: key,
    pageNo: String(pageNo),
    numOfRows: String(NUM_OF_ROWS),
    returnType: 'json',
  })
  const url = `${apiBase}/openapi2/IF_0042?${qs.toString()}`

  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url)
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`)
      }
      return JSON.parse(text)
    } catch (e) {
      lastErr = e
      const wait = BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 400)
      console.warn(`[build-ev-summary] page ${pageNo} 시도 ${attempt + 1}/${MAX_RETRIES} 실패, ${wait}ms 후 재시도:`, e.message)
      await sleep(wait)
    }
  }
  throw lastErr
}

function buildPlaceRecord(placeId, rows, generatedAt) {
  const first = rows[0]
  const statCounts = aggregateStatCounts(rows)
  const stationIds = [...new Set(rows.map((r) => String(r.statId ?? '').trim()).filter(Boolean))]
  const parts = [
    first.statNm,
    first.busiNm,
    first.adres,
    first.rnAdres,
    first.ctprvnNm,
    first.sggNm,
    stationIds.join(' '),
  ]
  const searchableText = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)

  const regionSummary = [first.ctprvnNm, first.sggNm].filter(Boolean).join(' ').trim()

  return {
    placeId,
    stationIds,
    stationName: first.statNm,
    lat: first.lat,
    lng: first.lng,
    addressSummary: pickPrimaryAddress({ rows }),
    regionSummary: regionSummary || undefined,
    chargerCount: rows.length,
    chargerTypesSummary: formatListSummary(
      rows.map((r) => r.displayChgerLabel ?? r.chgerTyLabel),
      3,
    ),
    operatorSummary: formatListSummary(
      rows.map((r) => r.busiNm),
      2,
    ),
    statSummary: formatStatSummary(statCounts),
    latestStatUpdDt: getLatestStatUpdDt(rows),
    speedBadge: summarizeSpeedCategories(rows),
    locationHint: pickShortLocationHint(rows, first),
    searchableText,
    dataSource: 'safemap-if0042',
    updatedAt: generatedAt,
    rows,
  }
}

async function main() {
  loadDotEnvFiles()

  const generatedAt = new Date().toISOString()
  let totalRawRows = 0
  let coordReject = 0
  let koreaReject = 0
  const byId = new Map()
  let page = 1
  let totalReported = null

  console.info('[build-ev-summary] IF_0042 수집 시작 (numOfRows=%d)', NUM_OF_ROWS)

  while (page <= MAX_PAGES) {
    const data = await fetchPage(page)
    const totalRaw = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalRaw != null) totalReported = Number(totalRaw)

    const list = extractListFromResponse(data)
    totalRawRows += list.length

    const baseIndex = byId.size
    for (let i = 0; i < list.length; i += 1) {
      const n = normalizeChargerCore(list[i], baseIndex + i)
      if (!n) {
        coordReject += 1
        continue
      }
      if (!isLatLngRoughlyKorea(n.lat, n.lng)) {
        koreaReject += 1
        continue
      }
      if (!n.id || byId.has(n.id)) continue
      byId.set(n.id, n)
    }

    let estPages = null
    if (totalReported != null && totalReported > 0) {
      estPages = Math.max(1, Math.ceil(totalReported / NUM_OF_ROWS))
    }
    console.info(
      '[build-ev-summary] page %d/%s 고유충전기 %d (이번 페이지 raw %d)',
      page,
      estPages != null ? String(estPages) : '?',
      byId.size,
      list.length,
    )

    const shortPage = list.length < NUM_OF_ROWS
    const reachedTotal = totalReported != null && page * NUM_OF_ROWS >= totalReported
    if (shortPage || reachedTotal) break
    page += 1
  }

  const normalizedRows = [...byId.values()]
  const placeMap = new Map()
  for (const row of normalizedRows) {
    const k = placeKey(row)
    if (!placeMap.has(k)) placeMap.set(k, [])
    placeMap.get(k).push(row)
  }

  const places = Array.from(placeMap.entries()).map(([pid, rows]) => buildPlaceRecord(pid, rows, generatedAt))

  const payload = {
    schemaVersion: 1,
    generatedAt,
    meta: {
      generatedAt,
      totalRawRows,
      totalNormalizedRows: normalizedRows.length,
      totalPlaces: places.length,
      schemaVersion: 1,
      dataSource: 'safemap-if0042',
      coordRejectCount: coordReject,
      koreaFilteredCount: koreaReject,
      pagesScanned: page,
      totalReported,
    },
    places,
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`, 'utf8')
  const { size } = statSync(OUT_PATH)
  const fileSizeMb = (size / (1024 * 1024)).toFixed(3)

  console.info(
    '[build-ev-summary] 완료 → %s (places=%d, chargers=%d, file=%s MB)',
    OUT_PATH,
    places.length,
    normalizedRows.length,
    fileSizeMb,
  )
  console.info('[build-ev-summary] meta (검증용):')
  console.info(
    JSON.stringify(
      {
        generatedAt: payload.meta.generatedAt,
        schemaVersion: payload.meta.schemaVersion,
        totalRawRows: payload.meta.totalRawRows,
        totalNormalizedRows: payload.meta.totalNormalizedRows,
        totalPlaces: payload.meta.totalPlaces,
        coordRejectCount: payload.meta.coordRejectCount,
        koreaFilteredCount: payload.meta.koreaFilteredCount,
        pagesScanned: payload.meta.pagesScanned,
        totalReported: payload.meta.totalReported,
        fileSizeBytes: size,
        fileSizeMb: Number(fileSizeMb),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error('[build-ev-summary] 실패:', e)
  process.exit(1)
})
