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
| 모델 | 기획 초안은 무료 모델 가능. 검증, 배포 전 테스트, 평가는 유료 모델 |
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
- 클라이언트의 고급 기능(서버가 사용자에게 직접 묻기 등)은 있으면 쓰는 보너스로만.

### 3-3. 프로젝트 키와 저장소

- 키: 공개 기회는 `<slug>`, 개인 PRD는 `prd:<dossier_id>`. 기존 `slug` 인자에 `project` 인자를 같은 뜻으로 추가.
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
| B1 장차희 · Claude Code | 저장: 프로젝트(트랙 · 저장소 · 엄격 모드 · 목표 버전), 목표 버전 기록, 목표 잠금 API, 공유 메모리(결정 · 인수인계 · 프로젝트 사실) | `supabase/migrations/<시각>_supervisor_projects.sql`(`supervisor_projects`, `project_goals`, `project_memory`), `lib/db/supervisor-projects.ts`, `lib/db/project-goals.ts`, `lib/db/project-memory.ts`, `app/api/projects/[key]/goal/route.ts`, `tests/project-goals.test.ts` |
| B2 장차희 · Codex | 기획 탭: 목표 카드와 잠금 화면(목표 문장 · 성공 기준 · 하지 않는 것, PRD의 `goals` · `nonGoals` · `metrics`에서 초안), 트랙 선택(사용자가 고름), 성공 기준과 연결 안 된 요구사항 · 기능 표시 | `components/goal/*`, `components/IdeaWorkspace.tsx`(목표 단계 연결 부분) |

머지 순서: A1 타입 → B1 → A1 나머지 · B2 · A3 → A2 → 운영 마이그레이션 적용 후 배포.

### 단계 2. 핵심 고리 ②: 2단 검증과 이탈 검사

| 에이전트 | 담당 | 파일 |
| :--- | :--- | :--- |
| A1 | 정적 검사(3-5), 검증 토큰, 이탈 판정 규칙(3-6), 훅 번들에 1단 검사 추가(`pre-commit` · 종료 훅) | `lib/supervisor/diff-audit.ts`, `verify-token.ts`, `drift.ts`, `hook-bundle.ts`, `tests/supervisor-core.test.ts` |
| A2 | MCP: SHA 기반 `verify_feature`(응답 안 결과 또는 작업 ID) + `get_verification`, 완료 게이트(🟢 · 🔵 · ⚪, 엄격 모드), 이탈 경고를 응답에 | `lib/mcp/*`, `tests/mcp-supervisor.test.ts` |
| A3 | 불량 diff 25건, Seedup 최근 커밋 100여 개로 규칙별 오탐률, 데모 스크립트 | `tests/fixtures/bad-diffs.json`, `scripts/eval-supervisor.ts`, `scripts/demo-seedup-supervisor.ts` |
| B1 | 서버 검증(단순형): GitHub SHA 자료 모으기, 마스킹 후 모델 1~2회 판정(기존 `callJsonModel` 사용, tool 루프 없음), 코드 인용 대조, 재사용 · 사용량 차감 | `lib/verifier/*`, `lib/db/verifications.ts`, `supabase/migrations/<시각>_verifications.sql`, `tests/verifier.test.ts` |
| B2 | 최소 `/supervisor` 대시보드(목표 카드, 성공 기준별 진행, 기능 신호등, 이탈 경고, 결정 이력), `/agents` 스타터 팩(MCP 설정 · 훅 · `pre-commit`) | `app/api/supervisor/[key]/route.ts`, `app/supervisor/*`, `components/supervisor/*`, `app/agents/page.tsx`, `components/AgentPackDownload.tsx` |

머지 순서: A1 → B1 → A2 → B2 + `Header.tsx` 메뉴 → A3 실측 반영.

### 보류 (핵심 고리가 실제 프로젝트에서 끝까지 돈 뒤 하나씩 꺼냄)

꺼내는 조건: 핵심 고리(단계 1~2)로 실제 프로젝트 3개 이상이 목표 잠금부터 🟢 검증까지 간 뒤, 7절 지표를 보고 계획 세션이 순서를 정합니다.

| 보류 항목 | 관련 절 | 비고 |
| :--- | :--- | :--- |
| 역질문 루프 반복(멈춤 기준, 기본값 버튼), 트랙 자동 분류 | 2-1 | 지금은 기존 질문 + 사용자가 트랙 선택 |
| 트랙 B 협업 세팅(컨벤션 · R&R · 권한 생성기) | 2-1 ④ | |
| GitHub App · push 웹훅, 비공개 저장소 | 3-2 4층, 3-3 | 지금은 공개 저장소 + `link_commit` |
| 화면 평가(브라우저 · 캡처 · 비전 모델) | 3-7 | |
| 프로젝트 전체 · 아키텍처 · 트랙별 평가, 개선 루프 자동화 | 2-3 | 지금은 성공 기준별 진행만 |
| 실측 토큰 · 비용 트래커, 단가표, 모델 등급 추천 | 3-8 | |
| 오픈소스 · 스킬 추천 승격 엔진, 스킬 팩 | 3-9 | 기존 `toolkit` 추천은 그대로 사용 |
| 근거 보강 | 3-10 | 엔진 동결 해제 후 |
| codebase-memory-mcp 연동 | | |
| 장기 실행(Cloudflare Workflows 등), tool calling 검증 루프 | 3-4 | 단순형으로 부족할 때만 |

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

- Claude Code 훅(세션 시작 · 압축 · 종료) 입력 형식과 동작, OpenTelemetry 지표, Codex 훅 · 세션 로그 형식(B2, A1이 구현 전 확인)
- MCP 서버 안내문을 클라이언트별로 얼마나 반영하는지, 사용자 확인 요청 지원 범위
- GitHub API 한도, 단순형 검증이 실제로 응답 시간 안에 끝나는지, Seedup의 Cloudflare 요금제와 Workers 백그라운드 시간 제한, Workflows · Durable Objects 제공 범위(판정을 사용자 저장소 CI로 옮기는 것은 하지 않음)
- Cloudflare Browser Rendering 제공 범위와 가격
- codebase-memory-mcp 실제 출력 형식, App Store 리뷰 피드 · 네이버 · YouTube API 약관
- GitHub 트렌드 · AI 제품 테이블의 라이선스 · 패키지 이름 필드
- 운영 PRD에서 `goals` · `nonGoals` · `metrics`가 실제로 채워지는 비율(A3 단계 1)

---

## 10. 기존 계획에서 이어받는 작업

### 10-1. 지금 상태

숫자와 진행(머지된 PR, 남은 CX, 마이그레이션, 테스트, MCP 도구 수, 단계별 진행)은 [status.md](status.md)에만 적습니다. 이 문서에는 계획상 제약만 둡니다.

- **데이터 수집 동결:** 3개월치 수집이 끝날 때까지 엔진 · 수집 파일은 고치지 않습니다(파일 목록은 status.md 1절). 3-10(근거 보강)과 아래 엔진 작업은 그 뒤에 합니다.

### 10-2. `work-plan-merged-2026-11-20.md`의 남은 항목이 가는 곳

| 기존 항목 | 상태 | 이 문서에서 |
| :--- | :--- | :--- |
| 0-4 사용자 코드 · 아이디어가 무료 모델로 감 | 결정 대기 | 단계 2 전제 조건. 검증 · 평가는 유료 모델(1절)로 가므로, 무엇이 어느 모델로 가는지 개인정보 처리방침에 밝힘 |
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
