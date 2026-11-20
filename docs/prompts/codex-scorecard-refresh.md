# Codex 프롬프트: 성적표 감독관 정적 검사 숫자 갱신

계획 세션(장차희)이 지시하고 Codex(GPT 6.1 Sol)가 실행합니다. #158(측정)이 #160(규칙 보완)보다 먼저 머지되어 `docs/scorecard.md`의 "감독관 정적 검사" 숫자가 규칙 보완 전 값(불량 diff 21/25)으로 남아 있습니다. 측정을 다시 돌려 실제 값으로 고칩니다. 원칙은 계획 1절 "숫자: 실측값만".

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 측정 담당이다. 측정 스크립트를 다시 돌리고 성적표 숫자만 고친다.

[먼저 읽기 — 이것만]
AGENTS.md, CONTRIBUTING.md, docs/scorecard.md의 "감독관 정적 검사" 절, scripts/eval-supervisor.ts, tests/fixtures/bad-diffs.json.

[할 일]
1. npx tsx scripts/eval-supervisor.ts 를 그대로 실행해(스크립트는 고치지 마). 결과 파일 eval-results/<오늘 날짜>-supervisor-audit.json이 갱신 · 생성되게.
2. docs/scorecard.md "감독관 정적 검사" 절의 숫자 · 표 · 측정 날짜 · 오탐 후보 목록을 이번 실행 결과로 바꿔. 문장 구조는 유지하고, 이전 값은 "규칙 보완(#160) 전"으로 한 줄 남겨.
3. 기대와 다르게 판정된 fixture가 있으면 그대로 적어(규칙이나 fixture를 고치지 마).

[고칠 수 있는 파일]
docs/scorecard.md, eval-results/<오늘 날짜>-supervisor-audit.json. 다른 파일은 고치지 마. 스크립트 실행이 실패하면 고치지 말고 오류를 보고해.

[하지 말 것]
git 커밋 · push · PR · 브랜치 변경 금지. 로컬 변경까지만.

[결과 보고 — 커밋하지 말고 워크트리 루트의 PR_BODY.md]
실행 명령과 결과 요약, 바뀐 숫자(전 → 후), 기대와 다른 fixture, status.md에 반영할 한 줄.
```
