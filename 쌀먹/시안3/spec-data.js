// 세 시안이 함께 쓰는 예시 데이터와 추적 함수.
// 증언 3건은 저장소 스냅샷의 실제 원문이고, 요구사항·기능·화면·가설은 화면 설명을 위한 예시입니다.
window.SPEC = {
  title: '제공사별 모델 스키마 차이',
  problem: 'LLM 제공사마다 요청 파라미터 스키마가 달라 모델을 바꿀 때마다 코드를 직접 고쳐야 한다.',
  gap: '기존 도구는 스키마 차이를 감싸 주지만, 쓸 수 있는 제공사를 자동으로 찾아 주지는 않는다.',
  rivals: ['@ai-sdk/gateway', 'portkey-ai', '@mastra/schema-compat', '@lovable.dev/ai-gateway'],
  evidence: [
    { id: 'E-1', platform: 'Hacker News', date: '2026-07-07', quote: 'What is your AI harness that lets you switch LLM models easily?', ko: 'LLM 모델을 쉽게 전환할 수 있게 해주는 AI 프레임워크는 무엇인가요?', url: 'https://news.ycombinator.com/item?id=48821642' },
    { id: 'E-2', platform: 'Stack Overflow', date: '2025-12-11', quote: 'Amazon Bedrock does not provide an API that returns:', ko: 'Amazon Bedrock은 다음을 반환하는 API를 제공하지 않습니다:', url: 'https://stackoverflow.com/questions/79843685' },
    { id: 'E-3', platform: 'Hacker News', date: '2026-02-06', quote: 'every time I wanted to try a different LLM provider, I had to rewrite large parts of my code.', ko: '다른 LLM 제공자를 시도할 때마다 코드의 많은 부분을 다시 작성해야 했습니다.', url: 'https://news.ycombinator.com/item?id=46913964' },
  ],
  requirements: [
    { id: 'R-01', title: '제공사를 바꿔도 호출 코드는 그대로', detail: '모델 이름만 바꾸면 같은 코드로 다른 제공사를 호출한다.', up: ['E-1', 'E-3'] },
    { id: 'R-02', title: '제공사별 파라미터를 한 스키마로 정리', detail: '온도, 최대 토큰, 도구 호출 형식의 차이를 한 형식으로 받는다.', up: ['E-2', 'E-3'] },
  ],
  hypotheses: [
    { id: 'H-01', title: '쓸 수 있는 모델을 자동으로 찾아 추천', detail: '이 기능을 원한다는 원문이 없습니다.' },
    { id: 'H-02', title: '비용이 낮은 제공사로 자동 전환', detail: '이 기능을 원한다는 원문이 없습니다.' },
  ],
  features: [
    { id: 'F-01', title: '단일 호출 인터페이스', detail: '제공사와 무관한 call() 하나.', up: ['R-01'],
      slots: { '입력·상태': 'model, messages, params', '규칙': '모르는 제공사는 호출 전에 거절', '예외': '제공사 오류를 공통 오류로 변환', '권한': '키는 호출자가 직접 전달', '데이터': '저장하지 않음', '완료 기준': null } },
    { id: 'F-02', title: '파라미터 매핑 표', detail: '공통 파라미터를 제공사별 이름과 범위로 옮긴다.', up: ['R-02'],
      slots: { '입력·상태': '공통 파라미터 객체', '규칙': '범위를 벗어나면 가장 가까운 값으로 맞춤', '예외': null, '권한': '없음', '데이터': '매핑 표는 코드에 포함', '완료 기준': '제공사 3곳에서 같은 입력이 통과' } },
    { id: 'F-03', title: '지원하지 않는 파라미터 경고', detail: '옮길 수 없는 파라미터는 조용히 버리지 않고 알린다.', up: ['R-02'],
      slots: { '입력·상태': '매핑 결과', '규칙': '버려진 항목을 목록으로 반환', '예외': '경고는 호출을 막지 않음', '권한': '없음', '데이터': '없음', '완료 기준': '버려진 파라미터가 응답에 표시됨' } },
  ],
  screens: [
    { id: 'S-01', title: '모델 전환 설정', detail: '제공사와 모델을 고르는 한 화면.', up: ['F-01'] },
    { id: 'S-02', title: '매핑 확인', detail: '내 파라미터가 어떻게 옮겨졌는지, 무엇이 빠졌는지.', up: ['F-02', 'F-03'] },
  ],
};

(function () {
  const S = window.SPEC;
  const all = [...S.evidence, ...S.requirements, ...S.features, ...S.screens];
  const byId = Object.fromEntries(all.map((item) => [item.id, item]));
  /** 한 항목이 기대는 위쪽 사슬과, 그 항목에 기대는 아래쪽 사슬 전체. */
  window.traceOf = function (id) {
    const ids = new Set([id]);
    const up = (x) => (byId[x]?.up ?? []).forEach((p) => { ids.add(p); up(p); });
    const down = (x) => all.filter((item) => (item.up ?? []).includes(x)).forEach((c) => { ids.add(c.id); down(c.id); });
    up(id);
    down(id);
    return ids;
  };
  window.byId = byId;
})();
