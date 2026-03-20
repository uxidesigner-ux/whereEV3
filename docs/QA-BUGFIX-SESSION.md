# QA/버그픽스 세션 기록

구조·파이프라인 동결 전제에서, 체크리스트 기준으로 재현된 이슈만 최소 수정한다.

---

## 이슈 1: 상세 열린 뒤 필터 열기 → 상세 닫기(X/back)가 필터를 먼저 닫음

| 항목 | 내용 |
|------|------|
| **재현** | 모바일에서 상세 시트 연 상태에서 상단 필터 탭 → 필터 Drawer 열림(상세가 z-index로 위에 있어 필터는 가려질 수 있음) → 상세 닫기(X) 또는 `history.back()` 한 번 |
| **원인** | `pushState` 순서가 `[detail, filter]`가 되면, 브라우저 back 한 번은 **가장 최근 push인 filter**를 소비한다. `popstate` 핸들러도 스택에서 `filter`를 먼저 꺼내 필터만 닫고 **상세는 남는다**. |
| **수정** | `openFilterDrawer`에서 `detailStationRef.current`이면 조기 return. 상단 필터 `IconButton`은 `detailStation`일 때 `disabled` + `aria-label` 안내. |
| **검증** | `npm run lint`, `npm run build` 통과. 수동: 상세 연 상태에서 필터 비활성·탭 무반응 확인. |

---

## 이슈 2: 모바일→데스크톱 전환 후 잔여 `pushState`와 UI 불일치

| 항목 | 내용 |
|------|------|
| **재현** | 모바일에서 상세/필터로 히스토리 엔트리 쌓은 뒤 창을 넓혀 데스크톱 레이아웃으로 전환 → 브라우저 뒤로가기 |
| **원인** | `isMobile`일 때만 `popstate`를 구독해 두면, 데스크톱에서는 리스너가 없어 **뒤로가기에도 상세 모달 상태가 갱신되지 않을 수 있음**. 스택·플래그는 전환 시 비우지만 히스토리 길이는 그대로인 경우가 있다. |
| **수정** | `popstate` 리스너를 **항상** 등록. `!isMobile` 분기에서는 스택 없이 `detail` → `filter` 순으로 열린 오버레이만 닫아 UI를 히스토리와 맞춤. |
| **검증** | 빌드 통과. 수동: 위 전환 후 back 시 모달/필터가 남지 않는지 확인(동일 URL SPA 전제). |

---

## 오버레이 복구 규칙 (코드 주석과 동일)

1. **정상 경로(모바일)**: `overlayStackRef` pop 결과가 `detail` / `filter`이면 각각 해당 닫기 함수.
2. **스택 비었는데 popstate**: UI 기준 **상세가 열려 있으면 상세 우선**, 아니면 필터 — z-order(상세 1400 > 필터 1200)와 동일.
3. **데스크톱 분기**: 스택 미사용, 동일 우선순위로 `detail` → `filter`.

---

## 변경 파일

- `src/App.jsx` — `openFilterDrawer` 가드, 필터 버튼 `disabled`, 전역 `popstate` + 주석
- `docs/QA-BUGFIX-SESSION.md` — 본 문서
- `docs/QA-CHECKLIST.md` — 시나리오 보강(선택 시 아래 diff 반영)
