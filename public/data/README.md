# `public/data`

## `ev-stations-summary.json`

- **저장소에 포함**한다 (앱과 같이 배포). 대용량이면 **Git LFS** (`.gitattributes`) — `git lfs install` 후 clone/커밋.
- **갱신**: `npm run build:ev-summary`(실데이터) 또는 `npm run seed:ev-summary`(시드) 후 커밋.
- **빌드**: `npm run build`만 하면 Vite가 `public/`을 그대로 복사해 `/data/ev-stations-summary.json`으로 서빙된다.
- **선택**: 외부 URL에서만 받아 빌드하려면 `EV_SUMMARY_DOWNLOAD_URL` + `npm run build:deploy` (`scripts/fetch-ev-summary-for-build.mjs`).

자세한 절차: `docs/EV-SUMMARY-OPS.md`
