import type { Instrumentation } from 'next';

export function redactMcpLogValue(value: string) {
  return value
    .replace(/(\/api\/mcp\/)(?!token(?:$|[\s/?#"'<>]))[^\s/?#"'<>]+/gi, '$1[key]')
    .replace(/sdp_[a-f0-9]{48}/gi, '[redacted]');
}

/**
 * Records every server error (page render, route handler, server action) in the app_errors table, which
 * scripts/check-app-errors.ts counts each few hours. Strip query strings and mask address-style MCP keys
 * before writing to the database or console. Recording must never cause a second failure.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : null;
  const row = {
    path: redactMcpLogValue(request.path.split('?')[0]).slice(0, 300),
    method: request.method,
    route: redactMcpLogValue(context.routePath),
    kind: context.routeType,
    message: redactMcpLogValue(message).slice(0, 500),
    digest: digest === null ? null : redactMcpLogValue(digest),
  };
  console.error('server error', JSON.stringify(row));
  try {
    const { createAdminClient } = await import('./lib/supabase/admin');
    await createAdminClient()?.from('app_errors').insert(row);
  } catch {
    // The table may not exist yet (supabase/migrations/20261119112104_app_errors.sql); the console line above still reaches the logs.
  }
};
