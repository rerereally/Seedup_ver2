'use client';

import { useSyncExternalStore } from 'react';
import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import type { PrdModel } from '@/lib/opportunities/models';

const KEY = 'seedup:prd-model';
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

/** The model the reader picked, if it is still usable; otherwise the first row, the free model, so nothing costs money by default. */
export function usePrdModel(models: PrdModel[]) {
  const picked = useSyncExternalStore(subscribe, read, () => '');
  const usable = models.filter((row) => row.available);
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
            {row.label} · {row.available ? row.note : row.reason ?? t('지금은 쓸 수 없음', 'not available now')}
          </option>
        ))}
      </select>
    </label>
  );
}
