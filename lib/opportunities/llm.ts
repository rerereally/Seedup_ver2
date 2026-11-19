import { enforceFreeOnlyModels, isFreeOpenRouterModel, outputTokenCap } from '../ingest/openrouter-models';

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
function endpointFor(model: string, json = true): Endpoint | null {
  if (model === EXAONE_ID) {
    const key = process.env.EXAONE_API_KEY?.trim();
    // LG recommends temperature 1.0 and top_p 0.95; low effort keeps a PRD inside the route's time limit.
    return key ? { url: EXAONE_URL, key, model: EXAONE_MODEL, extra: { temperature: 1, top_p: 0.95, reasoning_effort: process.env.EXAONE_REASONING_EFFORT?.trim() || 'low' } } : null;
  }
  const key = process.env.OPENROUTER_API_KEY;
  // Prose reads stiff at 0.1; JSON answers stay near-deterministic so their shape holds.
  return key ? { url: `${OPENROUTER_BASE}/chat/completions`, key, model, extra: json ? { temperature: 0.1, response_format: { type: 'json_object' } } : { temperature: 0.4 } } : null;
}

/**
 * Free models that write a PRD well and fast, best first (measured 2026-11-18 with the PRD prompt: ernie 33 s and the
 * most specific text; nemotron ultra 61 s; the default nemotron super thinks for ~45 s before writing).
 * PRD_FREE_MODELS overrides it, since free and preview models come and go.
 */
export function prdFreeModels() {
  const listed = (process.env.PRD_FREE_MODELS ?? 'baidu/ernie-5.5-flash-preview:free,nvidia/nemotron-3-ultra-550b-a55b:free').split(',').map((model) => model.trim()).filter(Boolean);
  return [...new Set([...listed, ...configuredModels()])];
}

/** The models to try in order: the one picked on the PRD menu first, then the free ones. */
function modelChain(chosen?: string) {
  return chosen ? [chosen, ...configuredModels().filter((model) => model !== chosen)] : configuredModels();
}

const messagesFor = (prompt: string, system?: string) => [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];

// Free reasoning models count their thinking inside max_tokens and cannot turn it off: ernie 5.5 flash thinks for
// 6k to 8k tokens whatever the effort setting, so at 8k it often ended with no answer at all (measured 2026-11-19).
// A free model costs nothing more for a higher cap, and the cap only bites when thinking runs long.
const tokenCap = (model: string, requested: number) => outputTokenCap(model, requested, model === EXAONE_ID || isFreeOpenRouterModel(model));

/** Tokens one call used, reported to whoever logs PRD runs. `model` is the menu id that answered. */
export type ModelUsage = { model: string; promptTokens: number; completionTokens: number };

function extractJson(content: string) {
  const text = content.replace(/```json|```/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export async function callJsonModel<T>(prompt: string, options?: { maxTokens?: number; timeoutMs?: number; title?: string; model?: string; models?: string[]; system?: string; deadline?: number; reasoning?: 'low' | 'medium' | 'high'; attempts?: number; onUsage?: (usage: ModelUsage) => void }): Promise<T | null> {
  // A model chosen on the PRD menu goes first, with the free models behind it as fallbacks. The menu's admin policy is
  // what allows a paid model there, so free-only does not apply to it; every other caller (collection, ingest) has no
  // way to pass a model and stays on the free list.
  const models = options?.models?.length ? options.models : modelChain(options?.model);

  for (const model of models) {
    const endpoint = endpointFor(model);
    if (!endpoint) continue;
    for (let attempt = 0; attempt < (options?.attempts ?? 2); attempt += 1) {
      // A caller with a deadline (a person waiting) gets an answer or null in time, never a minutes-long retry chain.
      const left = options?.deadline ? options.deadline - Date.now() : Infinity;
      if (left < 3_000) return null;
      await waitForSlot();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(options?.timeoutMs ?? CALL_TIMEOUT_MS, left));
      try {
        llmUsage.calls += 1;
        const response = await fetch(endpoint.url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${endpoint.key}`, 'x-title': options?.title ?? 'Seedup opportunity engine' },
          body: JSON.stringify({
            model: endpoint.model,
            messages: messagesFor(prompt, options?.system),
            // Free reasoning models spend tokens before answering, so the limit must stay generous.
            max_tokens: tokenCap(model, options?.maxTokens ?? 6_000),
            ...endpoint.extra,
            ...(options?.reasoning && model !== EXAONE_ID ? { reasoning: { effort: options.reasoning } } : {}),
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

/** What a streamed answer reports while it is written. `restart`: the model in use failed, the text so far is dropped. */
export type StreamEvent = { type: 'delta'; text: string } | { type: 'thinking' } | { type: 'restart'; model: string };

export type StreamOptions = {
  model?: string;
  /** The models to try, in order, instead of the chosen model followed by the configured free ones. */
  models?: string[];
  system?: string;
  maxTokens?: number;
  title?: string;
  /** Give up on a model that has sent nothing at all (not even reasoning) by then and try the next one. */
  firstTokenMs?: number;
  /** Give up on a model that goes quiet for this long mid-answer. */
  idleMs?: number;
  /** The whole call, every model included, ends by this time (epoch ms). */
  deadline?: number;
  /** An answer shorter than this is treated as empty. */
  minChars?: number;
  /** How long a reasoning model may think before it writes. Free models think for most of a minute at their default. */
  reasoning?: 'low' | 'medium' | 'high';
  onEvent?: (event: StreamEvent) => void;
  onUsage?: (usage: ModelUsage) => void;
};

/**
 * Streams a prose answer, model by model. A model that sends nothing within `firstTokenMs` or stalls for `idleMs` is
 * dropped for the next one at once, instead of waiting out a long timeout as the JSON call does. Reasoning tokens
 * count as life but are not part of the text.
 */
export async function streamText(prompt: string, options: StreamOptions = {}): Promise<{ text: string; model: string; cut?: boolean } | null> {
  const firstTokenMs = options.firstTokenMs ?? 15_000;
  const idleMs = options.idleMs ?? 25_000;
  const deadline = options.deadline ?? Date.now() + CALL_TIMEOUT_MS;
  for (const model of options.models?.length ? options.models : modelChain(options.model)) {
    const endpoint = endpointFor(model, false);
    if (!endpoint) continue;
    if (deadline - Date.now() < 5_000) break;
    await waitForSlot();
    const controller = new AbortController();
    let text = '';
    let alive = false;
    let thinking = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    // Why the watchdog fired: a silent model is dropped, but an answer cut by the deadline keeps what it wrote.
    let stop = 'quiet' as 'quiet' | 'deadline';
    const arm = (ms: number) => {
      clearTimeout(watchdog);
      const left = deadline - Date.now();
      stop = left < ms ? 'deadline' : 'quiet';
      watchdog = setTimeout(() => controller.abort(), Math.max(1_000, Math.min(ms, left)));
    };
    arm(firstTokenMs);
    try {
      llmUsage.calls += 1;
      const response = await fetch(endpoint.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${endpoint.key}`, 'x-title': options.title ?? 'Seedup' },
        body: JSON.stringify({
          model: endpoint.model,
          messages: messagesFor(prompt, options.system),
          max_tokens: tokenCap(model, options.maxTokens ?? 8_000),
          stream: true,
          stream_options: { include_usage: true },
          ...endpoint.extra,
          // EXAONE takes reasoning_effort (already in its extra); OpenRouter takes a reasoning object.
          ...(options.reasoning && model !== EXAONE_ID ? { reasoning: { effort: options.reasoning } } : {}),
        }),
      });
      if (!response.ok || !response.body) {
        llmUsage.failures += 1;
        llmUsage.lastFailure = `${model}: HTTP ${response.status}`;
        continue;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let chunk: { choices?: Array<{ delta?: { content?: string | null; reasoning?: string | null; reasoning_content?: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
          try { chunk = JSON.parse(data); } catch { continue; }
          if (chunk.usage) options.onUsage?.({ model, promptTokens: chunk.usage.prompt_tokens ?? 0, completionTokens: chunk.usage.completion_tokens ?? 0 });
          const delta = chunk.choices?.[0]?.delta;
          const piece = delta?.content ?? '';
          if (piece) {
            text += piece;
            options.onEvent?.({ type: 'delta', text: piece });
          } else if (delta?.reasoning || delta?.reasoning_content) {
            if (!thinking) options.onEvent?.({ type: 'thinking' });
            thinking = true;
          } else continue;
          alive = true;
          arm(idleMs);
        }
      }
      if (text.trim().length >= (options.minChars ?? 1)) return { text, model };
      llmUsage.empty += 1;
      llmUsage.lastFailure = `${model}: ${alive ? 'answer too short' : 'empty response'}`;
    } catch (error) {
      llmUsage.failures += 1;
      llmUsage.lastFailure = `${model}: ${error instanceof Error ? error.name : 'unknown error'}${alive ? ' mid-answer' : ''}`;
      // Out of time with most of an answer written: the caller decides whether a cut answer is still usable.
      if (stop === 'deadline' && text.trim().length >= (options.minChars ?? 1)) return { text, model, cut: true };
    } finally {
      clearTimeout(watchdog);
    }
    if (text) options.onEvent?.({ type: 'restart', model });
  }
  return null;
}

/** Must match the vector(1536) columns in supabase/migrations. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Some models only answer at their native size (nemotron-3-embed-1b: 2048), so the size is not sent; the vector is
 * cut to the column size and scaled back to length 1. Cutting kept the same nearest matches in a check on that model.
 */
export function fitEmbedding(vector: number[] | undefined): number[] {
  const cut = (vector ?? []).slice(0, EMBEDDING_DIMENSIONS);
  if (cut.length < EMBEDDING_DIMENSIONS) return [];
  const length = Math.hypot(...cut);
  return length ? cut.map((value) => value / length) : [];
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
      body: JSON.stringify({ model, input: input.slice(0, 2_000) }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = fitEmbedding(json.data?.[0]?.embedding);
    return vector.length ? vector : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
