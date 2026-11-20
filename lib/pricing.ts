type Price = { input: number; output: number; cacheRead?: number; cacheWrite?: number; tier?: 'Haiku' | 'Sonnet' | 'Opus' | 'Sol' | 'Astra' };

// US dollars per million tokens. OpenRouter PRD rates retain the existing rates.
// Direct API estimates use standard short-context rates and the shortest published cache-write duration.
// https://platform.claude.com/docs/en/about-claude/pricing
// https://developers.openai.com/api/docs/pricing
const opus: Price = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, tier: 'Opus' };
const sonnet: Price = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5, tier: 'Sonnet' };
const haiku: Price = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, tier: 'Haiku' };
const sol: Price = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5, tier: 'Sol' };
const longHaiku: Price = { ...haiku, input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 };

const prices: Readonly<Record<string, Price | null>> = {
  'openai/gpt-6.2-sol': sol,
  'anthropic/claude-haiku-5.5': haiku,
  'deepseek/deepseek-v4.1-flash-1017': { input: 0.04, output: 0.5 },
  'anthropic/claude-sonnet-5.5': sonnet,
  'anthropic/claude-opus-5.5': opus,
  'claude-opus-5-5': opus,
  'claude-sonnet-5-5': sonnet,
  'claude-haiku-5-5': haiku,
  'gpt-6.2-sol': sol,
  'gpt-6.2-astra': { input: 8, output: 40, cacheRead: 0.4, cacheWrite: 10, tier: 'Astra' },
  'claude-opus-5-5[1m]': null,
  'claude-sonnet-5-5[1m]': null,
};

export const TOP_MODEL = 'gpt-6.2-astra';
export const LOWER_TIERS = ['Haiku', 'Sonnet', 'Sol'] as const;

export function priceFor(model: string): Price | null {
  if (Object.hasOwn(prices, model)) return prices[model];
  return model.endsWith(':free') || model === 'openrouter/free' ? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } : null;
}

export type TokenCounts = {
  /** Uncached input. Cache reads and writes are counted separately. */
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
};

export function tokenCost(model: string, tokens: TokenCounts): number | null {
  const { input_tokens: input, output_tokens: output, cache_read_tokens: reads = 0, cache_write_tokens: writes = 0 } = tokens;
  const price = model === 'claude-haiku-5-5' && input + reads + writes > 100_000 ? longHaiku : priceFor(model);
  if (!price || (reads && price.cacheRead === undefined) || (writes && price.cacheWrite === undefined)) return null;
  return (input * price.input + output * price.output + reads * (price.cacheRead ?? 0) + writes * (price.cacheWrite ?? 0)) / 1_000_000;
}
