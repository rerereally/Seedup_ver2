# PRD 화면(PrdBuilder) 나누기 계획

작성일 2026-11-19. 아직 시작 전인 리팩터링 계획입니다. 기능 변경은 하지 않습니다.

## 왜 나누나

`components/opportunity-stage/PrdBuilder.tsx` 한 파일(작성 때 976줄, 2026-11-21 기준 1,307줄)에 세 가지가 섞여 있습니다.

- **상태와 서버 통신:** 생성 스트림, 항목 수정, 개발 준비 칸 채우기, 버전 기록
- **보기 5개:** 문서, 기능 명세, 유저플로우, 와이어프레임, 구조 트리
- **위쪽 도구 막대와 오른쪽 상세 패널**

이것을 역할별로 떼어 내서, `PrdBuilder`는 조각을 조립만 하는 200줄 안팎의 파일로 만듭니다.

## 나눈 뒤 모양

```
components/opportunity-stage/
  PrdBuilder.tsx          조립만: 훅을 부르고 아래 조각을 배치 (~200줄)
  usePrdGeneration.ts     생성 스트림(NDJSON 읽기, 실시간 글, 경과 시간), 수정, 개발 준비 칸 채우기, 오류·안내 메시지
  usePrdVersions.ts       버전 목록, 브라우저 저장(localStorage), 되돌리기, forgetStoredPrd
  PrdToolbar.tsx          제목, 수치 배지, 다시 만들기, 북마크, 내보내기, 에이전트로 보내기 메뉴
  ItemDetail.tsx          항목을 눌렀을 때 오른쪽 상세와 "이 항목만 고치기" 폼
  views/DocView.tsx       문서 보기 (지금 약 110줄)
  views/TraceView.tsx     기능 명세 그래프 (GraphEdges 사용)
  views/TreeView.tsx      구조 트리
  views/FlowView.tsx      유저플로우 (mermaid)
  PrdParts.tsx            이미 떼어 낸 것: GraphEdges, Wireframes, LivePrd
  prd-render.tsx          여러 보기가 같이 쓰는 표시 함수: 인용 칩(cites, prose), 우선순위 배지, 수락 기준 줄, 항목 강조(tone)
```

## 순서 (한 단계에 PR 하나)

1. **표시 함수를 `prd-render.tsx`로 옮기기.** 보기들이 컴포넌트 안의 함수(`cites`, `prose`, `docRow`, `item`, `tone`)에 기대고 있어서 이것부터 합니다. 강조 상태(`focus`, `trace`)가 필요한 함수는 인자로 받거나 작은 Context로 받습니다.
2. **보기 4개를 `views/`로 옮기기.** 상태를 거의 쓰지 않고 `spec`만 받으므로 가장 안전합니다.
3. **`ItemDetail`, `PrdToolbar` 떼어 내기.** 콜백(revise, copy, download)을 props로 받게 합니다.
4. **`usePrdVersions` 떼어 내기.** 저장 키와 되돌리기 로직만 옮깁니다. 저장 키 문자열은 바꾸지 않습니다. 바꾸면 사용자 브라우저에 저장된 PRD가 사라집니다.
5. **`usePrdGeneration` 떼어 내기.** 스트림 읽기와 실시간 표시 상태라서 가장 까다롭습니다. 마지막에 합니다.

## 지킬 것

- **동작은 바꾸지 않습니다.** 문구, 클래스, 이벤트 순서를 그대로 옮깁니다. 리팩터링 PR에 기능 변경을 섞지 않습니다.
- **props 모양은 그대로 둡니다.** `PrdBuilder`를 쓰는 곳이 세 군데입니다.
  - `app/prd/page.tsx` (검증된 문제에서 PRD)
  - `components/IdeaWorkspace.tsx` (`/prd/new`, 아이디어에서 PRD. `forgetStoredPrd`도 가져다 씀)
  - `components/SeedAdvisor.tsx` (`/seeds`, 내 프로젝트의 다음 기능)

  `hideControls`, `hideRevise`, `generateSignal`, `onSpec`, `externalInstruction`, `agentSlug` 같은 props와 `forgetStoredPrd` export를 유지합니다.
- **데이터 접근 규칙:** `components/`에서는 `.from('...')`으로 DB를 직접 부를 수 없습니다(lint 오류). DB가 필요하면 `lib/db/`의 함수를 씁니다.
- **무료 모델 한도:** 실제 PRD를 만드는 확인은 OpenRouter 무료 모델의 하루 1,000회 한도를 씁니다. 대부분은 E2E(고정 응답, `LLM_FIXTURES=1`)로 충분하니 실제 생성은 꼭 필요할 때만 합니다.

## 단계마다 확인할 것

자동 검사:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run e2e
```

`npm run e2e`는 아이디어 → 질문 → PRD → "에이전트로 보내기" → AGENTS.md 받기를 고정 응답으로 확인합니다. Supabase 환경 변수(`.env`)가 있어야 합니다.

E2E가 확인하지 않는 부분은 PR 미리보기 주소(`pr-N`)에서 눈으로 봅니다.

- [ ] 보기 5개(문서, 기능 명세, 유저플로우, 와이어프레임, 구조 트리) 전환
- [ ] 항목을 눌러 오른쪽 상세가 열리고, "이 항목만 고치기"가 동작
- [ ] 버전 기록에서 되돌리기
- [ ] 개발 준비 칸 채우기
- [ ] 공유 링크와 북마크
- [ ] `/prd`, `/prd/new`, `/seeds` 세 화면 모두에서 위 동작
- [ ] 생성 중 화면이 흔들리지 않음(실시간 글이 나오는 동안 레이아웃 고정)

미리보기는 운영 DB를 읽고 씁니다. 화면 확인용으로만 쓰고, 테스트 데이터를 만들지 마세요.
