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

// LG K-EXAONE 2.5 is not on OpenRouter; it runs on LG's OpenAI-compatible EXAONE API Platform with its own key
// (docs.exaone.ai, checked 2026-11-17). It always reasons first, and max_tokens includes that reasoning.
const EXAONE_ID = 'exaone';
const EXAONE_URL = 'https://api.exaone.ai/v1/chat/completions';
const EXAONE_MODEL = 'k-exaone_v2.5';

type Endpoint = { url: string; key: string; model: string; extra: Record<string, unknown> };

/** Where a model is called, with which key and parameters; null when that provider has no key configured. */
function endpointFor(model: string): Endpoint | null {
  if (model === EXAONE_ID) {
    const key = process.env.EXAONE_API_KEY?.trim();
    // LG recommends temperature 1.0 and top_p 0.95; low effort keeps a PRD inside the route's time limit.
    return key ? { url: EXAONE_URL, key, model: EXAONE_MODEL, extra: { temperature: 1, top_p: 0.95, reasoning_effort: process.env.EXAONE_REASONING_EFFORT?.trim() || 'low' } } : null;
  }
  const key = process.env.OPENROUTER_API_KEY;
  return key ? { url: `${OPENROUTER_BASE}/chat/completions`, key, model, extra: { temperature: 0.1, response_format: { type: 'json_object' } } } : null;
}

/** Tokens one call used, reported to whoever logs PRD runs. `model` is the menu id that answered. */
export type ModelUsage = { model: string; promptTokens: number; completionTokens: number };

function extractJson(content: string) {
  const text = content.replace(/```json|```/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export async function callJsonModel<T>(prompt: string, options?: { maxTokens?: number; timeoutMs?: number; title?: string; model?: string; onUsage?: (usage: ModelUsage) => void }): Promise<T | null> {
  // A model chosen on the PRD menu goes first, with the free models behind it as fallbacks. The menu's admin policy is
  // what allows a paid model there, so free-only does not apply to it; every other caller (collection, ingest) has no
  // way to pass a model and stays on the free list.
  const chosen = options?.model;
  const models = chosen ? [chosen, ...configuredModels().filter((model) => model !== chosen)] : configuredModels();

  for (const model of models) {
    const endpoint = endpointFor(model);
    if (!endpoint) continue;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await waitForSlot();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? CALL_TIMEOUT_MS);
      try {
        llmUsage.calls += 1;
        const response = await fetch(endpoint.url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${endpoint.key}`, 'x-title': options?.title ?? 'Seedup opportunity engine' },
          body: JSON.stringify({
            model: endpoint.model,
            messages: [{ role: 'user', content: prompt }],
            // Free reasoning models spend tokens before answering, so the limit must stay generous.
            max_tokens: options?.maxTokens ?? 6_000,
            ...endpoint.extra,
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
        const json = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        options?.onUsage?.({ model, promptTokens: json.usage?.prompt_tokens ?? 0, completionTokens: json.usage?.completion_tokens ?? 0 });
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
