// Goal drift rules (docs/supervisor-plan.md 3-6): work no feature claims, new screens, routes or tables the spec does not
// name, work on what the goal says not to do, and edits to files of features already done. Pure: callers pass the
// commits (from link_commit or GitHub) and the spec; results go to MCP responses and the dashboard.
import type { Spec } from '../opportunities/spec';
import type { DriftFinding, ProjectGoal } from './types';

export type DriftCommit = {
  sha: string;
  message: string;
  files: string[];
  featureIds: string[];
  /** Files this commit created (a new page or route is checked against the spec). */
  addedFiles?: string[];
  /** Tables this commit's migrations create. */
  addedTables?: string[];
};

const STOP = new Set(['app', 'api', 'page', 'route', 'index', 'src', 'lib', 'components', 'the', 'and', 'for', 'with', 'add', 'fix', 'new', 'update', 'feat', 'chore', 'tsx', 'ts', '기능', '추가', '수정', '화면']);
const words = (text: string) => text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^\p{L}\p{N}]+/u)
  .filter((word) => word.length >= (/[a-z]/.test(word) ? 3 : 2) && !STOP.has(word));
// Prefix match, so "알림" meets "알림을" and "export" meets "exports".
const overlap = (a: string[], b: string[]) => a.filter((word) => b.some((other) => word.startsWith(other) || other.startsWith(word)));

const PAGE = /(^|\/)app\/(.+?)\/page\.[cm]?[jt]sx?$/;
const ROUTE = /(^|\/)app\/api\/(.+?)\/route\.[cm]?[jt]s$/;

/** The URL segments a new page or API route adds, without groups, dynamic parts or the api prefix. */
function routeWords(path: string): string[] | null {
  const match = ROUTE.exec(path) ?? PAGE.exec(path);
  if (!match) return null;
  return words(match[2].split('/').filter((part) => !/^[([]/.test(part)).join(' '));
}

function specVocabulary(spec: Spec) {
  return words([
    ...spec.features.map((row) => `${row.title} ${row.detail}`),
    ...spec.screens.map((row) => `${row.name} ${row.does}`),
    ...spec.requirements.map((row) => row.title),
    ...(spec.technicalDesign?.dataModel ?? []),
    ...(spec.technicalDesign?.interfaces ?? []),
  ].join(' '));
}

/**
 * Drift in a list of commits. `doneFiles` maps each done feature to its files (featureFiles of the done ones); a commit
 * touching those for another feature, or for none, is touched_done.
 */
export function findDrift(
  commits: DriftCommit[],
  spec: Spec,
  goal: Pick<ProjectGoal, 'outOfScope'> | null,
  doneFiles: Record<string, string[]> = {},
): DriftFinding[] {
  const vocab = specVocabulary(spec);
  const nonGoals = goal?.outOfScope.map((text) => ({ text, words: words(text) })).filter((row) => row.words.length) ?? [];
  const findings: DriftFinding[] = [];

  for (const commit of commits) {
    const base = { sha: commit.sha, featureIds: commit.featureIds };
    if (!commit.featureIds.length) {
      findings.push({ ...base, kind: 'unlinked_commit', files: commit.files, message: '어느 기능에도 연결되지 않은 커밋입니다. link_commit으로 기능을 적거나, 범위 밖 작업인지 사용자에게 확인하세요.' });
    }

    const unknown = (commit.addedFiles ?? []).filter((path) => {
      const segments = routeWords(path);
      return segments !== null && segments.length > 0 && !overlap(segments, vocab).length;
    });
    const tables = (commit.addedTables ?? []).filter((table) => !overlap(words(table.replace(/_/g, ' ')), vocab).length);
    if (unknown.length || tables.length) {
      findings.push({ ...base, kind: 'out_of_spec', files: [...unknown, ...tables.map((table) => `table:${table}`)], message: '명세에 없는 화면 · API 경로 · 테이블이 추가됐습니다. 명세에 넣거나 빼세요.' });
    }

    // A non-goal matches when every one of its words (or at least two of them) shows up in the message or the paths.
    const said = words(`${commit.message} ${commit.files.join(' ')}`);
    const hit = nonGoals.find((row) => {
      const shared = overlap(row.words, said).length;
      return shared === row.words.length || shared >= 2;
    });
    if (hit) findings.push({ ...base, kind: 'non_goal', files: commit.files, message: `"하지 않는 것"에 적힌 "${hit.text}"에 해당하는 작업으로 보입니다. 사용자에게 확인하세요.` });

    const touched = Object.entries(doneFiles).flatMap(([featureId, files]) =>
      commit.featureIds.includes(featureId) ? [] : files.filter((file) => commit.files.includes(file)).map((file) => ({ featureId, file })));
    if (touched.length) {
      findings.push({ ...base, kind: 'touched_done', files: [...new Set(touched.map((row) => row.file))], featureIds: [...new Set([...commit.featureIds, ...touched.map((row) => row.featureId)])], message: `완료된 기능(${[...new Set(touched.map((row) => row.featureId))].join(', ')})의 파일을 고쳤습니다. 그 기능을 다시 확인하세요.` });
    }
  }
  return findings;
}
