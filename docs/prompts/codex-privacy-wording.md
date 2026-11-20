# Codex 프롬프트: 처리방침에 입력별 모델과 보관 범위 밝히기 (출시 전 준비)

계획 세션(장차희)이 지시하고 Codex(GPT 6.1 Sol)가 구현합니다. 리뷰 · 머지는 정지훈. 근거는 [decisions.md](../decisions.md)의 "0-4(A안)", "검증 모델: GPT 6.2 Sol · Haiku 5.5", 계획 1절 "모델" 줄, [9절 조사](../research/2026-11-20-section9.md) 6절(OpenRouter `data_collection`의 실제 의미).

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 처리방침 문구 담당이다. lib/legal.ts의 문구만 고친다.

[먼저 읽기 — 이것만]
AGENTS.md, CONTRIBUTING.md, lib/legal.ts 전체, docs/decisions.md의 "0-4: 사용자 입력이 가는 모델(A안)" · "검증 모델" 항목,
docs/supervisor-plan.md 1절 결정 표의 "모델" 줄, docs/research/2026-11-20-section9.md 6절, components/IdeaWorkspace.tsx에서 "무료 모델 제공사가 입력을" 안내 한 줄.

[할 일]
1. lib/legal.ts 처리방침의 "밖으로 보내는 곳"에서 OpenRouter 줄을 입력별로 나눠 정확히:
   - 아이디어 · 질문 답 · 메모 · PRD: 무료 모델로 갈 수 있고, 그 제공사가 입력을 기록하거나 학습에 쓸 수 있음.
   - 기능 검증의 코드(GitHub 공개 저장소에서 서버가 읽은 diff · 파일): GPT 6.2 Sol(OpenAI) 또는 Claude Haiku 5.5(Anthropic)로, 개발에 쓴 모델과 다른 쪽이 판정. OpenRouter에서 "데이터를 수집하는 제공사는 빼는" 설정으로 보냄. 판정에만 쓰고 Seedup은 판정 결과(인용한 코드 줄 포함)를 저장함.
   - "어디에도 저장되지 않는다"고 약속하지 마. OpenRouter와 모델 제공사는 각자의 정책에 따라 안전 목적 등으로 일정 기간 보관할 수 있다는 범위로.
   - 기존 EXAONE · 기타 줄과 다른 절은 그대로.
2. 바뀐 날짜가 있으면 EFFECTIVE_DATE를 오늘(2026년 11월 20일)로.
3. components/IdeaWorkspace.tsx의 안내 한 줄이 새 문구와 어긋나면 PR 본문에 적기만 해(그 파일은 고치지 마).
4. 테스트: 기존 처리방침 관련 테스트가 있으면 통과, 없으면 새 문구에 두 모델 이름과 "수집하는 제공사를 뺀다"는 범위가 들어가는지 확인하는 작은 테스트 하나.

[고칠 수 있는 파일]
lib/legal.ts, tests/legal.test.ts(새로 또는 기존). 다른 파일은 고치지 마.

[하지 말 것]
git 커밋 · push · PR · 브랜치 변경 금지. 로컬 변경까지만.

[끝내는 조건]
npm run typecheck && npm run lint && npm test(Windows의 tests/prd-exports.test.ts 1개 실패는 알려진 문제).

[결과 보고 — 커밋하지 말고 워크트리 루트의 PR_BODY.md]
.github/pull_request_template.md 형식: 바꾼 문장 전 → 후, 안내 한 줄과 어긋나는지, status.md에 반영할 한 줄, 확인한 명령과 결과.
```
