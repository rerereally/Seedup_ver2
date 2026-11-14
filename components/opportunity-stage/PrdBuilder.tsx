'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EXPORT_FILES, SLOT_KEYS, slotLabels, mermaidFlow, renderAgentBrief, renderSpecMarkdown, traceOf } from '@/lib/opportunities/spec';
import type { ExportFormat, Spec, SpecFeature, SpecInput } from '@/lib/opportunities/spec';
import { inBatches } from '@/lib/utils';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { downloadText } from './download';
import styles from './stage.module.css';

type View = 'trace' | 'tree' | 'flow' | 'doc';

const VIEWS: Array<[View, string, string]> = [['trace', '근거 추적', 'Evidence trace'], ['tree', '구조 트리', 'IA tree'], ['flow', '유저플로우', 'User flow'], ['doc', '문서', 'Document']];

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

/** Counts items whose title or text changed, so a revision reports what it actually touched. */
function changedCount(before: Spec, after: Spec) {
  const key = (spec: Spec) => new Set([...spec.requirements, ...spec.hypotheses].map((row) => `${row.title}|${row.detail}`).concat(spec.features.map((row) => `${row.title}|${row.detail}`), spec.screens.map((row) => `${row.name}|${row.does}`)));
  const a = key(before);
  const b = key(after);
  return [...b].filter((item) => !a.has(item)).length + [...a].filter((item) => !b.has(item)).length;
}

export default function PrdBuilder({ title, evidenceIds, ready, loginNext, children, endpoint = '/api/opportunities/prd', requestBody, generateLabel }: {
  title: string;
  evidenceIds: string[];
  /** The evidence passes the bar; otherwise the PRD is made as a labeled hypothesis draft. */
  ready: boolean;
  loginNext: string;
  children?: React.ReactNode;
  /** Another generator (the repo reverse spec) can reuse this workspace; it answers with the quotes it picked. */
  endpoint?: string;
  requestBody?: Record<string, unknown>;
  generateLabel?: string;
}) {
  const lang = useLang();
  const t = translator(lang);
  const [input, setInput] = useState<SpecInput | null>(null);
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const ids = pickedIds ?? evidenceIds;
  const customSource = Boolean(requestBody);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [previous, setPrevious] = useState<Spec | null>(null);
  const [view, setView] = useState<View>('trace');
  const [focus, setFocus] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'revising'>('idle');
  const [slotPending, setSlotPending] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [format, setFormat] = useState<ExportFormat>('agents');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const markdown = useMemo(() => (input && spec ? renderSpecMarkdown(input, spec) : ''), [input, spec]);
  const brief = useMemo(() => (input && spec ? renderAgentBrief(input, spec, format) : ''), [input, spec, format]);
  const trace = useMemo(() => (spec && focus ? traceOf(spec, focus) : null), [spec, focus]);

  const fail = (status: number, json: { error?: string }, fallback: string) => {
    if (status === 401) setNeedsLogin(true);
    else setError(json.error ?? fallback);
  };

  const generate = async () => {
    setStatus('loading');
    setError('');
    setMessage('');
    setNeedsLogin(false);
    try {
      const { status: code, ok, json } = await postJson(endpoint, { ...(requestBody ?? { title, evidenceIds }), lang });
      if (!ok) fail(code, json, t('PRD를 만들지 못했습니다.', 'Could not create the PRD.'));
      else {
        setInput(json.input as SpecInput);
        setPickedIds(Array.isArray(json.evidenceIds) ? json.evidenceIds : null);
        if (json.cached) setMessage(t(`AI 모델이 지금 응답하지 않아, 같은 근거로 ${new Date(json.cachedAt).toLocaleString('ko-KR')}에 만든 PRD를 보여줍니다.`, `The AI model is not answering right now, so this is the PRD made from the same quotes on ${new Date(json.cachedAt).toLocaleString('en-US')}.`));
        setSpec(json.spec as Spec);
        setPrevious(null);
        setFocus(null);
        setSaveState('idle');
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setStatus('idle');
    }
  };

  const fillSlots = async (feature: SpecFeature) => {
    if (!spec) return;
    setSlotPending((before) => [...before, feature.id]);
    try {
      const requirements = feature.requirementIds.flatMap((rid) => spec.requirements.find((row) => row.id === rid) ?? []);
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/slots', { title, evidenceIds: ids, feature, requirements, lang: spec.lang ?? lang });
      if (!ok) fail(code, json, t('슬롯을 채우지 못했습니다.', 'Could not fill the slots.'));
      else setSpec((current) => current && { ...current, features: current.features.map((row) => (row.id === feature.id ? { ...row, slots: json.slots } : row)) });
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setSlotPending((before) => before.filter((id) => id !== feature.id));
    }
  };

  // Two at a time keeps the free model under its rate limit; a failed feature just stays empty.
  const fillAll = () => spec && inBatches(spec.features.filter((row) => !row.slots && !slotPending.includes(row.id)), 2, fillSlots);

  const revise = async () => {
    if (!spec || instruction.trim().length < 2) return;
    setStatus('revising');
    setError('');
    setMessage('');
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/prd/revise', { title, evidenceIds: ids, spec, instruction });
      if (!ok) fail(code, json, t('수정하지 못했습니다.', 'Could not revise.'));
      else {
        const next = json.spec as Spec;
        setPrevious(spec);
        setSpec(next);
        setFocus(null);
        setInstruction('');
        setSaveState('idle');
        setMessage(t(`"${instruction.trim()}" 반영: 항목 ${changedCount(spec, next)}곳이 바뀌었습니다. 증언 목록은 그대로입니다.`, `Applied "${instruction.trim()}": ${changedCount(spec, next)} items changed. The quotes stay the same.`));
      }
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
    } finally {
      setStatus('idle');
    }
  };

  const undo = () => {
    if (!previous) return;
    setSpec(previous);
    setPrevious(null);
    setMessage(t('직전 수정을 되돌렸습니다.', 'Reverted the last change.'));
  };

  const save = async () => {
    setSaveState('saving');
    setError('');
    setNeedsLogin(false);
    try {
      const { status: code, ok, json } = await postJson('/api/opportunities/dossiers', { title, evidenceIds: ids, prdMarkdown: markdown || undefined });
      if (!ok) {
        fail(code, json, t('저장하지 못했습니다.', 'Could not save.'));
        setSaveState('idle');
        return;
      }
      setSaveState('saved');
    } catch {
      setError(t('연결이 끊겼습니다. 다시 시도해주세요.', 'Connection lost. Please try again.'));
      setSaveState('idle');
    }
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t(`${label}를 복사했습니다.`, `Copied ${label}.`));
    } catch {
      setError(t('클립보드에 복사하지 못했습니다. 파일로 받아주세요.', 'Could not copy. Download the file instead.'));
    }
  };

  const tone = (itemId: string) => (!trace ? '' : trace.ids.has(itemId) ? styles.specOn : styles.specDim);
  const evidenceTone = (n: number) => (!trace ? '' : trace.evidence.has(n) ? styles.specOn : styles.specDim);
  const pick = (itemId: string) => setFocus((current) => (current === itemId ? null : itemId));
  const item = (itemId: string, body: React.ReactNode, className = '') => (
    <button key={itemId} type="button" className={`${styles.specItem} ${tone(itemId)} ${className}`} aria-pressed={focus === itemId} onClick={() => pick(itemId)}>
      <span className={styles.specId}>{itemId}</span>
      {body}
    </button>
  );

  const slotsBlock = (feature: SpecFeature) => (
    <div className={styles.slots}>
      {feature.slots ? (
        <dl>
          {SLOT_KEYS.map((key) => (
            <div key={key}>
              <dt>{slotLabels(lang)[key]}</dt>
              <dd>{feature.slots![key].length ? feature.slots![key].join(' · ') : <em>{t('정해지지 않음: 먼저 물어볼 것', 'Open question: ask first')}</em>}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <button type="button" className={styles.prdButton} disabled={slotPending.includes(feature.id)} onClick={() => void fillSlots(feature)}>
          {slotPending.includes(feature.id) ? t('슬롯 채우는 중', 'Filling slots') : t('개발 준비 슬롯 채우기', 'Fill readiness slots')}
        </button>
      )}
    </div>
  );

  const busy = status !== 'idle';

  return (
    <>
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={(!customSource && !evidenceIds.length) || busy} onClick={generate}>
          {status === 'loading' ? t('PRD 작성 중, 최대 1분 30초', 'Writing the PRD, up to 90 s') : spec ? t('PRD 다시 만들기', 'Make the PRD again') : generateLabel ?? (ready ? t('이 근거로 PRD 만들기', 'Make a PRD from this evidence') : t('가설 초안 PRD 만들기', 'Make a hypothesis-draft PRD'))}
        </button>
        <button type="button" className={`${styles.action} ${styles.actionQuiet}`} disabled={!ids.length || saveState === 'saving'} onClick={save}>
          {saveState === 'saved' ? t('보관함에 저장됨', 'Saved') : saveState === 'saving' ? t('저장 중', 'Saving') : t('보관함에 저장', 'Save')}
        </button>
      </div>
      {!ready && !customSource && !spec && evidenceIds.length > 0 && <p className={styles.notice}>{t('근거가 기준(증언 3건, 플랫폼 2종)에 못 미쳐, 모든 내용을 검증 전 가설로 표시한 초안으로 만듭니다.', 'The evidence is below the bar (3 quotes, 2 platforms), so this becomes a draft labeled as unverified.')}</p>}
      {children}
      <div aria-live="polite">
        {needsLogin && <p className={styles.notice}><Link href={`/login?next=${encodeURIComponent(loginNext)}`}>{t('로그인', 'Sign in')}</Link>{t('하면 담은 근거를 유지한 채 이어갑니다.', ' to continue with the evidence you collected.')}</p>}
        {error && <p className={styles.notice}>{error}</p>}
        {message && <p className={styles.notice}>{message}</p>}
      </div>

      {input && spec && (
        <section className={styles.prd} aria-label={t('생성된 PRD', 'Generated PRD')}>
          <div className={styles.prdHead}>
            <h3>{input.title} PRD</h3>
            <span>
              {spec.draft && <b className={styles.draftBadge}>{t('가설 초안', 'Hypothesis draft')}</b>}
              {t('증언', 'Quotes')} {input.evidence.length} → {t('요구사항', 'Requirements')} {spec.requirements.length} → {t('기능', 'Features')} {spec.features.length} → {t('화면', 'Screens')} {spec.screens.length}
              {spec.hypotheses.length > 0 ? ` · ${t('검증 필요 가설', 'Hypotheses')} ${spec.hypotheses.length}` : ''}
            </span>
          </div>

          <div className={styles.specTabs} role="tablist" aria-label={t('PRD 보기 방식', 'PRD view')}>
            {VIEWS.map(([key, label, labelEn]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} className={styles.specTab} onClick={() => setView(key)}>{t(label, labelEn)}</button>
            ))}
          </div>

          {spec.existing && spec.existing.length > 0 && (
            <details className={styles.existing} open>
              <summary>{t(`기존 구조 ${spec.existing.length}개 · 새 기능이 깨면 안 되는 것`, `Existing structure (${spec.existing.length}) · new work must not break it`)}</summary>
              <ul>{spec.existing.map((row) => <li key={row.name}><b>{row.name}</b>{row.does ? `: ${row.does}` : ''}</li>)}</ul>
            </details>
          )}

          {view === 'trace' && (
            <div className={styles.specCols}>
              <p className={styles.specHint}>{t('항목을 누르면 그 항목이 기대는 증언과, 그 위에 쌓인 기능·화면이 함께 강조됩니다.', 'Click any item to light up the quotes it stands on and the features and screens built on it.')}</p>
              <div className={styles.specCol}>
                <h4>{t('증언', 'Quotes')}</h4>
                {input.evidence.map((item, index) => (
                  <button key={item.id} type="button" className={`${styles.specItem} ${evidenceTone(index + 1)}`} aria-pressed={focus === `E-${index + 1}`} onClick={() => pick(`E-${index + 1}`)}>
                    <span className={styles.specId}>E-{index + 1}</span>
                    <q lang="en">{item.quote.length > 140 ? `${item.quote.slice(0, 140)}…` : item.quote}</q>
                  </button>
                ))}
              </div>
              <div className={styles.specCol}>
                <h4>{t('요구사항', 'Requirements')}</h4>
                {spec.requirements.map((row) => item(row.id, <><b>{row.title}</b><small>{t('근거', 'Evidence')} {row.evidence.map((n) => `E-${n}`).join(', ')}</small></>))}
                {spec.hypotheses.map((row) => item(row.id, <><b>{row.title}</b><small>{t('근거 없음: 검증 필요 가설', 'No evidence: hypothesis to validate')}</small></>, styles.specHypo))}
              </div>
              <div className={styles.specCol}>
                <h4>
                  {t('기능', 'Features')}
                  {spec.features.some((row) => !row.slots) && <button type="button" className={styles.linkButton} onClick={() => void fillAll()}>{t('슬롯 모두 채우기', 'Fill all slots')}</button>}
                </h4>
                {spec.features.map((row) => (
                  <div key={row.id}>
                    {item(row.id, <><b>{row.title}</b><small>{t(`${row.requirementIds.join(', ')} 충족`, `Serves ${row.requirementIds.join(', ')}`)}</small></>)}
                    {slotsBlock(row)}
                  </div>
                ))}
              </div>
              <div className={styles.specCol}>
                <h4>{t('화면', 'Screens')}</h4>
                {spec.screens.map((row) => item(row.id, <><b>{row.name}</b><small>{row.featureIds.join(', ')}</small></>))}
              </div>
            </div>
          )}

          {view === 'tree' && (
            <ul className={styles.specTree}>
              {spec.requirements.map((requirement) => (
                <li key={requirement.id}>
                  <span className={styles.specId}>{requirement.id}</span> <b>{requirement.title}</b> <small>({requirement.evidence.map((n) => `E-${n}`).join(', ')})</small>
                  <ul>
                    {spec.features.filter((feature) => feature.requirementIds.includes(requirement.id)).map((feature) => (
                      <li key={feature.id}>
                        <span className={styles.specId}>{feature.id}</span> {feature.title}
                        <ul>
                          {spec.screens.filter((screen) => screen.featureIds.includes(feature.id)).map((screen) => (
                            <li key={screen.id}><span className={styles.specId}>{screen.id}</span> {screen.name}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {spec.hypotheses.length > 0 && <li className={styles.specHypo}>{t('검증 필요 가설', 'Hypotheses to validate')}: {spec.hypotheses.map((row) => `${row.id} ${row.title}`).join(', ')}</li>}
            </ul>
          )}

          {view === 'flow' && (
            <div>
              <ol className={styles.flow}>
                {spec.screens.map((screen) => (
                  <li key={screen.id}>
                    <span className={styles.specId}>{screen.id}</span>
                    <b>{screen.name}</b>
                    {screen.does && <small>{screen.does}</small>}
                  </li>
                ))}
              </ol>
              {spec.screens.length > 0 && <button type="button" className={styles.prdButton} onClick={() => void copy('Mermaid', mermaidFlow(spec))}>{t('Mermaid 코드 복사', 'Copy Mermaid code')}</button>}
            </div>
          )}

          {view === 'doc' && <pre className={styles.prdText} tabIndex={0}>{markdown}</pre>}

          <form className={styles.revise} onSubmit={(event) => { event.preventDefault(); void revise(); }}>
            <label htmlFor="prd-revise">{t('대화로 고치기', 'Revise by chat')}</label>
            <div>
              <input id="prd-revise" value={instruction} maxLength={300} onChange={(event) => setInstruction(event.target.value)} placeholder={t('예: 타겟을 초보 개발자로 좁혀줘', 'e.g. Narrow the target to beginner developers')} disabled={busy} />
              <button type="submit" className={styles.prdButton} disabled={busy || instruction.trim().length < 2}>{status === 'revising' ? t('고치는 중', 'Revising') : t('고치기', 'Revise')}</button>
              {previous && <button type="button" className={styles.prdButton} onClick={undo} disabled={busy}>{t('되돌리기', 'Undo')}</button>}
            </div>
          </form>

          <div className={styles.prdActions}>
            <select aria-label={t('AI 코딩 도구 파일 형식', 'File format for AI coding tools')} className={styles.prdSelect} value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
              {(Object.keys(EXPORT_FILES) as ExportFormat[]).map((key) => <option key={key} value={key}>{EXPORT_FILES[key]}</option>)}
            </select>
            <button type="button" className={styles.prdButton} onClick={() => void copy(EXPORT_FILES[format], brief)}>{t(`${EXPORT_FILES[format]} 복사`, `Copy ${EXPORT_FILES[format]}`)}</button>
            <button type="button" className={styles.prdButton} onClick={() => downloadText(EXPORT_FILES[format], brief)}>{t(`${EXPORT_FILES[format]} 받기`, `Download ${EXPORT_FILES[format]}`)}</button>
            <button type="button" className={styles.prdButton} onClick={() => void copy('PRD', markdown)}>{t('PRD 복사', 'Copy PRD')}</button>
            <button type="button" className={styles.prdButton} onClick={() => downloadText('PRD.md', markdown)}>{t('PRD.md 받기', 'Download PRD.md')}</button>
          </div>
        </section>
      )}
    </>
  );
}
