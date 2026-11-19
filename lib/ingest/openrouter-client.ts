// OpenRouter chat call with model fallback, and lenient parsing of the JSON the models return.
import { enforceFreeOnlyModels, isFreeOpenRouterModel, outputTokenCap } from './openrouter-models';

const DEFAULT_WRITING_MODEL = 'anthropic/claude-sonnet-5';
const DEFAULT_PREPROCESS_MODEL = 'google/gemini-3.5-flash';
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45_000);
export const ARTICLE_OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_ARTICLE_TIMEOUT_MS ?? 75_000);
const FREE_MODEL_MIN_TIMEOUT_MS = 45_000;

export async function callOpenRouter<T>(
  apiKey: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options?: {
    maxTokens?: number;
    timeoutMs?: number;
    models?: string[];
    temperature?: number;
    jsonMode?: boolean;
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  },
) {
  const models = enforceFreeOnlyModels(options?.models?.length ? options.models : getWritingModels());
  const errors: string[] = [];
  const maxTokens = options?.maxTokens ?? 2400;

  for (const model of models) {
    const controller = new AbortController();
    const isFreeModel = isFreeOpenRouterModel(model);
    const timeoutMs = options?.timeoutMs ?? OPENROUTER_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), isFreeModel ? Math.max(timeoutMs, FREE_MODEL_MIN_TIMEOUT_MS) : timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001',
          'x-title': 'Seedup',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: outputTokenCap(model, maxTokens),
          ...(options?.jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: options.jsonSchema.name,
                    strict: true,
                    schema: options.jsonSchema.schema,
                  },
                },
              }
            : options?.jsonMode
              ? { response_format: { type: 'json_object' } }
              : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter request failed: ${response.status} ${body}`);
      }

      const json = await response.json();

      // OpenRouter sometimes returns 200 OK with an error object (quota/rate-limit)
      if (json.error) {
        throw new Error(`OpenRouter API error: ${json.error.message ?? JSON.stringify(json.error)}`);
      }

      const rawContent = json.choices?.[0]?.message?.content;
      const content = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part: unknown) => typeof part === 'string' ? part : (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : '')).join('')
          : '';
      if (!content) throw new Error('OpenRouter returned empty content');

      try {
        return { result: parseJsonResponse<T>(content), model };
      } catch (parseError) {
        const preview = content.slice(0, 500).replace(/\s+/g, ' ');
        console.warn('OpenRouter JSON parse failed preview:', { model, preview });
        throw parseError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
      console.warn('OpenRouter model failed, trying fallback if available', { model, message });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`All OpenRouter models failed. ${errors.join(' | ')}`);
}

function parseModelList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

export function getWritingModels() {
  const primary = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_WRITING_MODEL;
  return [...new Set([primary, ...parseModelList(process.env.OPENROUTER_FALLBACK_MODELS)])];
}

export function getPreprocessModels() {
  const configured = parseModelList(process.env.OPENROUTER_PREPROCESS_MODELS);
  if (configured.length) return [...new Set(configured)];

  // A free writing model means a test setup, so never fall through to the paid default.
  const writingModels = getWritingModels();
  return isFreeOpenRouterModel(writingModels[0]) ? writingModels : [DEFAULT_PREPROCESS_MODEL];
}

export function getIdeaEvaluationModels() {
  // Keep an interactive request bounded: the primary writing model plus one
  // configured fallback. callOpenRouter tries them sequentially.
  return getWritingModels().slice(0, 2);
}

export function parseJsonResponse<T>(content: string) {
  // Log a short preview when parsing fails to help debugging without dumping the full model output.
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Detect HTML responses (rate-limit pages, error pages from provider)
  if (/^<!DOCTYPE|^<html/i.test(stripped)) {
    const preview = stripped.slice(0, 120).replace(/\s+/g, ' ');
    console.warn('OpenRouter returned HTML instead of JSON:', preview);
    throw new Error('OpenRouter returned HTML (rate-limit or quota exceeded)');
  }

  // Log first 200 chars when parsing fails to help debugging
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf('{');
    if (start === -1) {
      console.warn('OpenRouter non-JSON preview:', stripped.slice(0, 500));
      throw new Error('OpenRouter returned non-JSON content');
    }

    // Models occasionally append a second JSON object or a short explanation.
    // Parse only the first balanced object instead of combining it with the tail.
    const candidate = extractFirstJsonObject(stripped.slice(start));
    if (!candidate) {
      console.warn('OpenRouter incomplete JSON preview:', stripped.slice(0, 500));
      throw new Error('OpenRouter returned incomplete JSON content');
    }
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return JSON.parse(repairJsonCandidate(candidate)) as T;
    }
  }
}

function extractFirstJsonObject(value: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(0, index + 1);
    }
  }

  return null;
}

function repairJsonCandidate(value: string) {
  return value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .trim();
}
