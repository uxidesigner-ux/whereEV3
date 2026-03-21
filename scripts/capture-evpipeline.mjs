/**
 * dev 서버(5173) 가정. 콘솔 [evPipeline] 로그를 JSON으로 stdout에 출력.
 */
import { chromium } from 'playwright'

const BASE = process.env.EV_PIPELINE_URL || 'http://127.0.0.1:5173/'

async function main() {
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

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(18000)

  const map = page.locator('.leaflet-container').first()
  await map.waitFor({ state: 'visible', timeout: 30000 })
  const box = await map.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 50)
    await page.mouse.up()
  }
  await page.waitForTimeout(2000)

  const btn = page.getByRole('button', { name: '이 지역 검색' })
  await btn.waitFor({ state: 'visible', timeout: 20000 })
  await btn.click()
  await page.waitForTimeout(8000)

  await browser.close()
  process.stdout.write(JSON.stringify(collected, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
