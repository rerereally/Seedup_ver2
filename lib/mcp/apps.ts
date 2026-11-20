// MCP Apps (io.modelcontextprotocol/ui, spec 2026-01-26): tools also draw a small card in hosts that render
// apps (Claude web and desktop, VS Code Copilot). Hosts that do not keep showing the text result, which stays complete.
import type { VerificationRecord } from '@/lib/db/verifications';
import type { BuildProgress } from '@/lib/opportunities/build-progress';
import type { Spec } from '@/lib/opportunities/spec';
import type { Opportunity } from '@/lib/opportunities/types';
import { scrubSecrets } from '@/lib/supervisor/diff-audit';

export const APP_URI = 'ui://seedup/card';
export const APP_MIME = 'text/html;profile=mcp-app';
const APP_TOOLS = new Set(['search_opportunities', 'generate_verified_prd', 'resume_project', 'get_next_task', 'update_feature_status', 'verify_feature']);

/** The tool list with the card linked to the tools that have one. */
export function withAppMeta<T extends { name: string }>(tools: readonly T[]) {
  return tools.map((tool) => (APP_TOOLS.has(tool.name) ? { ...tool, _meta: { ui: { resourceUri: APP_URI } } } : tool));
}

export const appResource = { uri: APP_URI, name: 'Seedup card', description: 'Opportunities, PRD summary and build progress as a card', mimeType: APP_MIME };

export function readAppResource(uri: unknown) {
  if (uri !== APP_URI) return null;
  // No external origins: the card is one self-contained page and only talks to the host.
  return { contents: [{ uri: APP_URI, mimeType: APP_MIME, text: APP_HTML, _meta: { ui: { prefersBorder: true, csp: {} } } }] };
}

export const projectPage = (siteUrl: string, key: string) =>
  key.startsWith('prd:') ? `${siteUrl.replace(/\/+$/, '')}/prd` : `${siteUrl.replace(/\/+$/, '')}/prd?opportunity=${encodeURIComponent(key)}`;

export const supervisorPage = (siteUrl: string, key: string) =>
  `${siteUrl.replace(/\/+$/, '')}/supervisor/${encodeURIComponent(key)}`;

export const progressNote = (note: string) => scrubSecrets(note
  .replace(/\[(?:supervisor_verified|self_reported|local_checked)(?::[^\]\r\n]*)?\]/gi, '')
  .replace(/\bsvt1\.[\w-]+\.[\w-]+/g, '[REDACTED verification token]')).scrubbed.trim();

/** What the card draws for search_opportunities. */
export function opportunitiesCard(found: Opportunity[], siteUrl: string) {
  return {
    kind: 'opportunities',
    items: found.map((item) => ({
      slug: item.slug,
      name: item.name,
      problem: item.problem,
      qualified: item.qualified,
      quotes: item.evidence.length,
      platforms: item.platforms,
      rivals: item.directCount,
      status: item.status,
      url: `${siteUrl}/opportunities/${item.slug}`,
    })),
  };
}

/** What the card draws for generate_verified_prd: features and how many quotes stand behind each. */
export function prdCard(opportunity: Opportunity, spec: Spec, siteUrl: string) {
  const rows = [...spec.requirements, ...spec.hypotheses];
  return {
    kind: 'prd',
    slug: opportunity.slug,
    name: opportunity.name,
    summary: spec.summary,
    draft: spec.draft,
    requirements: spec.requirements.length,
    hypotheses: spec.hypotheses.length,
    features: spec.features.map((feature) => {
      const served = rows.filter((row) => feature.requirementIds.includes(row.id));
      return { id: feature.id, title: feature.title, quotes: new Set(served.flatMap((row) => row.evidence)).size, hypothesis: served.length > 0 && served.every((row) => spec.hypotheses.includes(row)) };
    }),
    url: projectPage(siteUrl, opportunity.slug),
  };
}

/** What the card draws for resume_project and update_feature_status. */
export function checklistCard(
  opportunity: Opportunity, spec: Spec, progress: BuildProgress, criteria: (feature: Spec['features'][number]) => string[],
  siteUrl: string, completion?: { featureId: string; level: 'supervisor_verified' | 'self_reported' }, goal?: string,
) {
  return {
    kind: 'checklist',
    slug: opportunity.slug,
    name: opportunity.name,
    features: spec.features.map((feature) => ({ id: feature.id, title: feature.title, status: progress[feature.id]?.status ?? 'todo', done: progress[feature.id]?.status === 'done', level: progress[feature.id]?.status === 'done' ? (progress[feature.id]?.verificationLevel === 'supervisor_verified' ? 'supervisor_verified' : 'self_reported') : null, criteria: criteria(feature).length, note: progressNote(progress[feature.id]?.note ?? '') })),
    url: projectPage(siteUrl, opportunity.slug),
    ...(completion ? { completion } : {}),
    ...(goal ? { goal } : {}),
  };
}

export function nextTaskCard(feature: Spec['features'][number], why: string, criteria: number, quotes: number, files: string[], goal?: string) {
  return { kind: 'next', id: feature.id, title: feature.title, why, criteria, quotes, files, ...(goal ? { goal } : {}) };
}

export function verificationCard(
  row: VerificationRecord, goal: string, verdicts: Array<{ criterion: string; verdict: string; citations: number }>,
  blockers: number, warnings: number,
) {
  return {
    kind: 'verification', project: row.projectKey, id: row.id, feature: row.featureId, sha: row.sha.slice(0, 8), fullSha: row.sha,
    status: row.status, verified: row.status === 'passed' && Boolean(row.token), goal, verdicts, blockers, warnings, drift: row.drift.length,
  };
}

// The card: plain DOM, no libraries. Text from the server goes in through textContent only (quotes come from the web).
const APP_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--surface:#ffffff;--white:#ffffff;--ink:#121214;--tertiary:#4b4b53;--muted:#6c6c74;--outline-soft:#e6e6ea;--surface-low:#f4f4f6;--seed:#127a4c;--seed-soft:#ecf7f1;--on-seed:#ffffff;--warn:#9a5b00;--warn-soft:#fbf2e3;color-scheme:light}
:root[data-theme=dark]{--surface:#0f1012;--white:#17181b;--ink:#ececef;--tertiary:#b9bdc6;--muted:#9096a0;--outline-soft:#2a2b30;--surface-low:#1c1d21;--seed:#3ecf8e;--seed-soft:#0f241a;--on-seed:#04140c;--warn:#f0b75a;--warn-soft:#2a1f0c;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--white);color:var(--ink);font:14px/1.5 "Pretendard",system-ui,sans-serif}
main{padding:14px 16px;overflow-wrap:anywhere}h1{font-size:15px;margin:0 0 2px;font-weight:600}.sub{color:var(--tertiary);font-size:13px;margin:0 0 12px}
.list>*{border-top:1px solid var(--outline-soft);padding:10px 0}.list>:last-child{border-bottom:1px solid var(--outline-soft)}
.row{display:flex;gap:10px;align-items:baseline;justify-content:space-between}.name{font-weight:600}.muted{color:var(--muted);font-size:13px}
.goal{white-space:pre-line;color:var(--tertiary);font-size:13px}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tag{display:inline-block;border-radius:8px;padding:1px 7px;font-size:13px;background:var(--surface-low);color:var(--tertiary)}
.tag.ok{background:var(--seed-soft);color:var(--seed)}.tag.warn{background:var(--warn-soft);color:var(--warn)}
.num{font-variant-numeric:tabular-nums}.id{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);margin-right:6px}
.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
button{font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:5px 11px;cursor:pointer;border:1px solid var(--outline-soft);background:var(--surface);color:var(--ink)}
button.primary{background:var(--seed);border-color:var(--seed);color:var(--on-seed)}
button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
button:disabled{opacity:.5;cursor:default}
.bar{height:6px;border-radius:99px;background:var(--surface-low);overflow:hidden;margin:6px 0 12px}.bar>i{display:block;height:100%;background:var(--muted)}
.check{display:inline-flex;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--outline-soft);align-items:center;justify-content:center;font-size:13px;flex:none;margin-right:8px}
.check.done{background:var(--surface-low);color:var(--ink)}.feat{display:flex;align-items:flex-start}
.status{color:var(--muted);font-size:13px;min-height:18px;margin-top:8px}
</style></head><body><main id="root"><p class="muted">Seedup</p></main>
<script>
(function(){
  var ko = !/^en/i.test(navigator.language || 'ko');
  var T = function(k, e){ return ko ? k : e; };
  function progressLabel(status){
    return { in_progress: T('작업 중', 'In progress'), improving: T('개선 중', 'Improving'), blocked: T('막힘', 'Blocked'), needs_recheck: T('다시 확인 필요', 'Recheck') }[status];
  }
  var root = document.getElementById('root');
  var seq = 0, waiting = {};
  function post(m){ window.parent.postMessage(m, '*'); }
  function request(method, params){ var id = ++seq; post({ jsonrpc: '2.0', id: id, method: method, params: params || {} }); return new Promise(function(ok, no){ waiting[id] = { ok: ok, no: no }; }); }
  function h(tag, attrs){
    var node = document.createElement(tag);
    for (var key in (attrs || {})) { if (key === 'text') node.textContent = attrs[key]; else if (key === 'on') node.onclick = attrs[key]; else node.setAttribute(key, attrs[key]); }
    for (var i = 2; i < arguments.length; i++) { var child = arguments[i]; if (child == null || child === false) continue; node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child); }
    return node;
  }
  function theme(ctx){ if (ctx && ctx.theme) document.documentElement.setAttribute('data-theme', ctx.theme); if (ctx && ctx.locale) ko = !/^en/i.test(ctx.locale); }
  function open(url){ request('ui/open-link', { url: url }).catch(function(){ window.open(url, '_blank', 'noopener'); }); }
  function say(text){ var s = document.getElementById('status'); if (s) s.textContent = text; }
  function call(name, args, busy){
    say(busy);
    return request('tools/call', { name: name, arguments: args }).then(function(result){
      if (result && result.structuredContent) render(result.structuredContent);
      else say((result && result.content && result.content[0] && result.content[0].text || T('응답이 없습니다.', 'No answer.')).slice(0, 200));
    }).catch(function(){ say(T('도구를 부르지 못했습니다. 대화창에서 다시 요청해 주세요.', 'Could not call the tool. Ask in the chat instead.')); });
  }
  function opportunities(data){
    return [h('h1', { text: T('검증된 기회', 'Verified opportunities') }), h('p', { class: 'sub', text: T('원문은 GitHub, Hacker News, Stack Overflow에서 글자 그대로 대조했습니다.', 'Quotes are matched word for word on GitHub, Hacker News and Stack Overflow.') }),
      h('div', { class: 'list' }, ...data.items.map(function(item){
        return h('div', null,
          h('div', { class: 'row' }, h('span', { class: 'name', text: item.name }), h('span', { class: item.qualified ? 'tag ok' : 'tag warn', text: item.qualified ? T('검증됨', 'Verified') : T('원문 모으는 중', 'Gathering') })),
          h('p', { class: 'muted clamp', text: item.problem }),
          h('p', { class: 'muted num', text: T('원문 ', '') + item.quotes + T('개 · ', ' quotes · ') + item.platforms.join(', ') + T(' · 직접 경쟁 ', ' · direct rivals ') + item.rivals }),
          h('div', { class: 'actions' },
            h('button', { class: 'primary', text: T('이걸로 PRD 만들기', 'Make the PRD'), on: function(){ call('generate_verified_prd', { slug: item.slug }, T('PRD를 만드는 중입니다. 처음이면 1분쯤 걸립니다.', 'Making the PRD, about a minute the first time.')); } }),
            h('button', { text: T('원문 보기', 'Quotes'), on: function(){ open(item.url); } })));
      })), h('p', { id: 'status', class: 'status', role: 'status' })];
  }
  function prd(data){
    return [h('h1', { text: data.name }), h('p', { class: 'sub' }, data.draft ? h('span', { class: 'tag warn', text: T('가설 초안', 'Hypothesis draft') }) : h('span', { class: 'tag ok', text: T('검증된 PRD', 'Verified PRD') }), ' ', h('span', { class: 'num', text: T('요구사항 ', 'Requirements ') + data.requirements + T(' · 가설 ', ' · hypotheses ') + data.hypotheses })),
      data.summary ? h('p', { class: 'muted clamp', text: data.summary }) : null,
      h('div', { class: 'list' }, ...data.features.map(function(f){
        return h('div', { class: 'row' }, h('span', null, h('span', { class: 'id', text: f.id }), f.title), h('span', { class: f.hypothesis ? 'tag warn' : 'tag', text: f.hypothesis ? T('가설', 'Hypothesis') : T('원문 ', '') + f.quotes + T('개', ' quotes') }));
      })),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', text: T('구현 체크리스트', 'Build checklist'), on: function(){ call('resume_project', { project: data.slug }, T('체크리스트를 불러오는 중입니다.', 'Loading the checklist.')); } }),
        h('button', { text: T('웹에서 전체 보기', 'Open on the web'), on: function(){ open(data.url); } })),
      h('p', { id: 'status', class: 'status', role: 'status' })];
  }
  function checklist(data){
    var done = data.features.filter(function(f){ return f.done; }).length, total = data.features.length || 1;
    return [h('h1', { text: data.name }), data.goal ? h('p', { class: 'goal', text: data.goal }) : null,
      h('p', { class: 'sub num', text: T('기능 ', 'Features ') + done + ' / ' + data.features.length + T(' 완료', ' done') }),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(done / total * 100) + '%' })),
      h('div', { class: 'list' }, ...data.features.map(function(f){
        var level = f.done ? (data.completion && data.completion.featureId === f.id ? data.completion.level : f.level) : null;
        var status = progressLabel(f.status);
        var marker = level === 'supervisor_verified' ? h('span', { class: 'tag ok', text: T('🟢 감독관 검증', '🟢 Supervisor verified') })
          : level === 'self_reported' ? h('span', { class: 'tag', text: T('⚪ 자가 보고', '⚪ Self-reported') })
          : status ? h('span', { class: f.status === 'blocked' || f.status === 'needs_recheck' ? 'tag warn' : 'tag', text: status }) : null;
        return h('div', { class: 'feat' }, h('span', { class: f.done ? 'check done' : 'check', 'aria-label': f.done ? T('완료', 'Done') : T('남음', 'To do'), text: f.done ? '✓' : '' }),
          h('div', null, h('div', null, h('span', { class: 'id', text: f.id }), f.title), marker,
            h('div', { class: 'muted', text: f.note || (f.criteria + T('개 기준을 통과하면 완료', ' criteria to pass')) })));
      })),
      h('div', { class: 'actions' }, h('button', { text: T('웹에서 보기', 'Open on the web'), on: function(){ open(data.url); } })),
      h('p', { class: 'muted', text: T('상태는 에이전트가 update_feature_status로 보고합니다. 완료는 기준을 모두 확인해야 기록됩니다.', 'The agent reports status with update_feature_status; done needs every criterion checked.') })];
  }
  function next(data){
    return [h('h1', null, h('span', { class: 'id', text: data.id }), h('span', { text: data.title })),
      data.goal ? h('p', { class: 'goal', text: data.goal }) : null,
      h('p', { class: 'sub', text: data.why }),
      h('p', { class: 'muted num', text: T('완료 기준 ', 'Done criteria: ') + data.criteria + T('개, 원문 ', ', quotes: ') + data.quotes + T('개', '') }),
      data.files.length
        ? h('div', { class: 'list' }, ...data.files.map(function(file){ return h('div', { class: 'muted', style: 'overflow-wrap:anywhere', text: file }); }))
        : h('p', { class: 'muted', text: T('관련 파일 정보 없음', 'No related file information') })];
  }
  function verification(data){
    var pending = data.status === 'queued' || data.status === 'running';
    var status = {
      queued: T('검증 대기 중', 'Verification queued'), running: T('검증 중', 'Verification running'),
      passed: T('검증 증표 없음', 'Verification proof unavailable'), blocked: T('검증 차단', 'Verification blocked'),
      failed: T('검증 미통과', 'Verification failed'), error: T('검증 오류', 'Verification error')
    }[data.status];
    var outcome = data.verified ? T('🟢 감독관 검증', '🟢 Supervisor verified') : status;
    var verdict = { met: T('충족', 'Met'), not_met: T('미충족', 'Not met'), unclear: T('판정 불가', 'Unclear') };
    return [h('h1', null, h('span', { class: 'id', text: data.feature + ' @ ' + data.sha }), h('span', { class: data.verified ? 'tag ok' : pending ? 'tag' : 'tag warn', text: outcome })),
      data.goal ? h('p', { class: 'goal', text: data.goal }) : null,
      data.verdicts.length ? h('div', { class: 'list' }, ...data.verdicts.map(function(row){
        return h('div', { class: 'row' }, h('span', null, h('span', { class: 'id', text: T('기준 ', 'Criterion ') + row.criterion }),
          h('span', { class: 'muted', text: T('인용 대조 ', 'Checked citations: ') + row.citations })),
          h('span', { class: row.verdict === 'met' ? 'tag' : 'tag warn', text: verdict[row.verdict] }));
      })) : null,
      data.blockers ? h('p', { class: 'tag warn', text: T('차단 항목 ', 'Blockers: ') + data.blockers }) : null,
      data.warnings ? h('p', { class: 'tag warn', text: T('정적 검사 경고 ', 'Static warnings: ') + data.warnings }) : null,
      data.drift ? h('p', { class: 'tag warn', text: T('범위 경고 ', 'Scope warnings: ') + data.drift }) : null,
      pending ? h('div', { class: 'actions' }, h('button', { class: 'primary', text: T('검증 결과 확인', 'Check verification'),
        on: function(){ call('verify_feature', { project: data.project, feature: data.feature, sha: data.fullSha || data.sha }, T('검증 결과를 불러오는 중입니다.', 'Loading the verification.')); } })) : null,
      h('p', { id: 'status', class: 'status', role: 'status' })];
  }
  function render(data){
    if (!data || !data.kind) return;
    var parts = data.kind === 'opportunities' ? opportunities(data) : data.kind === 'prd' ? prd(data) : data.kind === 'checklist' ? checklist(data) : data.kind === 'next' ? next(data) : data.kind === 'verification' ? verification(data) : null;
    if (!parts) return;
    root.replaceChildren.apply(root, parts.filter(Boolean));
  }
  window.addEventListener('message', function(event){
    var m = event.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id != null && waiting[m.id] && !m.method) { var w = waiting[m.id]; delete waiting[m.id]; if (m.error) w.no(m.error); else w.ok(m.result); return; }
    if (m.method === 'ui/notifications/tool-result') render(m.params && m.params.structuredContent);
    else if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
    else if (m.method === 'ui/resource-teardown') post({ jsonrpc: '2.0', id: m.id, result: {} });
    else if (m.id != null && m.method) post({ jsonrpc: '2.0', id: m.id, result: {} });
  });
  // The body's own box, not the document's: the document is at least as tall as the frame and would never shrink.
  new ResizeObserver(function(){ var box = document.body.getBoundingClientRect(); post({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: Math.ceil(box.width), height: Math.ceil(box.height) } }); }).observe(document.body);
  request('ui/initialize', { protocolVersion: '2026-01-26', appCapabilities: {}, clientInfo: { name: 'seedup-card', version: '1.0.0' } })
    .then(function(result){ theme(result && result.hostContext); post({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }); })
    .catch(function(){});
})();
</script></body></html>`;
