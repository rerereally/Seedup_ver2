# Antigravity 시작 프롬프트: 단계 2 A3 (불량 diff · 규칙별 오탐률 · 데모)

담당 정지훈 · Antigravity. 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 단계 2 A3, 설계는 3-5절(정적 검사와 오탐 줄이기), 숫자 원칙은 1절 "숫자: 실측값만".

## 시작 전에 사람이 확인할 것

- 측정 대상인 `lib/supervisor/diff-audit.ts`(A1, #140)는 `main`에 있습니다. 지금 바로 시작할 수 있습니다.
- 이 칸은 **코드를 고치지 않는 측정 칸**입니다. 오탐이 많은 규칙을 경고로 내릴지는 결과를 보고 계획 세션이 정하고, 고치는 일은 A1 칸에서 합니다.
- 최근 머지 커밋은 로컬 git 기록에서 읽습니다. 네트워크나 운영 DB는 필요 없습니다.

## 붙여 넣을 프롬프트

```
최신 main에서 브랜치 feat/s2-a3-audit-eval을 만들어 작업해.
먼저 AGENTS.md, CONTRIBUTING.md, docs/supervisor-plan.md(1절 결정 표, 3-4, 3-5, 5절 단계 2 A3), docs/scorecard.md, lib/supervisor/diff-audit.ts, lib/supervisor/types.ts를 읽어.
너는 docs/supervisor-plan.md 5절 단계 2의 A3(Antigravity) 담당이야. 측정 칸이라 lib/* 코드는 고치지 마.

[작업 1. 불량 diff 25건]
- tests/fixtures/bad-diffs.json에 현실적인 unified diff 25건을 만들어. 각 항목 { id, label, expect: 'block' | 'warn' | 'clean', expectedCodes: AuditCode[], diff }.
  - 구라 10건: TODO 껍데기, 하드코딩 mock/placeholder, 빈 catch, .skip 테스트, 빈 함수 등
  - 보안 10건: 알려진 접두사 시크릿, NEXT_PUBLIC_ 시크릿, dangerouslySetInnerHTML, SQL 문자열 결합, 인증 없는 API POST
  - 정상 5건: 테스트 · 인증 · 오류 처리가 제대로 된 코드. JSX placeholder= 속성, 주석 있는 빈 catch처럼 오탐이 나기 쉬운 정상 코드를 일부러 넣어.
  - 실제 키처럼 보이는 값은 명백한 가짜(예: sk-test-FAKE...)만 써.
- tests/supervisor-audit-fixtures.test.ts: 25건에 auditDiff를 돌려 expect와 맞는지 확인. 맞지 않는 항목은 테스트를 지우거나 기대값을 바꾸지 말고, 실패를 결과 보고에 그대로 적어(규칙 수정은 A1 몫).

[작업 2. 실제 커밋 오탐률]
- scripts/eval-supervisor.ts: 읽기 전용.
  1) fixtures 25건 결과(차단률, 경고 판정 정확도, 정상 5건 오탐 수)
  2) 이 저장소 main의 최근 머지 커밋 100여 개(첫 부모 기준 diff)에 auditDiff를 돌려 규칙별로 걸린 수, 차단 수, 걸린 커밋 수, 예시 3개(파일 · 줄 · 스니펫)를 집계.
     실제 머지 코드는 정상으로 간주하고, 차단 규칙에 걸리면 "오탐 후보"로 표시해(사람이 확인할 목록).
  결과를 eval-results/<YYYY-MM-DD>-supervisor-audit.json에 쓰고, 콘솔에 규칙별 표를 출력.
- 명령: npx tsx scripts/eval-supervisor.ts

[작업 3. 데모]
- scripts/demo-seedup-supervisor.ts: 발표 · 설명용 CLI. 가짜 의존성만 써서 네트워크 없이 돌아가게.
  1) 구라 · 시크릿 diff → 정적 차단(모델 호출 없음) 2) 고친 diff → 통과 3) 이탈 예시(명세 밖 파일) → 경고. 출력은 DESIGN.md 8.1 형식(첫 줄 결론, Next:).

[작업 4. 성적표]
- docs/scorecard.md 끝에 "감독관 정적 검사" 절 추가: 측정 날짜, 명령, fixtures 결과, 실제 커밋 규칙별 표, 오탐 후보 수. 측정한 숫자만 쓰고 목표치나 추정은 쓰지 마.

[고칠 수 있는 파일]
tests/fixtures/bad-diffs.json, tests/supervisor-audit-fixtures.test.ts, scripts/eval-supervisor.ts, scripts/demo-seedup-supervisor.ts, eval-results/<날짜>-supervisor-audit.json, docs/scorecard.md.
lib/*, components/*, app/*, supabase/*, 수집 동결 파일(docs/status.md 1절)은 건드리지 마. docs/status.md, docs/supervisor-plan.md, docs/decisions.md도 고치지 마.

[끝내는 조건]
npm run typecheck && npm run lint && npm test(새 fixture 테스트의 실패는 결과로 보고) 후 한국어 커밋, 맨 앞에 S2-A3. PR을 열고 템플릿을 채워.
PR 본문에: 한 것 · 안 한 것 · 남은 것, status.md에 반영할 한 줄, 규칙별 오탐률 표, 경고로 내릴 만한 규칙 제안(결정은 계획 세션), 기대와 다르게 판정된 fixture 목록.
```
