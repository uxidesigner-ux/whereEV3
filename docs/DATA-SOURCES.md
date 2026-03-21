# whereEV3 데이터 출처 (MVP)

## 설계 요약

| 레이어 | 역할 | 소스 |
|--------|------|------|
| **충전소/충전기 기본** | 이름, 주소, 운영기관, 전화, 이용시간, 좌표, 타입, 출력, `statUpdDt` 등 | 공공데이터(Safemap) `normalizeCharger` → `applyMvpChargerOverlay` → `dataSource: 'safemap'` |
| **로컬 목록 대체** | API 키 없음 + DEV만 | `getDevMockEvChargers()` 후 동일하게 `applyMvpChargerOverlay` → `dataSource: 'dev-mock'` |
| **표시용 충전기 상태** | 사용 가능 / 사용 중 / 점검중 (`row.stat`) | **MVP 시드 목업** — `chargerId`(·`statId`) 기준 결정적 분포(약 50% / 35% / 15%). 원본 코드는 `row.apiStat` |
| **충전 세션 (사용 중만)** | 현재·목표 충전율, 잔여 시간, 진행 바 | **`getChargerSessionForUi(row)`** — 동일 키로 결정적 생성. 공공 row 필드로 섞지 않음 |

UI는 **기본 row(실데이터 필드) + 표시용 `stat` + `getChargerSessionForUi`** 로 그린다. 실시간 세션 API가 생기면 `applyMvpChargerOverlay` / `getChargerSessionForUi`의 목업 분기만 교체하면 된다.

---

## 공공데이터(`normalizeCharger`)에 포함되는 것

`statNm`, `statId`, `chgerId`, `lat`, `lng`, API 원본 `stat`(→ 오버레이 후 `apiStat`), `statUpdDt`, `chgerTy` 및 파생 라벨, `outputKw`, `adres`, `rnAdres`, `useTm`, `busiNm`, `telno`, `chgerNm`, 행정코드, `dataSource: 'safemap'`.

오버레이 직후 UI용 **`stat`** 은 MVP 시뮬레이션 값이다.

**정규화 객체에 넣지 않는 것 (MVP에서 의도적 제외):**

- 세션성 필드는 row에 붙이지 않음. 사용 중일 때만 `getChargerSessionForUi`가 객체로 반환.

---

## MVP 시드 목업

- **상태 덮어쓰기:** `applyMvpChargerOverlay` (`src/data/chargerSessionMvp.js`) — 모든 `normalizeCharger` 결과·dev-mock 행에 적용.
- **키:** `chargerSessionLookupKey(row)` = `` `${statId}|${chgerId}` `` (둘 다 있을 때), 아니면 `row.id` (없으면 `id|unknown` 계열 fallback).
- **세션:** `getChargerSessionForUi` — `row.stat === '3'` 일 때만; 목표 80 또는 90%, 진행 바는 목표를 100%로 계산.
- **수동 오버라이드(테스트):** `chargerSessionMvp.js` 내부 `MVP_MOCK_SESSIONS_BY_KEY`(현재 비어 있음).

---

## 상세 UI 필드 대응

| UI | 데이터 출처 |
|----|-------------|
| 충전기명·타입·출력 | row (실데이터) |
| 상태 배지·필터·집계 | `row.stat` (MVP 시뮬레이션) |
| 진행 바, 현재%/목표% | `getChargerSessionForUi` → `parseExplicitChargePercentPair` |
| 약 N분 | `formatChargerExplicitTime` + 세션의 `remainingMinutesRaw` |
| 안내 문구 | 상세 본문 고정 카피(MVP 시뮬레이션 고지) |

---

## 관련 파일

- `src/api/safemapEv.js` — fetch, `normalizeCharger`(코어+오버레이), 상세·도구용 목록 API
- `src/api/evStationsSummary.js` — 스냅샷 JSON 로드·파싱·overlay 적용
- `src/api/evChargerNormalizeCore.js` — 빌드·스냅샷과 동일 스키마의 정규화(overlay 제외)
- `src/data/chargerSessionMvp.js` — 시드 상태·세션 + `getChargerSessionForUi`
- `src/dev/mockEvChargers.js` — DEV 목록 대체 + 오버레이
- `src/components/StationDetailContent.jsx` — row + 세션 합성·안내 문구
- `src/App.jsx` — 데이터 로드 분기

---

## 목록·지도 데이터 (whereEV3) — summary JSON 스냅샷

- **런타임:** 앱은 IF_0042를 **전 페이지 순회하지 않는다.** 부팅 시 **`/data/ev-stations-summary.json`**(정적 파일)을 **1회 로드**하고, `parseEvStationsSummaryJson` → 정적 `rows`에 `applyMvpChargerOverlay`만 적용한 뒤 `fullEvCatalogRef`에 보관한다.
- **뷰포트:** `filterNormalizedRowsToBounds`로 **현재 지도 bounds**에 들어가는 충전기 행만 `items`로 올린다. **이 지역 검색·검색 fit·칩**도 동일하게 **메모리 summary에서만** 재필터링한다(목록용 IF_0042 재호출 없음).
- **배치 생성:** `npm run build:ev-summary` → `scripts/build-ev-stations-summary.mjs`가 서비스 키로 IF_0042 전 페이지 수집·`normalizeChargerCore`(overlay 제외)·한국·`id` 중복 제거·`placeKey` 단위로 `places[]`를 만들어 `public/data/ev-stations-summary.json`에 쓴다. 배포 전 또는 cron으로 주기 갱신(예: 일 1회). **운영·CI·크기 점검:** [`docs/EV-SUMMARY-OPS.md`](./EV-SUMMARY-OPS.md).
- **상태값:** 스냅샷 JSON에는 API 원본 `stat`만 두고, UI용 `stat`/`apiStat`는 기존과 같이 **`applyMvpChargerOverlay`**(MVP 시드)로 런타임 합성.
- **DEV:** summary 로드 실패 또는 **빈 `places`** 이면 `getDevMockEvChargers()`로 대체. 프로덕션은 빈 JSON이면 빈 지도(오류는 네트워크/404 시).
- **상세 패널:** `fetchDetailRowsForStatId` 등 **statId 단위 IF_0042 조회**는 서비스 키가 있을 때만 유지(목록과 분리).
- **레거시:** `fetchEvChargersFullCatalog`·`evCatalogIdb`는 스크립트/참고용으로 남을 수 있으나 **앱 부트 경로에서는 사용하지 않는다.** `fetchEvChargersSummaryForBounds`(`evViewportSummary.js`)는 진단·도구용.
- **프로덕 계측:** `?evPipeline=1` — 콘솔 `[evPipeline] ①②③`·`adapter-samples` 및 화면 하단 `EvPipelineDebugPanel`.
- **DEV 계측:** 콘솔 `[evViewportSummary]` 로그 및 `viewportSummaryMetrics`(abort/stale/적용 횟수) — `src/dev/viewportSummaryTelemetry.js`.
- **좌표:** Safemap 목록의 `x`/`y`는 Web Mercator(EPSG:3857) 미터 값인 경우가 많다. `safemapApiRowToLatLng`(`src/utils/coordTransform.js`)에서 WGS84 `lat`/`lng`로만 정규화한 뒤 `normalizeCharger`가 지도·bounds에 넘긴다. `?evDiag=pipeline`으로 페이지별 raw/normalize/bounds 통과 개수, `?evDiag=raw20`으로 `items` 좌표를 클러스터 없이 빨간 점으로 확인할 수 있다.
- **시트·KPI:** `filteredItems` → `appliedMapBounds` 기준 `itemsInScope` → 목록 그룹 파이프라인은 **로드된 `items` 전체** 기준(변경 없음).
