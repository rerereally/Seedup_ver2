# Seedup 계획: 목표를 중심축으로 에이전트 개발 흐름 잡기

작성일 2026-11-20. 같은 날 대화에서 정한 내용을 모두 반영한 현재 계획입니다. 이 파일의 이전 판(감독관 MCP 작업 분배)을 대체합니다. 검토 과정과 근거는 `docs/seedup-v3-review-2026-11-20.pdf`에 있습니다.

## 이 문서의 권한

- **이 문서가 Seedup의 최상위 계획입니다.** 다른 계획 · 작업 목록 문서(`work-plan-merged-2026-11-20.md`, `ai-agent-work-plan.md`, `codex-tasks.md`, `antigravity-tasks.md`, `service-plan.md` 등)와 어긋나면 이 문서를 따릅니다.
- 기존 계획에서 남은 작업은 10절에서 이 문서의 단계로 옮겼습니다. 거기에 없는 작업은 하지 않습니다.
- 계획을 바꾸는 일은 계획 세션에서만 합니다. 실행 세션 · 에이전트는 이 문서를 읽고 맡은 칸만 실행하며, 계획과 다른 판단이 필요하면 고치지 말고 계획 세션에 올립니다.
- 바꿀 때는 이 문서를 먼저 고치고, 맨 아래 "바뀐 기록"에 날짜와 이유를 한 줄 남깁니다.

---

## 0. 한 줄 정의와 북극성

**Seedup은 처음 정한 목표를 중심축으로 고정하고, 기획부터 개발과 평가까지 흐름이 그 목표를 향하도록 잡아 주는 서비스입니다.** 코드는 Claude Code나 Codex가 씁니다. Seedup은 그 바깥에서 세 가지를 쥡니다.

- **무엇을 왜 만드나:** 목표, 근거, 명세
- **어디까지 왔나:** 진행 상태, 다음 작업, 사람 할 일
- **정말 그렇게 됐나:** 실제 코드, CI, 화면으로 판정

**북극성 지표는 목표 도달률**입니다. 완료 시점에 충족된 성공 기준의 비율로 잽니다. "한 줄로 배포까지 자동"은 목표가 아니라 선택 기능입니다.

**대상은 Claude Code · Codex를 쓰는 AI 네이티브 1인 빌더**입니다. 저장소 만들기, 커밋, push, CI 파일 작성은 에이전트가 하고, 사람은 GitHub 계정 연결 같은 사람 할 일만 합니다. GitHub 없이 쓰는 사람은 로컬 검사만 받고 "로컬 확인"(낮은 신뢰)으로 표시합니다.

**범위는 핵심 고리 하나를 먼저 완성합니다:** 목표 잠금 → `prd:<id>` → `get_next_task` · `AGENTS.md`에 목표 → 세션 시작 훅 → 2단 검증(로컬 즉시 + 서버 단순형) → 기본 이탈 검사 → 최소 대시보드. 나머지는 5절 "보류"에 두고, 핵심 고리가 실제로 돌아간 뒤 하나씩 꺼냅니다.

**Claude Code · Codex와 다른 점**

| 관점 | Claude Code · Codex | Seedup |
| :--- | :--- | :--- |
| 목표 | 대화와 메모리 파일 안. 세션이 끝나거나 압축되면 흐려짐 | 서버에 잠긴 목표(G). 요구사항, 기능, 커밋, 평가가 모두 연결됨 |
| 기억 | 도구마다 따로 | 도구와 무관하게 서버에 있음. 어떤 에이전트든 이어서 진행 |
| 완료 판정 | 만든 모델이 같은 세션에서 보고 | 다른 계열 모델이 GitHub의 실제 커밋, CI, 화면을 보고 판정 |
| 목표 이탈 | 요청받은 일은 함 | 명세 밖 작업과 범위 밖 변경을 경고 |
| 무엇을 만들지 | 사용자 말대로 | 트랙에 맞춘 평가(오픈소스·기술 또는 시장·경쟁) |

---

## 1. 정해진 결정

| 주제 | 결정 |
| :--- | :--- |
| 북극성 | 목표 도달률. 한 줄 자동 개발은 선택 기능 |
| 대상 | Claude Code · Codex를 쓰는 AI 네이티브 1인 빌더. git · CI 작업은 에이전트가 함. GitHub 없으면 "로컬 확인" |
| 범위 | 핵심 고리 먼저(5절 단계 1~2), 나머지는 보류 |
| 트랙 | A 개인용(내부 툴, 자동화) / B 출시용(외부 사용자). A에서 B로 바꿀 수 있음. 트랙 B 전용 기능은 보류 |
| 완료 판정 | 에이전트가 보낸 diff를 믿지 않음. GitHub의 실제 커밋 SHA와 CI 결과로 서버가 판정 |
| 검증 방식 | 2단: 로컬 훅이 즉시 예방(정적 검사 · 이탈 경고), 서버가 push 후 확정(🟢 감독관 검증). 서버 검증은 단순형(자료를 먼저 모으고 모델 1~2회 호출) |
| 판정 위치 | 판정 로직은 Seedup 서버에만. 사용자 저장소의 CI 안에서 판정하지 않음(에이전트가 그 파일을 고칠 수 있으므로). CI 결과는 GitHub API로 읽기만 |
| 승인 | 터미널 대화에서 받음(MCP 응답이 "사용자에게 물어라"를 지시 → `record_decision`에 "대화에서 승인"으로 기록). 대시보드는 이력 확인과 목표 변경만 |
| 게이트 | 기본은 표시 모드(🟢 감독관 검증 / 🔵 로컬 확인 / ⚪ 자가 보고). 프로젝트별 엄격 모드에서만 거부 |
| 모델 | 기획 초안은 무료 모델 가능. 검증 · 배포 전 테스트 · 평가는 유료 모델. **검증 모델은 GPT 6.2 Sol과 Haiku 5.5 둘이고, 개발 모델과 다른 계열이 판정**(Codex로 개발 → Haiku, Claude Code로 개발 → GPT). OpenRouter ID: `openai/gpt-6.2-sol`, `anthropic/claude-haiku-5.5`. `provider.data_collection: "deny"`는 수집하는 제공사를 라우팅에서 빼는 필터일 뿐 "어디에도 저장 안 됨"이 아니므로, 처리방침 · 화면에서 그렇게 약속하지 않음 |
| 개인 PRD | `prd:<id>` 프로젝트 키로 MCP 진행 도구 전부 사용 |
| 에이전트 연동 | MCP 하나에 기대지 않고 4층(MCP, 프로젝트 파일, 로컬 훅, GitHub)으로 |
| 숫자 | 실측값만 씀. 토큰 절감은 실제 비용 차액으로 |
| 출시 | 지금은 대표 흐름만 무료 베타로 |
| 유료화 | 지금은 고려하지 않음(가격, 결제, 유료 플랜, 대기자 명단 모두 계획 밖) |

---

## 2. 전체 워크플로우

```
[기획 탭]  ① 아이디어 → 트랙 분류  ② 트랙별 1차 평가  ③ 역질문 루프
           ④ 규모 · 협업 정의  ⑤ 산출물 확정 + 목표 잠금
               ↓
[MCP 탭]   ① 환경 세팅 먼저  ② 개발(목표 순서)  ③ 컨펌 · 이탈 검사 · 완료 검증
               ↓
[평가·개선] ① 성공 기준별 · 아키텍처 · 트랙별 평가(코드 + 화면)  ② 개선 작업 → MCP 탭으로
```

### 2-1. 기획 탭 (`/prd`)

| 단계 | 내용 | 지금 | 만들 것 |
| :--- | :--- | :--- | :--- |
| ① 트랙 분류 | AI가 트랙 제안, 사용자가 확정 | 없음 | 분류와 선택 화면 |
| ② 1차 평가 A | 활용할 오픈소스, API, 빠른 구현 경로, 기술 실현성 | 도구 목록 14개(`toolkit.ts`), GitHub 트렌드 DB가 따로 있음 | DB 기반 추천(3-9)과 연결 |
| ② 1차 평가 B | 시장, 경쟁, 차별점 + 오픈소스 · 기술 | 원문 검색, 경쟁 도구, 검증 리포트, 차별점 | 트랙 A 기술 평가를 합침 |
| ③ 역질문 루프 | 빈틈이 채워질 때까지 질문. A는 기능 · 데이터 입출력 · 시나리오, B는 목표 · 대상 · 문제 · 가치 | 질문 3~5개 한 번(`questions.ts`) | 목표 대비 빈칸 순으로 반복. 멈춤 기준은 `withPrdReadiness`의 열린 슬롯 · 가설 · 열린 질문 수. 최대 질문 수와 "나머지는 기본값으로" 버튼 |
| ④ 규모 · 협업 | A는 1인 기본값. B는 인원 · 규모 · 구조 입력 → 컨벤션, R&R, 권한, 브랜치 규칙, 에이전트별 파일 소유표 생성 | 없음 | 생성기와 화면. 이 문서 5절이 산출물 예시 |
| ⑤ 산출물 확정 | PRD, 기능 명세, 유저 워크플로우, 최종 목표 잠금 | PRD, 슬롯, 유저플로우, 와이어프레임, PRD 고정 | 목표 잠금(3-1) |

### 2-2. MCP 탭 (`/agents`, `/supervisor`)

| 단계 | 내용 | 지금 | 만들 것 |
| :--- | :--- | :--- | :--- |
| ① 환경 세팅 먼저 | `.env`, API 키, 외부 연동을 코드 전에 먼저 | 없음 | 사람 할 일 목록을 첫 단계로. 로컬 스크립트가 필요한 **키 이름만** 확인(값은 올리지 않음). 그동안 AI는 Mock으로 진행 가능 |
| ② 개발 | PRD, 구조, 협업 규칙 기준 구현 | `get_next_task` → `link_commit` | 목표 기여도 순서, 응답마다 목표 요약, 개인 PRD 지원 |
| ③ 컨펌 | 목표나 범위에 영향을 주는 결정에서만 확인 요청 | 없음 | MCP 응답이 "사용자에게 물어라"를 지시하고 에이전트가 터미널 대화에서 승인을 받음. 결과는 `record_decision`에 기록. 대시보드는 이력만 |
| ③ 이탈 검사 | 명세와 목표에서 벗어나는지 지속 확인 | 미연결 커밋 수만 | 3-6 |
| ③ 완료 검증 | 실제 코드로 판정 | 에이전트 diff를 믿는 `verify_feature` | 3-4 |

### 2-3. 평가 · 개선

| 평가 | 내용 |
| :--- | :--- |
| 목표 달성도(공통) | 성공 기준별 🟢 충족 / 🟡 일부 / ⚪ 미착수. 근거는 코드 인용과 화면 캡처 |
| 기술 아키텍처(공통) | 유료 모델이 저장소 전체로 구조, 코드 품질, 설계 리뷰. 트랙 B는 확장성 · 안정성 강화 |
| 트랙 A | 실제 사용 흐름의 단계 수 · 시간, 자동화 동작 효율 |
| 트랙 B | 경쟁 도구와 원문(E-n) 대비 상품성. 해결한 불만과 남은 불만 |
| 개선 루프 | 부족한 성공 기준을 채우는 작업부터 F-n `improving`으로 넣고 MCP 탭으로 되돌림 |

---

## 3. 핵심 설계

### 3-1. 목표 앵커 (G)

추적 체인 맨 위에 목표를 둡니다.

```
G 목표 → 성공 기준 G-n → R 요구사항 → F 기능 → S 화면 → 커밋 · 화면 캡처
                ↑ 근거: 트랙 B는 원문 E-n, 트랙 A는 사용 시나리오
```

- 담는 것: 목표 문장(누구의 어떤 문제를 어떤 결과로), 성공 기준 2~4개(측정 가능), 포함 범위, 하지 않는 것, 트랙.
- 지금 `Spec`의 `goals`, `nonGoals`, `metrics`를 잠긴 목표로 격상합니다.
- 연결 검사: 성공 기준과 연결되지 않은 요구사항 · 기능은 "목표와 무관"으로 표시하고 빼거나 범위 밖으로 옮기게 합니다.
- 변경: 허용하되 새 버전과 이유를 기록합니다. 영향받는 기능은 `needs_recheck`.
- 화면: `/supervisor` 맨 위 목표 카드(성공 기준별 진행, 이탈 경고 수, 확인 대기 수).

### 3-2. 에이전트 연동 4층

MCP는 에이전트가 부를 때만 응답하므로, MCP만으로는 목표가 "권유"에 그칩니다.

| 층 | 무엇으로 | 강도 | 하는 일 |
| :--- | :--- | :--- | :--- |
| 1. MCP | 서버 안내문, 도구 설명, 응답, 프롬프트 | 권유 | 안내문과 응답에 사용자의 진행 중 목표 요약. 목표 기여도 순 다음 작업 |
| 2. 프로젝트 파일 | `AGENTS.md`, `CLAUDE.md` | 세션마다 읽힘 | 잠긴 목표, 성공 기준, 하지 않는 것, 프로젝트 키 |
| 3. 로컬 훅 | 세션 시작, 압축 직전, 종료 | 확정 실행 | 세션 시작과 압축 뒤 목표 · 다음 작업 재주입, 종료 시 미검증 변경 알림 |
| 4. Git · GitHub | `pre-commit`, CI 결과 읽기, (보류) push 웹훅 · GitHub App | 에이전트와 무관 | 서버가 GitHub에서 SHA를 직접 읽어 판정. 웹훅이 붙으면 에이전트가 `link_commit`을 안 불러도 감독 |

- 지금: 1층의 서버 안내문은 고정 문장으로 있음(`lib/mcp/server.ts:910`). 2층은 `get_next_task` 규칙만 있음. 3·4층은 없음.
- 원칙: 에이전트가 협조하면 정확도가 오르고, 협조하지 않아도 감독은 계속됩니다.

**클라이언트별 지원 수준** (2026-11-20 기준, 근거는 [research/2026-11-20-section9.md](research/2026-11-20-section9.md). Antigravity는 확인 조사 중)

"작동"은 아래 다섯 가지를 실제 클라이언트에서 확인한 상태입니다: ① MCP 연결과 도구 호출 ② 세션 시작 때 잠긴 목표가 에이전트에 들어감(훅 또는 규칙 파일) ③ 종료 때 미검증 변경 인계 ④ 커밋 전 검사 ⑤ 개발과 다른 계열 모델이 판정.

| 기준 | Claude Code | Codex | Antigravity |
| :--- | :--- | :--- | :--- |
| ① MCP 연결 | 설치 안내 있음, 실제 연결 기록 없음 | 설치 안내 있음, 실제 연결 기록 없음 | 설치 안내 있음(`~/.gemini/config/mcp_config.json`), 실제 연결 기록 없음 |
| 규칙 파일 | `CLAUDE.md`를 기본으로 읽음 → `AGENTS.md`를 가리키는 `CLAUDE.md` 필요 | `AGENTS.md` | 확인 필요 |
| 서버 안내문 | 4,096자까지 | 앞 512자가 중요 | 확인 필요 |
| ② 시작 때 목표 | SessionStart 훅(묶음 있음, `clear` · `fork` 빠짐) | 훅 지원, `/hooks` 신뢰 필요, 묶음 없음 | 확인 필요 |
| ③ 종료 인계 | Stop 훅(묶음 있음) | Stop 훅 지원, 묶음 없음 | 확인 필요 |
| ④ 커밋 전 검사 | git `pre-commit`(설치는 사용자가 복사) | 같음 | 같음 |
| ⑤ 교차 판정 | `developed_with: claude-code` → GPT | `developed_with: codex` → Haiku | 받는 값 없음 → `VERIFIER_MODELS` 순서대로 |
| 공통 제약 | 훅 스크립트에 `sh` 필요(Windows) | 같음 | 같음 |

- 클라이언트의 고급 기능(서버가 사용자에게 직접 묻기 등)은 있으면 쓰는 보너스로만.

### 3-3. 프로젝트 키와 저장소

- 키: 공개 기회는 `<slug>`, 개인 PRD는 `prd:<dossier_id>`. 기존 `slug` 인자에 `project` 인자를 같은 뜻으로 추가.
- 키 확인: 공개 `<slug>`는 실제로 있는 기회일 때만 받습니다(`getOpportunity`로 확인, 없으면 없는 키와 같이 404). 오타 키로 빈 프로젝트가 생기지 않게 합니다. `prd:<id>`는 본인 dossier일 때만.
- `prd:`는 `userPrdById`(본인 것만)로 가져와 Opportunity 형태(`slug`=키, `name`=제목, `evidence`=저장 원문, `supply`=`rivals` 또는 빈 배열)로 만들어 기존 경로를 그대로 탑니다.
- PRD 수정 시 제목이 같은 기능은 같은 `F-n` 유지(`keepUnchanged`), 바뀐 기능은 `needs_recheck`.
- 저장소 연결: `connect_repo`로 프로젝트에 GitHub 저장소를 묶음. 첫 단계는 공개 저장소(서버 토큰), 다음 단계는 GitHub App(비공개 저장소, push 웹훅).
- 진행 기록 테이블의 `slug`는 `text`라 키 자체는 마이그레이션이 필요 없습니다.

### 3-4. 2단 검증

**1단: 로컬 즉시 (예방, 커밋 전)**
- `pre-commit` · 종료 훅이 바뀐 줄에 정적 검사(3-5)와 이탈 경고(3-6)를 바로 돌립니다. 시크릿 같은 차단 항목은 커밋을 막습니다.
- 결과는 "🔵 로컬 확인"까지입니다. 로컬 훅은 사용자 쪽에서 끌 수 있으므로 확정 판정으로 쓰지 않습니다.

**2단: 서버 확정 (push 후)**

```
push → link_commit(sha) → verify_feature(feature, sha)
  서버가 GitHub API로 그 SHA의 diff · 바뀐 파일 전체 · CI 결과를 먼저 모두 가져옴
  정적 검사 차단 → 모델 호출 없이 반려
  시크릿 마스킹 → 모은 자료와 완료 기준을 한 번에 넣고 모델 1회 판정(필요하면 1회 더)
     모델: 유료, 개발 모델과 다른 계열
  판정마다 코드 인용 → 서버가 그 SHA 파일에서 글자 대조, 안 맞으면 unclear
  "테스트 통과"는 CI success일 때만
  전부 met → 토큰(사용자 · 프로젝트 · 기능 · SHA) → done 시 🟢 감독관 검증
```

- **단순형인 이유:** 모델이 도구를 골라 가며 여러 번 읽는 루프는 시간과 구현이 커집니다. 자료를 먼저 다 모으고 1~2회만 부르면 지금 PRD 생성(운영 중간값 약 55초)과 같은 시간대에 끝납니다.
- 자료가 너무 크면 바뀐 파일과 완료 기준에 걸린 파일만 넣고, 나머지는 "보지 못함"으로 판정에 적습니다.
- 처리: 응답 안에서 끝나면 바로 결과, 길어지면 작업 ID를 주고 `get_verification`으로. 같은 (SHA, 기능)은 재사용.
- 그보다 긴 처리가 필요해지면 Cloudflare의 장기 실행 수단(Workflows, Durable Objects)을 검토합니다(9절 확인 필요).
- **하지 않는 것:** 사용자 저장소의 GitHub Actions 안에서 판정하기. 그 워크플로 파일은 개발 에이전트가 고칠 수 있습니다.
- 비용 상한: 사용자별 하루 횟수를 `consume_ai_usage`로 차감, 실패 시 환불.
- 한계: 모델 판정도 틀릴 수 있고, push하지 않은 작업은 서버가 못 봅니다(그 사이는 1단이 맡음).

### 3-5. 정적 검사와 오탐

| 등급 | 규칙 |
| :--- | :--- |
| 차단 | 알려진 접두사 시크릿 + 엔트로피, `NEXT_PUBLIC_` 시크릿, 새로 추가된 `.skip` 테스트, 새 `not implemented` 예외 |
| 경고 → 검증 에이전트 판정 | TODO 주석, mock/placeholder, 빈 catch, 빈 함수, XSS, SQL 결합, 인증 없는 API |

- 추가된 줄만, 테스트 · fixture · 문서 · 생성 파일 제외, JSX `placeholder=` 제외, 주석 있는 빈 catch 허용.
- `// seedup-allow: <규칙> <이유>` 예외(대시보드에 공개).
- Seedup 최근 머지 커밋 100여 개로 규칙별 오탐률 측정, "오탐" 신고 누적, 높은 규칙은 경고로 강등.
- 서버는 정규식만. AST는 로컬 훅에서만.

### 3-6. 목표 이탈 검사

- 어느 기능에도 묶이지 않은 커밋
- 명세에 없는 화면 · API 경로 · 테이블 추가
- "하지 않는 것"에 해당하는 작업
- 완료된 기능 파일 수정(기존 `needs_recheck`)
- 검증 에이전트가 기능 판정과 함께 "범위 밖 변경"을 보고
- 결과는 MCP 응답, 대시보드, (설정 시) 웹훅 알림으로

### 3-7. 화면 평가

```
미리보기 배포 URL → 유저플로우(S-n)대로 브라우저 실행(열기 · 클릭 · 입력)
  → 화면별 캡처 + 콘솔 오류 + 네트워크 실패
  → 기계 판정 먼저(시나리오 성공 · 실패, 오류) → 비전 모델이 와이어프레임 · 수락 기준과 비교(보조)
  → 화면 인용 + 코드 인용으로 리포트
```

- 실행 위치: Cloudflare Browser Rendering 또는 스타터 팩 CI(Playwright)에서 실행 후 캡처 업로드.
- 유저플로우를 실행 가능한 브라우저 시나리오로 바꿔, 완료 기준을 테스트로 먼저 만듭니다.
- 로그인 화면은 프로젝트가 만든 테스트 계정만 사용. 사용자의 실제 계정 정보는 받지 않습니다.

### 3-8. 실측 토큰과 비용

- Claude Code: `Stop` 훅 입력의 `transcript_path` JSONL에서 응답별 `usage` 합산 후 업로드(대안: OpenTelemetry).
- Codex: `~/.codex/sessions` 세션 로그를 읽는 스크립트.
- `POST /api/usage`(MCP 토큰 인증, 중복 제거) → 기능이 `in_progress`~`done`인 시간 구간으로 기능별 · 성공 기준별 집계.
- 비용은 `pricing.ts` 단가표. 절감액 = (같은 토큰을 최상위 모델로 썼을 때 비용) − (실제 비용).
- Seedup 자체 사용량(`prd_runs`, `verifications`)도 합산.

### 3-9. 오픈소스 · 스킬 · 서비스 추천 (DB 기반)

- 후보: 검토된 고정 목록(`toolkit.ts`) + DB(GitHub 트렌드, AI 제품) 중 기준(존재 · 보관 안 됨 · 라이선스 · 최근 활동 · 별 · 취약점 없음) 통과분 승격. 스킬은 출처 수집 추가.
- 맞추기: 기능(F-n)별 임베딩 + 규칙, 저장소 `package.json`과 선호 스택으로 호환 확인, 이미 쓰는 것은 제외(새 릴리스 · 보안 알림은 제공).
- 전달: 기획 탭 ②(트랙 A의 핵심), `get_next_task`에 기능당 최대 3개, 자세한 것은 `get_build_skill_pack`. 이유는 DB 데이터로.
- 되먹임: 커밋의 `package.json` 변경으로 채택 여부 측정 → 순위 반영.
- 공급망 보안: 패키지 이름은 검증된 저장소와 레지스트리에서 확인된 정확한 이름만. 모델이 이름을 만들지 않음. 제휴가 생겨도 순위는 돈으로 바꾸지 않음.

### 3-10. 근거 보강 (트랙 B, 개발과 먼 분야)

1. 경쟁 앱 1~3점 리뷰, Stack Exchange 비개발 사이트 확대, 한국어 출처(약관 확인 후)
2. 아이디어를 그 분야 사용자의 표현으로 바꿔 검색(글자 대조 유지)
3. 직접 들은 말 등급(출처 · 동의 기록), CSV 고객 문의, 크롬 확장을 모든 사이트로
4. 근거가 없으면 `/try/[slug]` 소개 페이지 · 대기자 명단으로 행동 근거 만들기
5. 근거 등급: 공개 원문 · 행동 · 직접 들은 말은 R-n(등급 표시), 시장 신호는 배경, 없음은 H-n

원칙: 공개 근거는 전부 글자 대조. 검증할 수 없는 근거는 등급으로 구분할 뿐 공개 원문인 척하지 않습니다.

### 3-11. 공유 메모리 (에이전트 · 세션 · 사람 사이)

에이전트를 바꾸거나 세션이 끊겨도, 사람이 둘이어도 같은 기억에서 이어 가게 합니다.

| 종류 | 내용 | 누가 쓰나 |
| :--- | :--- | :--- |
| 목표 | 잠긴 목표, 성공 기준, 하지 않는 것(3-1) | 사람(기획 탭) |
| 결정 기록 | 무엇을 정했나, 왜, 버린 대안, 누가(사람 / 어느 에이전트), 사용자 승인 여부, 관련 F-n · G-n | 에이전트 `record_decision`, 사람은 대시보드 |
| 인수인계 메모 | 세션 끝의 요약: 하던 일, 다음 할 일, 주의할 점, 미검증 변경 | 에이전트 `save_handoff`(종료 · 압축 직전 훅이 호출을 유도) |
| 프로젝트 사실 | 스택, 실행 · 테스트 명령, 필요한 환경 키 **이름**, 건드리면 안 되는 파일 | 에이전트 · 사람 |
| 진행 · 검증 | 기능 상태, 검증 결과, 이탈 기록 | 서버(자동) |

- **원본은 서버입니다.** 저장소의 `AGENTS.md` · `CLAUDE.md`는 서버에서 만든 요약 사본이고, 에이전트 자체 메모리(Claude Code 메모리, Codex 메모리)는 개인 습관용입니다. 프로젝트 사실을 거기에만 두지 않습니다.
- **읽는 곳:** `resume_project` · `get_next_task` 응답에 최근 결정 몇 개와 마지막 인수인계를 짧게, 전체는 `get_project_memory`로. 세션 시작 훅과 `AGENTS.md`에도 요약.
- **비밀값은 저장하지 않습니다.** 환경 키는 이름만, 값은 사용자의 `.env`에만.
- **목표와 충돌하는 결정**(범위 밖 기능 추가, 하지 않는 것 뒤집기)은 사용자 확인 대기로 올리고, 승인되면 목표 새 버전을 만듭니다.
- **크기:** 응답에 싣는 기억은 짧게(토큰 절약), 오래된 결정은 요약으로 접습니다.
- **두 사람 이상(트랙 B):** 항목마다 사람 · 에이전트 출처를 표시하고, 프로젝트 멤버만 읽습니다.

우리 팀(2인) 개발에도 같은 원칙을 씁니다. 공유 기억은 저장소 문서(이 계획, `docs/status.md`, `docs/decisions.md`, `CONTRIBUTING.md`)에 두고, 각자 에이전트의 개인 메모리에만 있는 사실은 공유된 것으로 보지 않습니다.

---

## 4. 공유 계약 (`lib/supervisor/types.ts`, 단계 1에서 가장 먼저 커밋)

단계 1에서는 목표 · 프로젝트 · 공유 메모리 · 검증 · 이탈 타입만 만듭니다. `TierRecommendation`, `Recommendation`, `SkillPack`, `UsageEvent`는 보류 기능용이라 꺼낼 때 추가합니다. 검증 상태 표시는 🟢 `supervisor_verified` · 🔵 `local_checked` · ⚪ `self_reported` 세 가지입니다.

```ts
export type ProjectKey = string; // '<slug>' | `prd:${string}`
export type Track = 'personal' | 'launch';

export type SuccessCriterion = { id: string; text: string; measure: string; status: 'open' | 'partial' | 'met' };
export type ProjectGoal = {
  projectKey: ProjectKey; version: number; track: Track;
  statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[];
  lockedAt: string; changeReason: string | null;
};
export type DriftFinding = {
  kind: 'unlinked_commit' | 'out_of_spec' | 'non_goal' | 'touched_done';
  sha: string; files: string[]; featureIds: string[]; message: string;
};

export type ModelTier = 'fast' | 'standard' | 'reasoning';
export type AuditSeverity = 'blocker' | 'warning';
export type AuditCode = 'LIE_TODO' | 'LIE_MOCK' | 'LIE_EMPTY_CATCH' | 'LIE_SKIPPED_TEST' | 'LIE_EMPTY_IMPL'
  | 'SEC_SECRET_LEAK' | 'SEC_CLIENT_SECRET' | 'SEC_XSS' | 'SEC_SQLI' | 'SEC_NO_AUTH';
export type AuditFinding = { code: AuditCode; category: 'lie' | 'security'; severity: AuditSeverity; file: string; line: number; snippet: string; message: string; fixHint: string; allowed?: string };
export type DiffAuditResult = { passed: boolean; blockerCount: number; warningCount: number; findings: AuditFinding[]; scrubbedDiff: string; redactedCount: number; diffHash: string };

export type CodeCitation = { path: string; line: number; quote: string; verified: boolean };
export type CriterionVerdict = { criterion: string; verdict: 'met' | 'not_met' | 'unclear'; reason: string; citations: CodeCitation[] };
export type VerificationStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'error';
export type Verification = {
  id: string; userId: string; projectKey: ProjectKey; featureId: string; repo: string; sha: string;
  status: VerificationStatus; findings: AuditFinding[]; verdicts: CriterionVerdict[]; drift: DriftFinding[];
  checks: Array<{ name: string; conclusion: string | null }>;
  model: string | null; inputTokens: number; outputTokens: number; costUsd: number;
  token: string | null; createdAt: string; finishedAt: string | null;
};
export type VerificationTokenPayload = { userId: string; projectKey: ProjectKey; featureId: string; sha: string; exp: number };

export type HumanTask = { id: string; title: string; category: 'auth' | 'database' | 'payment' | 'api_key' | 'deploy' | 'decision'; envVars: string[]; estimatedMinutes: number; guideSteps: string[]; unblocksFeatureIds: string[]; mockContractHint: string; done: boolean };
export type TierRecommendation = { featureId: string; tier: ModelTier; models: { claude: string; codex: string; antigravity: string }; reason: string };
export type Recommendation = { kind: 'library' | 'skill' | 'service' | 'check'; name: string; repo: string | null; packageName: string | null; url: string; reason: string; featureIds: string[]; source: 'curated' | 'promoted' };
export type SkillPack = { featureId: string; featureTitle: string; tier: TierRecommendation; rivalPitfalls: string[]; recommendations: Recommendation[]; skillRules: string[] };

export type UsageEvent = { agent: 'claude-code' | 'codex' | 'other'; sessionId: string; messageId: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; at: string };
export type Decision = {
  id: string; projectKey: ProjectKey; goalVersion: number; title: string; why: string; rejected: string[];
  author: { kind: 'person' | 'agent'; name: string }; approved: boolean | null; featureIds: string[]; criterionIds: string[]; at: string;
};
export type Handoff = { projectKey: ProjectKey; agent: string; doing: string; next: string; cautions: string[]; unverifiedShas: string[]; at: string };
export type ProjectFact = { projectKey: ProjectKey; kind: 'stack' | 'command' | 'env_name' | 'do_not_touch' | 'other'; text: string; author: string; at: string };
export type SupervisorProject = { userId: string; projectKey: ProjectKey; repo: string | null; track: Track; strict: boolean; goalVersion: number | null };
```

---

## 5. 단계별 작업 분배 (2인 · 에이전트 5개, 단계 안에서 파일 소유 중복 없음)

**역할:** 장차희는 총괄 · 계획(이 문서와 계획 세션), 정지훈은 기술 구현 · 머지입니다. 아래 A · B는 에이전트 묶음 이름이고, **모든 칸의 기술 책임 · 코드 리뷰 · 머지는 정지훈**입니다. B 칸 에이전트는 장차희가 띄워 시작할 수 있지만 PR은 정지훈이 리뷰하고 머지합니다.

공용 파일(`components/Header.tsx`, `README.md`, `lib/schema-manifest.json`)은 머지 순서에서만 고칩니다. DB 쿼리는 `lib/db/*` 안에서만 작성합니다. 마이그레이션을 두 번째로 머지하는 쪽은 rebase 후 `npx tsx scripts/check-migrations.ts --write`로 매니페스트를 다시 만듭니다.

### 단계 0. 지금 출시 (무료 베타)

- 운영 DB에 `section_views` 마이그레이션 적용, 운영 `OPENROUTER_FREE_ONLY=true` 확인.
- 대표 흐름(아이디어 → 원문 → PRD → `AGENTS.md`/MCP)만 앞에. 로그인 → PRD → 내보내기 → MCP 연결 직접 확인. 덜 된 화면은 숨기거나 베타 표시.
- 알리기: GeekNews Show GN, 디스콰이엇, OKKY, 바이브코딩 오픈채팅. 숫자는 정직하게.

### 단계 1. 핵심 고리 ①: 목표를 잠그고 에이전트에 잇기

| 에이전트 | 담당 | 파일 |
| :--- | :--- | :--- |
| A1 정지훈 · Claude Code | 공유 타입(가장 먼저 단독 PR), 목표 모델(잠금 · 버전 · 연결 검사 · 기여도 순서), 환경 세팅 먼저(사람 할 일 추출), 훅 번들(세션 시작 · 압축 뒤 목표 재주입) | `lib/supervisor/types.ts`, `goal.ts`, `human-queue.ts`, `hook-bundle.ts`, `tests/supervisor-goal.test.ts` |
| A2 정지훈 · Codex | MCP: `prd:<id>`, 서버 안내문에 진행 중 목표, `get_next_task` 목표 요약 · 기여도 순서, `resume_project`, `connect_repo`, `check_env`(키 이름만), 공유 메모리 도구(`record_decision`, `save_handoff`, `get_project_memory`), 목표 · 범위에 영향을 주는 결정이면 응답에 "사용자에게 물어라" 지시, `AGENTS.md`에 목표 · 성공 기준 · 하지 않는 것 · 최근 결정 | `lib/mcp/server.ts`, `endpoint.ts`, `apps.ts`, `lib/opportunities/spec.ts`(내보내기 부분), `tests/mcp-goal.test.ts` |
| A3 정지훈 · Antigravity | 기준 측정: 지금 PRD들의 목표 · 성공 기준 채움 비율, 목표 도달률 측정 스크립트 골격, 발표 서사 갱신 | `scripts/eval-goal.ts`, `docs/scorecard.md`, `docs/pitch-script-2026-11-21.md` |
| B1 · Claude Code | 저장: 프로젝트(트랙 · 저장소 · 엄격 모드 · 목표 버전), 목표 버전 기록, 목표 잠금 API, 공유 메모리(결정 · 인수인계 · 프로젝트 사실) | `supabase/migrations/<시각>_supervisor_projects.sql`(`supervisor_projects`, `project_goals`, `project_memory`), `lib/db/supervisor-projects.ts`, `lib/db/project-goals.ts`, `lib/db/project-memory.ts`, `app/api/projects/[key]/goal/route.ts`, `tests/project-goals.test.ts` |
| B2 · Codex | 기획 탭: 목표 카드와 잠금 화면(목표 문장 · 성공 기준 · 하지 않는 것, PRD의 `goals` · `nonGoals` · `metrics`에서 초안), 트랙 선택(사용자가 고름), 성공 기준과 연결 안 된 요구사항 · 기능 표시 | `components/goal/*`, `components/IdeaWorkspace.tsx`(목표 단계 연결 부분) |

머지 순서: A1 타입 → B1 → A1 나머지 · B2 · A3 → A2 → 운영 마이그레이션 적용 후 배포.

### 단계 1 보완: 칸 사이에 남은 연결 작업

단계 1의 칸들이 각자 끝난 뒤 서로 잇지 못한 곳입니다. 칸 하나로 묶습니다. 담당 정지훈 · Claude Code. 2번은 B2 파일이지만 B2 세션이 끝나 같이 맡습니다.

| 작업 | 내용 | 파일 |
| :--- | :--- | :--- |
| ① 목표 재잠금 → 기능 다시 확인 | 3-1대로 목표가 새 버전으로 잠기면 영향받는 기능을 `needs_recheck`로. 잠금 API가 A1의 `goalChange`를 부르게 함 | `app/api/projects/[key]/goal/route.ts`, `lib/db/project-goals.ts`, `tests/project-goals.test.ts` |
| ② 목표 카드를 A1 판정으로, 성공 기준 id 버그 | `components/goal/draft.ts`의 `unlinkedItems`를 `lib/supervisor/goal.ts`의 것으로 교체. `GoalLock.tsx`가 잠글 때마다 `G-1`부터 다시 매기는 버그 수정(기존 id 유지, 새 기준만 다음 번호) | `components/goal/*`, `tests/goal-draft.test.ts` |
| ③ "환경 세팅 먼저" 보여 주기 | A1 `humanTasks`를 `get_next_task` 응답 맨 앞과 목표 카드 아래에 "사람이 먼저 할 일"로 | `lib/mcp/server.ts`, `components/goal/GoalLock.tsx` |

머지 순서: 단계 1 보완 → 단계 2 A2(`lib/mcp/server.ts`가 겹치므로 보완을 먼저). 단계 2 B2(`/supervisor`, `/agents`)와는 파일이 겹치지 않습니다.

### 단계 2. 핵심 고리 ②: 2단 검증과 이탈 검사

| 에이전트 | 담당 | 파일 |
| :--- | :--- | :--- |
| A1 | 정적 검사(3-5), 검증 토큰, 이탈 판정 규칙(3-6), 훅 번들에 1단 검사 추가(`pre-commit` · 종료 훅) | `lib/supervisor/diff-audit.ts`, `verify-token.ts`, `drift.ts`, `hook-bundle.ts`, `tests/supervisor-core.test.ts` |
| A2 | MCP: SHA 기반 `verify_feature`(응답 안 결과 또는 작업 ID) + `get_verification`, 완료 게이트(🟢 · 🔵 · ⚪, 엄격 모드), 이탈 경고를 응답에 | `lib/mcp/*`, `tests/mcp-supervisor.test.ts` |
| A3 | 불량 diff 25건, Seedup 최근 커밋 100여 개로 규칙별 오탐률, 데모 스크립트 | `tests/fixtures/bad-diffs.json`, `scripts/eval-supervisor.ts`, `scripts/demo-seedup-supervisor.ts` |
| B1 | 서버 검증(단순형): GitHub SHA 자료 모으기, 마스킹 후 모델 1~2회 판정(기존 `callJsonModel` 사용, tool 루프 없음, **데이터 수집을 거부하는 유료 경로만**), 코드 인용 대조, 재사용 · 사용량 차감. 0-4 결정(A안)에 따라 처리방침 문구와 아이디어 입력 화면 안내 한 줄 | `lib/verifier/*`, `lib/db/verifications.ts`, `supabase/migrations/<시각>_verifications.sql`, `tests/verifier.test.ts`, `lib/legal.ts`(처리방침 문구만), `components/IdeaWorkspace.tsx`(안내 한 줄만), `lib/llm.ts`(데이터 수집 거부 옵션 추가만, 공용 파일) |
| B2 | 최소 `/supervisor` 대시보드(목표 카드, 성공 기준별 진행, 기능 신호등, 이탈 경고, 결정 이력), `/agents` 스타터 팩(MCP 설정 · 훅 · `pre-commit`) | `app/api/supervisor/[key]/route.ts`, `app/supervisor/*`, `components/supervisor/*`, `app/agents/page.tsx`, `components/AgentPackDownload.tsx` |

머지 순서: A1 → B1 → A2 → B2 + `Header.tsx` 메뉴 → A3 실측 반영.

### 단계 2 보완: B2 대시보드가 남긴 빈 곳

B2(PR #153)가 대시보드를 만들면서 찾은 빈 곳입니다. 대부분 `lib/db` · `lib/supervisor` · `lib/mcp` 파일이라 기술 책임자(정지훈) 쪽 칸으로 묶습니다. 담당 정지훈(에이전트는 정지훈이 고름). B1 #151 · B2 #153 머지 뒤, 단계 2 A2와 같은 파일은 A2 뒤에 합니다.

| 작업 | 내용 | 파일 |
| :--- | :--- | :--- |
| ① 사용자별 프로젝트 목록 | `supervisor_projects`에서 사용자의 프로젝트를 최근 활동순으로 읽는 함수. 대시보드 목록이 저장 PRD 목록을 대신 쓰지 않게 교체 | `lib/db/supervisor-projects.ts`, `components/supervisor/data.ts`, 관련 테스트 |
| ② 기능별 검증 수준 | 진행 기록에 검증 수준(🟢 `supervisor_verified` · 🔵 `local_checked` · ⚪ `self_reported`)을 저장 · 조회. 🟢는 유효한 검증 토큰이 있을 때만(A2 완료 게이트), 🔵는 로컬 훅 결과를 받을 때만. 대시보드 신호등이 이 값을 씀 | `supabase/migrations/<새 파일>`(`build_progress`에 칸 추가), `lib/opportunities/build-progress.ts`, `lib/mcp/server.ts`(A2 뒤), `components/supervisor/model.ts` |
| ③ 훅 묶음의 `pre-commit` | 계획 3-4의 1단 로컬 검사: 커밋 전에 바뀐 줄로 정적 검사(차단 규칙만 막고 경고는 표시). 스타터 팩에 파일과 설치 안내 추가 | `lib/supervisor/hook-bundle.ts`, `lib/supervisor/local-audit.ts`(로컬 검사), `lib/supervisor/diff-audit.ts`(규칙을 데이터로 꺼내 로컬 · 서버가 같은 규칙을 씀, #157), `tests/` |
| ④ 이탈 검사 입력 보강 | 커밋 연결에 파일 상태(추가 · 수정 · 삭제)를 받고, diff의 마이그레이션에서 새 테이블을 읽어 `findDrift`에 넘김(명세에 없는 화면 · API · 테이블 판정) | `lib/mcp/server.ts`(`link_commit`, A2 뒤), `lib/opportunities/feature-commits.ts`, 필요하면 마이그레이션, `components/supervisor/model.ts` |

| ⑤ 훅 묶음 형식 보완(9절 조사) | SessionStart matcher에 `clear` · `fork` 추가, Stop 입력 JSON을 문자열 대신 구조로 읽기, 프로젝트 루트 기준 경로, upstream 없는 브랜치도 "push 안 됨"으로, 압축 직전(PreCompact) 인계, Codex용 `.codex/hooks.json`(사용자가 `/hooks`에서 신뢰해야 실행), Windows의 `sh` 없음 대응 | `lib/supervisor/hook-bundle.ts`, 관련 테스트 |
| ⑥ 검증 운영 보완(9절 조사) | 실패한 파일 요청에도 상한(지금은 성공 80개만 셈), 요청 수 · 걸린 시간(p50/p95)을 기록, 데이터 수집 필터에 맞는 제공사가 없을 때 명확한 오류와 사용량 환불. 응답 뒤 30초를 넘는 처리는 Workers `waitUntil`로 버틸 수 없으므로, 실측 뒤 필요하면 Workflows 또는 Queues를 계획 세션이 고름 | `lib/verifier/*`, `lib/db/verifications.ts` |

순서: ①(독립) → A2 → ② · ④ → ③ · ⑤ · ⑥(언제든). ②는 마이그레이션이 있어 정지훈이 머지하며 운영 DB에 적용합니다.

### 기획 → 에이전트 연결 (핸드오프)

목표를 잠근 뒤 사용자가 에이전트로 넘어가는 이음새입니다. 넘길 것은 **프로젝트 키(`prd:<id>`) 하나와 첫 호출**이고, 목표 · PRD · 결정 · 사람 할 일은 에이전트가 MCP로 서버에서 가져옵니다(3-2의 4층, 3-11 공유 메모리).

| 단계 | 담당 | 내용 | 파일 |
| :--- | :--- | :--- | :--- |
| 1단계(지금) | Codex(장차희가 지시, 기술 책임 정지훈) | 목표를 잠그면 진행 표시줄 "에이전트" 단계에 화면을 엶: 프로젝트 키, **시작 문장 복사**(키만, 토큰 없음), MCP 연결 상태(`McpConnect` 재사용), `AGENTS.md`(잠긴 목표 · 키 포함) · 스타터 팩 받기(`AgentPackDownload` 재사용), 사람이 먼저 할 일(`humanTasks`), `/supervisor/<키>` 링크. 같은 PR에서 PRD 화면의 `AGENTS.md` 내보내기와 에이전트 안내 문장이 개인 PRD(`prd:<id>`)에도 목표 · 키를 넣게 고침 | `components/goal/*`, `components/IdeaWorkspace.tsx`(에이전트 단계 부분), `components/opportunity-stage/PrdBuilder.tsx`(내보내기 · 안내 문장 부분), 테스트 |
| 2단계(A2 뒤) | 정지훈 | MCP에 저장소 파일(`AGENTS.md`, 훅 묶음)을 돌려주는 도구(`setup_project` 등). 시작 문장이 "파일도 에이전트가 직접 써"로 바뀌어 사용자 할 일은 연결 1번 + 문장 1개. 같은 칸에서 `record_decision`이 목표 · 범위 변경(scope_change)을 받으면 응답에 웹의 목표 재잠금 화면 링크를 줌(MCP에는 목표 잠금 도구가 없고 재잠금은 웹에서만) | `lib/mcp/server.ts`, 테스트 |

- **시작 문장 형식**(웹 · MCP 공통): "Seedup 프로젝트 `<키>`를 이어서 진행해. `resume_project`로 잠긴 목표와 사람이 먼저 할 일을 확인하고, 연결된 저장소가 없으면 공개 GitHub 저장소를 만들거나 고른 뒤 `connect_repo`로 연결해. 그다음 `get_next_task`로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 물어봐." 토큰은 절대 넣지 않음. 서버 검증은 연결된 저장소를 읽으므로 저장소 연결이 첫 검증 전에 필요함.
- Codex 훅은 사용자가 `/hooks`에서 신뢰해야 실행된다는 안내를 화면에 한 줄(9절 조사).
- 저장소가 아직 없으면 에이전트가 만든 뒤 `connect_repo`를 부르게 시작 문장 흐름에 포함(2단계).
- 뒤로 미룸: 도구별 한 줄 실행 명령(`claude "…"` 등, 도구별 확인 뒤), 입구 통합(세 모드를 한 흐름으로, 연결이 먼저 돌아간 뒤 계획 세션이 정함).

### 세 입구, 한 출구 (기획 탭의 세 모드를 같은 출구로)

기획 탭의 "PRD 만들기 · 아이디어 검증 · 레포 분석"을 하나로 합치는 큰 통합(입구 통합) 대신, 세 모드가 모두 **같은 출구(목표 잠금 → 에이전트 단계)**로 들어오게만 잇습니다. 연결 1단계(#163) 뒤에 합니다. 담당 정지훈 · Antigravity([프롬프트](prompts/antigravity-remaining.md) T6).

| 작업 | 내용 | 파일 |
| :--- | :--- | :--- |
| ① 레포 분석 → 출구 | 역기획 PRD를 개인 PRD(`prd:<id>`)로 저장하고, 그 아래에 목표 잠금(`GoalLock`)과 에이전트 단계(`AgentHandoff`)를 붙임. 분석한 저장소를 프로젝트 저장소로 저장(첫 검증 전에 `connect_repo`가 필요 없게) | `components/SeedAdvisor.tsx`(PRD 부분), 필요하면 프로젝트 저장소를 저장하는 작은 API(`lib/db/supervisor-projects.ts`의 기존 함수 사용) |
| ② 아이디어 검증 → PRD에 근거 | "이 아이디어로 PRD 만들기"가 리포트의 원문(증거 id) · 경쟁 도구까지 PRD 입력으로 넘김. 그다음은 기존 PRD 흐름 | `components/ValidationReportPanel.tsx`, `components/IdeaWorkspace.tsx`(받는 부분만) |
| ③ MCP 연동 페이지 | `/agents`에서 내 프로젝트마다 시작 문장 복사(연결 1단계의 문장 함수 재사용) | `app/agents/page.tsx`, `components/AgentPackDownload.tsx` |

### 흐름 전체 E2E

로그인 → PRD → 목표 잠금 → 에이전트 단계(시작 문장) → MCP `resume_project` · `connect_repo` · `get_next_task` → `verify_feature` → 🟢 완료까지 한 번에 확인하는 테스트. GitHub와 검증 모델은 가짜로 바꿈. 세 입구 ① · ②가 들어오면 그 경로도 추가. 담당 정지훈(에이전트는 정지훈이 고름), 파일 `e2e/*`와 MCP 통합 테스트.



### 클라이언트 호환과 실제 연결 확인

Claude Code · Codex · Antigravity에서 위 "작동" 다섯 가지가 빠짐없이 되게 합니다. ②는 "실제 프로젝트 3개" 게이트의 첫 번째(운영 확인)를 겸합니다.

| 작업 | 담당 | 내용 |
| :--- | :--- | :--- |
| ① Antigravity 확인 조사 | Codex(장차희 지시, 웹 검색, 코드 변경 없음) | 9절 조사와 같은 형식으로 Antigravity의 규칙 파일 위치(`AGENTS.md` · `GEMINI.md` 등), 훅 지원, 서버 안내문 반영, 카드 표시, 원격 MCP(`serverUrl`) 인증 방식. [프롬프트](prompts/codex-antigravity-research.md) |
| ② 클라이언트별 실제 연결 확인 | 사람: 장차희(Claude Code, Codex), 정지훈(Antigravity, 운영 준비 직후) | 공개 테스트 저장소 하나로 연결 → `resume_project` → `connect_repo` → `get_next_task` → `update_feature_status`(in_progress) → 작은 커밋 push → `verify_feature` → `update_feature_status`(done, 토큰) → `/supervisor` 확인. 결과는 클라이언트별 다섯 기준 표로 `docs/research/<날짜>-client-check.md`. [확인 순서](prompts/client-check.md) |
| ③ 호환 보완 코드 | 정지훈(단계 2 보완 ⑤를 넓힘) | Claude Code용 `CLAUDE.md`(`AGENTS.md`를 가리키는 한 줄) 제공(에이전트 단계 화면 · `setup_project`), 서버 안내문 앞 512자에 감독 핵심(프로젝트 키 → `resume_project` → `get_next_task`, 목표 · 범위 변경 전 확인)을 먼저 두고 리서치 설명은 뒤로, `developed_with`에 `antigravity` 추가와 개발 모델 계열을 직접 받는 입력(결정 대기), `.codex/hooks.json`, Windows `sh` 대응 |
| ④ 스타터 팩 문구 버그 | 세 입구 ③에 포함(같은 파일, T6) | `AgentPackDownload`의 "현재 번들에는 pre-commit 검사가 없습니다"는 #157 뒤로 틀림. 실제 묶음 내용대로 고침 |

### MCP 도구 정리 (결정 대기, 정지훈)

실제 사용자가 아직 없어 이름을 바꾸기 가장 싼 때입니다. 만능 도구 하나(action 인자)로 몰지 않고, 읽기 전용 구분과 DESIGN.md 8절의 `Next:` 흐름은 유지합니다. **계획 세션 추천안**(23 → 19개):

| 제안 | 추천 | 이유 |
| :--- | :--- | :--- |
| `mark_feature_done` 제거 | 제거 | `update_feature_status`(done)와 같은 옛 이름 |
| `get_build_checklist`를 `resume_project`에 합침 | 합침 | 시작할 때 한 번에 받는 정보 |
| `get_verification`을 `verify_feature` 재호출로 | 대체 | 같은 (SHA, 기능)은 서버가 저장 결과를 돌려줌(B1 재사용) |
| `list_my_prds` + `get_my_prd` | 합침(`id`가 있으면 하나) | 둘 다 읽기 전용, 입력이 겹침 |
| `verify_feature`가 커밋 연결까지 | 자동 연결만 하고 `link_commit`은 **유지** | 검증하지 않는 커밋도 이탈 · 재확인에 필요 |
| 기획용 · 개발용 도구 분리(엔드포인트 둘 또는 프로젝트 세션은 개발용만) | **미룸** | 입구 통합 결정과 묶임. 대신 도구 설명 앞에 [기획] · [개발] 표시와 안내문 순서로 구분 |

PR: 연결 2(`setup_project`) **앞**에 별도 PR(이름 정리와 새 도구를 나눠 리뷰를 쉽게). README · `/agents` 도구 목록 · 테스트를 같은 PR에서 고침.

**단계 2에 함께 하는 것 (코드 칸 밖)**

| 작업 | 담당 | 내용 | 시점 |
| :--- | :--- | :--- | :--- |
| MCP 화면 · 응답 기준 | 완료: `DESIGN.md` 8절(정지훈 초안 #147, 계획 세션 확정) | MCP Apps 카드 토큰을 DESIGN.md v2에 맞추기, 도구 응답 글 형식(첫 줄 결론 → 목표 요약 → 다음 행동), 🟢 · 🔵 · ⚪ 검증 표시 규칙, "사용자에게 물어라" 안내 형식, 카드를 붙일 도구 목록 | 단계 2 A2가 검증 결과를 보여 주기 전 |
| 9절 "확인이 필요한 것" 조사 | Codex(장차희가 지시, 낮은 추론). 코드는 고치지 않음 | 훅 입력 형식(Claude Code · Codex), GitHub API 한도, Workers 시간 제한과 Browser Rendering 가격, GitHub 트렌드 · AI 제품 테이블의 라이선스 · 패키지 이름 필드. 결과는 9절 갱신 제안으로 | 단계 2 B2 뒤, 보류 기능 크기를 정하기 전 |

단계 2 A2는 "단계 1 보완"이 머지된 뒤 시작합니다(`lib/mcp/server.ts` 겹침). 보류 기능은 보류 절의 조건이 될 때까지 시작하지 않습니다.

### 보류 (핵심 고리가 실제 프로젝트에서 끝까지 돈 뒤 하나씩 꺼냄)

꺼내는 조건: 핵심 고리(단계 1~2)로 실제 프로젝트 3개 이상이 목표 잠금부터 🟢 검증까지 간 뒤, 7절 지표를 보고 계획 세션이 순서를 정합니다.

| 보류 항목 | 관련 절 | 비고 |
| :--- | :--- | :--- |
| 역질문 루프 반복(멈춤 기준, 기본값 버튼), 트랙 자동 분류 | 2-1 | 지금은 기존 질문 + 사용자가 트랙 선택 |
| 트랙 B 협업 세팅(컨벤션 · R&R · 권한 생성기) | 2-1 ④ | |
| GitHub App · push 웹훅, 비공개 저장소 | 3-2 4층, 3-3 | 지금은 공개 저장소 + `link_commit`. **결정 대기:** 비공개 저장소 검증을 출시 전 필수로 꺼낼지 |
| 화면 평가(브라우저 · 캡처 · 비전 모델) | 3-7 | |
| 프로젝트 전체 · 아키텍처 · 트랙별 평가, 개선 루프 자동화 | 2-3 | 지금은 성공 기준별 진행만 |
| 실측 토큰 · 비용 트래커, 단가표, 모델 등급 추천 | 3-8 | |
| 오픈소스 · 스킬 추천 승격 엔진, 스킬 팩 | 3-9 | 기존 `toolkit` 추천은 그대로 사용 |
| 근거 보강 | 3-10 | 엔진 동결 해제 후 |
| codebase-memory-mcp 연동 | | |
| 장기 실행(Cloudflare Workflows 등), tool calling 검증 루프 | 3-4 | 단순형으로 부족할 때만 |
| 심층 감독(엄격 모드 · 여러 파일 기능만 읽기 전용 감독 에이전트, 근거 줄 서버 재대조, 단계 · 비용 상한, Workflows · Queues) | 3-4 | 1절 "검증은 단순형" 결정을 바꾸는 일. 여러 파일 불량 diff로 단순형과 비교 측정한 뒤 계획 세션이 정함 |

---

## 6. 범위 밖

- **유료화는 지금 고려하지 않습니다.** 가격, 결제, 크레딧, 유료 플랜, 가격 대기자 명단은 계획에 넣지 않습니다. 비용 관련 기능은 운영 보호(하루 한도, 유료 모델 비용 상한)와 사용자에게 보여 주는 실측 토큰 · 비용까지만 합니다.
- 기존 계획의 "하지 않을 것"은 그대로 이어받습니다: 대상별 화면 분기(입문자 모드 등), 검증 없이 웹 결과를 원문으로 넣기, 실시간 동시 편집, 학습 기능.
- 위험으로 기억할 것: 플랫폼(Claude · Codex가 자체 기능 추가), 데이터 양, 수요 미확인. 오래 남는 차이는 바깥에 있음 · 도구 중립 · 목표와 근거.

---

## 7. 지표

- **목표 도달률**(북극성): 완료 시점 충족 성공 기준 비율
- 이탈 조기 발견: 범위 밖 작업이 몇 커밋 만에 잡혔나
- 범위 밖 작업 비율, 목표 변경 횟수와 이유
- 검증: 규칙별 오탐률, 검증자가 놓친 결함 수
- 비용: 기능 · 성공 기준별 실측 토큰과 비용, 절감액
- 운영: PRD 성공률과 시간, 섹션 → PRD 전환(`scripts/section-usage.ts`)

---

## 8. 에이전트 시작 지시 (복사용)

```
최신 main에서 브랜치 <브랜치명>을 만들어 작업해.
먼저 AGENTS.md, DESIGN.md, docs/supervisor-plan.md를 읽어.
너는 이 문서 5절 단계 <n>의 <에이전트> 담당이고, 그 칸에 적힌 파일만 만들거나 고쳐. 다른 파일이 필요하면 고치지 말고 나에게 알려.
공유 타입은 lib/supervisor/types.ts(4절)를 그대로 쓰고, 바꿔야 하면 나에게 먼저 말해.
DB 쿼리는 lib/db/* 안에서만 작성해.
끝나면 npm run typecheck && npm run lint && npm test를 통과시키고 PR을 열어.
```

---

## 9. 확인이 필요한 것

2026-11-20 조사([research/2026-11-20-section9.md](research/2026-11-20-section9.md), 공식 문서 근거)로 확인된 것은 해당 절과 단계 2 보완 ⑤ · ⑥으로 옮겼습니다. 요점:

- **훅:** Claude Code · Codex 모두 SessionStart · PreCompact · Stop을 지원하고, Stop은 `{"decision":"block","reason":…}`로 이어 가게 함. Codex 훅은 사용자가 `/hooks`에서 신뢰해야 실행. 지금 훅 묶음의 어긋난 곳은 보완 ⑤. Claude Code 사용량은 OpenTelemetry `claude_code.token.usage` · `claude_code.cost.usage`(비용은 근삿값).
- **MCP 클라이언트:** 서버 안내문은 Claude Code · Codex · VS Code가 반영(Cursor는 확인 못 함). 사용자 확인 요청(elicitation)은 클라이언트마다 다르고, MCP Apps 카드는 Cursor · VS Code 지원, Claude Code · Codex CLI는 확인 못 함. 그래서 텍스트 응답을 기본으로 하고 카드 · 확인 요청은 선택(1절 "승인은 터미널 대화" 유지).
- **GitHub 한도:** 토큰 하나에 시간당 5,000회, 검증 1회에 보통 `5 + 읽은 파일 수`회 → 시간당 약 60~1,000회 검증(예산 계산, 실측 아님).
- **Workers:** 연결이 살아 있는 동안 경과 시간 상한은 없지만 CPU(무료 10ms, 유료 기본 30초)와 응답 뒤 `waitUntil` 30초 제한이 있음. Workflows · Durable Objects · Queues는 무료 · 유료 모두 제공. Browser Run(옛 Browser Rendering)은 무료 하루 10분, 유료 월 10시간 + 시간당 $0.09.
- **외부 출처(3-10, 보류 유지):** 네이버 검색 API는 FAQ상 장기 저장 · 재가공 불가, YouTube 댓글은 30일 안에 갱신 또는 삭제, 경쟁 앱 리뷰 RSS는 공식 지원 · 재이용 허락 확인 못 함. 영구 인용 근거로 쓰려면 권리 확인이 먼저.
- **OpenRouter:** 두 검증 모델 모두 등재(1절 ID). `data_collection: "deny"`는 라우팅 필터이고, 무보관은 계정의 ZDR · Safety Retention 설정에 달림.
- **DB:** `github_trends` · `ai_products`에 라이선스 · 패키지 이름 칸 없음(3-9 추천 승격은 스키마 · 수집까지 포함한 보류 작업).

**아직 확인할 것**

- Seedup의 Cloudflare 요금제와 CPU 설정, GitHub 토큰 종류(정지훈)
- 실제 검증 1회의 걸린 시간 p50/p95와 GitHub 요청 수(단계 2 보완 ⑥에서 기록)
- OpenRouter 계정의 privacy · Safety Retention 설정, 두 모델이 deny 필터 아래 실제로 호출되는지(정지훈, 유료 요청 1회씩)
- 훅을 지원 CLI 버전별로 실제 실행: 시작 · clear · fork · 압축 · 중단 · 재개(보완 ⑤ 테스트)
- Codex 저장 세션 로그의 토큰 필드 위치(내부 형식이라 계약으로 쓰지 않음, 실측 토큰은 보류 3-8)
- Cursor의 서버 안내문 반영, Claude Code · Codex CLI의 카드 표시
- codebase-memory-mcp 출력 형식, 운영 PRD의 `goals` · `nonGoals` · `metrics` 채움 비율(A3 단계 1 측정)

---

## 10. 기존 계획에서 이어받는 작업

### 10-1. 지금 상태

숫자와 진행(머지된 PR, 남은 CX, 마이그레이션, 테스트, MCP 도구 수, 단계별 진행)은 [status.md](status.md)에만 적습니다. 이 문서에는 계획상 제약만 둡니다.

- **데이터 수집 동결:** 3개월치 수집이 끝날 때까지 엔진 · 수집 파일은 고치지 않습니다(파일 목록은 status.md 1절). 3-10(근거 보강)과 아래 엔진 작업은 그 뒤에 합니다.

### 10-2. `work-plan-merged-2026-11-20.md`의 남은 항목이 가는 곳

| 기존 항목 | 상태 | 이 문서에서 |
| :--- | :--- | :--- |
| 0-4 사용자 코드 · 아이디어가 무료 모델로 감 | 결정됨(A안) | 아이디어 · PRD는 무료 모델 유지 + 처리방침과 화면에 "무료 모델 제공사가 입력을 기록 · 학습에 쓸 수 있음" 명시. 코드(검증)는 데이터 수집을 거부하는 유료 경로로만 보내고 처리방침에 명시. 구현은 단계 2 B1 |
| 0-7 SSRF(Node 사설 IP) | 엔진 동결 | 동결 해제 후 첫 작업 |
| 1-1 인용 정밀도 사람 라벨 · KPI | 사람 일 | 계속 진행(트랙 B 근거 신뢰의 바탕) |
| 1-3 조사 에이전트 켜기 · 엔진 적용 | 일부 | 보류(3-10과 묶음, 동결 해제 후) |
| 1-4~1-7 홍보 글 · HN 쏠림 · 합치기 · 임계값 | 엔진 동결 | 보류(3-10과 묶음, 동결 해제 후) |
| 1-9 사람 블라인드 채점 | 사람 일 | 계속 진행(도구는 CX-1로 있음) |
| 2-8 평가를 다음 실험으로 | 남음 | 3-10의 4번(`/try`로 행동 근거) |
| 3-3 대상별 출력(CX-8) | 남음 | 보류(트랙별 내보내기로 나중에 흡수) |
| 3-4 메뉴 정리 · 범위 동결 | 결정 대기 | 단계 0 |
| 3-5 저장 0건 원인 | 남음 | 단계 0 |
| 4-1 RAG 개선(도구는 CX-13) | 남음 | 보류(3-9 추천의 기반) |
| 4-2 모델 호출 경로 하나로 | 엔진 동결 | 동결 해제 후. 단계 2 B1의 `lib/llm.ts` 작업과 충돌하지 않게 순서 맞춤 |
| 4-3 유료 모델 | 바뀜 | 1절 결정(검증 · 평가는 유료 모델)으로 대체 |
| 5-1 배포 전 점검 | 남음 | 보류(2-3 평가). 1단 로컬 검사가 일부를 맡음 |
| 5-3 PRD 모듈 · 보강 에이전트(CX-7) | 남음 | 보류(역질문 루프 반복과 함께) |
| 5-4 저장소 기반 슬롯 | 남음 | 보류(`connect_repo` 활용) |
| 6-1 팀 기능(CX-14 서버 버전 · 댓글) | 남음 | 버전 기록은 단계 1 목표 버전 · 공유 메모리로, 댓글 · 권한은 보류(트랙 B 협업) |
| 6-2 대상 넓히기 | 남음 | 3-10(동결 해제 후) |
| 6-3 B2B 준비 | 보류 | 계획 밖 |
| 인터뷰 10명, 운영 지표 | 사람 일 | 계속 진행. 지표는 7절 |
| 가격 대기 신청, 첫 유료 사용자 10명 | 제외 | 6절(유료화 고려 안 함) |
| 로그인 없이 PRD 만들기 | 결정 대기 | 단계 0 |

### 10-3. 기존 원칙과 맞춘 것

- 기존 계획의 "판정 · 점수 · 증언 채택을 모델에 넘기지 않는다"는 **증언 채택과 아이디어 점수**에는 그대로 적용합니다(채택은 글자 대조 규칙만).
- 기능 완료 판정은 검증 에이전트가 하지만, 코드 인용 글자 대조와 CI · 화면 같은 기계 판정을 근거로만 하고, 결과는 "감독관 검증"으로 출처를 표시합니다. 사람은 언제든 뒤집을 수 있습니다.

---

## 11. 문서 정리와 작업 규약 (완료)

- **D1 문서 정리:** PR #126으로 완료. `docs/status.md`, `docs/README.md`, `docs/archive/`(문서 17개, 옮긴 이유는 `archive/README.md`).
- **D2 작업 규약:** PR #125로 완료. 루트 `CONTRIBUTING.md`, `.github/pull_request_template.md`, `docs/decisions.md`, `AGENTS.md`의 규약 안내.
- 남은 것: 운영 DB 마이그레이션 적용 담당(CONTRIBUTING 7절의 "머지한 사람")은 아직 합의 전이라 status.md 결정 대기에 둡니다. 해커톤 뒤 `hackathon-judging-2026-11-19.md` 보관.

---

## 바뀐 기록

- 2026-11-20: 목표 중심 계획으로 새로 씀. 이 문서를 최상위 계획으로 정함. 유료화를 범위 밖으로 뺌. 공유 메모리(3-11) 추가. 기존 계획의 남은 항목을 10절로 옮김. 문서 정리 · 규약 묶음(11절) 정의.
- 2026-11-20: 외부 평가 반영. 대상을 "AI 네이티브 1인 빌더"로 좁히고 GitHub 없는 "로컬 확인" 경로 추가. 범위를 핵심 고리(단계 1~2)와 보류로 다시 나눔(기존 단계 3과 일부 단계 1~2 항목을 보류로). 검증을 2단(로컬 즉시 + 서버 단순형)으로 바꾸고 tool calling 루프와 사용자 저장소 CI 안 판정을 뺌. 승인은 터미널 대화에서, 대시보드는 이력만. 이미 끝난 AG-2 · AG-3 · AG-6을 단계 1에서 뺌.
- 2026-11-20: 10-1의 상태 숫자를 status.md로 넘김(중복 제거). 11절(D1 · D2)을 완료로 접음.
- 2026-11-20: 역할 확정. 장차희 총괄 · 계획, 정지훈 기술 구현 · 머지(모든 칸의 기술 책임 · 리뷰 · 머지). 5절 B 칸에서 사람 이름을 빼고 역할 문단 추가.
- 2026-11-20: 3-3에 공개 slug 키는 실제 기회인지 확인한다는 규칙 추가(PR #131 검토 중 결정).
- 2026-11-20: 단계 1 보완 칸 추가(정지훈 제안: 목표 재잠금 → 기능 재확인, 목표 카드 A1 판정 · 성공 기준 id 버그, 사람이 먼저 할 일 표시). 담당 정지훈 · Claude Code.
- 2026-11-20: 단계 2에 코드 칸 밖 작업 2개 추가(MCP 화면 · 응답 기준, 9절 조사). 정지훈 제안 반영.
- 2026-11-20: 0-4 결정(A안). 단계 2 B1 칸에 데이터 수집 거부 유료 경로, 처리방침 문구, 화면 안내 한 줄 추가.
- 2026-11-20: DESIGN.md 8절 MCP 화면 · 응답 기준 확정.
- 2026-11-20: 검증 모델(GPT 6.2 Sol · Haiku 5.5, 교차 계열), 유료 비용 보호(OpenRouter 지출 한도 + 사용자별 하루 횟수), 실제 프로젝트 검증 시점(단계 2 완료 뒤) 반영. 정지훈 결정.
- 2026-11-20: 단계 2 보완 칸 추가(B2 #153이 남긴 빈 곳 4개: 프로젝트 목록 함수, 기능별 검증 수준, pre-commit, 이탈 입력). 담당 정지훈.
- 2026-11-20: 9절 조사 반영(Codex, 공식 문서 근거). 확인된 사실을 9절 요점으로, 단계 2 보완에 ⑤ 훅 형식 · ⑥ 검증 운영 추가, 1절 모델 줄에 OpenRouter ID와 deny의 의미.
- 2026-11-20: "기획 → 에이전트 연결" 칸 추가. 1단계 웹 에이전트 단계 화면 + 개인 PRD 내보내기에 목표 · 키(지금, Codex), 2단계 MCP 파일 제공 도구(A2 뒤, 정지훈).
- 2026-11-20: 시작 문장에 저장소 연결(`connect_repo`) 추가, 연결 2단계에 목표 변경 안내 추가, "세 입구, 한 출구"와 흐름 전체 E2E 칸 추가.
- 2026-11-20: 정지훈 요청 반영. 3-2에 클라이언트별 지원 수준 표와 "작동" 기준, "클라이언트 호환과 실제 연결 확인" 칸, "MCP 도구 정리"(추천안, 결정 대기) 칸, 보류에 심층 감독 추가 · GitHub App 결정 대기 표시.
- 2026-11-20: 단계 2 보완 ② · ④ · ⑤ · ⑥, 연결 2, 세 입구 한 출구, 흐름 E2E를 정지훈 · Antigravity가 진행(프롬프트 `prompts/antigravity-remaining.md` T1~T7). 세 입구 한 출구 담당을 장차희 Codex에서 정지훈 Antigravity로 옮김.
- 2026-11-20: 처리방침 문구(출시 전 준비)와 성적표 숫자 갱신을 장차희 Codex로 옮김(정지훈 T1~T7과 파일이 겹치지 않음).
