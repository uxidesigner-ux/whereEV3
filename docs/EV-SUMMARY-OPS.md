# EV summary JSON 운영·배포 가이드

구조 전환 후 **실데이터 스냅샷**으로 운영 검증을 할 때의 절차와 정책을 정리한다.  
현재 단계: **구조 검증 완료** → **real summary 생성·배포 후** 수동 QA로 “운영 준비”를 판단한다.

## 채택 정책: `ev-stations-summary.json`을 저장소에 포함

| 항목 | 내용 |
|------|------|
| **저장소** | `public/data/ev-stations-summary.json`을 **커밋**해 앱과 함께 배포한다. |
| **용량** | 전국 스냅샷은 수백 MB일 수 있어 **Git LFS**로 추적한다 (`.gitattributes`). [Git LFS 설치](https://git-lfs.com) 후 **`git lfs install`을 반드시 실행**한 뒤 `git add`한다. LFS 없이 커밋하면 일반 Git blob이 되어 GitHub가 **100MB 초과**로 푸시를 거절한다. macOS: `brew install git-lfs` → `git lfs install`. |
| **프론트 빌드** | 별도 URL 불필요. **`npm run build`** 시 `prebuild`로 LFS 포인터 여부를 검사·로컬에서는 `git lfs checkout` 시도한다. |
| **Vercel** | [Project Settings → Git](https://vercel.com/docs/project-configuration/git-settings)에서 **Git Large File Storage (LFS)** 를 **켜야** 클론 시 실파일이 내려온다. 끄면 포인터만 있어 런타임 JSON 오류가 난다. 빌드 커맨드에 `git lfs pull` 을 넣지 말 것 — Vercel 환경에서 `missing protocol: ""` 로 실패할 수 있다. |
| **갱신** | 로컬에서 `npm run build:ev-summary` 후 JSON을 커밋하거나, CI `ev-summary` 아티팩트를 받아 덮어쓴 뒤 커밋. |
| **선택** | 외부 URL만 쓰고 싶다면 예전처럼 `EV_SUMMARY_DOWNLOAD_URL` + `npm run build:deploy` + `scripts/fetch-ev-summary-for-build.mjs` 경로도 유지 가능. |

---

## 0. 포털에서 복사한 JSON만 있을 때 (서울 등 지역)

API 한도 초과이거나 키 없이, 생활안전지도에서 **복사·다운로드한 IF_0042 형태 JSON**만 있는 경우:

1. 내용을 프로젝트 안 아무 경로에 저장 (예: `tmp/seoul.json`).
2. 실행:
   ```bash
   npm run import:ev-summary -- tmp/seoul.json
   ```
3. 기본으로 `public/data/ev-stations-summary.json`이 **덮어써짐**. 다른 경로로 쓰려면:
   ```bash
   node scripts/import-safemap-json-to-summary.mjs tmp/seoul.json public/data/ev-stations-summary.json
   ```

**주의:** 서울만 넣었으면 **서울(또는 해당 데이터 범위)에만** 마커가 있고, 나머지 지역은 비어 보입니다. 전국은 `build:ev-summary`로 다시 생성해야 합니다.

`.env.local`에는 **키만** 넣습니다. JSON 본문은 파일로 저장하는 방식이 맞습니다.

---

## 1. 실데이터 summary 생성 (로컬)

1. `.env.local`에 `VITE_SAFEMAP_SERVICE_KEY` 설정 (`.env.local.example` 참고).
2. 실행:
   ```bash
   npm run build:ev-summary
   ```
3. 터미널에 출력되는 **`[build-ev-summary] meta (검증용)`** 블록을 확인한다.

| 필드 | 의미 |
|------|------|
| `generatedAt` | 스냅샷 생성 시각(ISO) |
| `schemaVersion` | 스키마 버전(앱과 불일치 시 로더 확장 필요) |
| `totalRawRows` | API에서 읽은 raw 행 누적(페이지 합) |
| `totalNormalizedRows` | 좌표 정규화·중복 제거 후 충전기 수 |
| `totalPlaces` | `placeKey` 기준 장소 수 |
| `coordRejectCount` | 좌표 변환 실패 |
| `koreaFilteredCount` | 한국 범위 밖으로 제외 |
| `pagesScanned` | IF_0042 페이지 수 |
| `totalReported` | API `totalCount`(있을 때) |
| `fileSizeBytes` / `fileSizeMb` | 산출물 크기 |

CI에서는 동일 키를 **`SAFEMAP_SERVICE_KEY`** 시크릿으로 둘 수 있다(빌드 스크립트가 `VITE_SAFEMAP_SERVICE_KEY`와 병용).

---

## 2. 배포 후 수동 검증 (실제 브라우저)

real summary를 `public/data/ev-stations-summary.json`에 반영해 배포한 뒤 아래를 확인한다.

- **광화문(또는 서울 중심)**: 줌 적정 수준에서 마커/클러스터가 **기대만큼** 보이는지(빈 지도·극소수만 있으면 스냅샷·필터 이슈 의심).
- **내 위치**: 허용 후 주변 마커가 **즉시** 갱신되는지(추가 IF_0042 목록 호출 없음).
- **이 지역 검색**: 버튼 후 **로딩이 짧고** bounds 안 마커만 바뀌는지.
- **추천 검색어/프리셋**: 지도 이동 후 목록·마커가 **바로** 맞는지.
- **클러스터**: 단일은 번개 마커, 다수는 **숫자 배지**가 정상인지.

(자동 E2E는 별도 도구 범위; 위는 MVP 운영 검증 최소 체크리스트.)

---

## 3. 파일 크기·파싱

```bash
npm run inspect:ev-summary
```

출력: 파일 크기(MB), `JSON.parse` 소요 시간(ms), gzip 시 예상 크기, meta와 `places` 내 실제 `rows` 합 일치 여부.

- **기본 경고**: 약 **8MB 이상**이면 rows 분리·필드 축소·지역별 분할 등을 검토.
- **전송**: 정적 호스팅이면 **gzip/brotli**는 CDN/서버 설정으로 처리(클라이언트는 여전히 전체 파싱).
- **rows 분리**가 필요해지면 예: `ev-stations-summary.meta.json` + `ev-stations-rows.json`(또는 청크) 로더 분기는 후속 작업으로 설계.

---

## 4. CI/CD 정리

### GitHub Actions

- 워크플로: `.github/workflows/ev-summary.yml`
- **트리거**: `workflow_dispatch`(수동), 선택적으로 `schedule`(예: 매일)
- **시크릿**: `VITE_SAFEMAP_SERVICE_KEY` 또는 `SAFEMAP_SERVICE_KEY` 중 하나 설정
- **성공 시**: 아티팩트 `ev-stations-summary.json` 업로드 → 릴리스/배포 단계에서 `public/data`에 복사하거나, 별도 배포 파이프라인에서 주입

### 생성 실패 시 배포 정책 (권장)

| 정책 | 설명 |
|------|------|
| **엄격** | summary 빌드 실패 시 **프론트 배포 중단** — 잘못된/빈 데이터 노출 방지 |
| **완화** | 이전 성공 아티팩트를 **캐시**해 재사용; 그마저 없으면 실패 |
| **비권장** | 실패해도 빈 JSON으로 배포(운영 사고) |

### `generatedAt` / `schemaVersion`

- `generatedAt`: 스냅샷 신선도 판단·디버깅(앱은 MVP에서 필수 사용 아님).
- `schemaVersion`: 로더(`evStationsSummary.js`)와 불일치 시 파싱 실패 → **버전 올릴 때 앱과 스크립트 동시 배포** 권장.

---

## 5. 로컬·배포 요약

1. 스냅샷 갱신: `npm run build:ev-summary` → `npm run inspect:ev-summary` → `public/data/ev-stations-summary.json` **커밋·푸시** (LFS).
2. 또는 Actions `ev-summary` 아티팄트로 받은 파일을 같은 경로에 두고 커밋.
3. Vercel 등: **`npm run build`** 기본값이면 됨. `EV_SUMMARY_DOWNLOAD_URL`은 설정하지 않아도 된다.
4. 배포 후 **섹션 2** 체크리스트.

실키가 없는 클론만 있는 환경에서는 `build:ev-summary`로는 생성할 수 없다. 키는 **Secrets / `.env.local`만** 쓰고 커밋하지 않는다.

### `.env.local` / GitHub

- `.env.local`은 **`.gitignore`**.
- summary **생성** 워크플로는 **`secrets.*`만** 사용한다. 생성된 JSON은 **LFS로 저장소에 포함**한다.
