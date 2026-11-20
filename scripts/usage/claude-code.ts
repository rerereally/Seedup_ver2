// The generated collector sends token counts, model and event IDs/timestamps. Conversation content, paths and code stay local.
export const claudeCodeUsage = String.raw`
function claudeSession(payload) {
  if (typeof payload?.transcript_path !== 'string' || !isSession(payload.session_id)) return null;
  const responses = new Map();
  for (const entry of jsonLines(payload.transcript_path)) {
    const message = entry.message;
    const usage = message?.usage;
    if (entry.type !== 'assistant' || message?.model === '<synthetic>' || !usage
      || (entry.sessionId !== undefined && entry.sessionId !== payload.session_id)) continue;
    const row = usageRow(entry.timestamp, message.model, usage.input_tokens, usage.output_tokens,
      usage.cache_read_input_tokens, usage.cache_creation_input_tokens);
    if (!row) continue;
    const key = typeof message.id === 'string' ? message.id + '/' + row.model : row.ts + '/' + row.model;
    const before = responses.get(key);
    if (before) row.ts = before.ts; // One response can have several transcript records.
    responses.set(key, row);
  }
  return { id: payload.session_id, rows: [...responses.values()] };
}
`;
