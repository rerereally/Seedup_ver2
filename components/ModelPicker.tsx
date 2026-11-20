'use client';

import { useSyncExternalStore } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { PrdModel } from '@/lib/opportunities/models';

const KEY = 'seedup:prd-model';
// Same id as EXAONE_ID in lib/opportunities/models.ts, kept here so this client file does not pull in server code.
const EXAONE_ID = 'exaone';
const CHANGED = 'seedup-prd-model';
// Kept in memory too, so the menu still works where browser storage is blocked.
let memory = '';

function read() {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The model the reader picked, if it is still usable; otherwise the first row, the free model. Never a paid one by default.
 */
export function usePrdModel(models: PrdModel[]) {
  const picked = useSyncExternalStore(subscribe, read, () => '');
  const usable = models.filter((row) => row.available);
  // The free list writes a PRD in about half a minute; K-EXAONE took 3+ minutes (2026-11-18), so only when picked.
  return (usable.find((row) => row.id === picked) ?? usable[0])?.id;
}

export default function ModelPicker({ models }: { models: PrdModel[] }) {
  const t = translator(useLang());
  const current = usePrdModel(models);
  if (models.length < 2) return null;

  const choose = (id: string) => {
    memory = id;
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
    window.dispatchEvent(new Event(CHANGED));
  };

  return (
    <label className="inline-flex max-w-full items-center gap-2 text-sm text-muted">
      {t('모델', 'Model')}
      <select value={current} onChange={(event) => choose(event.target.value)} className="h-10 min-w-0 max-w-[22rem] border bg-white px-2.5 text-sm text-ink">
        {models.map((row) => (
          <option key={row.id} value={row.id} disabled={!row.available}>
            {row.base ? t('기본 무료 모델', 'Default free model') : `${row.label} (${row.free ? t('무료', 'free') : t('유료', 'paid')})`}
          </option>
        ))}
      </select>
    </label>
  );
}
