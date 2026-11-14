'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import styles from './stage.module.css';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
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

  const lang = useLang();
  const t = translator(lang);
  const title = typed || leadName || t('아직 담은 근거가 없습니다', 'No evidence collected yet');

  return (
    <div className={styles.certificate} ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="certificate-title">
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.sheetTop}>
          <div>
            <p className={styles.kicker}>{t('근거 확인서', 'Evidence certificate')}</p>
            <h2 id="certificate-title">{title}</h2>
          </div>
          <button ref={closeRef} className={styles.close} type="button" aria-label={t('확인서 닫기', 'Close certificate')} onClick={onClose}>×</button>
        </div>
        <span className={`${styles.verdict} ${passed ? styles.verdictPass : ''}`}>{verdict}</span>
        {chips.length > 0 && gap && <p className={styles.gapText}>{gap}</p>}
        <dl className={styles.nums}>
          <div><dt>{t('담은 근거', 'Quotes')}</dt><dd>{chips.length}{t('건', '')}</dd></div>
          <div><dt>{t('플랫폼', 'Platforms')}</dt><dd>{platformCount}{t('종', '')}</dd></div>
          <div><dt>{t('직접 경쟁', 'Direct rivals')}</dt><dd>{directCount === null ? '-' : `${directCount}${t('개', '')}`}</dd></div>
        </dl>
        {chips.length === 0 && <p className={`${styles.empty} ${styles.notice}`}>{t('화면의 증언을 끌어서 폴더에 넣거나 눌러서 담아 보세요.', 'Drag quotes into the folder, or tap them to collect.')}</p>}
        {chips.length > 0 && (
          <ul className={styles.quoteList}>
            {chips.map((chip, index) => (
              <li key={chip.id} style={{ animationDelay: `${index * 50}ms` }}>
                <i className={styles.quoteDot} style={{ '--dot': chip.bg } as React.CSSProperties} aria-hidden="true" />
                <div className={styles.quoteBody}>
                  <q lang="en">{chip.quote}</q>
                  {chip.quoteKo && lang === 'ko' && <p className={styles.quoteKo}>{chip.quoteKo}</p>}
                  <a className={styles.quoteLink} href={chip.url} target="_blank" rel="noopener noreferrer">{t(`${chip.platformLabel} 원문`, `Source (${chip.platform})`)}</a>
                  <em className={styles.quoteOk}>{t('원문 일치', 'Verified verbatim')}</em>
                </div>
                <button type="button" className={styles.remove} aria-label={t(`${chip.quote} 근거에서 빼기`, `Remove ${chip.quote}`)} onClick={() => onRemove(chip.id)}>{t('빼기', 'Remove')}</button>
              </li>
            ))}
          </ul>
        )}
        {chips.length > 0 && (
          <div className={styles.actions}>
            <Link className={styles.action} href={`/prd?evidence=${encodeURIComponent(chips.map((chip) => chip.id).join(','))}`}>
              {passed ? t('이 근거로 PRD 만들기', 'Build a PRD from this evidence') : t('가설 초안 PRD 만들기', 'Build a hypothesis-draft PRD')} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
