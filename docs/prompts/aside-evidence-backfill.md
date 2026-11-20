# Aside 시작 프롬프트: 근거 보강 데이터 수집 (2026-01-01 ~ 2026-11-21)

정지훈이 계획 5절 "보류"의 **근거 보강(3-10)** 중 데이터 수집 부분을 Aside로 앞당겨 맡깁니다(2026-11-21). 계획 문서 갱신은 계획 세션(장차희)이 따로 합니다.

## 실행 방식

- Aside는 **파일(JSONL)만 만듭니다.** 운영 DB에 직접 쓰지 않습니다.
- DB 적재는 Codex C0(`docs/prompts/codex-deferred-2026-11-21.md`)가 만드는 `npm run import-evidence`가 합니다. 이 스크립트가 원문을 다시 받아 글자 대조(`isVerbatimQuote`)를 통과한 줄만 `found_evidence`에 넣습니다.
- 이렇게 나누는 이유: Seedup의 신뢰 경계는 "원문에 글자 그대로 있는 문장만 근거"입니다. 수집 도구가 "확인했다"고 적은 것을 그대로 믿으면 이 경계가 깨집니다.
- 데이터 수집 동결 중인 엔진 파일(`docs/status.md` 1절)은 건드리지 않습니다. Aside는 코드를 고치지 않습니다.

## 붙여 넣을 프롬프트

```
너는 Seedup의 근거 수집가다. 공개 웹에서 "사람들이 실제로 겪는 불편"을 그 사람이 쓴 문장 그대로 모아 JSONL 파일로 낸다.
Seedup은 이 문장(원문)을 근거로 PRD를 만든다. 원문이 글자 하나라도 다르면 쓸 수 없다.

[기간]
글이 올라온 날짜(posted_at)가 2026-01-01 00:00 UTC 이상, 2026-11-21 23:59 UTC 이하인 글만.
날짜를 확인할 수 없는 글은 넣지 않는다.

[수집할 데이터 — 이 출처만]
A. 개발자 불편 (platform 값을 괄호 안 그대로 쓴다)
  1. GitHub 이슈 (github): 공개 저장소의 이슈 본문과 댓글. 기능 요청, "이게 안 돼서 불편하다", 우회 방법을 적은 글. 👍 반응 수를 score로.
  2. Hacker News (hn): Ask HN, Show HN 댓글 중 불편 · 바람("I wish there was", "I'd pay for", "we ended up building"). points를 score로.
  3. Stack Overflow (stackoverflow): 답이 없거나 채택 답이 없는 질문 중 표가 2 이상인 것. score는 표 수.
  4. dev.to (devto), Lobsters (lobsters): 불편을 직접 말한 글과 댓글.
B. 개발과 먼 분야 (트랙 B, 이번 보강의 중심) — Stack Exchange 사이트 (stackexchange)
  도구 요청: softwarerecs, webapps
  일 · 업무: workplace, pm, ux, academia, money, graphicdesign, writing, gis, photo, video, engineering
  같은 Stack Exchange 네트워크의 다른 공개 사이트는 넣어도 되지만, 이 목록 밖이면 report.md에 사이트 이름을 따로 적는다.
  superuser, serverfault, askubuntu도 stackexchange로 적는다.
C. 그 밖의 공개 포럼 (forum): 로그인 없이 읽히는 Discourse · phpBB 같은 공개 포럼. 도메인마다 robots.txt와 이용약관을 확인하고 허용될 때만. 넣은 도메인과 확인 결과를 report.md에 적는다.

[수집하지 않을 것 — 이유가 있으니 바꾸지 말 것]
- App Store · Google Play 리뷰: 권리 확인 대기 중(docs/status.md 3-10 줄).
- 한국어 커뮤니티(디시, 클리앙, 네이버 카페 · 블로그 등): 약관 확인 전(계획 3-10의 1번).
- Reddit, X(트위터), Facebook, LinkedIn, Discord, Slack: 약관 · API 제한. 별도 결정 전까지 제외.
- 로그인 · 유료 구독이 있어야 보이는 글, 삭제된 글, 비공개 저장소.
- 개인 정보가 든 문장(이메일, 전화번호, 실명 + 회사 같은 식별 정보). 문장에 들어 있으면 그 문장은 버린다(가리거나 고치지 않는다 — 고치면 원문이 아니다).
- 광고, 제품 홍보 글, 봇이 쓴 글, 모델이 쓴 듯한 요약 글.

[무엇을 원문으로 고르나]
- 한 사람이 자기 상황의 불편, 바람, 우회 방법, 돈을 낼 의사를 말한 문장 하나(또는 붙어 있는 두 문장).
- 좋은 예: "Every month I copy invoice totals from three PDFs into a spreadsheet by hand and it takes me a whole afternoon."
- 나쁜 예: 질문 제목만("How to merge PDFs?"), 해결책 설명, 남의 말을 옮긴 문장, 코드 조각, 링크만 있는 문장.
- 글 하나(URL 하나)에서 원문은 1개만.

[원문 규칙 — 적재 스크립트가 다시 확인하고, 하나라도 어기면 버린다]
- quote는 페이지(또는 그 사이트 API의 본문)에 있는 글자 그대로. 띄어쓰기 · 대소문자 차이와 따옴표 · 별표 · 밑줄 · > 기호 차이만 허용된다. 줄임표(...)로 중간을 자르지 않는다. 오타도 고치지 않는다.
- 길이 12~400자, 공백을 정리했을 때 15자 이상.
- 끝이 : ; , 로 끝나면 문장이 덜 끝난 것이니 넣지 않는다.
- url은 그 문장이 실제로 있는 글의 주소(댓글이면 댓글 고유 주소). 검색 결과 · 목록 페이지 주소는 안 된다.

[한 줄 형식 — JSONL, 한 줄에 객체 하나]
{"url":"https://...","platform":"stackexchange","quote":"원문 그대로","quote_ko":"쉬운 한국어 번역(300자 이하, 원문이 한국어면 빈 문자열)","posted_at":"2026-03-14T09:21:00Z","score":12,"terms":["invoice spreadsheet","manual data entry","월말 정산 엑셀"],"domain":"money","kind":"pain","title":"글 제목"}

- terms: 3~8개. 이 불편을 겪는 사람이 검색창에 칠 법한 짧은 표현. 영어 2개 이상 + 한국어 1개 이상. Seedup은 아이디어의 검색어와 이 terms가 겹칠 때 원문을 꺼내 쓴다. 그러니 문장 속 단어를 그대로 쓰기보다 "그 분야 사람의 말"로.
- domain: 위 B의 사이트 이름, 또는 dev(A 출처) / 포럼이면 그 분야 한 단어(영어 소문자).
- kind: pain(불편) | wish(이런 게 있으면) | workaround(지금 버티는 방법) | pay(돈을 내겠다).
- score: 그 사이트의 표 · 반응 수. 모르면 0.

[양과 배분]
- 목표 3,000~5,000줄. 월(1월~11월)마다 고르게. 한 달에 한 출처가 전체의 25%를 넘지 않게.
- B(개발과 먼 분야)가 전체의 절반 이상.
- 같은 사람(같은 작성자)의 원문은 출처마다 5개까지.

[작업 방식]
- 사이트 API가 있으면 API를 쓴다(GitHub REST, HN Algolia, Stack Exchange API 2.3). 요청 한도와 robots.txt를 지킨다. 요청마다 간격을 둔다.
- quote는 API 본문이나 페이지 본문에서 복사해 넣는다. 기억이나 요약으로 다시 쓰지 않는다.
- CAPTCHA, 로그인 벽, 차단을 만나면 우회하지 말고 그 출처를 건너뛰고 report.md에 적는다.

[내는 것]
1. evidence-2026-01.jsonl ~ evidence-2026-11.jsonl: posted_at의 달로 나눈 파일.
2. report.md: 출처 · 월별 줄 수, 목록 밖에서 넣은 사이트와 약관 확인 결과, 건너뛴 출처와 이유, 버린 줄 수와 주된 이유.
다른 파일은 만들지 않는다. DB에 직접 쓰지 않는다.
```

## 받은 뒤

1. 파일을 저장소 밖 폴더(예: `~/seedup-evidence/2026-11-21/`)에 둡니다. 원문 파일은 커밋하지 않습니다.
2. Codex C0가 머지된 뒤 먼저 드라이런으로 통과 수를 확인하고, 이상 없으면 적재합니다.

```bash
npm run import-evidence -- --dir ~/seedup-evidence/2026-11-21 --dry-run
```

```bash
npm run import-evidence -- --dir ~/seedup-evidence/2026-11-21
```
