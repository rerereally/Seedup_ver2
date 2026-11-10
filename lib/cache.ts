// Public lists change only when a collection run finishes, but every page used to read them again
// on every navigation. A short in-memory cache removes those round trips to the database.
const DEFAULT_TTL_MS = 60_000;
// Past its age a value is still shown once more while a fresh copy loads, so visitors rarely wait on the database.
const STALE_FACTOR = 30;
const MAX_ENTRIES = 100;
const entries = new Map<string, { at: number; value: Promise<unknown>; refreshing: boolean }>();

function store<T>(key: string, load: () => Promise<T>) {
  const value = load();
  const previous = entries.get(key);
  // A failed read must not be served to the next visitor; the copy it was replacing stays instead.
  value.then(() => entries.set(key, { at: Date.now(), value, refreshing: false }), () => {
    if (previous) entries.set(key, { ...previous, refreshing: false });
    else entries.delete(key);
  });
  return value;
}

export function cached<T>(key: string, load: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = entries.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as Promise<T>;
  if (hit && age < ttlMs * STALE_FACTOR) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      store(key, load).catch(() => undefined);
    }
    return hit.value as Promise<T>;
  }
  if (entries.size >= MAX_ENTRIES) entries.clear();
  const value = store(key, load);
  entries.set(key, { at: Date.now(), value, refreshing: false });
  return value;
}
