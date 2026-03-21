# `public/data`

## `ev-stations-summary.json`

- **Git에 올리지 않습니다** (`.gitignore`). 팀 정책: **CI 아티팩트·객체 스토리지 URL**이 원본.
- **로컬**: `npm run build:ev-summary`(실데이터) 또는 `npm run seed:ev-summary`(시드).
- **프로덕션(Vercel 등)**: 환경변수 `EV_SUMMARY_DOWNLOAD_URL`에 JSON URL 지정 → **`npm run build:deploy`** (`fetch` + `vite build`). `vercel.json`의 `buildCommand`가 이걸 가리킴.
- URL 없이 로컬에만 파일이 있으면 `build:deploy`는 기존 파일을 그대로 쓴다.

자세한 절차: `docs/EV-SUMMARY-OPS.md`
