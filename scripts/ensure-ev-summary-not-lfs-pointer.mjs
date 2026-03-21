/**
 * 빌드 시 public/data/ev-stations-summary.json 이 Git LFS 포인터면
 * dist에 포인터가 복사되어 런타임 JSON 파싱이 깨진다.
 * 로컬: git lfs checkout 시도 후에도 포인터면 실패.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const path = join(root, 'public', 'data', 'ev-stations-summary.json')

const LFS_PREFIX = 'version https://git-lfs.github.com/spec/v1'

function isPointer(buf) {
  const head = buf.toString('utf8', 0, Math.min(buf.length, 160)).trimStart()
  return head.startsWith(LFS_PREFIX)
}

if (!existsSync(path)) {
  console.warn('[ensure-ev-summary] skip: file missing', path)
  process.exit(0)
}

let buf = readFileSync(path)
if (!isPointer(buf)) process.exit(0)

console.error('[ensure-ev-summary] ev-stations-summary.json is a Git LFS pointer, not real JSON.')
if (process.env.VERCEL) {
  console.error(
    '[ensure-ev-summary] Vercel: Project Settings → Git → "Git Large File Storage (LFS)" 를 켜고 다시 배포하세요. ' +
      '(빌드에 git lfs pull 을 넣으면 missing protocol 오류가 날 수 있어 제거함.)'
  )
  console.error('  https://vercel.com/docs/project-configuration/git-settings')
  process.exit(1)
}

const r = spawnSync('git', ['lfs', 'checkout', 'public/data/ev-stations-summary.json'], {
  cwd: root,
  stdio: 'inherit',
})
if (r.status !== 0) {
  console.error('[ensure-ev-summary] git lfs checkout failed. Install Git LFS and run: git lfs install && git lfs pull')
  process.exit(1)
}

buf = readFileSync(path)
if (isPointer(buf)) {
  console.error('[ensure-ev-summary] still a pointer after checkout. Run: git lfs pull')
  process.exit(1)
}

console.log('[ensure-ev-summary] replaced LFS pointer with real file.')
