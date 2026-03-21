#!/usr/bin/env node
/**
 * 생활안전지도 포털·API에서 복사/저장한 JSON → 앱용 ev-stations-summary.json 변환.
 * API 호출 없음(키·한도 불필요).
 *
 * 사용:
 *   1) 복사한 내용을 예: tmp/seoul.json 파일로 저장
 *   2) npm run import:ev-summary -- tmp/seoul.json
 *   3) 기본 출력: public/data/ev-stations-summary.json
 *
 * 출력 경로 지정:
 *   node scripts/import-safemap-json-to-summary.mjs tmp/seoul.json public/data/ev-stations-summary.json
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { normalizeChargerCore } from '../src/api/evChargerNormalizeCore.js'
import {
  extractListFromResponse,
  aggregateStatCounts,
  formatStatSummary,
  getLatestStatUpdDt,
  pickPrimaryAddress,
} from '../src/api/safemapEv.js'
import { isLatLngRoughlyKorea } from '../src/utils/coordTransform.js'
import { placeKey, formatListSummary, pickShortLocationHint, summarizeSpeedCategories } from '../src/utils/geo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DEFAULT_OUT = join(ROOT, 'public', 'data', 'ev-stations-summary.json')

function looksLikeChargerRow(o) {
  if (!o || typeof o !== 'object') return false
  const hasStation = !!(o.stat_id ?? o.statId ?? o.stat_nm ?? o.statNm)
  const hasCoord = o.x != null || o.X != null || o.lat != null || o.LAT != null
  return hasStation && hasCoord
}

/** IF_0042 응답·body·items 배열·단일 row 등 흔한 형태에서 목록 추출 */
function rawListFromImportedJson(data) {
  if (Array.isArray(data)) return data
  const fromApi = extractListFromResponse(data)
  if (fromApi.length > 0) return fromApi
  if (data && typeof data === 'object') {
    const b = data.response?.body ?? data.body
    if (b?.items?.item != null) {
      const it = b.items.item
      return Array.isArray(it) ? it : [it]
    }
    if (looksLikeChargerRow(data)) return [data]
  }
  return []
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
    dataSource: 'safemap-json-import',
    updatedAt: generatedAt,
    rows,
  }
}

function parseArgs() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const input = args[0]
  const output = args[1] || DEFAULT_OUT
  return { input, output }
}

function main() {
  const { input, output } = parseArgs()
  if (!input) {
    console.error(
      '사용법: node scripts/import-safemap-json-to-summary.mjs <입력.json> [출력.json]\n' +
        '예: npm run import:ev-summary -- ./tmp/seoul-safemap.json',
    )
    process.exit(1)
  }

  let data
  try {
    const text = readFileSync(input, 'utf8')
    data = JSON.parse(text)
  } catch (e) {
    console.error('[import-ev-summary] 입력 파일 읽기/JSON 파싱 실패:', input, e.message)
    process.exit(1)
  }

  const list = rawListFromImportedJson(data)
  if (list.length === 0) {
    console.error(
      '[import-ev-summary] 충전소 row를 찾지 못했습니다. IF_0042 전체 응답 JSON 또는 body.items 배열 형태인지 확인하세요.',
    )
    process.exit(1)
  }

  let coordReject = 0
  let koreaReject = 0
  const byId = new Map()
  for (let i = 0; i < list.length; i += 1) {
    const n = normalizeChargerCore(list[i], i)
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

  const normalizedRows = [...byId.values()]
  const placeMap = new Map()
  for (const row of normalizedRows) {
    const k = placeKey(row)
    if (!placeMap.has(k)) placeMap.set(k, [])
    placeMap.get(k).push(row)
  }

  const generatedAt = new Date().toISOString()
  const places = Array.from(placeMap.entries()).map(([pid, rows]) => buildPlaceRecord(pid, rows, generatedAt))

  const payload = {
    schemaVersion: 1,
    generatedAt,
    meta: {
      generatedAt,
      totalRawRows: list.length,
      totalNormalizedRows: normalizedRows.length,
      totalPlaces: places.length,
      schemaVersion: 1,
      dataSource: 'safemap-json-import',
      coordRejectCount: coordReject,
      koreaFilteredCount: koreaReject,
      note: '포털/파일에서 가져온 일부 데이터일 수 있음. 전국 커버는 npm run build:ev-summary',
    },
    places,
  }

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(payload)}\n`, 'utf8')
  const { size } = statSync(output)
  console.info(
    '[import-ev-summary] 완료 →',
    output,
    '| raw',
    list.length,
    '→ normalized',
    normalizedRows.length,
    '→ places',
    places.length,
    '|',
    (size / 1024).toFixed(1),
    'KB',
  )
}

main()
