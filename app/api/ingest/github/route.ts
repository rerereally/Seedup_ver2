import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeRepo } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { GITHUB_QUERIES } from '@/lib/ingest/sources';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const startedAt = Date.now();
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const url = new URL(request.url);
  const perQuery = Number(url.searchParams.get('limit') ?? 5);
  const pushedAfter = url.searchParams.get('pushedAfter') ?? getDaysAgo(14);
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SeedupBot/1.0',
  };

  if (token) headers.authorization = `Bearer ${token}`;

  let upserted = 0;
  let errors = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of GITHUB_QUERIES) {
    const search = `${query} pushed:>${pushedAfter}`;
    const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(search)}&sort=stars&order=desc&per_page=${perQuery}`;

    try {
      const response = await fetch(apiUrl, { headers });
      if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
      const json = await response.json();

      for (const repo of json.items ?? []) {
        if (seen.has(repo.full_name)) {
          skipped += 1;
          continue;
        }
        seen.add(repo.full_name);

        const topics = Array.isArray(repo.topics) ? repo.topics : [];
        const { analysis } = await analyzeRepo({
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          topics,
        });

        const { error } = await supabase.from('github_trends').upsert(
          {
            repo_full_name: repo.full_name,
            repo_url: repo.html_url,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            topics,
            pushed_at: repo.pushed_at,
            ai_review: analysis.ai_review,
            beginner_summary: analysis.beginner_summary,
            project_idea: analysis.project_idea,
            relevance_score: analysis.relevance_score,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'repo_full_name' },
        );

        if (error) {
          errors += 1;
          console.error('GitHub trend upsert failed', repo.full_name, error);
        } else {
          upserted += 1;
        }
      }
    } catch (error) {
      errors += 1;
      console.error('GitHub query failed', query, error);
    }
  }

  await recordIngestRun(supabase, {
    source: 'github',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { perQuery, pushedAfter, queries: GITHUB_QUERIES },
  });

  return NextResponse.json({ ok: true, upserted, skipped, errors, pushedAfter });
}

function getDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
