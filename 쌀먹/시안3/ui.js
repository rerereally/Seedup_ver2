// 모든 화면이 함께 쓰는 머리·꼬리와 예시 데이터.
// 기회 이름·숫자·문제 설명은 2026-11-15 배포 사이트의 기회 목록에 보이는 값입니다.
window.OPPS = [
  { slug: 'gif-search-api', name: 'gif 검색 api 대안', problem: 'Tenor GIF API가 공지 없이 종료되어 개발자가 대체 서비스를 찾고 있다.', status: 'open', ev: 5, plat: 2, pass: true, rival: '아직 없음', c: '#ff6a1f' },
  { slug: 'llm-provider-schema-normalization', name: '제공사별 모델 스키마 차이', problem: 'LLM 제공사마다 요청 파라미터 스키마가 달라 모델 교체 시 코드를 직접 수정해야 한다.', status: 'narrow', ev: 3, plat: 2, pass: true, rival: '직접 경쟁 4개', c: '#3b82f6' },
  { slug: 'agent-workflow-control', name: '에이전트 워크플로우 제어', problem: 'AI 에이전트가 생성하는 코드와 명령을 중앙에서 정의하고 검토할 수 없어 복잡성이 커진다.', status: 'open', ev: 3, plat: 2, pass: true, rival: '아직 없음', c: '#8b5cf6' },
  { slug: 'mesh-brep', name: '메시 브레프 변환', problem: '개발자가 STL이나 OBJ 메시 파일을 인공지능 없이 자동으로 STEP 브레프 모델로 바꾸지 못한다.', status: 'open', ev: 3, plat: 3, pass: true, rival: 'tommasobbianchi/mesh… ★105', c: '#ef4444' },
  { slug: 'agent-guardrail', name: '에이전트 가드레일 제어', problem: '개발자가 LLM 에이전트의 SSH·DB 접근과 출력, 일시 정지를 안전하게 제어할 방법이 없다.', status: 'open', ev: 5, plat: 2, pass: true, rival: '아직 없음', c: '#34d399' },
  { slug: 'distributed-compliance', name: '분산 시스템 컴플라이언스', problem: '수백 대 분산 시스템에 걸쳐 컴플라이언스와 가시성 정보가 산재해 있어 관리가 어렵다.', status: 'open', ev: 3, plat: 1, pass: false, rival: '아직 없음', c: '#2dd4bf' },
  { slug: 'agent-schema-discovery', name: 'AI 에이전트 스키마 발견', problem: '자율 AI 에이전트가 도구를 발견하고 선택할 수 있도록 도구 설명과 스키마를 알리는 방법이 없다.', status: 'open', ev: 2, plat: 1, pass: false, rival: '아직 없음', c: '#facc15' },
  { slug: 'db-cli', name: 'DB CLI 명령 불일치', problem: '데이터베이스 CLI의 명령과 자동완성이 일관되지 않아 멀티데이터베이스 작업이 번거롭다.', status: 'open', ev: 2, plat: 1, pass: false, rival: '아직 없음', c: '#f472b6' },
  { slug: 'cloud-run-cold-start', name: 'Cloud Run 냉시작 관리', problem: 'AI 애플리케이션 배포 시 Cloud Run 냉시작 지연을 간단하게 제어할 방법이 없다.', status: 'open', ev: 2, plat: 2, pass: false, rival: '아직 없음', c: '#818cf8' },
  { slug: 'cron-queue-monitoring', name: '크론 큐 워커 모니터링', problem: '대부분 팀이 크론 잡과 큐 워커를 모니터링하지 못해 스케줄러 실패와 워커 다운을 놓친다.', status: 'open', ev: 2, plat: 1, pass: false, rival: '아직 없음', c: '#3b82f6' },
];
window.STATUS = { open: ['open', '열림'], narrow: ['narrow', '좁아지는 중'], closed: ['closed', '닫힘'] };
window.statusPill = (status) => `<span class="pill ${STATUS[status][0]}"><i></i>${STATUS[status][1]}</span>`;
window.bars = (n, max, color) => `<span class="bars" style="--c:${color}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

const SPROUT = '<svg viewBox="0 0 24 24" fill="none" stroke="#ff6a1f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c0-4 2.5-7 7-7 0 4-2.5 7-7 7z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M7 21h10"/></svg>';

(function mount() {
  const page = document.body.dataset.page;
  const item = (key, href, label) => `<a href="${href}" class="${page === key ? 'now' : ''}">${label}</a>`;
  document.body.insertAdjacentHTML('afterbegin', `<header class="site">
    <a class="logo" href="index.html">${SPROUT}Seedup</a>
    <nav class="menu">${item('opps', 'opportunities.html', '기회')}${item('seeds', 'seeds.html', '내 씨앗')}${item('library', 'library.html', '보관함')}</nav>
    <div class="right">${item('signals', 'signals.html', '읽을거리')}<a href="#">EN</a><button class="login">로그인</button></div>
  </header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div><b>Seedup</b>만들기 전에 사람들의 말부터.</div><div>기회 · 내 씨앗 · 보관함 · 읽을거리</div></footer>`);

  // 흐름 표시: data-flow="1|2|3"이 있는 화면에만 넣음
  const flow = document.querySelector('[data-flow]');
  if (flow) {
    const now = Number(flow.dataset.flow);
    const steps = [['opportunity.html', '근거 확인'], ['spec.html', '스펙 만들기'], ['handoff.html', '에이전트에 넘기기']];
    flow.className = 'flow';
    flow.innerHTML = steps.map(([href, label], i) => `<a href="${href}" class="${i + 1 === now ? 'now' : i + 1 < now ? 'done' : ''}"><b>${i + 1 < now ? '✓' : i + 1}</b>${label}</a>`).join('<span>›</span>');
  }
})();
