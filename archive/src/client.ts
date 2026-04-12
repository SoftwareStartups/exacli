/**
 * Exa SDK Client wrapper
 */

import { Exa } from 'exa-js';

export type ExaClient = InstanceType<typeof Exa>;
export type {
  BaseSearchOptions,
  RegularSearchOptions,
  FindSimilarOptions,
  ContentsOptions,
  AnswerOptions,
  SearchResponse,
  AnswerResponse,
  Research,
  ResearchCreateRequest,
} from 'exa-js';

export function createClient(apiKey: string): ExaClient {
  return new Exa(apiKey);
}
