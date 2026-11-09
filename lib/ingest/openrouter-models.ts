export function isFreeOpenRouterModel(model: string) {
  return model.endsWith(':free') || model === 'openrouter/free';
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
