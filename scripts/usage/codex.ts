// The generated collector sends token counts, model and event IDs/timestamps. Conversation content, paths and code stay local.
export const codexUsage = String.raw`
function inProject(root, cwd) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return false;
  // A workspace may be reached through a symlink, such as /var on macOS.
  const path = relative(root, existsSync(cwd) ? realpathSync(cwd) : cwd);
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
}

function codexSession(file, root) {
  let id, model, cwd;
  let previous = [0, 0, 0, 0];
  const rows = [];
  for (const entry of jsonLines(file)) {
    const payload = entry.payload;
    if (!payload) continue;
    if (entry.type === 'session_meta' && !id) {
      id = payload.id;
      cwd = payload.cwd;
    } else if (entry.type === 'turn_context') {
      model = payload.model;
      cwd = payload.cwd ?? cwd;
    } else if (entry.type === 'event_msg' && payload.type === 'token_count') {
      const total = payload.info?.total_token_usage;
      if (!total) continue;
      const current = [total.input_tokens, total.output_tokens, total.cached_input_tokens ?? 0, total.cache_write_input_tokens ?? 0];
      if (!current.every((count) => Number.isSafeInteger(count) && count >= 0)) continue;
      // Rate-limit-only and compaction events can repeat the last response. Use session counter deltas.
      const [input, output, reads, writes] = current.map((count, index) => count - previous[index]);
      previous = current;
      if (!(input || output || reads || writes) || !inProject(root, cwd) || reads < 0 || writes < 0 || input < reads + writes) continue;
      const row = usageRow(entry.timestamp, model, input - reads - writes, output, reads, writes);
      if (row) rows.push(row);
    }
  }
  return isSession(id) ? { id, rows } : null;
}

function* codexLogs(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* codexLogs(path);
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) yield path;
  }
}
`;
