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

- `src/api/safemapEv.js` — fetch, `normalizeCharger`, `applyMvpChargerOverlay` 호출
- `src/data/chargerSessionMvp.js` — 시드 상태·세션 + `getChargerSessionForUi`
- `src/dev/mockEvChargers.js` — DEV 목록 대체 + 오버레이
- `src/components/StationDetailContent.jsx` — row + 세션 합성·안내 문구
- `src/App.jsx` — 데이터 로드 분기

---

## 목록 fetch·지도 표시 (whereEV3)

- **Safemap:** 공간(bbox) 쿼리 없이 **페이지네이션만** 지원. 전국 데이터는 페이지 순서대로만 적재 가능.
- **`fetchEvChargers`:** 한 번에 끝까지 순회(새로고침·상세 동기 등에 사용).
- **`fetchEvChargersProgressive`:** 첫 페이지 적재 직후 UI `loading` 해제 → 이후 페이지는 백그라운드에서 `setItems` 누적. 언마운트 시 `AbortSignal`로 이후 요청 중단.
- **지도 클러스터:** 현재 **디바운스된 지도 bounds + 패딩** 안에 있는 충전소만 마커로 올려 연산량을 줄임(서버는 여전히 전국 페이지를 받되, 클라이언트 표시는 뷰포트 중심).
- **`fetchEvChargersSummaryForBounds` + `VIEWPORT_SUMMARY_FETCH_PRESETS`:** 부트/새로고침(`boot`)은 페이지 스캔 상한을 조금 더 크게, **이 지역 검색·칩·검색 fit** 등 사용자 입력(`interactive`)은 상한을 낮춰 응답을 빠르게 한다. API가 bbox를 지원하지 않는 한 일부 뷰포트에서 행이 덜 잡힐 수 있다.
- **DEV 계측:** 콘솔 `[evViewportSummary]` 로그 및 `viewportSummaryMetrics`(abort/stale/적용 횟수) — `src/dev/viewportSummaryTelemetry.js`.
- **좌표:** Safemap 목록의 `x`/`y`는 Web Mercator(EPSG:3857) 미터 값인 경우가 많다. `safemapApiRowToLatLng`(`src/utils/coordTransform.js`)에서 WGS84 `lat`/`lng`로만 정규화한 뒤 `normalizeCharger`가 지도·bounds에 넘긴다. `?evDiag=pipeline`으로 페이지별 raw/normalize/bounds 통과 개수, `?evDiag=raw20`으로 `items` 좌표를 클러스터 없이 빨간 점으로 확인할 수 있다.
- **시트·KPI:** `filteredItems` → `appliedMapBounds` 기준 `itemsInScope` → 목록 그룹 파이프라인은 **로드된 `items` 전체** 기준(변경 없음).
