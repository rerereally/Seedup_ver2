// Shapes of what the AI preprocessing and writing steps return. Re-exported from ./ai for existing imports.
import type { ContentType, NewsletterSection } from '@/lib/recommendations';

export type NewsAnalysis = {
  translated_title: string;
  content_type: ContentType;
  newsletter_section: NewsletterSection;
  newsletter_priority: number;
  category: string;
  relevance_score: number;
  short_summary: string;
  ai_summary: string;
  article_markdown?: string;
  beginner_summary: string;
  why_it_matters: string;
  key_points: string[];
  related_skills: string[];
  project_idea: string;
  difficulty: string;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  content_depth: string;
  topic_tags: string[];
  skill_tags: string[];
  intent_tags: string[];
  audience_tags: string[];
  related_roles: string[];
  learning_topics: string[];
  project_convertible: boolean;
  personalization_hooks: string[];
  source_quality_score: number;
  novelty_score: number;
  buildability_score: number;
  project_connect_score: number;
  recommendation_reasons: string[];
};

export type RepoAnalysis = {
  relevance_score: number;
  ai_review: string;
  beginner_summary: string;
  project_idea: string;
};

export type ProductAnalysis = {
  category: string;
  description: string;
  score: number;
  status: string;
  use_cases: string[];
  pricing_type: string;
  target_user: string;
  related_project_ideas: string[];
};

export type GeneratedProjectIdea = {
  title: string;
  description: string;
  level: string;
  duration_days: number;
  stack: string[];
  related_trend: string;
  target_user_level: string;
  recommended_for: string[];
  portfolio_value: string;
  plan: string[];
  duration_estimate?: ProjectDurationEstimate;
  scope?: ProjectScope;
  build_plan?: BuildPlanStep[];
  prerequisites?: string[];
  difficulty_reasons?: string[];
  mvp_acceptance?: string;
  expansion_ideas?: string[];
  stack_details?: ProjectStackDetail[];
  project_constraints?: ProjectConstraints;
  technical_limitations?: string[];
  assumptions?: string[];
  excluded_scope?: string[];
  complexity_reasons?: string[];
  schedule_reasoning?: string;
  validation_metrics?: ProjectValidationMetric[];
};

export type ProjectDurationEstimate = {
  recommended_days: number;
  minimum_days: number;
  maximum_days: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  assumed_hours_per_day: number;
  reasoning: string;
};

export type ProjectScope = {
  must_have: string[];
  should_have: string[];
  excluded: string[];
};

export type BuildPlanStep = {
  order: number;
  title: string;
  objective: string;
  tasks: string[];
  tools: string[];
  deliverable: string;
  done_when: string;
  estimated_hours_min: number;
  estimated_hours_max: number;
  dependencies?: number[];
  acceptance_criteria?: string[];
  risks?: string[];
};

export type ProjectConstraints = {
  target_level: 'beginner' | 'intermediate' | 'advanced';
  duration_days_min: number;
  duration_days_max: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  primary_language: string;
  core_feature_count: number;
  integration_count: number;
  excluded_features: string[];
};

export type ProjectValidationMetric = {
  metric: string;
  target: string;
  method: string;
};

export type ProjectStackDetail = {
  name: string;
  category: 'core' | 'optional' | 'alternative' | 'scale';
  reason: string;
};

export type GeneratedArticleDraft = {
  title: string;
  summary: string;
  content_markdown: string;
  category: string;
  content_type: ContentType;
  newsletter_section: NewsletterSection;
  newsletter_priority: number;
  tags: string[];
  related_skills: string[];
  project_idea: string;
  why_it_matters: string;
  key_points: string[];
  difficulty: string;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  referenced_tools: string[];
  source_links: string[];
  editorial_angle: string;
  core_claims?: ArticleCoreClaim[];
  technical_limitations?: string[];
  assumptions?: string[];
  mvp_scope?: string[];
  excluded_scope?: string[];
  measurable_acceptance_criteria?: string[];
  evidence?: ArticleEvidence;
  link_warnings?: string[];
};

export type ArticleCoreClaim = {
  claim: string;
  evidence_type: 'source' | 'general_knowledge' | 'inference';
  source_urls: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type ArticleEvidence = {
  source_count: number;
  source_type_count: number;
  direct_metric_count: number;
  has_primary_source: boolean;
  confidence: 'low' | 'medium' | 'high';
  limitations: string[];
};

export type ArticleSourceBundleItem = {
  title: string;
  source_type: string;
  source_role: 'primary' | 'independent' | 'supporting' | 'context';
  url?: string | null;
  summary: string;
};

export type ArticleQuestionAnswer = {
  answer: string;
};

export type PaperAnalysis = {
  relevance_score: number;
  review_type: string;
  beginner_summary: string;
  expert_summary: string;
  why_it_matters: string;
  key_points: string[];
  related_skills: string[];
  implementation_idea: string;
  service_idea: string;
  difficulty: string;
  target_reader: string;
  trend_score: number;
  buildability_score: number;
  beginner_score: number;
  business_score: number;
  research_depth_score: number;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  content_depth: string;
};

export type PaperAnalysisResult = {
  analysis: PaperAnalysis;
  model: string | null;
  ok: boolean;
  qualityReason?: string;
};
