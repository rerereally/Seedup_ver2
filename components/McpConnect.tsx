'use client';

import { Check, Copy, ExternalLink, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { mcpClients, type McpClientId } from '@/lib/mcp/clients';

/**
 * Connects any coding agent: pick the tool, then copy its setup or open its install link. The first copy or open gets
 * the user's token (the same one every time, so a second tool does not cut off the first) and fills it into the setup.
 */
export default function McpConnect({ siteUrl, connected, lastUsed }: { siteUrl: string; connected: boolean; lastUsed: string | null }) {
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(connected);
  const [picked, setPicked] = useState<McpClientId>('claude-code');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  const clients = mcpClients(siteUrl, token || '[토큰]');
  const client = clients.find((item) => item.id === picked) ?? clients[0];

  const fetchToken = async (rotate = false) => {
    const response = await fetch('/api/mcp/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rotate }) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.token) throw new Error(json.error ?? '토큰을 받지 못했습니다.');
    setToken(json.token);
    setHasToken(true);
    return String(json.token);
  };

  // Every action reads the setup again with the real token, since state from fetchToken lands after this render.
  const run = async (action: 'copy' | 'open') => {
    setWorking(true);
    setMessage('');
    setCopied(false);
    setOpened(null);
    try {
      const real = mcpClients(siteUrl, token || (await fetchToken())).find((item) => item.id === picked)!;
      if (action === 'open' && real.link) {
        window.location.href = real.link;
        setOpened(real.link);
        setMessage(`${real.name}에서 설치 창이 열리면 설치를 누르세요.`);
        return;
      }
      try {
        await navigator.clipboard.writeText(real.snippet);
        setCopied(true);
        setMessage(`복사했습니다. ${real.where}에 붙여 넣으세요.`);
      } catch {
        setMessage('클립보드에 복사하지 못했습니다. 아래 설정을 직접 선택해 복사하세요.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setWorking(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm('새 토큰을 만들면 지금 연결된 모든 도구가 끊깁니다. 계속할까요?')) return;
    setWorking(true);
    try {
      await fetchToken(true);
      setMessage('새 토큰을 만들었습니다. 쓰던 도구의 설정을 다시 복사해 바꿔 넣으세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '토큰을 만들지 못했습니다.');
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('연결을 끊으면 모든 도구가 Seedup에 접근할 수 없습니다. 계속할까요?')) return;
    setWorking(true);
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

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="mcp-status" className="card p-5">
        <div>
          <h2 id="mcp-status" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${hasToken ? 'bg-seed' : 'bg-outline-strong'}`} />
            {hasToken ? (lastUsed ? `연결됨 · 마지막 사용 ${lastUsed}` : '토큰 있음 · 아직 쓴 도구 없음') : '아직 연결한 도구가 없습니다'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">토큰 하나로 여러 도구를 연결합니다. 서버에는 토큰의 해시만 저장합니다.</p>
        </div>
        {hasToken && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-quiet whitespace-nowrap" disabled={working} onClick={() => void rotate()}>토큰 새로 만들기</button>
            <button type="button" className="btn-quiet whitespace-nowrap" disabled={working} onClick={() => void disconnect()}>연결 끊기</button>
          </div>
        )}
      </section>

      <section aria-labelledby="mcp-pick">
        <h2 id="mcp-pick" className="text-[17px] font-semibold text-ink">쓰는 도구 고르기</h2>
        <div role="tablist" aria-label="연결할 도구" className="seg mt-3">
          {clients.map((item) => (
            <button key={item.id} type="button" role="tab" id={`mcp-tab-${item.id}`} aria-controls="mcp-panel" aria-selected={item.id === picked} onClick={() => { setPicked(item.id); setMessage(''); setCopied(false); setOpened(null); }}>{item.name}</button>
          ))}
        </div>

        <div id="mcp-panel" role="tabpanel" aria-labelledby={`mcp-tab-${client.id}`} className="mt-6">
          <ol className="flex flex-col gap-2">
            {client.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-[15px] leading-7 text-ink">
                <span className="num mt-[3px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-mid text-xs font-semibold text-muted">{index + 1}</span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {client.link && <button type="button" className="btn h-11 px-5" disabled={working} onClick={() => void run('open')}><ExternalLink aria-hidden="true" className="h-4 w-4" />{client.name}에서 열기</button>}
            <button type="button" className={client.link ? 'btn-quiet h-11' : 'btn h-11 px-5'} disabled={working} onClick={() => void run('copy')}>
              {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
              {client.keyUrl ? '주소 복사' : client.id === 'claude-code' ? '명령 복사' : '설정 복사'}
            </button>
            <span className="font-mono text-[13px] text-muted [overflow-wrap:anywhere]">{client.where}</span>
          </div>

          <pre className="terminal mt-4 whitespace-pre-wrap break-all">{client.snippet}</pre>
          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-muted">
            <KeyRound aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {client.keyUrl
              ? '이 주소에는 토큰이 들어 있어서 주소 자체가 비밀번호입니다. 다른 사람에게 보여 주지 마세요. 새어 나갔다면 토큰을 새로 만드세요. 이 주소는 서버 로그에 남을 수 있으니, 가능하면 헤더 방식 연결을 쓰세요.'
              : token ? '설정에 내 토큰이 들어 있습니다. 다른 사람에게 보여 주지 마세요.' : '복사하거나 열면 [토큰] 자리에 내 토큰이 채워집니다.'}
          </p>

          <p role="status" className="mt-3 min-h-5 text-sm text-ink">
            {message}
            {opened && <> <a href={opened} className="font-semibold text-seed underline-offset-4 hover:underline">창이 열리지 않으면 여기를 누르세요</a></>}
          </p>
        </div>
      </section>

      <section aria-labelledby="mcp-try" className="border-t border-outline-soft pt-8">
        <h2 id="mcp-try" className="text-[17px] font-semibold text-ink">연결됐는지 확인하기</h2>
        <p className="mt-2 text-[15px] leading-7 text-muted">도구를 다시 열고 아래처럼 물어보세요. Seedup 도구를 불러 답하면 연결된 것이고, 위 상태도 &quot;마지막 사용&quot;으로 바뀝니다.</p>
        <ul className="rows mt-4">
          {['Seedup에서 AI 에이전트 관련해 검증된 기회를 찾아줘', '그중 하나로 검증된 PRD를 만들어서 AGENTS.md로 저장해줘', '이 PRD의 구현 체크리스트를 보여 주고 첫 기능부터 만들어줘'].map((prompt) => (
            <li key={prompt} className="py-3 text-[15px] text-ink">&ldquo;{prompt}&rdquo;</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
