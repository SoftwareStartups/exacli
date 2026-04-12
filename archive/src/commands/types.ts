export interface BaseCommandArgs {
  json?: boolean;
  toon?: boolean;
}

export interface ContentArgs {
  text?: boolean;
  highlights?: boolean;
  summary?: boolean;
}

export interface SearchCommandArgs extends BaseCommandArgs, ContentArgs {
  'num-results'?: string;
  'include-domains'?: string;
  'exclude-domains'?: string;
  category?: string;
  'start-date'?: string;
  'end-date'?: string;
  autoprompt?: boolean;
  type?: string;
}

export interface SimilarCommandArgs extends BaseCommandArgs, ContentArgs {
  'num-results'?: string;
  'exclude-source-domain'?: boolean;
  category?: string;
}

export interface ContentsCommandArgs extends BaseCommandArgs, ContentArgs {
  'max-age-hours'?: string;
}

export interface AnswerCommandArgs extends BaseCommandArgs {
  text?: boolean;
  stream?: boolean;
  model?: string;
  'system-prompt'?: string;
}

export interface ResearchCreateArgs extends BaseCommandArgs {
  model?: string;
  poll?: boolean;
  'poll-interval'?: string;
  timeout?: string;
}

export interface ResearchStatusArgs extends BaseCommandArgs {}

export interface ResearchListArgs extends BaseCommandArgs {
  limit?: string;
  cursor?: string;
}

export interface Citation {
  title?: string | null;
  url: string;
}
