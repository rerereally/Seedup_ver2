export function isFreeOpenRouterModel(model: string) {
  return model.endsWith(':free') || model === 'openrouter/free';
}

// Free models are mostly reasoning models that count their thinking inside max_tokens and cannot switch it off;
// some think 6-8k tokens on every call, so below this floor they return an empty answer.
const FREE_MIN_TOKENS = 16_000;

/** max_tokens for one call: what the caller asked for, raised to the floor for free (thinking) models. */
export function outputTokenCap(model: string, requested: number, thinks = isFreeOpenRouterModel(model)) {
  return thinks ? Math.max(requested, FREE_MIN_TOKENS) : requested;
}

// With OPENROUTER_FREE_ONLY=true, a paid model can never be called, even as a fallback.
export function enforceFreeOnlyModels(models: string[]) {
  if (process.env.OPENROUTER_FREE_ONLY?.trim() !== 'true') return models;

  const freeModels = models.filter(isFreeOpenRouterModel);
  if (!freeModels.length) {
    throw new Error(`OPENROUTER_FREE_ONLY blocked paid models: ${models.join(', ')}`);
  }
  return freeModels;
}
