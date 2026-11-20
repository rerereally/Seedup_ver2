# 작업 규약

두 사람(정지훈, 장차희)이 각자 에이전트 여러 개로 같은 저장소를 동시에 고칠 때 지키는 규칙입니다. 계획 내용은 여기에 옮겨 적지 않고 [`docs/supervisor-plan.md`](docs/supervisor-plan.md)(이하 계획 문서)의 절로 링크합니다.

## 1. 권한

- 계획 문서는 방향과 우선순위의 기준입니다([이 문서의 권한](docs/supervisor-plan.md#이-문서의-권한)). 계획에 없는 작업도 할 수 있고, 방향(목표 · 범위 · 보류 기능 순서 · 유료화)을 바꾸는 결정만 장차희의 확인을 받습니다.
- **역할:** 장차희는 **총괄 · 계획**(방향 결정, 우선순위), 정지훈은 **기술 구현 · 머지**(기술 책임, 코드 리뷰, `main` 머지, 운영 DB 마이그레이션 적용)를 맡습니다.
- 규칙을 바꾸면 이 문서에 반영하고 이유를 [`docs/decisions.md`](docs/decisions.md)에 한 줄 남깁니다. 대화로 정한 규칙도 잊지 않게 문서로 옮겨 둡니다.

## 2. 역할과 파일 소유

- 단계별 담당은 [5절](docs/supervisor-plan.md#5-단계별-작업-분배-2인--에이전트-5개-단계-안에서-파일-소유-중복-없음) 표를 참고합니다. 다른 사람이 지금 작업 중인 파일을 고쳐야 하면 먼저 알려 충돌을 피합니다.
- **공용 파일**은 고치기 전에 상대에게 알립니다: `components/Header.tsx`, `lib/schema-manifest.json`, `lib/llm.ts`, `lib/mcp/server.ts`.
- DB 쿼리는 `lib/db/*` 안에서만 씁니다.
- **수집 동결:** [status.md 1절](docs/status.md#데이터-수집-동결)에 동결이 적혀 있으면 그 파일은 정지훈과 먼저 확인합니다.

## 3. 브랜치

`<종류>/<요약>`, 모두 소문자와 `-`. 계획 칸의 작업 ID가 있으면 앞에 붙여도 됩니다(`<종류>/<작업ID>-<요약>`).

- 종류: `feat`, `fix`, `chore`, `docs`, `perf`
- 예: `fix/mcp-criteria-newline`, `feat/s1-b1-goal-store`
- 가능하면 에이전트 도구 이름(`claude/`, `codex/`)보다 무엇을 하는지 드러나는 이름을 씁니다.

## 4. PR

- 작게. 한 PR은 한 주제만 다룹니다. 코드를 바꿔 문서가 틀려지면 같은 PR에서 문서도 고칩니다.
- CI(`.github/workflows/ci.yml`의 check · migrations · e2e)가 통과해야 머지합니다.
- 정지훈이 코드를 리뷰하고 **머지**합니다. 아래 머지 세션 말고 다른 에이전트는 머지하지 않습니다.
- **머지 위임:** 정지훈은 리뷰 · 머지를 Claude Code 세션 하나(이하 머지 세션)에 맡길 수 있습니다. 머지 세션은 아래를 모두 확인한 PR만 머지하고, 하나라도 맞지 않으면 머지하지 않고 PR에 이유를 댓글로 남깁니다.
  1. CI(check · migrations · e2e)가 통과했고 충돌이 없다.
  2. PR 본문에 무엇을 왜 바꿨는지 있다.
  3. 코드 리뷰에서 버그 · 보안 문제가 없다.
  4. 마이그레이션이 든 PR이 아니다. 마이그레이션 PR은 운영 DB 적용과 함께 정지훈이 직접 머지합니다(7절).
  5. 방향(목표 · 범위 · 보류 기능 순서 · 유료화)을 바꾸는 PR이면 장차희의 확인(PR 승인이나 댓글)이 있다.
  6. 머지 세션이 직접 만든 PR이 아니다. 자기 PR은 정지훈이 리뷰 · 머지합니다.
- 본문은 [PR 템플릿](.github/pull_request_template.md)을 채웁니다. 계획 칸은 있으면 적고, 없으면 비워도 됩니다.

## 5. 커밋 메시지

한국어로 씁니다. 계획 칸의 작업 ID가 있으면 맨 앞에 대문자로 붙입니다.

```
S1-B1 목표 버전 기록 테이블 추가
D2 2인 작업 규약 문서 추가
```

## 6. 에이전트

- 에이전트 하나에 브랜치(worktree) 하나. 두 에이전트가 같은 브랜치나 같은 파일을 동시에 고치지 않습니다.
- 작업을 맡길 때는 [8절 시작 지시](docs/supervisor-plan.md#8-에이전트-시작-지시-복사용)를 참고합니다.
- 공유 타입(`lib/supervisor/types.ts`, [4절](docs/supervisor-plan.md#4-공유-계약-libsupervisortypests-단계-1에서-가장-먼저-커밋))을 바꿔야 하면 먼저 두 사람이 합의합니다.
- PR 전에 `npm run typecheck && npm run lint && npm test`를 통과시킵니다.

## 7. DB 마이그레이션

- 파일: `supabase/migrations/<YYYYMMDDHHMMSS>_<소문자_이름>.sql`. 시각은 기존 파일보다 뒤여야 합니다(`npm run migrations`가 확인).
- 마이그레이션을 추가하면 `npx tsx scripts/check-migrations.ts --write`로 `lib/schema-manifest.json`을 다시 만듭니다. 상대가 먼저 마이그레이션을 머지했다면 rebase 후 다시 만듭니다.
- **운영 적용:** 마이그레이션이 든 PR을 머지한 사람(정지훈)이 머지 직후 운영 DB에 적용합니다(`npx supabase db push` 또는 Supabase SQL 편집기). 적용 뒤 `npx tsx --env-file=.env scripts/check-schema.ts`가 빠진 것 없음을 보여야 끝입니다.
- `main` 머지는 곧 배포이므로, 새 테이블을 읽는 코드는 적용 전까지 운영에서 실패할 수 있습니다. PR 템플릿의 마이그레이션 칸을 꼭 채웁니다.

## 8. 공유 기억

[3-11절](docs/supervisor-plan.md#3-11-공유-메모리-에이전트--세션--사람-사이) 끝 문단을 따릅니다.

- 진행 상태: `docs/status.md`
- 결정: [`docs/decisions.md`](docs/decisions.md)
- 규칙: 이 문서
- Claude Code · Codex 같은 개인 에이전트 메모리에만 있는 사실은 공유된 것으로 보지 않습니다. 상대도 알아야 하면 위 문서에 적습니다.

### 문서는 누가 언제 고치나

원칙은 **문서는 코드에 맞춘다**입니다. 누구든 코드와 어긋난 문서를 고칠 수 있습니다.

| 문서 | 언제 |
| :--- | :--- |
| `docs/status.md`, `README.md`, `docs/README.md` | 기능 · 수치 · 상태가 바뀐 PR 안에서, 또는 여러 PR을 모아 따로 |
| `docs/supervisor-plan.md` | 코드와 어긋난 사실은 누구든. 방향을 바꾸는 내용은 장차희 확인 뒤 |
| `docs/decisions.md` | 규칙이나 방향을 정했을 때 |
| `DESIGN.md` | 화면 규칙이 실제로 바뀌었을 때 |

- 같은 문서를 여러 세션이 동시에 고치면 충돌하므로, 큰 문서 정리는 한 PR에 모읍니다.

## 9. 배포와 운영

- `main`에 push(머지)하면 CI를 거쳐 Cloudflare에 자동 배포됩니다. PR마다 미리보기 주소가 붙지만 운영 DB를 그대로 쓰므로 화면 확인용으로만 씁니다.
- 평소에는 4절의 CI · 리뷰 · 계획상 머지 순서를 충족한 PR을 `main`에 계속 머지합니다. 발표나 출시를 앞두고 별도 동결을 정하면 적용 범위와 기간, 해제 조건을 `docs/status.md`에 적습니다.
- 시크릿은 저장소에 넣지 않습니다. 값은 `.env`와 Cloudflare · GitHub 설정에만 두고, 문서에는 키 이름만 적습니다.

## 10. 알려진 환경 차이

- Windows에서 `npm test`를 돌리면 `tests/prd-exports.test.ts`의 gh 명령 테스트 1개가 `/bin/sh`가 없어 실패합니다. Linux CI에서는 통과하므로 이것만 실패하면 정상입니다. 고칠지는 별도의 작은 작업으로 정합니다.
