// Fixed model answers for the end-to-end test (LLM_FIXTURES=1), so the browser flow is checked against the app's own
// code without waiting on, paying for, or flaking with a real model. Never set LLM_FIXTURES on the deployed site.

export const fixturesOn = () => process.env.LLM_FIXTURES === '1';

const QUESTIONS = {
  questions: [
    { key: 'first_team', question: '온콜 인수인계 봇을 가장 먼저 쓸 팀은 어디인가요?', why: '첫 팀에 따라 메모 형식이 달라집니다.', options: ['SRE 팀', '백엔드 팀', '데이터 플랫폼 팀'] },
    { key: 'channel', question: '인수인계 메모는 어디에 남기나요?', why: '연동할 곳이 정해집니다.', options: ['슬랙 채널', '노션 페이지', '깃허브 이슈'] },
    { key: 'success', question: '무엇을 보면 성공인가요?', why: '성공 지표가 정해집니다.', options: ['인수인계 시간 절반', '놓친 장애 0건', '메모 작성률 90%'] },
  ],
};

const CLARITY = { missing: ['who', 'problem'], suggestion: '온콜 교대 때 인수인계 메모가 흩어져 같은 경고를 다시 조사하는 SRE 팀을 위해, 슬랙 메모를 모아 요약해 주는 봇' };

const PRD = `# 한 줄 요약
온콜 교대 때 슬랙에 흩어진 메모를 모아, 다음 담당자가 5분 안에 읽을 인수인계 요약을 만들어 주는 슬랙 봇.

## 배경
온콜 담당자는 교대 때 지난 근무의 경고, 조치, 남은 일을 손으로 정리한다. 정리가 빠지면 다음 담당자가 같은 경고를 다시 조사한다.

## 대상 사용자
- 매주 온콜을 교대하는 5~20명 SRE 팀

## 사용 장면
월요일 오전 9시, 민지는 온콜을 넘겨받는다. 슬랙에서 /handoff를 입력하자 지난 7일의 경고 12건이 3건의 진행 중 이슈와 9건의 해결 건으로 정리되어 나온다.

## 목표
- 교대 인수인계를 5분 안에 끝낸다.

## 하지 않을 것
- 경고를 자동으로 해결하지 않는다.

## 요구사항
### R1. [P0] 사용자는 지난 근무의 슬랙 메시지를 한 요약으로 받을 수 있어야 한다
채널 이름과 교대 시각을 받아, 그 사이의 메시지를 경고 단위로 묶은 요약을 돌려준다.
- 수락 기준: 7일치 메시지 500건을 30초 안에 요약한다.
- 확인 방법: SRE 5명에게 지금 인수인계에 걸리는 시간을 묻는다.
### R2. [P1] 사용자는 요약에서 진행 중인 이슈만 골라 볼 수 있어야 한다
해결 표시(✅ 반응이나 "해결" 답글)가 없는 경고만 남기고 마지막 조치 시각순으로 보여 준다.
- 수락 기준: 진행 중 이슈는 해결 건과 나뉘어 표시된다.
- 확인 방법: 첫 팀 3곳이 진행 중 이슈를 따로 보길 원하는지 묻는다.
### R3. [P1] 사용자는 요약을 다음 담당자에게 한 번에 넘길 수 있어야 한다
요약과 진행 중 이슈를 다음 담당자의 슬랙 DM으로 보내고, 읽음 여부를 기록한다.
- 수락 기준: /handoff @다음담당자 를 입력하면 10초 안에 DM이 도착한다.
- 확인 방법: SRE 5명에게 DM 전달과 채널 게시 중 무엇을 원하는지 묻는다.

## 기능
### F1. 메시지 수집과 요약 (R1)
채널과 기간을 받아 메시지를 모으고 경고별 요약을 돌려준다.
### F2. 진행 중 이슈 필터 (R2)
요약을 받아 해결되지 않은 이슈만 돌려준다.
### F3. 인수인계 전달 (R3)
요약과 받는 사람을 받아 DM을 보내고 읽음 시각을 돌려준다.

## 위험
- 슬랙 권한 승인이 늦으면 첫 팀 도입이 늦어진다.

## 가정
- 대부분의 인수인계 정보는 슬랙에 있다.

## 성공 지표
- 첫 팀의 인수인계 시간이 4주 안에 절반으로 준다.

## 열린 질문
- 페이저듀티 연동을 첫 버전에 넣을 것인가?`;

/** The fixed JSON answer for a call, keyed by the caller's title; null makes the caller use its own fallback. */
export function fixtureJson(title = ''): unknown {
  if (/idea clarity/i.test(title)) return CLARITY;
  return /planning questions/i.test(title) ? QUESTIONS : null;
}

export const fixtureProse = () => PRD;
