// Shared server data read and written with the service key on behalf of page and API code: the PRD model policy,
// the PRD cache that stands in for failed requests, PRD run logs, and the published newsletter issues. None of it is a
// visitor's private row; keeping the service key here means app/ never chooses to skip row-level security itself.
import { createAdminClient } from '@/lib/supabase/admin';
import { getIssue, listIssues } from '@/lib/newsletter/issues';
import { loadPrdPolicy } from '@/lib/opportunities/models';
import { prdRunLog } from '@/lib/opportunities/prd-runs';
import type { PrdRunKind } from '@/lib/opportunities/prd-runs';
import { readPrdCache, samplePrdSlug, writePrdCache } from '@/lib/opportunities/prd-cache';
import type { Spec, SpecInput } from '@/lib/opportunities/spec';

export const prdPolicy = () => loadPrdPolicy(createAdminClient());
export const cachedPrd = (evidenceIds: string[]) => readPrdCache(createAdminClient(), evidenceIds);
export const cachePrd = (evidenceIds: string[], input: SpecInput, spec: Spec) => writePrdCache(createAdminClient(), evidenceIds, input, spec);
export const samplePrd = (candidates: Parameters<typeof samplePrdSlug>[1]) => samplePrdSlug(createAdminClient(), candidates);
export const prdRun = (user: { id: string; email?: string | null }, kind: PrdRunKind, chosen: string) => prdRunLog(createAdminClient(), user, kind, chosen);
export const newsletterIssues = (limit?: number) => listIssues(createAdminClient(), limit);
export const newsletterIssue = (period: string) => getIssue(createAdminClient(), period);
