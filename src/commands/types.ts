/**
 * CLI argument shape and Exa API enums/response types (exa-spec.yaml 2.0.0).
 */

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
export const MONITOR_BATCH_ACTIONS = ['delete', 'pause', 'unpause'] as const;

export const DYNAMIC_HIGHLIGHTS_BETA = 'dynamic-highlights-2026-08-28';
export const BATCHES_BETA = 'batches-2026-06-06';

/** Parsed CLI flags. Every command reads the subset it supports. */
export interface CliArgs {
  json?: boolean;
  // search filters
  'num-results'?: string;
  type?: string;
  category?: string;
  'include-domains'?: string;
  'exclude-domains'?: string;
  'include-text'?: string;
  'exclude-text'?: string;
  'start-date'?: string;
  'end-date'?: string;
  'user-location'?: string;
  latitude?: string;
  longitude?: string;
  moderation?: boolean;
  'additional-queries'?: string;
  objective?: string;
  'system-prompt'?: string;
  'output-schema'?: string;
  stream?: boolean;
  'user-id'?: string;
  compliance?: string;
  'exclude-source-domain'?: boolean;
  // contents
  text?: boolean;
  'max-characters'?: string;
  'include-html-tags'?: boolean;
  'text-verbosity'?: string;
  'include-sections'?: string;
  'exclude-sections'?: string;
  highlights?: boolean;
  'highlights-query'?: string;
  'highlights-max-characters'?: string;
  'highlights-verbosity'?: string;
  'dynamic-highlights'?: boolean;
  summary?: boolean;
  'summary-query'?: string;
  'summary-schema'?: string;
  'max-age-hours'?: string;
  livecrawl?: string;
  'livecrawl-timeout'?: string;
  'snapshot-as-of'?: string;
  subpages?: string;
  'subpage-target'?: string;
  'extras-links'?: string;
  'extras-image-links'?: string;
  'extras-rich-links'?: string;
  'extras-rich-image-links'?: string;
  'extras-code-blocks'?: string;
  // answer
  model?: string;
  // agent
  effort?: string;
  input?: string;
  'previous-run'?: string;
  'data-sources'?: string;
  'max-cost'?: string;
  'max-duration'?: string;
  wait?: boolean;
  'poll-interval'?: string;
  timeout?: string;
  // monitors and batches
  name?: string;
  status?: string;
  query?: string;
  period?: string;
  'remove-schedule'?: boolean;
  'webhook-url'?: string;
  'webhook-events'?: string;
  metadata?: string;
  execute?: boolean;
  // pagination
  limit?: string;
  cursor?: string;
}

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
