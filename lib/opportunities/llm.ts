import { enforceFreeOnlyModels } from '../ingest/openrouter-models';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MIN_CALL_INTERVAL_MS = 3_100; // Free tier allows 20 requests per minute.
const CALL_TIMEOUT_MS = 120_000;

export const llmUsage = { calls: 0, failures: 0, empty: 0, lastFailure: '' };

let nextCallAt = 0;

async function waitForSlot() {
  const now = Date.now();
  const startAt = Math.max(now, nextCallAt);
  nextCallAt = startAt + MIN_CALL_INTERVAL_MS;
  if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));
}

function configuredModels() {
  const primary = process.env.OPENROUTER_MODEL?.trim();
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(',').map((model) => model.trim());
  return enforceFreeOnlyModels([primary ?? '', ...fallbacks].filter(Boolean));
}

function extractJson(content: string) {
  const text = content.replace(/```json|```/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export async function callJsonModel<T>(prompt: string, options?: { maxTokens?: number; timeoutMs?: number; title?: string }): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const models = configuredModels();
  if (!apiKey || !models.length) return null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await waitForSlot();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? CALL_TIMEOUT_MS);
      try {
        llmUsage.calls += 1;
        const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': options?.title ?? 'Seedup opportunity engine' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            // Free reasoning models spend tokens before answering, so the limit must stay generous.
            max_tokens: options?.maxTokens ?? 6_000,
            response_format: { type: 'json_object' },
          }),
        });
        if (response.status === 429) {
          llmUsage.failures += 1;
          llmUsage.lastFailure = `${model}: rate limited`;
          await new Promise((resolve) => setTimeout(resolve, 9_000));
          continue;
        }
        if (!response.ok) {
          llmUsage.failures += 1;
          llmUsage.lastFailure = `${model}: HTTP ${response.status}`;
          break;
        }
        const json = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
        const content = json.choices?.[0]?.message?.content ?? '';
        if (!content) {
          llmUsage.empty += 1;
          llmUsage.lastFailure = `${model}: empty response`;
          continue;
        }
        const parsed = extractJson(content);
        if (parsed) return parsed as T;
        llmUsage.failures += 1;
        llmUsage.lastFailure = `${model}: no JSON in response`;
      } catch (error) {
        llmUsage.failures += 1;
        llmUsage.lastFailure = `${model}: ${error instanceof Error ? error.name : 'unknown error'}`;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

export async function createEmbedding(input: string, options?: { timeoutMs?: number }): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.RAG_EMBEDDING_MODEL?.trim();
  if (!apiKey || !model || !enforceFreeOnlyModels([model]).length) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 20_000);
  try {
    const response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': 'Seedup opportunity engine' },
      body: JSON.stringify({ model, input: input.slice(0, 2_000), dimensions: 1536 }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
