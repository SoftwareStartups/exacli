/**
 * CLI argument shape and Exa API enums/response types (exa-spec.yaml 2.0.0).
 */

import type { ExaClient } from '../client.js';

export const SEARCH_TYPES = [
  'auto',
  'fast',
  'instant',
  'deep-lite',
  'deep',
  'deep-reasoning',
] as const;
export const DEEP_SEARCH_TYPES: readonly string[] = [
  'deep-lite',
  'deep',
  'deep-reasoning',
];
export const LIVECRAWL_MODES = [
  'never',
  'always',
  'fallback',
  'preferred',
] as const;
export const TEXT_VERBOSITY = ['compact', 'standard', 'full'] as const;
export const SECTION_TAGS = [
  'header',
  'navigation',
  'banner',
  'body',
  'sidebar',
  'footer',
  'metadata',
] as const;
export const HIGHLIGHTS_VERBOSITY = ['low', 'medium', 'high'] as const;
export const COMPLIANCE_MODES = ['hipaa'] as const;
export const ANSWER_MODELS = [
  'exa',
  'exa-pro',
  'exa-research',
  'exa-fast',
] as const;
export const AGENT_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'auto',
  'ultra',
] as const;
export const MONITOR_STATUSES = ['active', 'paused', 'disabled'] as const;
export const MONITOR_UPDATE_STATUSES = ['active', 'paused'] as const;
export const MONITOR_BATCH_ACTIONS = ['delete', 'pause', 'unpause'] as const;

export const WEBSET_ENTITY_TYPES = [
  'company',
  'person',
  'article',
  'research_paper',
  'custom',
] as const;
export const WEBSET_SEARCH_BEHAVIORS = ['override', 'append'] as const;
export const WEBSET_MONITOR_STATUSES = ['enabled', 'disabled'] as const;
export const BOOLEAN_STRINGS = ['true', 'false'] as const;
export const ENRICHMENT_FORMATS = [
  'text',
  'date',
  'number',
  'options',
  'email',
  'phone',
  'url',
] as const;

export const DYNAMIC_HIGHLIGHTS_BETA = 'dynamic-highlights-2026-08-28';
export const BATCHES_BETA = 'batches-2026-06-06';

export const BOOLEAN_FLAGS = [
  'json',
  'help',
  'version',
  'skip-validation',
  'moderation',
  'stream',
  'exclude-source-domain',
  'text',
  'include-html-tags',
  'highlights',
  'dynamic-highlights',
  'summary',
  'wait',
  'remove-schedule',
  'execute',
  'recall',
  'with-items',
] as const;

export const MULTIPLE_FLAGS = ['criterion', 'enrichment'] as const;

export const STRING_FLAGS = [
  'api-key',
  'num-results',
  'type',
  'category',
  'include-domains',
  'exclude-domains',
  'include-text',
  'exclude-text',
  'start-date',
  'end-date',
  'user-location',
  'latitude',
  'longitude',
  'additional-queries',
  'objective',
  'system-prompt',
  'output-schema',
  'user-id',
  'compliance',
  'max-characters',
  'text-verbosity',
  'include-sections',
  'exclude-sections',
  'highlights-query',
  'highlights-max-characters',
  'highlights-verbosity',
  'summary-query',
  'summary-schema',
  'max-age-hours',
  'livecrawl',
  'livecrawl-timeout',
  'snapshot-as-of',
  'subpages',
  'subpage-target',
  'extras-links',
  'extras-image-links',
  'extras-rich-links',
  'extras-rich-image-links',
  'extras-code-blocks',
  'model',
  'effort',
  'input',
  'previous-run',
  'data-sources',
  'max-cost',
  'max-duration',
  'poll-interval',
  'timeout',
  'name',
  'status',
  'query',
  'period',
  'webhook-url',
  'webhook-events',
  'metadata',
  'limit',
  'cursor',
  'body',
  'count',
  'entity',
  'entity-description',
  'title',
  'external-id',
  'expand',
  'source-id',
  'behavior',
  'description',
  'format',
  'options',
  'cron',
  'timezone',
  'events',
  'event-type',
  'successful',
  'types',
  'created-after',
  'created-before',
  'identifier-column',
  'webset',
] as const;

/** Parsed CLI flags. Every command reads the subset it supports. */
export type CliArgs = {
  [K in (typeof BOOLEAN_FLAGS)[number]]?: boolean;
} & {
  [K in (typeof STRING_FLAGS)[number]]?: string;
} & {
  [K in (typeof MULTIPLE_FLAGS)[number]]?: string[];
};

/** Shared signature of every command handler. */
export type Handler = (
  client: ExaClient,
  positionals: string[],
  args: CliArgs
) => Promise<void>;

export interface Citation {
  title?: string | null;
  url: string;
}

export interface SearchResult {
  id: string;
  url: string;
  title?: string | null;
  publishedDate?: string | null;
  author?: string | null;
  score?: number;
  text?: string;
  highlights?: string[];
  summary?: string;
  subpages?: SearchResult[];
  extras?: Record<string, unknown[] | undefined>;
  entities?: Array<{ type: string; properties?: { name?: string | null } }>;
}

export interface GroundingEntry {
  field: string;
  citations: Citation[];
  confidence?: string | null;
}

export interface SearchResponse {
  requestId?: string;
  results?: SearchResult[];
  output?: {
    content: string | Record<string, unknown>;
    grounding?: GroundingEntry[];
  };
  statuses?: Array<{
    id: string;
    status: string;
    error?: { tag?: string; httpStatusCode?: number | null } | null;
  }>;
  costDollars?: { total?: number };
}

export interface AnswerResponse {
  requestId?: string;
  answer: string | Record<string, unknown>;
  citations?: Citation[];
  costDollars?: { total?: number };
}

export interface AgentRun {
  id: string;
  status: string;
  stopReason?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  request?: { query?: string; effort?: string } | null;
  output?: {
    text?: string | null;
    structured?: unknown;
    grounding?: GroundingEntry[] | null;
  } | null;
  costDollars?: { total?: number };
  error?: { message?: string; code?: string } | null;
}

export interface Monitor {
  id: string;
  name?: string | null;
  status: string;
  search?: { query?: string; numResults?: number };
  trigger?: { type?: string; period?: string } | null;
  webhook?: { url?: string; events?: string[] };
  nextRunAt?: string | null;
  createdAt?: string;
  webhookSecret?: string;
}

export interface MonitorRun {
  id: string;
  monitorId?: string;
  status: string;
  failReason?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  durationMs?: number | null;
  output?: {
    results?: SearchResult[];
    content?: string | Record<string, unknown>;
  } | null;
}

export interface Batch {
  id: string;
  status: string;
  requestCounts?: { total: number; completed: number; failed: number };
  createdAt?: string;
  expiresAt?: string | null;
  endedAt?: string | null;
  resultsUrl?: string | null;
}

export interface ListResponse<T> {
  data: T[];
  hasMore?: boolean;
  nextCursor?: string | null;
}
