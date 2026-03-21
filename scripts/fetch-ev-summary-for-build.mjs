#!/usr/bin/env node
/**
 * 배포 빌드 전에 `public/data/ev-stations-summary.json` 을 준비한다.
 * Git에는 summary를 두지 않는 정책일 때 사용.
 *
 * 우선순위:
 * 1) EV_SUMMARY_DOWNLOAD_URL 이 있으면 해당 URL에서 다운로드(HTTP 200 + JSON)
 * 2) 없으면 이미 `public/data/ev-stations-summary.json` 이 있으면 그대로 통과
 * 3) 둘 다 없으면 종료 코드 1 (Vercel 등에서 빌드 실패 → 잘못된 배포 방지)
 *
 * Vercel 예: Environment Variables 에 EV_SUMMARY_DOWNLOAD_URL 만 설정
 * (R2/S3 공개 URL, 또는 내부 아티팩트 프록시 URL)
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data', 'ev-stations-summary.json')

const url = (process.env.EV_SUMMARY_DOWNLOAD_URL || '').trim()

async function main() {
  if (url) {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.error('[fetch-ev-summary] 다운로드 실패:', res.status, res.statusText, url.slice(0, 80))
      process.exit(1)
    }
    const text = await res.text()
    try {
      JSON.parse(text)
    } catch {
      console.error('[fetch-ev-summary] 응답이 JSON이 아닙니다.')
      process.exit(1)
    }
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
    console.info('[fetch-ev-summary] 저장 완료:', OUT, `(${Math.round(text.length / 1024 / 1024)} MB approx)`)
    return
  }

  if (existsSync(OUT)) {
    console.info('[fetch-ev-summary] 기존 파일 사용:', OUT)
    return
  }

  console.error(
    '[fetch-ev-summary] public/data/ev-stations-summary.json 이 없습니다.\n' +
      '  - 로컬: npm run build:ev-summary 또는 npm run seed:ev-summary\n' +
      '  - 배포: EV_SUMMARY_DOWNLOAD_URL 에 스냅샷 URL 설정 후 다시 빌드',
  )
  process.exit(1)
}

main().catch((e) => {
  console.error('[fetch-ev-summary]', e)
  process.exit(1)
})
