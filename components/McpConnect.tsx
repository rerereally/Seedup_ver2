'use client';

import { useState } from 'react';

/** Issues a personal MCP token and shows the one-line setup for Claude Code and Cursor. The token is shown once. */
export default function McpConnect({ siteUrl }: { siteUrl: string }) {
  const [token, setToken] = useState('');
  const [state, setState] = useState<'idle' | 'working'>('idle');
  const [message, setMessage] = useState('');
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/mcp`;
  const claude = `claude mcp add --transport http seedup ${endpoint} --header "Authorization: Bearer ${token || '[토큰]'}"`;
  const cursor = JSON.stringify({ mcpServers: { seedup: { url: endpoint, headers: { Authorization: `Bearer ${token || '[토큰]'}` } } } }, null, 2);

  const request = async (method: 'POST' | 'DELETE') => {
    setState('working');
    setMessage('');
    try {
      const response = await fetch('/api/mcp/token', { method });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(json.error ?? '요청에 실패했습니다.');
      else if (method === 'POST') {
        setToken(json.token);
        setMessage('새 토큰입니다. 이 화면을 벗어나면 다시 볼 수 없으니 지금 복사하세요. 이전 토큰은 더 이상 쓸 수 없습니다.');
      } else {
        setToken('');
        setMessage('토큰을 지웠습니다. 연결된 도구는 더 이상 Seedup에 접근할 수 없습니다.');
      }
    } catch {
      setMessage('연결이 끊겼습니다. 다시 시도해주세요.');
    } finally {
      setState('idle');
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('복사했습니다.');
    } catch {
      setMessage('클립보드에 복사하지 못했습니다. 직접 선택해 복사하세요.');
    }
  };

  return (
    <>
      <section>
        <h2 className="text-[17px] font-semibold text-ink"><span className="num text-seed">1</span> 개인 토큰 만들기</h2>
        <p className="mt-2 text-[15px] text-muted">토큰은 한 번만 보여 드립니다. 서버에는 해시만 저장합니다. PRD는 하루 10개까지 만들 수 있습니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn h-11 px-5" disabled={state === 'working'} onClick={() => void request('POST')}>{token ? '토큰 다시 만들기' : '토큰 만들기'}</button>
          <button type="button" className="btn-quiet h-11" disabled={state === 'working'} onClick={() => void request('DELETE')}>토큰 지우기</button>
        </div>
        <p role="status" className="mt-3 text-sm text-muted">{message}</p>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold text-ink"><span className="num text-seed">2</span> 에이전트에 추가하기</h2>
        <p className="mt-4 text-sm font-medium text-ink">Claude Code</p>
        <pre className="terminal mt-2 whitespace-pre-wrap break-all">{claude}</pre>
        <button type="button" className="btn-quiet mt-2" onClick={() => void copy(claude)}>명령 복사</button>
        <p className="mt-6 text-sm font-medium text-ink">Cursor (.cursor/mcp.json)</p>
        <pre className="terminal mt-2">{cursor}</pre>
        <button type="button" className="btn-quiet mt-2" onClick={() => void copy(cursor)}>설정 복사</button>
      </section>
    </>
  );
}
