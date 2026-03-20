# whereEV3 데이터 출처 (MVP)

## 설계 요약

| 레이어 | 역할 | 소스 |
|--------|------|------|
| **충전소/충전기 기본** | 목록·지도·상세의 이름, 주소, 타입, 출력, stat, 좌표 등 | 공공데이터(Safemap) `normalizeCharger` → `dataSource: 'safemap'` |
| **로컬 목록 대체** | API 키 없음 + DEV만 | `getDevMockEvChargers()` → `dataSource: 'dev-mock'` (동일 필드 형태, 표시용 플레이스홀더) |
| **충전 세션 (고급)** | 사용 중(stat=3)일 때만 진행률·현재/목표 %·잔여시간·종료예정 | **`src/data/chargerSessionMvp.js` 전용** — 공공 row에 필드로 섞지 않음 |

UI는 **기본 row + `getChargerSessionForUi(row)`** 를 합쳐 그린다. 실시간 세션 API가 생기면 `getChargerSessionForUi` 안의 목업 분기만 API 결과로 바꾸면 된다.

---

## 공공데이터(`normalizeCharger`)에 포함되는 것

`statNm`, `statId`, `chgerId`, `lat`, `lng`, `stat`, `statUpdDt`, `chgerTy` 및 파생 라벨, `outputKw`, `adres`, `rnAdres`, `useTm`, `busiNm`, `telno`, `chgerNm`, 행정코드, `dataSource: 'safemap'`.

**포함하지 않는 것 (MVP에서 의도적 제외):**

- `remainingMinutesRaw`, `expectedEndAt`, `currentChargePercent`, `targetChargePercent`, `progressPercent`  
  → 응답에 비슷한 키가 있어도 **정규화 객체에 넣지 않음**. 세션은 전부 `chargerSessionMvp.js` 또는 향후 세션 API.

---

## 세션 목업 매핑

- **함수:** `getChargerSessionForUi(row)` (`src/data/chargerSessionMvp.js`)
- **조건:** `row.stat === '3'` 일 때만 조회; 없으면 `null` → 진행 바·잔여시간 UI 없음(「사용 중」만).
- **키:** `chargerSessionLookupKey(row)` = `` `${statId}|${chgerId}` `` (둘 다 있을 때), 아니면 `row.id`.

실데이터 충전기에 시연 세션을 붙이려면 `MVP_MOCK_SESSIONS_BY_KEY`에 동일 형식으로 키를 추가한다.

---

## 상세 UI 필드 대응

| UI | 데이터 출처 |
|----|-------------|
| 충전기명·타입·출력·상태 배지 | row (공공/로컬 목록) |
| 진행 바, 현재%/목표% | `getChargerSessionForUi` → `parseExplicitChargePercentPair` |
| 약 N분 / 종료 시각 | 동일 세션 → `formatChargerExplicitTime` |
| 사용 가능·점검중 카드 | row만 (세션 없음) |

---

## 관련 파일

- `src/api/safemapEv.js` — fetch, `normalizeCharger`
- `src/data/chargerSessionMvp.js` — MVP 세션 목업 + `getChargerSessionForUi`
- `src/dev/mockEvChargers.js` — DEV 목록 대체
- `src/components/StationDetailContent.jsx` — row + 세션 합성
- `src/App.jsx` — 데이터 로드 분기
