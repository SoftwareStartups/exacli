export interface BaseCommandArgs {
  json?: boolean;
}

export interface ContentArgs {
  text?: boolean;
  highlights?: boolean;
  summary?: boolean;
  livecrawl?: string;
  'livecrawl-timeout'?: string;
  'max-age-hours'?: string;
  'max-characters'?: string;
  subpages?: string;
  'subpage-target'?: string;
  'extras-links'?: string;
  'extras-image-links'?: string;
}

export interface SearchCommandArgs extends BaseCommandArgs, ContentArgs {
  'num-results'?: string;
  'include-domains'?: string;
  'exclude-domains'?: string;
  'include-text'?: string;
  'exclude-text'?: string;
  category?: string;
  'start-date'?: string;
  'end-date'?: string;
  'start-crawl-date'?: string;
  'end-crawl-date'?: string;
  'user-location'?: string;
  'additional-queries'?: string;
  moderation?: boolean;
  autoprompt?: boolean;
  type?: string;
}

export interface SimilarCommandArgs extends BaseCommandArgs, ContentArgs {
  'num-results'?: string;
  'exclude-source-domain'?: boolean;
  category?: string;
}

export interface ContentsCommandArgs extends BaseCommandArgs, ContentArgs {}

export interface AnswerCommandArgs extends BaseCommandArgs {
  text?: boolean;
  stream?: boolean;
  model?: string;
  'system-prompt'?: string;
  'user-location'?: string;
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
