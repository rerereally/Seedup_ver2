'use client';

import { useState } from 'react';

type Tool = 'cursor' | 'vscode' | 'claude';

/**
 * Connects a coding agent in one click: the button gets the user's token (the same one on every click, so a second
 * tool does not cut off the first) and opens the editor's own "add MCP server" dialog, or copies the Claude Code command.
 */
export default function McpConnect({ siteUrl, connected }: { siteUrl: string; connected: boolean }) {
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(connected);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState<{ label: string; href: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/mcp`;

  const setup = (value: string) => {
    const server = { url: endpoint, headers: { Authorization: `Bearer ${value}` } };
    return {
      cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=seedup&config=${encodeURIComponent(btoa(JSON.stringify(server)))}`,
      vscode: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'seedup', type: 'http', ...server }))}`,
      claude: `claude mcp add --transport http seedup ${endpoint} --header "Authorization: Bearer ${value}"`,
      json: JSON.stringify({ mcpServers: { seedup: server } }, null, 2),
    };
  };
  const shown = setup(token || '[토큰]');

  const fetchToken = async (rotate = false) => {
    const response = await fetch('/api/mcp/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rotate }) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.token) throw new Error(json.error ?? '토큰을 받지 못했습니다.');
    setToken(json.token);
    setHasToken(true);
    return String(json.token);
  };

  const connect = async (tool: Tool) => {
    setWorking(true);
    setMessage('');
    setFallback(null);
    try {
      const links = setup(token || (await fetchToken()));
      if (tool === 'claude') {
        try {
          await navigator.clipboard.writeText(links.claude);
          setMessage('명령을 복사했습니다. 터미널에 붙여 넣고 실행하면 Claude Code에 연결됩니다.');
        } catch {
          setManualOpen(true);
          setMessage('클립보드에 복사하지 못했습니다. 아래 직접 설정하기에서 명령을 복사하세요.');
        }
        return;
      }
      const label = tool === 'cursor' ? 'Cursor' : 'VS Code';
      window.location.href = links[tool];
      setFallback({ label, href: links[tool] });
      setMessage(`${label}에서 추가 창이 열리면 설치를 누르세요. 다른 도구에 연결해도 이 연결은 유지됩니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setWorking(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm('새 토큰을 만들면 지금 연결된 모든 도구가 끊깁니다. 계속할까요?')) return;
    setWorking(true);
    setFallback(null);
    try {
      await fetchToken(true);
      setManualOpen(true);
      setMessage('새 토큰을 만들었습니다. 쓰던 도구는 위 버튼으로 다시 연결하세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '토큰을 만들지 못했습니다.');
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('연결을 끊으면 모든 도구가 Seedup에 접근할 수 없습니다. 계속할까요?')) return;
    setWorking(true);
    setFallback(null);
    try {
      const response = await fetch('/api/mcp/token', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setToken('');
      setHasToken(false);
      setMessage('연결을 끊었습니다.');
    } catch {
      setMessage('연결을 끊지 못했습니다. 다시 시도해주세요.');
    } finally {
      setWorking(false);
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
        <h2 className="text-[17px] font-semibold text-ink"><span className="num text-seed">1</span> 버튼 한 번으로 연결</h2>
        <p className="mt-2 text-[15px] text-muted">쓰는 도구를 누르면 개인 토큰을 받아 바로 연결합니다. 여러 도구에 연결해도 같은 토큰을 씁니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn h-11 whitespace-nowrap px-5" disabled={working} onClick={() => void connect('cursor')}>Cursor에 연결</button>
          <button type="button" className="btn-quiet h-11 whitespace-nowrap" disabled={working} onClick={() => void connect('vscode')}>VS Code에 연결</button>
          <button type="button" className="btn-quiet h-11 whitespace-nowrap" disabled={working} onClick={() => void connect('claude')}>Claude Code 명령 복사</button>
        </div>
        <p role="status" className="mt-3 text-sm text-muted">
          {message}
          {fallback && <> <a href={fallback.href} className="font-semibold text-seed underline-offset-4 hover:underline">{fallback.label}가 열리지 않으면 여기를 누르세요</a></>}
        </p>
      </section>

      <section>
        <details open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-[17px] font-semibold text-ink"><span className="num text-seed">2</span> 직접 설정하기</summary>
          <p className="mt-2 text-[15px] text-muted">{token ? '아래 설정에는 내 토큰이 들어 있습니다. 다른 사람에게 보여 주지 마세요.' : '위 버튼을 한 번 누르면 아래 설정에 내 토큰이 채워집니다.'}</p>
          <p className="mt-5 text-sm font-medium text-ink">Claude Code</p>
          <pre className="terminal mt-2 whitespace-pre-wrap break-all">{shown.claude}</pre>
          <button type="button" className="btn-quiet mt-2" disabled={!token} onClick={() => void copy(shown.claude)}>명령 복사</button>
          <p className="mt-6 text-sm font-medium text-ink">Cursor, Windsurf 등 (mcp.json)</p>
          <pre className="terminal mt-2">{shown.json}</pre>
          <button type="button" className="btn-quiet mt-2" disabled={!token} onClick={() => void copy(shown.json)}>설정 복사</button>
        </details>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold text-ink"><span className="num text-seed">3</span> 연결 관리</h2>
        <p className="mt-2 text-[15px] text-muted">{hasToken ? '연결된 토큰이 있습니다. 서버에는 토큰의 해시만 저장합니다.' : '아직 연결한 도구가 없습니다.'}</p>
        {hasToken && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-quiet h-11 whitespace-nowrap" disabled={working} onClick={() => void rotate()}>토큰 새로 만들기</button>
            <button type="button" className="btn-quiet h-11 whitespace-nowrap" disabled={working} onClick={() => void disconnect()}>연결 끊기</button>
          </div>
        )}
      </section>
    </>
  );
}
