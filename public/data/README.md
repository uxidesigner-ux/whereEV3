# `public/data`

## `ev-stations-summary.json`

- **저장소에 포함**한다 (앱과 같이 배포). 대용량이면 **Git LFS** (`.gitattributes`).
  - **맥에서 `git: 'lfs' is not a git command`이면** LFS가 없는 것이다. 먼저 설치: `brew install git-lfs`, 그다음 `git lfs install`. 그 후에만 `git add` / `git commit` (미설치 상태로 커밋하면 100MB 초과로 GitHub 푸시가 거절된다).
  - 클론 후 작업 트리에 포인터만 보이면: `git lfs pull` 또는 `git lfs checkout`.
- **갱신**: `npm run build:ev-summary`(실데이터) 또는 `npm run seed:ev-summary`(시드) 후 커밋.
- **빌드**: `npm run build`만 하면 Vite가 `public/`을 그대로 복사해 `/data/ev-stations-summary.json`으로 서빙된다.
- **선택**: 외부 URL에서만 받아 빌드하려면 `EV_SUMMARY_DOWNLOAD_URL` + `npm run build:deploy` (`scripts/fetch-ev-summary-for-build.mjs`).

**Vercel:** 대시보드에서 Git LFS를 켜야 배포 빌드에 실 JSON이 포함된다. ([Git settings](https://vercel.com/docs/project-configuration/git-settings))

자세한 절차: `docs/EV-SUMMARY-OPS.md`
