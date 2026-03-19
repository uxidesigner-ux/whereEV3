# whereEV2 모바일 1차 구현 확정 사양

`docs/mobile-first-restructure-v1.md` 방향을 기준으로, **코드 착수 전 확정**한 1차 구현 명세. 추상 제안이 아니라 바로 개발에 쓸 수 있는 수준으로 고정한다.

---

## 1. 1차 구현 확정 사양

### 1.1 모바일 첫 진입 시 기본 상태

| 항목 | 확정 내용 |
|------|-----------|
| **지도 중심 위치** | 기존과 동일. **SEOUL_CENTER [37.5665, 126.978], zoom 11** 로 초기화. 사용자가 "현재 위치" 버튼을 누르기 전에는 서울 중심 유지. |
| **Bottom sheet collapsed 시 보여줄 핵심 정보** | **userLocation 없을 때**: "**현재 지도 영역 · N곳**" (filteredItems.length 기준). **userLocation 있을 때**: "**내 주변 충전소 · N곳**". 시트를 열면 목록이 있다는 것을 전달. |
| **첫 5초 안에 할 대표 행동 1개** | **"시트를 위로 스와이프하여 열기"** 또는 **헤더 탭하여 시트 열기**. 열면 바로 "빠른 필터 chip + 충전소 목록"이 보이므로, 첫 행동 = 시트 열기로 확정. |

### 1.2 충전소 목록 구조

| 항목 | 확정 내용 |
|------|-----------|
| **목록 아이템에 보여줄 정보** | **1줄: 충전소명(statNm)**. **2줄: 운영기관(busiNm) · 충전기 타입(chgerTyLabel)**. **3줄(선택): 거리** — userLocation 있으면 "약 1.2km" 형태, 없으면 생략. 주소·전화·이용시간은 목록에는 넣지 않고 상세에서만 표시. |
| **기본 정렬 기준** | **userLocation 있으면: 내 위치 기준 거리순**. **userLocation 없으면: 현재 지도 중심 기준 거리순**. 둘 다 "가까운 순"으로 통일. |
| **userLocation 없을 때 대체 정렬** | 지도 중심 좌표(초기값 SEOUL_CENTER, 이후 map.getCenter()) 기준으로 각 충전소와의 거리 계산 후 정렬. |
| **목록 탭 시 지도/상세 동기화** | **(1) 목록 아이템 탭** → 해당 충전소 **지도에서 포커스**: map.setView([lat, lng], 16) 또는 flyTo. **(2) 동시에** 해당 충전소 **상세 모달 열기**. 마커 클릭 시 Popup은 "요약 1~2줄 + [상세 보기] 버튼"만 표시, [상세 보기] 탭 시 같은 상세 모달 열기. **선택된 충전소**는 state 하나(selectedStation)로 관리. |

### 1.3 빠른 필터 1차 범위

| 항목 | 확정 내용 |
|------|-----------|
| **1차에서 반드시 노출할 필터** | **(1) 충전기 타입**: 기존 `filterChgerTy` 사용. chip 다중 선택. **(2) 정렬 chip**: "**가까운 순**" 또는 "**내 위치 기준**" — 반경 필터가 아니라 **정렬 기준**을 나타냄. userLocation 있으면 "내 위치 기준(가까운 순)", 없으면 "지도 중심 기준(가까운 순)"으로 동작. |
| **"더 보기"로 미룰 필터** | **운영기관(busiNm), 시도(ctprvnCd), 시군구(sggCd)**. "필터 더 보기" 버튼 클릭 시 기존 FilterModalSelect 3개가 들어 있는 **모달** 열기. |
| **패턴** | **충전기 타입**: bottom sheet **연 상태 상단**에 **chip**. **"가까운 순"**: chip 1개(항상 적용, 정렬만 변경). **"필터 더 보기"**: 텍스트 버튼 → **Modal**. |

### 1.4 충전소 상세 방식

| 항목 | 확정 내용 |
|------|-----------|
| **모달 vs 시트 확장** | **MUI Dialog** 사용하되, **모바일에서는 시트형 레이아웃**: 하단 정렬(fullWidth, 모바일에서 `anchor="bottom"` 또는 Paper가 화면 하단에서 올라오는 형태), 중앙 팝업처럼 보이지 않게. 데스크탑에서는 기존 Dialog 중앙 배치 가능. |
| **상세에 보여줄 정보** | **충전소명(statNm)**. **주소(adres || rnAdres)**. **운영기관(busiNm)**. **충전기 타입(chgerTyLabel)**. **이용시간(useTm)**. **전화(telno)**. 각각 한 줄씩, 라벨+값 형식. |
| **상세 액션 버튼** | **(1) 길찾기**: `https://www.google.com/maps/dir/?api=1&destination=lat,lng` 또는 `geo:lat,lng` 링크. 새 탭/앱으로 열기. **(2) 전화걸기**: `tel:${telno}`. telno 없으면 버튼 비활성 또는 숨김. 모달 하단에 버튼 2개 가로 배치. |

### 1.5 KPI/차트 처리 방식

| 항목 | 확정 내용 |
|------|-----------|
| **모바일 1차에서** | **접기 섹션**으로 보낸다. 완전 숨김은 하지 않음. |
| **구체적 처리** | 시트 본문에서 **"통계 보기"** 라는 텍스트 버튼(또는 아코디언 헤더) 1개 배치. 기본은 **접힌 상태**. 펼치면 기존 StatCard 4개(1줄 2x2 그리드 또는 1줄 4개 축소) + BarChart(Top10) + PieChart(타입 분포) 표시. 접힌 상태에서는 목록 + footer만 보이도록. |
| **노출 조건** | "통계 보기"를 **사용자가 탭해서 펼쳤을 때만** 표시. 별도 조건(예: 필터 결과 0건일 때 숨김)은 1차에서 적용하지 않음. |

### 1.6 실제 1차 구현 범위 최종 확정

| 구분 | 내용 |
|------|------|
| **반드시 포함** | (1) 모바일 시트 헤더: userLocation 없으면 "현재 지도 영역 · N곳", 있으면 "내 주변 충전소 · N곳". (2) 시트 연 상태: 충전기 타입 chip + "가까운 순"(정렬) + "필터 더 보기". (3) 충전소 목록(이름, 운영기관·타입, 거리). (4) 상세: Dialog 시트형(모바일) + 길찾기/전화. (5) 정렬: userLocation 있으면 내 위치 기준, 없으면 지도 중심 기준 거리순. (6) 목록 탭 → 지도 포커스 + 상세. (7) KPI/차트 "통계 보기" 접기. (8) footer 유지. |
| **이번에는 제외** | 라우터, 즐겨찾기, 지도 위 chip, 반경 필터(5km 등), Popup 제거(상세 보기 버튼만 추가). |
| **2차로 미룸** | 반경 필터, 지도 위 chip, 정렬 옵션 추가, 통계 조건부 노출. |

---

## 2. 사용자 플로우

1. **진입** → 지도(서울 중심) + 하단 시트 헤더 "현재 지도 영역 · N곳". (위치 확보 후 "내 주변 충전소 · N곳"으로 전환)
2. **시트 열기** → chip(충전기 타입, "가까운 순") + "필터 더 보기" + 충전소 목록(항상 거리순: 위치 있으면 내 위치 기준, 없으면 지도 중심 기준).
3. **필터** → 타입 chip 선택 시 목록·지도 즉시 반영. 목록은 항상 "가까운 순"(위치 있으면 내 위치, 없으면 지도 중심). "필터 더 보기" → 모달에서 운영기관/시도/시군구 선택.
4. **한 건 선택** → 목록에서 충전소 탭 → 지도 해당 위치로 이동 + 상세 모달 열림.
5. **상세에서** → 길찾기 / 전화 버튼 탭 → 외부 앱 이동. 모달 닫기 → 지도·목록 상태 유지.
6. **마커 클릭** → Popup에 요약 + [상세 보기] → 탭 시 같은 상세 모달.
7. **(선택) 통계** → 시트 하단 "통계 보기" 펼치면 KPI·BarChart·PieChart 표시.

---

## 3. 화면별 핵심 요소

| 화면/영역 | 요소 |
|-----------|------|
| **지도 메인** | MapContainer, TileLayer, Marker(클릭 시 Popup), ZoomControl, LocationControl, userLocation Circle/CircleMarker. 변경: Popup 내부에 [상세 보기] 버튼 추가. |
| **시트 헤더(collapsed)** | 좌: 아이콘 + (userLocation 없으면 "현재 지도 영역", 있으면 "내 주변 충전소") + " · N곳". 우: ChevronUp/ChevronDown. |
| **시트 본문(open)** | 1) 빠른 필터: 충전기 타입 chip + "가까운 순" chip + "필터 더 보기". 2) 충전소 목록. 3) "통계 보기" 접기. 4) footer. |
| **충전소 목록 아이템** | statNm, busiNm · chgerTyLabel, (선택) 거리. 탭 시 setSelectedStation + map 포커스 + 상세 모달 open. |
| **상세 모달** | MUI Dialog. 모바일: 시트형(하단 정렬, 중앙 팝업 아님). 내용: statNm, 주소, busiNm, chgerTyLabel, useTm, telno. 버튼: 길찾기, 전화. |
| **필터 더 보기 모달** | FilterModalSelect × 3(운영기관, 시도, 시군구). |

---

## 4. 실제 수정 순서

1. **데이터/유틸**  
   - 거리 계산 함수 추가(위경도 → km).  
   - `filteredItems`에 userLocation 또는 지도 중심 기준 `distance` 붙이고 정렬하는 `useMemo` 추가.  
   - (선택) "내 주변" 켜졌을 때만 거리순, 꺼졌을 때는 API 순 유지.

2. **모바일 전용 콘텐츠 분리**  
   - `panelBodyContent`를 `isMobile`로 분기. 모바일일 때: 헤더용 "주변 충전소 · N곳" 문구, 빠른 필터 영역, 목록, 통계 접기, footer. 데스크탑일 때: 기존 그대로.

3. **충전소 목록 컴포넌트**  
   - `StationListMobile.jsx`(또는 유사 이름): props `stations`, `selectedId`, `onSelect`, `userLocation`, `center`(지도 중심). 정렬은 상위에서 된 배열을 받음. 아이템 탭 시 `onSelect(station)`.

4. **시트 헤더 문구**  
   - 모바일 시트 헤더에 "주변 충전소" + `filteredItems.length` + "곳".

5. **빠른 필터 UI**  
   - 시트 본문 상단에 충전기 타입 chip(기존 filterChgerTy 연동) + "내 주변" chip(state 하나 추가) + "필터 더 보기" 버튼. "필터 더 보기" 클릭 시 모달 열고 내부에 FilterModalSelect 3개.

6. **상세 모달**  
   - `StationDetailModal.jsx`: props `open`, `station`, `onClose`. 내용·버튼 위 1.4대로. 목록/Popup에서 `selectedStation` 설정 시 모달 open.

7. **지도 포커스**  
   - selectedStation 바뀔 때 useMap 또는 MapContainer 밖에서 ref로 map 인스턴스 받아 setView/flyTo.

8. **Popup [상세 보기]**  
   - MapView의 Popup 안에 버튼 추가. 클릭 시 해당 station으로 setSelectedStation + 상세 모달 open(전역 state 또는 이벤트 전달).

9. **통계 접기**  
   - 모바일 본문 하단에 아코디언 또는 "통계 보기" 버튼. 펼치면 StatCard 4개 + BarChart + PieChart. 접힌 상태 기본.

10. **정리**  
    - 데스크탑 패널은 기존 `panelBodyContent` 유지. 모바일만 새 구조 적용. footer는 모바일 시트 맨 아래 한 번만.

---

## 5. 수정해야 할 파일별 역할

| 파일 | 역할 |
|------|------|
| **`src/App.jsx`** | (1) 모바일/데스크탑 `panelBodyContent` 분기. (2) `selectedStation`, `detailModalOpen`, `filterMoreOpen`, `mapCenter`(지도 중심). (3) 거리 계산·정렬: userLocation 있으면 내 위치 기준, 없으면 지도 중심 기준. (4) 시트 헤더: userLocation 없으면 "현재 지도 영역 · N곳", 있으면 "내 주변 충전소 · N곳". (5) 모바일: 빠른 필터(타입 chip + "가까운 순") + StationListMobile + 통계 접기 + footer. (6) StationDetailModal: 모바일 시트형. (7) 목록/Popup → 지도 포커스 + 상세. |
| **`src/components/StationListMobile.jsx`** (신규) | 목록 렌더. stations, onSelect, selectedId. 각 아이템: statNm, busiNm·chgerTyLabel, 거리(prop으로 받음). 탭 시 onSelect(station). |
| **`src/components/StationDetailModal.jsx`** (신규) | MUI Dialog. open, station, onClose. 정보 표시 + 길찾기/전화 버튼. |
| **`src/utils/geo.js`** (신규 권장) | `haversineDistanceKm(lat1, lng1, lat2, lng2)` 등 거리 계산. |
| **`src/components/FilterModalSelect.jsx`** | 수정 없음. "필터 더 보기" 모달 안에서 그대로 사용. |
| **`src/theme/dashboardTheme.js`** | 수정 없음. 필요 시 chip/목록 카드용 색·간격만 참조. |
| **`src/index.css`** | 모바일 시트/목록 카드에 필요한 클래스가 있으면 최소한으로 추가. 전역 reset 확대 금지. |
| **`src/api/safemapEv.js`** | 수정 없음. |

---

이 명세대로 1차 구현을 진행하면 된다. 구현 중 명세와 충돌하는 부분이 생기면 이 문서를 먼저 수정한 뒤 코드를 맞출 것.
