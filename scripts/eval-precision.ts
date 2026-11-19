// Citation precision: of the quotes the site shows as evidence, the share whose author really has the problem the
// quote is filed under. Labels live in lib/opportunities/data/precision-labels.json; this prints the precision on the
// labeled quotes still published, and lists the published quotes nobody has labeled yet so they can be judged next.
// Reads the live snapshot when the database is configured, the bundled one otherwise.
//   npx tsx --env-file=.env scripts/eval-precision.ts [--md]   (--md prints the unlabeled quotes as a checklist)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getOpportunities } from '../lib/opportunities/data';
import { precisionOf, type PrecisionLabels } from '../lib/opportunities/eval';

const read = <T>(path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
(async () => {
  const { labels } = read<{ labels: PrecisionLabels }>('lib/opportunities/data/precision-labels.json');
  const result = precisionOf((await getOpportunities()).opportunities, labels);

  console.log(`인용 정밀도 ${result.precision === null ? '측정 불가' : `${result.precision}%`} (판정 ${result.labeled}개 중 관련 ${result.relevant}개, 사람이 확인한 판정 ${result.byPeople}개)`);
  console.log(`판정 없는 공개 인용 ${result.unlabeled.length}개`);
  for (const row of result.wrong) console.log(`  관련 없음: ${row.slug} · ${row.quote.slice(0, 90)}${row.note ? ` (${row.note})` : ''}`);
  if (process.argv.includes('--md')) for (const row of result.unlabeled) console.log(`- [ ] ${row.id} ${row.slug}: ${row.quote}`);
  process.exit(0);
})();
