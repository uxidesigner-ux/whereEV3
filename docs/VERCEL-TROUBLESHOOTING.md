# Vercel 배포·런타임 트러블슈팅

## `ROUTER_FILESYSTEM_LOOKUP_ERROR` (Internal error, `icn1::…` 등)

Vercel 라우터가 요청 처리 중 **파일시스템 조회**에 실패했을 때 나오는 **플랫폼 측 오류 코드**다. 공개 문서가 거의 없고, 원인도 배포·리전·순간 부하에 따라 갈린다.

### 가능한 원인 (정리)

| 구분 | 설명 |
|------|------|
| **라우팅·헤더 범위** | `vercel.json`에서 `headers`의 `source`를 `/(.*)`처럼 **모든 경로**에 걸면, 정적 파일(특히 **수백 MB JSON**) 요청마다 라우터가 같은 규칙을 타며 부담이 커질 수 있다. [TOO_MANY_FILESYSTEM_CHECKS](https://vercel.com/docs/errors/TOO_MANY_FILESYSTEM_CHECKS)와 같은 계열 이슈와 인접해 있다. |
| **대용량 정적 파일** | 전국 `ev-stations-summary.json`(~300MB)은 엣지/스토리지 조합에 따라 간헐적 실패·타임아웃이 나올 수 있다. |
| **일시 장애** | 특정 리전(`icn1` 등)·시점의 내부 오류일 수 있다. 재배포·시간 두고 재시도. |

### 이 저장소에서 한 조치

- **`vercel.json`**: CSP 헤더를 **`/` · `/index.html`만** 적용하도록 좁혀, `/data/ev-stations-summary.json` 등 정적 자산 요청이 불필요한 라우터 규칙을 타지 않게 했다.
- **선택**: 환경 변수 **`VITE_EV_STATIONS_SUMMARY_URL`** 로 요약 JSON을 **Vercel 밖**(R2, Blob, 다른 CDN)에서만 제공하면, 배포 산출물에서 초대형 파일을 빼고 라우터 부담을 줄일 수 있다. 이때 상단 CSP 문자열의 `connect-src`에 호스트를 넣는다. 예: `https://pub-xxxxx.r2.dev` 를 쓰면  
  `connect-src 'self' … https://pub-xxxxx.r2.dev` 처럼 **한 호스트씩** 추가(와일드카드는 신중히).

### 정적 파일 크기 한도 (참고)

[Vercel Limits — Static file uploads](https://vercel.com/docs/limits#static-file-uploads): Hobby **100MB** / Pro **1GB** 등(용도별로 “소스 업로드”와 “빌드 출력”이 다르게 설명되므로 공식 문서를 본다). 장기적으로는 **Pro** 또는 **외부 호스팅 URL**을 검토하는 것이 안전하다.

---

## Git LFS

- **Project → Settings → Git**에서 **Git LFS** 활성화.
- 자세한 절차: [`docs/EV-SUMMARY-OPS.md`](./EV-SUMMARY-OPS.md)
