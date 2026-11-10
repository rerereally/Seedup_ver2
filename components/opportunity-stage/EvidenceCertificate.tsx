'use client';

import { useEffect, useRef } from 'react';
import PrdBuilder from './PrdBuilder';
import styles from './stage.module.css';
import type { StageChip } from './OpportunityStage';

export default function EvidenceCertificate({ chips, typed, leadName, gap, directCount, platformCount, passed, verdict, onClose, onRemove }: {
  chips: StageChip[];
  typed: string;
  leadName: string | null;
  gap: string;
  directCount: number | null;
  platformCount: number;
  passed: boolean;
  verdict: string;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !rootRef.current) return;
      const focusable = [...rootRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const title = typed || leadName || '아직 담은 근거가 없습니다';

  return (
    <div className={styles.certificate} ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="certificate-title">
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.sheetTop}>
          <div>
            <p className={styles.kicker}>근거 확인서</p>
            <h2 id="certificate-title">{title}</h2>
          </div>
          <button ref={closeRef} className={styles.close} type="button" aria-label="확인서 닫기" onClick={onClose}>×</button>
        </div>
        <span className={`${styles.verdict} ${passed ? styles.verdictPass : ''}`}>{verdict}</span>
        {chips.length > 0 && gap && <p className={styles.gapText}>{gap}</p>}
        <dl className={styles.nums}>
          <div><dt>담은 근거</dt><dd>{chips.length}건</dd></div>
          <div><dt>플랫폼</dt><dd>{platformCount}종</dd></div>
          <div><dt>직접 경쟁</dt><dd>{directCount === null ? '-' : `${directCount}개`}</dd></div>
        </dl>
        {chips.length === 0 && <p className={`${styles.empty} ${styles.notice}`}>화면의 증언을 끌어서 폴더에 넣거나 눌러서 담아 보세요.</p>}
        {chips.length > 0 && (
          <ul className={styles.quoteList}>
            {chips.map((chip, index) => (
              <li key={chip.id} style={{ animationDelay: `${index * 50}ms` }}>
                <i className={styles.quoteDot} style={{ '--dot': chip.bg } as React.CSSProperties} aria-hidden="true" />
                <div className={styles.quoteBody}>
                  <q lang="en">{chip.quote}</q>
                  {chip.quoteKo && <p className={styles.quoteKo}>{chip.quoteKo}</p>}
                  <a className={styles.quoteLink} href={chip.url} target="_blank" rel="noopener noreferrer">{chip.platformLabel} 원문</a>
                  <em className={styles.quoteOk}>원문 일치</em>
                </div>
                <button type="button" className={styles.remove} aria-label={`${chip.quote} 근거에서 빼기`} onClick={() => onRemove(chip.id)}>빼기</button>
              </li>
            ))}
          </ul>
        )}
        {chips.length > 0 && <PrdBuilder title={title} evidenceIds={chips.map((chip) => chip.id)} ready={passed} loginNext="/" />}
      </div>
    </div>
  );
}
