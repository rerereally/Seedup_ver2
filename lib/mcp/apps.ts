// MCP Apps (io.modelcontextprotocol/ui, spec 2026-01-26): tools also draw a small card in hosts that render
// apps (Claude web and desktop, VS Code Copilot). Hosts that do not keep showing the text result, which stays complete.
import type { BuildProgress } from '@/lib/opportunities/build-progress';
import type { Spec } from '@/lib/opportunities/spec';
import type { Opportunity } from '@/lib/opportunities/types';

export const APP_URI = 'ui://seedup/card';
export const APP_MIME = 'text/html;profile=mcp-app';
const APP_TOOLS = new Set(['search_opportunities', 'generate_verified_prd', 'get_build_checklist', 'get_next_task', 'mark_feature_done', 'update_feature_status']);

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
  key.startsWith('prd:') ? `${siteUrl}/prd` : `${siteUrl}/prd?opportunity=${encodeURIComponent(key)}`;

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

/** What the card draws for get_build_checklist and mark_feature_done. */
export function checklistCard(opportunity: Opportunity, spec: Spec, progress: BuildProgress, criteria: (feature: Spec['features'][number]) => string[], siteUrl: string) {
  return {
    kind: 'checklist',
    slug: opportunity.slug,
    name: opportunity.name,
    features: spec.features.map((feature) => ({ id: feature.id, title: feature.title, status: progress[feature.id]?.status ?? 'todo', done: progress[feature.id]?.status === 'done', criteria: criteria(feature).length, note: progress[feature.id]?.note ?? '' })),
    url: projectPage(siteUrl, opportunity.slug),
  };
}

export function nextTaskCard(feature: Spec['features'][number], why: string, criteria: number, quotes: number, files: string[], goal?: string) {
  return { kind: 'next', id: feature.id, title: feature.title, why, criteria, quotes, files, ...(goal ? { goal } : {}) };
}

// The card: plain DOM, no libraries. Text from the server goes in through textContent only (quotes come from the web).
const APP_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fff;--ink:#16181d;--muted:#5d6470;--line:#e4e7ec;--soft:#f4f6f8;--seed:#127a4c;--seed-soft:#ecf7f1;--warn:#9a5b00;--warn-soft:#fdf4e3;color-scheme:light}
:root[data-theme=dark]{--bg:#16181d;--ink:#eef0f3;--muted:#a1a8b3;--line:#2c3038;--soft:#1f2228;--seed:#3ecf8e;--seed-soft:#0f241a;--warn:#f0b75a;--warn-soft:#2a2112;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Segoe UI",sans-serif}
main{padding:14px 16px}h1{font-size:15px;margin:0 0 2px;font-weight:650}.sub{color:var(--muted);font-size:13px;margin:0 0 12px}
.list>*{border-top:1px solid var(--line);padding:10px 0}.list>:last-child{border-bottom:1px solid var(--line)}
.row{display:flex;gap:10px;align-items:baseline;justify-content:space-between}.name{font-weight:600}.muted{color:var(--muted);font-size:13px}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:12px;background:var(--soft);color:var(--muted);white-space:nowrap}
.tag.ok{background:var(--seed-soft);color:var(--seed)}.tag.warn{background:var(--warn-soft);color:var(--warn)}
.num{font-variant-numeric:tabular-nums}.id{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);margin-right:6px}
.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
button{font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:5px 11px;cursor:pointer;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
button.primary{background:var(--seed);border-color:var(--seed);color:#fff}:root[data-theme=dark] button.primary{color:#0b1a12}
button:disabled{opacity:.5;cursor:default}
.bar{height:6px;border-radius:99px;background:var(--soft);overflow:hidden;margin:6px 0 12px}.bar>i{display:block;height:100%;background:var(--seed)}
.check{display:inline-flex;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line);align-items:center;justify-content:center;font-size:11px;flex:none;margin-right:8px}
.check.done{background:var(--seed);border-color:var(--seed);color:#fff}.feat{display:flex;align-items:flex-start}
.status{color:var(--muted);font-size:13px;min-height:18px;margin-top:8px}
</style></head><body><main id="root"><p class="muted">Seedup</p></main>
<script>
(function(){
  var ko = !/^en/i.test(navigator.language || 'ko');
  var T = function(k, e){ return ko ? k : e; };
  var STATUS = { in_progress: T('작업 중', 'In progress'), improving: T('개선 중', 'Improving'), blocked: T('막힘', 'Blocked'), needs_recheck: T('다시 확인 필요', 'Recheck') };
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
        h('button', { class: 'primary', text: T('구현 체크리스트', 'Build checklist'), on: function(){ call('get_build_checklist', { slug: data.slug }, T('체크리스트를 불러오는 중입니다.', 'Loading the checklist.')); } }),
        h('button', { text: T('웹에서 전체 보기', 'Open on the web'), on: function(){ open(data.url); } })),
      h('p', { id: 'status', class: 'status', role: 'status' })];
  }
  function checklist(data){
    var done = data.features.filter(function(f){ return f.done; }).length, total = data.features.length || 1;
    return [h('h1', { text: data.name }), h('p', { class: 'sub num', text: T('기능 ', 'Features ') + done + ' / ' + data.features.length + T(' 완료', ' done') }),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(done / total * 100) + '%' })),
      h('div', { class: 'list' }, ...data.features.map(function(f){
        return h('div', { class: 'feat' }, h('span', { class: f.done ? 'check done' : 'check', 'aria-label': f.done ? T('완료', 'Done') : T('남음', 'To do'), text: f.done ? '✓' : '' }),
          h('div', null, h('div', null, h('span', { class: 'id', text: f.id }), f.title), h('div', { class: 'muted', text: (f.status && f.status !== 'todo' && f.status !== 'done' ? (STATUS[f.status] || f.status) + ' · ' : '') + (f.note || (f.criteria + T('개 기준을 통과하면 완료', ' criteria to pass'))) })));
      })),
      h('div', { class: 'actions' }, h('button', { text: T('웹에서 보기', 'Open on the web'), on: function(){ open(data.url); } })),
      h('p', { class: 'muted', text: T('상태는 에이전트가 update_feature_status로 보고합니다. 완료는 기준을 모두 확인해야 기록됩니다.', 'The agent reports status with update_feature_status; done needs every criterion checked.') })];
  }
  function next(data){
    return [h('h1', null, h('span', { class: 'id', text: data.id }), h('span', { text: data.title })),
      h('p', { class: 'sub', text: data.why }),
      data.goal ? h('p', { class: 'muted', style: 'white-space:pre-line;overflow-wrap:anywhere', text: data.goal }) : null,
      h('p', { class: 'muted num', text: T('완료 기준 ', 'Done criteria: ') + data.criteria + T('개, 원문 ', ', quotes: ') + data.quotes + T('개', '') }),
      data.files.length
        ? h('div', { class: 'list' }, ...data.files.map(function(file){ return h('div', { class: 'muted', style: 'overflow-wrap:anywhere', text: file }); }))
        : h('p', { class: 'muted', text: T('관련 파일 정보 없음', 'No related file information') })];
  }
  function render(data){
    if (!data || !data.kind) return;
    var parts = data.kind === 'opportunities' ? opportunities(data) : data.kind === 'prd' ? prd(data) : data.kind === 'checklist' ? checklist(data) : data.kind === 'next' ? next(data) : null;
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
