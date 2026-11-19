import { appendFileSync, closeSync, existsSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import snapshot from '../lib/opportunities/data/snapshot.json';
import { parseSealedPredictions, sealPredictions } from '../lib/opportunities/predictions';
import { tidyOpportunities } from '../lib/opportunities/review';
import type { Opportunity, OpportunitySnapshot } from '../lib/opportunities/types';

export function appendPredictions(file: string, opportunities: Opportunity[], now: number) {
  // Take the lock before reading so simultaneous runs cannot seal the same slug twice.
  const lockPath = `${file}.lock`;
  const lock = openSync(lockPath, 'wx');
  try {
    const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const slugs = new Set(parseSealedPredictions(previous).map((row) => row.slug));
    const added = sealPredictions(opportunities, now).filter((row) => {
      if (slugs.has(row.slug)) return false;
      slugs.add(row.slug);
      return true;
    });
    if (added.length) {
      const separator = previous && !previous.endsWith('\n') ? '\n' : '';
      appendFileSync(file, separator + added.map((row) => `${JSON.stringify(row)}\n`).join(''), 'utf8');
    }
    return added;
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

if (require.main === module) {
  const file = join(__dirname, '..', 'predictions', 'sealed.jsonl');
  const opportunities = tidyOpportunities((snapshot as OpportunitySnapshot).opportunities);
  const added = appendPredictions(file, opportunities, Date.now());
  for (const { slug, hash } of added) console.log(`${slug} ${hash}`);
  if (!added.length) console.log('새로 봉인할 예측이 없습니다.');
}
