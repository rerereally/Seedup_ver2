'use client';

import { useState } from 'react';

/** Issues a personal MCP token and shows the one-line setup for Claude Code and Cursor. The token is shown once. */
export default function McpConnect({ siteUrl }: { siteUrl: string }) {
  const [token, setToken] = useState('');
  const [state, setState] = useState<'idle' | 'working'>('idle');
  const [message, setMessage] = useState('');
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/mcp`;
  const claude = `claude mcp add --transport http seedup ${endpoint} --header "Authorization: Bearer ${token || '<토큰>'}"`;
  const cursor = JSON.stringify({ mcpServers: { seedup: { url: endpoint, headers: { Authorization: `Bearer ${token || '<토큰>'}` } } } }, null, 2);

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
    <div className="mt-4 space-y-3 text-sm">
      <p className="leading-6 text-muted">Claude Code·Cursor에서 Seedup의 기회 검색과 근거 추적 PRD 생성을 바로 쓸 수 있습니다. PRD는 하루 10개까지입니다.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={state === 'working'} onClick={() => void request('POST')}>{token ? '토큰 다시 만들기' : 'MCP 토큰 만들기'}</button>
        <button type="button" className="btn-quiet" disabled={state === 'working'} onClick={() => void request('DELETE')}>토큰 지우기</button>
      </div>
      <p role="status" className="text-muted">{message}</p>
      {token && (
        <>
          <div>
            <p className="font-semibold text-ink">Claude Code</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-surface p-3 text-[12.5px]">{claude}</pre>
            <button type="button" className="btn-quiet mt-1" onClick={() => void copy(claude)}>명령 복사</button>
          </div>
          <div>
            <p className="font-semibold text-ink">Cursor (.cursor/mcp.json)</p>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-surface p-3 text-[12.5px]">{cursor}</pre>
            <button type="button" className="btn-quiet mt-1" onClick={() => void copy(cursor)}>설정 복사</button>
          </div>
        </>
      )}
    </div>
  );
}
