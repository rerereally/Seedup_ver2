import { readFileSync } from 'node:fs';
import { enforceFreeOnlyModels } from '../lib/llm';
import type { DocumentId, RagLabel } from '../lib/rag-eval/metrics';

export const DEFAULT_LABELS = 'lib/rag-eval/labels.json';
// Same cutoff as retrieveIdeaContext; its config is private to the ingestion module.
export const BASELINE_THRESHOLD = 0.35;

export const ragOptions = {
  labels: { type: 'string', default: DEFAULT_LABELS },
  model: { type: 'string' },
  'corpus-model': { type: 'string' },
  yes: { type: 'boolean' },
} as const;

function isDocumentId(value: unknown): value is DocumentId {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<DocumentId>;
  return typeof row.source_table === 'string' && /^[a-z_]+$/.test(row.source_table)
    && typeof row.source_id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.source_id);
}

export function loadRagLabels(file: string) {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const isLabel = (value: unknown): value is RagLabel => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Partial<RagLabel>;
    return typeof row.id === 'string' && Boolean(row.id.trim()) && typeof row.idea === 'string' && Boolean(row.idea.trim())
      && (row.relevant === null || (Array.isArray(row.relevant) && row.relevant.every(isDocumentId)));
  };
  if (!Array.isArray(data) || !data.length || !data.every(isLabel) || new Set(data.map(({ id }) => id)).size !== data.length) {
    throw new Error(`Invalid labels in ${file}: each case needs a unique id, idea and relevant (null or a list of document IDs).`);
  }
  return data;
}

export function ragModel(values: { model?: string; 'corpus-model'?: string }) {
  const corpus = values['corpus-model'] ?? (process.env.RAG_EMBEDDING_MODEL?.trim() || 'openai/text-embedding-3-small');
  const model = values.model ?? corpus;
  // Equal vector lengths do not make embeddings from different models comparable.
  if (model !== corpus) throw new Error('Use a corpus indexed with --model and identify it with --corpus-model or RAG_EMBEDDING_MODEL.');
  if (!/^[\w.-]+\/[\w.:-]+$/.test(model) || !enforceFreeOnlyModels([model]).length) {
    throw new Error('Choose an OpenRouter embedding model allowed by OPENROUTER_FREE_ONLY.');
  }
  return model;
}
