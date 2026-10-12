import type { ExaClient } from '../client.js';
import { formatSearchResults } from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import {
  betaHeaders,
  buildContents,
  buildResultFilters,
  buildUserLocation,
  compact,
} from '../utils/options.js';
import { streamCompletion } from '../utils/stream.js';
import {
  UsageError,
  parseEnum,
  parseJsonObject,
  parseStringList,
  requireArg,
} from '../utils/validation.js';
import {
  type CliArgs,
  COMPLIANCE_MODES,
  DEEP_SEARCH_TYPES,
  SEARCH_TYPES,
  type SearchResponse,
} from './types.js';

export async function search(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const query = requireArg(positionals.join(' '), 'search <query>');
  const type = parseEnum('type', args.type, SEARCH_TYPES);
  const additionalQueries = parseStringList(args['additional-queries']);
  if (additionalQueries && !DEEP_SEARCH_TYPES.includes(type ?? '')) {
    throw new UsageError(
      '--additional-queries requires --type deep-lite, deep, or deep-reasoning'
    );
  }
  const outputSchema = await parseJsonObject(
    'output-schema',
    args['output-schema']
  );
  if (args.stream && !outputSchema) {
    throw new UsageError('--stream requires --output-schema');
  }
  const { contents, betas } = await buildContents(args);

  const body = compact({
    query,
    type,
    ...buildResultFilters(args),
    additionalQueries,
    objective: args.objective,
    systemPrompt: args['system-prompt'],
    outputSchema,
    userLocation: buildUserLocation(args),
    moderation: args.moderation || undefined,
    userIdentifier: args['user-id'],
    compliance: parseEnum('compliance', args.compliance, COMPLIANCE_MODES),
    includeText: parseStringList(args['include-text']),
    excludeText: parseStringList(args['exclude-text']),
    contents,
  });
  const headers = betaHeaders(betas);

  if (args.stream) {
    await streamCompletion(client, '/search', body, headers, args);
    return;
  }

  const response = await client.request<SearchResponse>('POST', '/search', {
    body,
    headers,
  });
  printOutput(response, args, formatSearchResults);
}
