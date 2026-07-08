export const RESEARCH_QUERIES = [
  'cat:cs.AI OR cat:cs.CL OR cat:cs.LG',
  'all:"AI agent" OR all:"tool use" OR all:"workflow automation"',
  'all:"retrieval augmented generation" OR all:RAG',
  'all:"code generation" OR all:"software engineering"',
  'all:"human computer interaction" OR all:"developer tools"',
];

export const RESEARCH_SOURCE_INFO = {
  arxiv: {
    name: 'arXiv',
    url: 'https://export.arxiv.org/api/query',
  },
  papersWithCode: {
    name: 'Papers with Code',
    url: 'https://paperswithcode.com/api/v1/papers/',
  },
  huggingFacePapers: {
    name: 'Hugging Face Papers',
    url: 'https://huggingface.co/papers',
  },
} as const;
