/**
 * 실 API(Safemap) 경로에서 evPipeline 계측 캡처.
 *
 * 전제: `.env.local`에 VITE_SAFEMAP_SERVICE_KEY가 채워져 있거나, 동일 변수가 환경에 있어야 함.
 *
 * 사용:
 *   node scripts/real-evpipeline-capture.mjs
 *
 * 이미 Vite가 떠 있으면:
 *   EV_PIPELINE_URL=http://127.0.0.1:5173/ node scripts/real-evpipeline-capture.mjs --no-vite
 *
 * stdout: 수집 JSON
 * stderr: 요약 표 + mock-path 경고
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')

function readSafemapKey() {
  const fromEnv = (process.env.VITE_SAFEMAP_SERVICE_KEY || '').trim()
  if (fromEnv) return fromEnv
  try {
    const t = readFileSync(join(ROOT, '.env.local'), 'utf8')
    const m = t.match(/^VITE_SAFEMAP_SERVICE_KEY=(.*)$/m)
    if (!m) return ''
    return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    return ''
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const a = s.address()
      const p = typeof a === 'object' && a ? a.port : 0
      s.close(() => resolve(p))
    })
    s.on('error', reject)
  })
}

async function waitForHttp(url, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`서버 준비 타임아웃: ${url} (${timeoutMs}ms)`)
}

function payloadFromEntry(entry) {
  const a = entry?.args
  if (Array.isArray(a) && a.length >= 2 && typeof a[1] === 'object' && a[1] !== null) return a[1]
  return null
}

function summarize(collected) {
  const byPhase = { boot: {}, 'search-area': {} }
  const samples = { boot: null, 'search-area': null }

  for (const e of collected) {
    const p = payloadFromEntry(e)
    if (!p) continue
    if (e.text.includes('① fetch-done') && (p.phase === 'boot' || p.phase === 'search-area')) {
      byPhase[p.phase].fetch = { ...p }
    }
    if (e.text.includes('② react-pipeline') && (p.phase === 'boot' || p.phase === 'search-area')) {
      byPhase[p.phase].react = { ...p }
    }
    if (e.text.includes('③ first-marker-visible') && (p.phase === 'boot' || p.phase === 'search-area')) {
      byPhase[p.phase].first = { ...p }
    }
    if (e.text.includes('adapter-samples') && p.samples) {
      samples[p.phase] = p.samples
    }
  }

  return { byPhase, samples }
}

function isMockPath(collected) {
  for (const e of collected) {
    const p = payloadFromEntry(e)
    if (p?.note && String(p.note).toLowerCase().includes('mock')) return true
  }
  return false
}

function printStderrTable(summary) {
  const { byPhase, samples } = summary
  const rows = ['boot', 'search-area']
  const hdr =
    '| 단계 | fetchMs | rawRowsScanned | boundsInsideRows | adaptedValidCoords | groupedPlaces | renderableAfterCap | finalRenderedMarkers | markerWaitMs | fetchEndToFirstPaintMs | clickToFirstPaintMs |'
  const sep =
    '|------|---------|----------------|------------------|--------------------|---------------|--------------------|----------------------|--------------|-------------------------|---------------------|'

  console.error(hdr)
  console.error(sep)
  for (const phase of rows) {
    const f = byPhase[phase]?.fetch || {}
    const r = byPhase[phase]?.react || {}
    const m = byPhase[phase]?.first || {}
    const line = [
      phase,
      f.fetchMs ?? '—',
      f.rawRowsScanned ?? '—',
      r.boundsInsideRows ?? f.boundsInsideRows ?? '—',
      r.adaptedValidCoords ?? '—',
      r.groupedPlaces ?? '—',
      r.renderableAfterCap ?? '—',
      m.finalRenderedMarkers ?? r.finalRenderedMarkers ?? '—',
      m.markerWaitMs ?? '—',
      m.fetchEndToFirstPaintMs ?? '—',
      m.clickToFirstPaintMs ?? '—',
    ].join(' | ')
    console.error(`| ${line} |`)
  }

  console.error('\nadapter-samples (최대 5건/phase):\n')
  for (const phase of rows) {
    const s = samples[phase]
    console.error(`### ${phase}`)
    if (!s?.length) {
      console.error('(없음)\n')
      continue
    }
    for (let i = 0; i < s.length; i += 1) {
      const x = s[i]
      console.error(
        `${i + 1}. rawX=${x.rawX} rawY=${x.rawY} → lat=${x.adaptedLat} lng=${x.adaptedLng} valid=${x.valid} korea=${x.korea} boundsInside=${x.boundsInside}`,
      )
    }
    console.error('')
  }
}

async function runPlaywright(base) {
  const bootWaitMs = Number(process.env.EV_PIPELINE_BOOT_WAIT_MS || 120000)
  const afterSearchMs = Number(process.env.EV_PIPELINE_AFTER_SEARCH_MS || 20000)

  const collected = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  page.on('console', async (msg) => {
    const text = msg.text()
    if (!text.includes('[evPipeline]')) return
    const args = []
    for (const arg of msg.args()) {
      try {
        args.push(await arg.jsonValue())
      } catch {
        args.push(undefined)
      }
    }
    collected.push({ text, args })
  })

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(bootWaitMs)

  const map = page.locator('.leaflet-container').first()
  await map.waitFor({ state: 'visible', timeout: 60000 })
  const box = await map.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 50)
    await page.mouse.up()
  }
  await page.waitForTimeout(2500)

  const btn = page.getByRole('button', { name: '이 지역 검색' })
  await btn.waitFor({ state: 'visible', timeout: 30000 })
  await btn.click()
  await page.waitForTimeout(afterSearchMs)

  await browser.close()
  return collected
}

const noVite = process.argv.includes('--no-vite')

async function main() {
  const key = readSafemapKey()
  let base = process.env.EV_PIPELINE_URL || ''
  let viteChild = null

  if (!noVite) {
    if (!key) {
      console.error(
        '[evPipeline] VITE_SAFEMAP_SERVICE_KEY가 비어 있습니다. .env.local에 키를 넣거나 환경 변수로 설정한 뒤 다시 실행하세요.',
      )
      process.exit(1)
    }
    const port = await getFreePort()
    base = `http://127.0.0.1:${port}/`
    const viteCli = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
    const useDirectVite = existsSync(viteCli)
    const cmd = useDirectVite ? process.execPath : 'npx'
    const args = useDirectVite
      ? [viteCli, '--host', '127.0.0.1', '--strictPort', '--port', String(port)]
      : ['vite', '--host', '127.0.0.1', '--strictPort', '--port', String(port)]

    viteChild = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    viteChild.stderr?.on('data', (d) => process.stderr.write(d))
    viteChild.stdout?.on('data', (d) => process.stderr.write(d))
    await waitForHttp(base, 90000)
  } else {
    if (!base) {
      console.error('[evPipeline] --no-vite 사용 시 EV_PIPELINE_URL을 지정하세요.')
      process.exit(1)
    }
  }

  let collected
  try {
    collected = await runPlaywright(base)
  } finally {
    if (viteChild?.pid) {
      viteChild.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 1500))
      try {
        viteChild.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }

  if (isMockPath(collected)) {
    console.error(
      '\n[evPipeline] 경고: 로그에 mock 안내(note)가 포함되어 있습니다. 실 API 경로가 아닐 수 있습니다. 키·Vite 재시작·URL을 확인하세요.\n',
    )
  }

  const summary = summarize(collected)
  printStderrTable(summary)
  process.stdout.write(JSON.stringify(collected, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
