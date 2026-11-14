'use client';

import Link from 'next/link';
import { useState } from 'react';
import { downloadText } from './download';
import styles from './stage.module.css';

type PrdResult = { title: string; markdown: string; agentBrief: string; requirementCount: number; hypothesisCount: number };

export default function PrdBuilder({ title, evidenceIds, ready, loginNext, children }: {
  title: string;
  evidenceIds: string[];
  ready: boolean;
  loginNext: string;
  children?: React.ReactNode;
}) {
  const [result, setResult] = useState<PrdResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [copied, setCopied] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const generate = async () => {
    setStatus('loading');
    setError('');
    setNeedsLogin(false);
    try {
      const response = await fetch('/api/opportunities/prd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, evidenceIds }),
      });
      const json = await response.json();
      if (response.status === 401) setNeedsLogin(true);
      else if (!response.ok) setError(json.error ?? 'PRD를 만들지 못했습니다.');
      else setResult(json as PrdResult);
    } catch {
      setError('연결이 끊겼습니다. 다시 시도해주세요.');
    } finally {
      setStatus('idle');
    }
  };

  const save = async () => {
    setSaveState('saving');
    setError('');
    setNeedsLogin(false);
    try {
      const response = await fetch('/api/opportunities/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, evidenceIds, prdMarkdown: result?.markdown }),
      });
      if (response.status === 401) {
        setNeedsLogin(true);
        setSaveState('idle');
        return;
      }
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        setError(json.error ?? '저장하지 못했습니다.');
        setSaveState('idle');
        return;
      }
      setSaveState('saved');
    } catch {
      setError('연결이 끊겼습니다. 다시 시도해주세요.');
      setSaveState('idle');
    }
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setError('클립보드에 복사하지 못했습니다. 파일로 받아주세요.');
    }
  };

  return (
    <>
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={!ready || status === 'loading'} onClick={generate}>
          {status === 'loading' ? 'PRD 작성 중, 최대 1분 30초' : result ? 'PRD 다시 만들기' : '이 근거로 PRD 만들기'}
        </button>
        <button type="button" className={`${styles.action} ${styles.actionQuiet}`} disabled={!evidenceIds.length || saveState === 'saving'} onClick={save}>
          {saveState === 'saved' ? '보관함에 저장됨' : saveState === 'saving' ? '저장 중' : '보관함에 저장'}
        </button>
      </div>
      {children}
      <div aria-live="polite">
        {needsLogin && <p className={styles.notice}><Link href={`/login?next=${encodeURIComponent(loginNext)}`}>로그인</Link>하면 담은 근거를 유지한 채 이어갑니다.</p>}
        {error && <p className={styles.notice}>{error}</p>}
      </div>
      {result && (
        <section className={styles.prd} aria-label="생성된 PRD">
          <div className={styles.prdHead}>
            <h3>{result.title} PRD</h3>
            <span>근거 연결 요구사항 {result.requirementCount}개{result.hypothesisCount > 0 ? `, 검증 필요 가설 ${result.hypothesisCount}개` : ''}</span>
          </div>
          <pre className={styles.prdText} tabIndex={0}>{result.markdown}</pre>
          <div className={styles.prdActions}>
            <button type="button" className={styles.prdButton} onClick={() => copy('prd', result.markdown)}>{copied === 'prd' ? '복사됨' : 'PRD 복사'}</button>
            <button type="button" className={styles.prdButton} onClick={() => copy('agent', result.agentBrief)}>{copied === 'agent' ? '복사됨' : 'AI 코딩 도구용 복사'}</button>
            <button type="button" className={styles.prdButton} onClick={() => downloadText('PRD.md', result.markdown)}>PRD.md 받기</button>
            <button type="button" className={styles.prdButton} onClick={() => downloadText('AGENTS.md', result.agentBrief)}>AGENTS.md 받기</button>
          </div>
        </section>
      )}
    </>
  );
}
