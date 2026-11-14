// Keeps each .in() request URL short; PostgREST puts the id list in the query string.
export const IN_CHUNK_SIZE = 150;

/**
 * Runs one .in() query per chunk of ids (one after another) and concatenates the rows.
 * A chunk that errors is logged and skipped, so the other chunks still return their rows.
 */
export async function selectInChunks<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += IN_CHUNK_SIZE) {
    const { data, error } = await run(ids.slice(start, start + IN_CHUNK_SIZE));
    if (error) {
      console.error(`selectInChunks: chunk at ${start} failed: ${error.message}`);
      continue;
    }
    rows.push(...(data ?? []));
  }
  return rows;
}
