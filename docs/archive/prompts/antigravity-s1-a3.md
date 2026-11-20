# Antigravity 시작 프롬프트: 단계 1 A3 (기준 측정 · 발표 서사)

담당 정지훈 · Antigravity. 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 단계 1 A3, 확인할 것은 9절 마지막 줄("운영 PRD에서 `goals` · `nonGoals` · `metrics`가 실제로 채워지는 비율")입니다.

## 시작 전에 사람이 확인할 것

- 작업 1(기준 측정)과 작업 2(발표 서사)는 **지금 바로** 시작할 수 있습니다. 발표가 2026-11-21이라 작업 2가 급합니다.
- 작업 3(목표 도달률 스크립트 골격)은 A1의 `lib/supervisor/types.ts`([#132](https://github.com/rerereally/Seedup_ver2/pull/132))가 `main`에 머지된 뒤에 합니다.
- 작업 1은 운영 DB를 읽기만 합니다. `.env`에 `SUPABASE_SECRET_KEY`가 있어야 합니다.
- 지금은 `main` 머지 동결 중이고 **문서 PR만 예외**입니다(`docs/status.md` 1절). 그래서 PR을 둘로 나눕니다. 문서 PR(대본 · 성적표)은 발표 전에 머지할 수 있고, 스크립트 PR은 발표 뒤에 머지합니다.

## 붙여 넣을 프롬프트

```
먼저 AGENTS.md, CONTRIBUTING.md, docs/supervisor-plan.md, docs/scorecard.md, docs/status.md를 읽어.
너는 docs/supervisor-plan.md 5절 단계 1의 A3(Antigravity) 담당이야. PR을 두 개로 나눠서 열어.
  PR 1 (스크립트): 최신 main에서 브랜치 feat/s1-a3-goal-baseline. 파일 scripts/eval-goal.ts, eval-results/<YYYY-MM-DD>-goal-baseline.json
  PR 2 (문서):     최신 main에서 브랜치 docs/s1-a3-pitch.        파일 docs/pitch-script-2026-11-21.md, docs/scorecard.md
위 파일 말고는 고치지 마. 다른 파일이 필요하면 고치지 말고 나에게 알려.
lib/*, components/*, app/*, 수집 동결 파일(docs/status.md 1절 목록)은 건드리지 마.
docs/status.md, docs/supervisor-plan.md, docs/decisions.md도 고치지 마(CONTRIBUTING.md 8절 "문서는 누가 언제 고치나").

[작업 1. 기준 측정: 지금 PRD에 목표가 얼마나 채워져 있나 → PR 1]
- scripts/eval-goal.ts를 만들어. 읽기 전용이고, DB를 읽는 방식은 scripts/section-usage.ts를 따라(서비스 키로 읽기만, 쓰기 없음).
- evidence_dossiers에서 prd_markdown이 있는 행을 읽고, PRD마다 아래 섹션이 "실제로 채워졌는지" 세:
  "## 목표"/"## Goals", "## 하지 않을 것"/"## Non-goals", "## 성공 지표"/"## Success metrics".
  섹션이 없거나, 항목이 없거나, 자리표시 문장("정의되지 않음", "Not defined", "Nothing listed yet.",
  "Agree on a measurable outcome first.", "Anything not listed above.")뿐이면 "비어 있음"이야.
  섹션 제목과 자리표시 문장은 lib/opportunities/spec.ts의 마크다운 생성 부분에서 직접 확인하고 맞춰.
- 성공 지표가 측정 가능한지도 세: 숫자, 비율, 기간 중 하나가 들어간 항목 수.
- 결과는 전체 수, 섹션별 채움 비율, 세 섹션 모두 채워진 비율, 측정 가능한 성공 지표 비율만 출력해.
  PRD 본문, 제목, user_id, dossier id는 출력하거나 파일에 저장하지 마(개인 데이터).
- 결과를 eval-results/<YYYY-MM-DD>-goal-baseline.json에 저장하고, 실행 시각과 커밋 SHA를 함께 남겨.
- 섹션 판정 함수에는 작은 테스트를 붙여(채움 · 비어 있음 · 자리표시만 있음). 테스트 파일이 필요하면 tests/eval-goal.test.ts 하나만 PR 1에 추가해.

[작업 2. 발표 서사 → PR 2]
- docs/scorecard.md에 "목표 채움 기준선" 표를 추가하고 맨 위 기준일을 고쳐. 기존 표 형식(항목 | 결과 | 집계 방식 | 기록일)을 따르고,
  작업 1의 실측값만 적어. 집계 방식 칸에 "scripts/eval-goal.ts (PR 1 브랜치)"라고 출처를 적어.
- docs/pitch-script-2026-11-21.md에 5분 발표 대본을 써. docs/supervisor-plan.md 0절(한 줄 정의, 북극성, Claude Code · Codex와 다른 점)이 축이야.
- 구성: 문제 → 지금 되는 것(대표 흐름: 아이디어 → 원문 → PRD → AGENTS.md/MCP) → 앞으로 붙는 것(목표 잠금, 2단 검증) → 숫자 → 한계.
- 숫자는 docs/scorecard.md와 작업 1 결과에 있는 실측값만 써. 없는 숫자를 만들거나 반올림해서 부풀리지 마.
- "지금 되는 것"과 "계획(단계 1~2)"을 문장마다 분명히 구분해. 아직 없는 기능을 된 것처럼 쓰지 마.
- 장면마다 화면에서 보여 줄 경로(예: /prd/new, /agents)를 적어.

[작업 3. 목표 도달률 스크립트 골격 — lib/supervisor/types.ts가 main에 있을 때만, PR 1에 추가]
- scripts/eval-goal.ts에 목표 도달률(완료 시점에 status가 'met'인 성공 기준 비율) 계산 함수를 추가해. ProjectGoal, SuccessCriterion 타입을 그대로 써.
- 아직 저장된 목표가 없으면 "측정할 목표 없음"을 출력하고 끝내.
- types.ts가 main에 없으면 이 작업은 건너뛰고 PR 본문 "안 한 것"에 적어.

[끝낼 때, PR마다]
1. npm run typecheck && npm run lint && npm test를 통과시켜.
2. 바꾼 내용이 적힌 md 문서를 같은 PR에서 최신화해(PR 2의 scorecard.md 기준일 등).
3. 커밋 메시지는 "S1-A3 <한국어 요약>" 형식으로 써.
4. .github/pull_request_template.md를 채우고, PR 본문에 아래 세 가지를 꼭 적어(CONTRIBUTING.md 8절):
   (1) 한 것 · 안 한 것 · 남은 것
   (2) status.md에 반영할 한 줄: 2절 "1 | A3" 줄의 새 내용(측정한 채움 비율 한 줄, 건너뛴 작업 포함)
   (3) 계획과 다르게 판단한 점이나 계획 문서가 틀린 곳. 9절 "확인이 필요한 것"에 답이 나왔으면 여기에 적어.
5. PR만 열어. 머지, main에 직접 push, 배포는 하지 마.
```

## 끝난 뒤 사람이 할 것

- PR 2(문서): 대본의 숫자를 `docs/scorecard.md`와 한 줄씩 대조한 뒤 리뷰 · 머지합니다. 문서 PR이라 동결 중에도 머지할 수 있습니다.
- PR 1(스크립트): 동결이 풀린 뒤 리뷰 · 머지합니다.
- 머지 직후 PR 본문의 "status.md에 반영할 한 줄"을 `docs/status.md`에 옮깁니다(머지한 사람, `CONTRIBUTING.md` 8절). 작업 3을 건너뛰었으면 A3 줄은 "일부"로 둡니다.
