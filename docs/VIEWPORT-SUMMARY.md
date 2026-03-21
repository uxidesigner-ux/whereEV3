# Viewport 요약 로딩 (임시 구조)

## 배경

Safemap 전기차 목록 API(`IF_0042`)는 **bbox / viewport 쿼리 파라미터를 제공하지 않는다**.  
현재 앱은 **페이지 단위로 목록을 받은 뒤**, 클라이언트에서 `southWest`–`northEast` 안의 행만 누적하는 방식으로 viewport 요약을 구현한다.

구현 위치: `src/api/evViewportSummary.js` (`fetchEvChargersSummaryForBounds`).

## 한계

- 초기·이 지역 검색 시 **API 전체를 훑지는 않지만**, 뷰에 충분한 밀도가 나올 때까지 **여러 페이지(기본 최대 18페이지 × 500행)** 를 순회할 수 있다.
- bbox 밖 데이터는 네트워크로 받았다가 **버려지는 낭비**가 남는다.
- 상세 보강은 동일 목록 API를 **statId 기준으로 페이지 순회**하며 모은다 (`src/api/evPlaceDetail.js`).

## 향후 백엔드 개선 시

- `bbox=minLat,minLng,maxLat,maxLng` 또는 `center+radius` 기반 **summary 전용** 엔드포인트
- `statId` 단일 충전소 **detail 전용** 엔드포인트  

가 생기면 위 두 모듈의 fetch 부만 교체하면 된다.
