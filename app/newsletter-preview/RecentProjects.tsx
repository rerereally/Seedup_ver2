'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { translator } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { readSavedSeedResult } from '@/lib/seeds/saved-result';
import type { SavedSeedResult } from '@/lib/seeds/saved-result';

export default function RecentProjects({ userId, lang }: { userId?: string; lang: Lang }) {
  const [saved, setSaved] = useState<SavedSeedResult | null>(null);
  const t = translator(lang);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => setSaved(readSavedSeedResult(userId)), 0);
    return () => clearTimeout(timer);
  }, [userId]);

  return (
    <section className="card mt-5 max-w-[42rem] p-5" aria-label={t('내 프로젝트의 다음 기능', 'Next feature for my project')}>
      {saved?.repos.length ? (
        <>
          <h2 className="text-[17px] font-bold">{t('최근 살펴본 레포', 'Recently analyzed repos')}</h2>
          <ul className="rows mt-3">
            {saved.repos.slice(0, 3).map(({ name }) => (
              <li key={name}>
                <Link href={{ pathname: '/prd/repo', query: { user: saved.login, repo: name } }} className="link-seed min-h-11 w-full py-2 [overflow-wrap:anywhere]">
                  {saved.login}/{name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/seeds" className="link-seed mt-2 min-h-11">{t('다른 레포 살펴보기', 'Analyze another repo')}</Link>
        </>
      ) : (
        <>
          <p className="text-sm leading-6 text-tertiary">{t('GitHub 공개 레포를 읽고 다음에 더할 기능을 제안합니다.', 'Get suggestions for what to add next to a public GitHub repo.')}</p>
          <Link href="/seeds" className="btn mt-3 h-11">{t('GitHub 레포 연결하기', 'Connect a GitHub repo')}</Link>
        </>
      )}
    </section>
  );
}
