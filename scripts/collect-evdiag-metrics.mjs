/**
 * dev 서버가 떠 있다고 가정하고, 각 evDiag URL에서 콘솔 로그를 수집해 JSON으로 출력.
 *
 * 사용: npm run dev -- --host 127.0.0.1 --port 5173
 *       EVDIAG_RUNS=5 npm run diag:metrics
 *
 * 환경변수:
 *   VITE_DEV_URL   기본 http://127.0.0.1:5173
 *   EVDIAG_RUNS    케이스당 반복 횟수(기본 3). 1이면 중앙값 없이 단일 샘플만.
 */
import { chromium } from 'playwright'

const BASE = process.env.VITE_DEV_URL || 'http://127.0.0.1:5173'
const RUNS_PER_CASE = Math.max(1, parseInt(process.env.EVDIAG_RUNS || '3', 10) || 1)

const CASES = [
  'hard1',
  'hard10def',
  'hard10custom',
  'track,freeze1500',
  'track,noDefer',
  'track,light',
  'nobounds1500',
]

const MEDIAN_KEYS = [
  'mapReady_ms',
  'mapReady_to_first1_markerIcon_ms',
  'first1_rel_ms',
  'first5_rel_ms',
  'first10_rel_ms',
  'first20_rel_ms',
  'first40_rel_ms',
  'max_marker_icons_observed',
  'boot_overlayOff_ms',
  'groupedBase_compute_max',
  'mapLayer_ref_change_max',
  'ids20_changed_events',
  'evLayer_mount_max',
  'evLayer_unmount_count',
  'icon_divIcon_resolves_at_overlay',
]

function medianOf(nums) {
  const a = nums.filter((x) => x != null && Number.isFinite(Number(x))).map(Number).sort((x, y) => x - y)
  if (a.length === 0) return null
  const mid = Math.floor(a.length / 2)
  if (a.length % 2 === 1) return a[mid]
  return (a[mid - 1] + a[mid]) / 2
}

function roundReportable(k, v) {
  if (v == null || !Number.isFinite(v)) return v
  if (k === 'boot_overlayOff_ms' || String(k).includes('_ms')) return Math.round(v * 100) / 100
  if (Number.isInteger(v)) return v
  return Math.round(v * 100) / 100
}

function medianRow(samples) {
  const out = {}
  for (const k of MEDIAN_KEYS) {
    const m = medianOf(samples.map((s) => s[k]))
    out[k] = roundReportable(k, m)
  }
  return out
}

function parseLogs(lines) {
  const text = lines.join('\n')

  const pick = (re) => {
    const m = text.match(re)
    return m ? m[1] ?? m[0] : null
  }

  const pickAll = (re) => {
    const out = []
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m
    while ((m = r.exec(text)) !== null) out.push(m[1] ?? m[0])
    return out
  }

  /** [whereEV3-map] +123.45ms first N marker icons in DOM (count=…) */
  const firstAppN = (n) => {
    const re = new RegExp(
      `\\+(\\d+(?:\\.\\d+)?)ms first ${n} marker icons in DOM \\(count=\\d+\\)`,
      'g',
    )
    const ms = []
    let m
    while ((m = re.exec(text)) !== null) ms.push(parseFloat(m[1]))
    return ms.length ? Math.min(...ms) : null
  }

  const mapReadyMs = (() => {
    const re = /\[whereEV3-map\] \+(\d+(?:\.\d+)?)ms map ready/g
    let best = null
    let m
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat(m[1])
      if (best == null || v < best) best = v
    }
    return best
  })()

  const firstHarnessN = (n) => {
    const re = new RegExp(`first ${n} marker-icon DOM \\+(\\d+(?:\\.\\d+)?)ms`, 'g')
    const ms = []
    let m
    while ((m = re.exec(text)) !== null) ms.push(parseFloat(m[1]))
    return ms.length ? Math.min(...ms) : null
  }

  const firstNRel = (n) => firstAppN(n) ?? firstHarnessN(n)

  const maxIconsObserved = (() => {
    const re = /marker icons in DOM \(count=(\d+)\)/g
    let max = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const v = parseInt(m[1], 10)
      if (v > max) max = v
    }
    return max || null
  })()

  const mapReadyToFirst1 =
    mapReadyMs != null && firstAppN(1) != null ? Math.round((firstAppN(1) - mapReadyMs) * 100) / 100 : null

  const overlay =
    pick(/boot→overlayOff:\s*([\d.]+)\s*ms/i) ||
    pick(/boot→overlayOff:\s*([\d.]+)ms/i) ||
    pick(/boot→overlayOff[:\s]+([\d.]+)/i)

  const groupedMax = pickAll(/groupedAllStationsForMapBase compute #(\d+)/g).map(Number)
  const groupedCount = groupedMax.length ? Math.max(...groupedMax) : null

  const refMax = pickAll(/mapLayerStations\[] ref #(\d+)/g).map(Number)
  const refChanges = refMax.length ? Math.max(...refMax) : null

  const idChangeLines = [...text.matchAll(/mapLayerStations\[] ref #\d+[^\n]*ids20eq=(true|false)/g)]
  const ids20ChangeCount = idChangeLines.filter((x) => x[1] === 'false').length

  const mountNums = pickAll(/\[evDiag\] EvStationMapLayer mount\s+(\d+)/g).map(Number)
  const mountMax = mountNums.length ? Math.max(...mountNums) : null
  const unmounts = (text.match(/\[evDiag\] EvStationMapLayer unmount/g) || []).length

  let iconResolves =
    pick(/iconResolves:\s*(\d+)/) ||
    pick(/iconResolves:\s*(\d+)\s*[,}]/) ||
    pick(/"iconResolves":\s*(\d+)/)
  if (iconResolves == null) {
    const m = text.match(/diag@overlayOff[^\n]*\{[^}]*iconResolves:\s*(\d+)/)
    if (m) iconResolves = m[1]
  }

  return {
    mapReady_ms: mapReadyMs,
    mapReady_to_first1_markerIcon_ms: mapReadyToFirst1,
    first1_rel_ms: firstNRel(1),
    first5_rel_ms: firstNRel(5),
    first10_rel_ms: firstNRel(10),
    first20_rel_ms: firstNRel(20),
    first40_rel_ms: firstNRel(40),
    max_marker_icons_observed: maxIconsObserved,
    boot_overlayOff_ms: overlay ? parseFloat(overlay) : null,
    groupedBase_compute_max: groupedCount,
    mapLayer_ref_change_max: refChanges,
    ids20_changed_events: idChangeLines.length ? ids20ChangeCount : null,
    evLayer_mount_max: mountMax,
    evLayer_unmount_count: unmounts || null,
    icon_divIcon_resolves_at_overlay: iconResolves != null ? parseInt(iconResolves, 10) : null,
  }
}

async function runCaseOnce(evDiag) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    geolocation: { latitude: 37.5665, longitude: 126.978 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const lines = []
  page.on('console', (msg) => {
    lines.push(`[${msg.type()}] ${msg.text()}`)
  })
  const url = `${BASE}/?evDiag=${encodeURIComponent(evDiag)}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(32000)
  } catch (e) {
    lines.push(`[error] ${e.message}`)
  }
  await browser.close()
  const metrics = parseLogs(lines)
  return { url, ...metrics, rawLineCount: lines.length }
}

async function runCase(evDiag) {
  const samples = []
  for (let i = 0; i < RUNS_PER_CASE; i += 1) {
    console.error(`Running ${evDiag} (${i + 1}/${RUNS_PER_CASE})...`)
    samples.push(await runCaseOnce(evDiag))
  }
  const base = { evDiag, url: samples[0]?.url }
  if (RUNS_PER_CASE === 1) {
    return { ...base, ...samples[0], runs: 1 }
  }
  return {
    ...base,
    runs: RUNS_PER_CASE,
    median: medianRow(samples),
    samples,
  }
}

async function main() {
  const results = []
  for (const c of CASES) {
    results.push(await runCase(c))
  }
  console.log(
    JSON.stringify(
      {
        meta: {
          baseUrl: BASE,
          runsPerCase: RUNS_PER_CASE,
          note: 'median은 숫자 필드만; null 샘플은 제외',
        },
        results,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
