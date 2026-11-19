# Seedup 최종 개선 사항 종합 보고서

**기준 커밋:** `origin/main` (`88eed83`, PR #78 `ui/banner-slider-daily` 머지 완료, 2026-11-19)  
**현재 규모:** 단위 테스트 **217개**(+ P0-1 신규 테스트 추가) · DB 마이그레이션 **26개**(운영 적용 완료) · MCP 도구 **13개**

> [!NOTE]
> PR #61~#78을 통해 `lib/db/*` 데이터 계층, MCP 13개 도구(Apps 카드 · 6단계 상태 · 커밋 추적 · `get_next_task` · `verify_feature` · `needs_recheck`), 예측 봉인 장부, 후보 비교, 매일 리서치 메일, 홈 배너 슬라이드까지 핵심 기능이 대거 완성되었습니다. 아래는 **그 최신 코드 위에 남아 있는 실제 결함과 다음 도약 과제를 정리한 목록**입니다.

---

## 우선순위 한눈에 보기

| 순위 | 묶음 | 핵심 목표 | 예상 규모 |
| :---: | :--- | :--- | :---: |
| **1** | **P0-1. 보안 · 운영 핫픽스** | DoS/스팸/배치 폭탄 차단, 쿼터 반환·Fail-Closed 통일, 보안 헤더, 깨진 링크 3곳 | 반나절 |
| **2** | **P0-2. MCP 구조 결함 수정** | 매일 엔진 후 진행 중 프로젝트 먹통(`prd_cache` 변동) 해결 + 내 아이디어 PRD·6슬롯 연동 | 1일 |
| **3** | **P0-3. 트렌드 · 추천 신뢰 복구** | 가짜 막대 그래프·가짜 "100% 상승" 제거, 180개 누적 정리, 추천 개인화·엔진 통일 | 0.5~1일 |
| **4** | **P1-1. PRD 품질 도약 (vs Claude/GPT)** | `eval-prd` 4개 누락 복구, P0 근거 정합성 감사 + 내보내기 전 미정 질문, DeepSeek vs Sol 실측 | 1~2일 |
| **5** | **P1-2. README · Mermaid 최종 동기화** | 테스트·마이그레이션 26·MCP 13·Mermaid 구조/렌더링 오류 전면 현행화 | 1~2시간 |
| **6** | **P2. 성능 · 파이프라인 · 위생 · 호스팅** | Workers 런타임, `scheduled-ingest` 직실행, `PrdBuilder` 분리, DB화, 호스팅 판단 | 중기 |
| **★** | **심화 A. 엔진 성능 극대화** | 기회 엔진 프리필터·`topup` 병렬화·2패스 군집, PRD 조기 헤징·P0 슬롯 프리필 | 선택/단계 |
| **★** | **심화 B. MCP 1티어 메인 기능화** | PRD 핀닝·자동 바인딩, Prompts/Resources/Tool Annotations, 자동 훅·`explain_file`, OAuth 2.1 | 핵심 축 |

---

## P0-1. 보안 · 운영 정합성 핫픽스 (즉시)

> [!CAUTION]
> 외부 입력·토큰 엔드포인트에서 **Worker 메모리 크래시, 스팸, 쿼터 우회**로 이어질 수 있는 항목들입니다.

- [x] **`fetchPageText` 메모리 DoS 수정** (`lib/opportunities/web.ts`)
  - `(await response.text()).slice(0, MAX_PAGE_BYTES)`는 전체 본문을 메모리에 다 읽은 뒤 잘라 Workers 128MB 한도를 넘길 수 있음 → `response.body.getReader()` 스트림 바이트 카운트로 2MB 도달 즉시 `reader.cancel()` 및 리다이렉트·거부 응답 바디 정리.
- [x] **공개/토큰 API Rate Limit + JSON-RPC 배치 상한**
  - `/api/mcp`(+ `/api/mcp/[key]`), `/api/quotes`, `/api/ideas/pages/[slug]/signup`에 IP/사용자 기준 `rateLimited()` 적용 + `Retry-After: 60`, MCP 응답 `Cache-Control: no-store`.
  - `lib/mcp/server.ts` `handleRpc()`에 빈 배열(`[]`) 거부 및 배치 크기 상한(`MCP_MAX_BATCH_SIZE = 10`) 적용.
- [x] **실패 시 쿼터 반환 & Fail-Closed 통일**
  - MCP `generate_verified_prd` · `verify_feature` · `validate_idea` 및 크롬 확장 `/api/quotes`(422/503) 실패 시 `releaseUsageFor`(낙관적 CAS 재시도)로 쿼터 반환.
  - `lib/mcp/auth.ts` `consumeUsageFor` 폴백이 DB 읽기/쓰기 오류 시 무조건 `true`가 아니라 `usageLimitFailsOpen()` 정책(운영 Fail-Closed)을 따르게 통일.
- [x] **HTTP 보안 헤더 추가** (`next.config.ts`)
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- [x] **깨진 안내 링크·문구 수정**
  - `/news?tab=github`(PR #68에서 `/github-trends`로 이동) 잔여 **3곳** 수정: `lib/mcp/server.ts:485`, `app/scrap/page.tsx:135`, `app/sitemap.ts:24` → `/github-trends`.
  - `app/api/quotes/route.ts`: 401 에러의 구버전 문구(*"프로필의 에이전트 연결"*) → `MCP 연동(/agents)`으로 수정.
- [ ] **운영 체크(코드 외):**
  - 로컬 `main`(`1c228bf`)을 최신 `origin/main`(`88eed83`, PR #78)으로 `git pull` 동기화 및 완료된 워크트리 정리.

---

## P0-2. MCP 핵심 구조 결함 수정 (진행 중 프로젝트 보호 & 내 PRD 연결)

- [ ] **활성 PRD 고정(Pinning) — 매일 07시 엔진 후 MCP 먹통 버그 해결** (`lib/mcp/server.ts`, `lib/mcp/endpoint.ts`)
  - **현재 버그:** `get_next_task` · `update_feature_status` · `verify_feature`가 `prdEvidence(opportunity)` 해시로 공용 `prd_cache`를 조회합니다. 매일 07시 엔진이 해당 문제에 원문 1건만 추가해도 키가 바뀌어 진행 중이던 프로젝트가 갑자기 `No PRD for "<slug>" yet`으로 막히고, 재생성 시 `F-n` 번호가 기존 `build_progress`·`feature_commits`와 어긋납니다.
  - **수정:** 프로젝트 시작 시 사용자별 활성 PRD 스냅샷(`spec_json`)을 `evidence_dossiers`에 고정(pin)하고, 이후 모든 진행·커밋·검증 도구가 고정본을 참조하도록 변경.
- [ ] **내 아이디어 PRD 완전 저장 + MCP 개인 PRD 도구 연결** (`app/api/opportunities/dossiers/route.ts`, `lib/mcp/server.ts`)
  - **현재 단절:** `dossiers/route.ts`가 여전히 공개 기회 `ev_*` 원문만 받아(`findEvidence`) 내 아이디어의 `lv_*` 웹 원문·크롬 확장 원문·메모 PRD가 422/누락됩니다. 또한 MCP 13개 도구 전부 내 개인 PRD를 읽지 못하고, `generate_verified_prd`가 `slots: null`로 생성해 `get_next_task`의 `Readiness slots` 6칸이 사실상 항상 `(open question)`으로 나옵니다.
  - **수정:** `evidence_dossiers`에 `lv_*` 원문·메모·`spec_json`(채워진 6슬롯 포함)·버전 저장 지원 + MCP `list_my_prds` / `get_my_prd` 추가 및 진행/커밋/검증 도구가 개인 PRD ID도 지원.

---

## P0-3. 트렌드 · 추천 엔진 신뢰 복구

> [!WARNING]
> Seedup의 브랜드 핵심은 **"근거 없는 숫자와 과장을 배제한다"**입니다. 트렌드 화면의 가짜 우상향 막대 그래프와 "100% 상승" 문구는 브랜드 신뢰와 정면 충돌하므로 빠르게 제거하는 것이 좋습니다.

- [ ] **트렌드 엔진 (`lib/ingest/trends.ts`, `trend-builder.ts`, `external-trends.ts`)**
  - `buildBars(score)`의 고정 가짜 우상향 배열(`[0.42, 0.5, ..., 1]`) 제거 → 실제 `trend_snapshots` 최근 7일 수치 사용(데이터 부족 시 숨김).
  - `getWeeklyGrowthRate`에서 `previous === 0`일 때 `100%` 반환 및 *"100% 상승"* 문구 제거 → `"신규 등장"` 표기.
  - `trends` 갱신 시 이번 실행에 없는 과거 행 정리(150개 저장인데 180개 누적되는 현상 제거).
  - `external-trends.ts`와 `trend-builder.ts`에 중복된 패턴·일반어 차단 목록을 하나로 통합 + npm 스코프 유지(`cli`, `core` 잡음 차단) + `isAllowedEntityTitle`(`trend-builder.ts:490`) 정규식 누락으로 **`'MCP 서버 만들기'`·`'Figma to Code 워크플로우'` 2개가 생성 즉시 자가 삭제되는 버그** 및 `빌드 아이디어` 과도한 통과 기준 완화.
  - *(주의)* 새 트렌드 이름 발굴은 무료 LLM 호출을 늘리지 말고, 최근 7일 급증 태그·레포명·제품명 **통계 집계**로 가볍게 접근 권장.
- [ ] **추천 엔진 (`lib/recommendations.ts`, `lib/personal.ts`, `HomeDesk.tsx`)**
  - 개인 일치 점수(관심 +4 / 스택 +3)가 공통 편집·최신성 점수(30~47점)에 묻히지 않도록 개인 점수와 편집 품질 점수를 분리·재가중.
  - `fuzzyMatch()`에서 4글자 이상 영문(`java`↔`javascript`)도 단어 경계 매칭으로 수정 + 싫어요한 글의 `topic_tags`/`skill_tags` 감점 추가.
  - 홈 상단 배너(`ruleReads`)와 하단 "나를 위한 추천"(`forYou`)을 단일 엔진으로 통일 + 추천 클릭 이벤트(`clicked_at`) 기록.

---

## P1-1. PRD 품질 도약 — Claude/GPT 직접 작성보다 낫게 만들기

"문장 유창성" 경쟁이 아니라 **① 검증된 근거 범위 감사 + ② 에이전트 1-shot 실행 명세 + ③ Draft/Critic 분리 + ④ 코드 연동**으로 우위를 만듭니다.

- [ ] **실험 세트 선행 수정 (`scripts/eval-prd.ts`)**
  - `PROBLEM_CASES` 12개 중 최신 `snapshot.json`에 없어 현재 스킵되는 **4개 슬러그**(`caller-transcription-confidence`, `canopy-fisheye-distortion-analyzer`, `cofounder-ai-conversation-visibility`, `overdue-payment-collection`)를 최신 슬러그로 교체(8/12 → 12/12).
  - 핵심 지표 3종(**근거 부족 P0 수 · 미정 구현 결정 수 · P0 테스트 가능 완료 조건 비율**) + 소요 시간·비용 계측 추가.
- [ ] **P0 근거 정합성 감사(Critic) 추가 (`lib/opportunities/spec.ts`, `prd.ts`)**
  - 인용 번호 범위만 체크하는 `normalizeSpec()`의 한계를 보완해, **P0 요구사항 + 인용 원문 쌍만 1회 경량 검토**하여 범위 비약(`partial`/`unsupported`)은 요구사항을 좁히거나 미정 사항·가설(`H-n`)로 분리.
- [ ] **내보내기 전 구현 분기 질문 게이트 + P0 완료 조건 검사**
  - `specIssues()`에 **P0별 테스트 가능한 `acceptance` 유무 검사** 추가.
  - `AGENTS.md` 내보내기 직전 P0 기능의 빈 6슬롯 중 구현 결과를 바꾸는 결정(권한·예외·데이터) 3~5개만 질문하고, 답을 PRD와 내보내기 파일에 반영.
- [ ] **통제 실험 후 모델 확정**
  - **1차:** 같은 초안으로 `현재 흐름 vs P0 감사·완료 조건 개선` 비교.
  - **2차:** `DeepSeek(초안) + Sol(감사)` 조합을 동일 초안으로 비교해 시간·비용 대비 품질 개선폭 확인 후 채택.

---

## P1-2. README · Mermaid 최종 동기화 (기능 확정 직후 1회)

- [ ] **Mermaid 다이어그램 재작성 (`README.md`)**
  - `flowchart TB` + 노드 간 화살표(`V1 → V2 → V3 → V4`) + `<br/>` 한글 어절 줄바꿈 + `가설 H-n -.-> F` 연결 + **기회 엔진과 기술 큐레이션/RAG 트랙 분리** + `4. 에이전트 전달 · 공유`.
- [ ] **최신 코드와 수치·기능 전면 동기화**
  - 단위 테스트 `141개` → 최신 수(또는 구조 중심 표기) + Playwright E2E(`e2e/`, `npm run e2e`) · `npm run migrations`.
  - DB 마이그레이션 `20개` → **26개**(최근 6개 반영) + 중복 번호 `3. OAuth Redirect URL 등록` 수정 + 26행 이력/repair 런북 `<details>` 접기.
  - MCP 도구 `9개` → **13개** + MCP Apps 카드 + 코드 추적/재확인, 예측 봉인 장부(`/predictions/sealed.jsonl`), 매일 리서치 메일, `lib/db/` 계층, `ci.yml`(migrations·e2e·PR preview) · `site-health.yml`, `EXAONE_API_KEY`·`PRD_FREE_MODELS`·`LIVE_EVIDENCE_SECRET` 반영.
  - 상단 목차(ToC), 핵심 기능 강약 조절, 대표 스크린샷 2~3장, `LICENSE` 추가.

---

## P2. 성능 · 운영 구조 · 코드 위생 · 호스팅 (안정화 단계)

- [ ] **Workers 런타임 & 지연 시간 최적화**
  - `lib/llm.ts`: 전역 `waitForSlot()`(3.1초)을 `isFreeOpenRouterModel(model)` 호출에만 한정 적용.
  - `lib/cache.ts`: SWR 백그라운드 갱신에 `getCloudflareContext().ctx.waitUntil()` 연결.
  - `app/api/opportunities/prd/route.ts`: 긴 thinking/repair 침묵 구간 대비 15초 `{"type":"ping"}` 하트비트 추가.
  - `lib/mcp/server.ts` · `auth.ts`: `callTool`의 `deps.opportunities()`를 필요한 도구에서만 지연 호출, `userForToken`의 `last_used_at` 동기 `UPDATE`를 비동기/쓰로틀화, `readFeatureCommits` 전체 스캔 제한.
  - 잔여 `auth.getUser()`(38곳) · `select('*')`(31곳) 단계적 정리.
- [ ] **운영 자동화 & 상태 영속화**
  - `scheduled-ingest.yml`: `next build + next start + curl` 제거 → 이미 분리된 `lib/ingest/*`를 `scripts/run-ingest.ts`로 직접 실행.
  - `opportunity-engine.yml`: `scripts/seal-predictions.ts` 자동 봉인 단계 연결 검토.
  - `engine-memory.json`(Actions Cache) 및 `lib/opportunities/review.ts`(코드 하드코딩)를 Supabase 테이블로 이전.
  - 기회 엔진 만료(`21일`) vs 읽기 메모리(`30일`) 충돌 해소(`qualified` 기회는 보존/archive) + Greedy 군집 체인 드리프트 완화.
- [ ] **코드베이스 & 저장소 위생**
  - `docs/prd-builder-split.md` 계획대로 `PrdBuilder.tsx`(1,023줄) 분리 및 5개 뷰 `next/dynamic` 지연 로딩.
  - PR Preview(`ci.yml`)가 운영 DB에 쓰지 않도록 읽기 전용 가드 또는 Staging Supabase 분리.
  - 외부 공개 전 루트 작업 폴더(`8조 발표.pdf`, `디자인 레퍼런스 1차/2차/`, `쌀먹/`) 정리 및 `LICENSE` 추가.
  - `lib/legal.ts` 개인정보처리방침에 `link_commit` · `verify_feature` · 매일 리서치 메일 2줄 보완.
- [ ] **중기 기능 & 호스팅 전략**
  - 기능: `/try/[slug]` 대기자 불편 응답 → PRD 가설(`H-n`) 승격, 검증 리포트 공개 링크(`/report/[id]`), 원격 MCP OAuth.
  - 호스팅: **지금은 Cloudflare Workers(무료, 월 0달러) 유지**, 먼저 Supabase 대시보드에서 **실제 DB 리전**만 확인(`ap-northeast-2`라면 `wrangler.jsonc` `placement` 즉시 수정). 향후 국내 트래픽·유료화·Workers 한계 도달 시 **상시 Node.js(서울/도쿄, 월 5~7달러) 또는 Vercel Pro(월 20~40달러) + Supabase 서울 리전 동반 이전**.

---

## 심화 A. 엔진 성능 극대화 전략 (속도 · 통과율 · 정확도)

### 1. 기회 엔진 (`engine.ts` · `topup.ts` · `rules.ts` · `merge.ts`)
- **임베딩/규칙 1차 프리필터로 LLM 낭비 40~50% 절감:** 현재 `discoverPains()`는 540개 글을 그대로 68배치 LLM에 넣습니다. 홍보/단순 질문 룰 확장 + 대표 불만 앵커 벡터 유사도 컷으로 잡음을 먼저 거르면, **같은 LLM 예산으로 실질 탐색 범위를 2배 늘리거나 실행 시간(14~29분)을 절반으로 단축**할 수 있습니다.
- **`topup.ts` 직렬 루프 병렬화 + 실제 불만 검색구 재사용:** 현재 `topUpEvidence()`는 기준 미달 20개를 **1개씩 직렬 실행**하고 키워드 2개씩 기계 조합(`searchPhrases`)으로 검색합니다. `mapLimit(..., 3)` 병렬화 + 엔진이 이미 생성한 `plan.demand`(실제 불만 표현 구문)를 저장·재사용하면 보충 속도가 ~3배 빨라지고 **기준 통과 전환율**이 크게 올라갑니다.
- **2패스 정밀 군집 + 플랫폼 편중 완화:** 순서 의존 Greedy 군집(`clusterByEmbedding`)에 **Centroid 재할당 2패스 + 클러스터 내 최소 유사도 하한(`>= 0.52`)**을 붙여 False Merge(체인 드리프트)를 줄이고, 라운드로빈 샘플링에 HN 외 플랫폼(GitHub Discussions · Stack Overflow · 포럼 · 한국어 1~2곳) 최소 보장 슬롯을 배정해 `플랫폼 2곳` 통과 장벽을 낮춥니다.
- **LLM 단계 통합:** `judge()` 내 *"인용 재확인"*과 *"한국어 번역"* 2회 호출을 1회(`keep` + 통과분 번역 동시 출력)로 합쳐 호출 수와 무료 모델 실패 확률을 25% 줄입니다.

### 2. PRD 엔진 (`prd.ts` · `spec.ts` · `llm.ts`)
- **체감 속도(TTFT) 단축:** `waitForSlot()`을 무료 OpenRouter 모델 한정으로 분리하고, 첫 모델이 8초간 reasoning/token 무응답이면 2순위 모델(`particle-1` 등)을 병렬 경주시키는 **조기 헤징(Staggered Fallback)**으로 무료 모델 간헐적 지연을 방어합니다.
- **P0 6슬롯 자동 프리필:** PRD 스트리밍 직후 백그라운드에서 P0 기능 2~3개의 6슬롯을 `Promise.all`로 미리 채워, 내보내기·MCP 전환 시 빈 `(open question)`과 대기 시간을 제거합니다.
- **Draft + Critic 분리 파이프라인:** 빠른 초안 모델(DeepSeek 등) + 정밀 감사 모델(Sol 등)로 P0 근거 정합성·테스트 가능 완료 조건만 1회 감사해, 비용은 낮추고 실행 정확도는 대형 모델 1-shot 이상으로 끌어올립니다.

### 3. 트렌드 · 추천 엔진 (`trends.ts` · `recommendations.ts` · `personal.ts`)
- **트렌드(비용 0원 통계 발굴):** 가짜 막대·가짜 100% 제거와 과거 행 정리 후, LLM 추가 없이 최근 7일 급증 태그·GitHub 레포명·Product Hunt 제품명의 **신규 출현 비율·증가율 통계**로 새 트렌드를 자동 포착합니다.
- **추천(개인화 분리 + CTR 학습):** `개인 일치 점수(70%) + 편집·신선도(30%)` 구조로 재가중하고, 전 길이 단어 경계 매칭 + 싫어요 태그 감점 + 홈 배너/하단 단일 엔진 + `clicked_at` CTR 계측을 붙입니다.

---

## 심화 B. MCP를 "1티어 메인 기능"으로 만드는 5대 전략

Seedup MCP는 이미 13개 도구·MCP Apps 카드·커밋/재확인 추적까지 갖춰 기반이 뛰어납니다. **"코딩 에이전트를 켤 때마다 안 붙이면 허전한 필수 MCP"**로 도약시키려면 아래 5축이 결정적입니다.

### 1. 컨텍스트 드리프트 제로 (프로젝트 고정 & 자동 바인딩)
- **활성 PRD 고정(Pinning) + 개인 PRD 1급 지원 (`P0-2`):** 매일 07시 엔진으로 `prd_cache` 키가 바뀌어도 진행 중 프로젝트가 깨지지 않게 사용자별 `dossier_id`에 `spec_json`(채워진 6슬롯 포함)을 고정하고, `list_my_prds` · `get_my_prd`로 내 아이디어 PRD까지 전부 연결합니다.
- **저장소 자동 바인딩:** 매 세션 `slug`를 외워 말하지 않아도 되게 `AGENTS.md` 또는 `.seedup.json`에 `project_id`를 박아 두고, 에이전트가 인자 없이 `get_next_task`만 불러도 현재 레포의 다음 기능을 바로 꺼내 오게 만듭니다.

### 2. MCP 표준 기능 100% 활용 (`Tools`를 넘어 `Annotations` · `Prompts` · `Resources`)
현재 `lib/mcp/server.ts`는 `prompts/list: []`, `resources/templates/list: []`로 비어 있고 `Tool Annotations`도 없습니다.
- **Tool Annotations (`readOnlyHint`, `idempotentHint`, `destructiveHint`) 즉시 추가:** 최신 MCP 스펙(2025-03-26+)의 `readOnlyHint: true`를 읽기 도구(`search_opportunities`, `get_opportunity`, `get_next_task`, `get_build_checklist`, `get_kept_items`)에 달면, **Claude Code · Cursor가 매번 승인 팝업을 띄우지 않고 자동 실행**해 체감 속도가 확 달라집니다.
- **MCP Prompts (슬래시 워크플로 4종):** 에이전트 채팅창에서 `/mcp__seedup__...`로 한 번에 돌리는 표준 루프 제공:
  - `discover-and-spec`: 아이디어 검증 → 근거 PRD → `AGENTS.md` 저장
  - `build-next-feature`: `get_next_task` → 구현 → 테스트 → `verify_feature` → `link_commit` → `update_feature_status`
  - `pre-ship-audit`: 현재 브랜치 `git diff`를 PRD P0 완료 기준 + 보안 체크와 일괄 대조
  - `why-this-file`: 파일 경로 → 연결된 `F-n → R-n → E-n` 원문 역추적 설명
- **MCP Resources (`seedup://` URI):** `seedup://prds/active`, `seedup://prd/{id}/spec`, `seedup://prd/{id}/progress`, `seedup://kept/recent`를 노출해 `@seedup://...`로 도구 호출 없이 컨텍스트를 직접 첨부.

### 3. 에이전트가 까먹지 않는 자동 훅 + 양방향 역추적 + 진짜 검증 게이트
- **커밋 자동화 훅 원클릭 제공:** `AGENTS.md` 지시문만으로는 에이전트가 `link_commit`을 자주 놓칩니다. `.git/hooks/post-commit` 또는 Claude Code `PostToolUse` 훅 템플릿을 함께 내보내 커밋할 때마다 `link_commit`과 `needs_recheck`가 100% 자동 작동하게 만듭니다.
- **코드 → 원문 역추적 도구 `explain_file(path)` 추가:** 에이전트가 기존 파일을 수정하기 전에 부르면 *"이 파일은 `F-02`를 구현하며 원문 `E-3` 때문에 존재함 + 건드릴 때 재확인할 수락 기준 3개"*를 즉시 반환합니다. 일반 코딩 에이전트에 없는 **"코드의 존재 이유(Why) 메모리"**가 됩니다.
- **`verify_feature` ↔ `done` 교차 검증 연결:** `verify_feature`가 전 항목 `met` 판정 시 짧은 검증 토큰(`verification_id`)을 발급해 `update_feature_status(done)`에 붙이게 하고, 사이트 UI에 **"자가 보고 완료"** vs **"Diff 교차 검증 완료"**를 구분 표시합니다.

### 4. 도구 다이어트 & 응답 효율 최적화 (LLM 선택 정확도 향상)
- **정예 도구 구조화:** MCP 도구가 15개를 넘어가면 LLM이 엉뚱한 도구를 고르거나 매 턴 스키마 토큰을 낭비합니다. 구버전 별칭(`mark_feature_done`)은 `tools/list` 노출에서 숨기고 백엔드 호환만 유지하며, 자주 함께 불리는 조회(기회 + 고정 PRD + 진행률)는 컨텍스트 도구로 압축합니다.
- **저지연 엔드포인트:** `callTool()`에서 기회 목록이 불필요한 도구에 `deps.opportunities()` 선행 로드 제거 + `userForToken` `last_used_at` 비동기화 + `readFeatureCommits` 최근/인덱스 제한 + 배치 크기 상한(10건).

### 5. 연결 장벽 제로 (OAuth 2.1 + MCP Apps 고도화)
- **OAuth 2.1 (PKCE + Dynamic Client Registration):** 현재 `/api/mcp/[key]` URL 경로 토큰은 로그 노출 리스크와 복사 번거로움이 있습니다. OAuth 2.1을 붙이면 Claude.ai · Claude Desktop · ChatGPT · Cursor에서 **"Seedup 로그인" 클릭 한 번**으로 안전하게 연결됩니다.
- **MCP Apps 카드 인터랙션 확장:** 현재 조회·생성 위주 카드에 **"이 기능 바로 시작(`in_progress`)"**, **"Diff 검증 결과 인라인 보기"**, **"원문 인용 근거 펼치기"** 액션을 넣어 대화창 자체를 미니 워크스페이스로 끌어올립니다.

---

## 지금은 하지 않을 것 (Scope Out)

- 팀 워크스페이스 · 실시간 공동 편집 · 댓글
- 결제/구독 빌링 선구현 (실사용자 10~20명 검증 및 지불 의향 확인 후 진행)
- 트렌드 새 이름 발굴을 위한 추가 LLM 호출(통계 기반으로 대체)
- DB 리전 확인 없는 앱 단독 호스팅 이전
