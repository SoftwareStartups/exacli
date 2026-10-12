import type { ExaClient } from '../client.js';
import { formatSearchResults } from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import {
  betaHeaders,
  buildContents,
  buildResultFilters,
  compact,
} from '../utils/options.js';
import { UsageError, isValidUrl, requireArg } from '../utils/validation.js';
import type { CliArgs, SearchResponse } from './types.js';

/** /findSimilar is deprecated by Exa but still served. */
export async function similar(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const url = requireArg(positionals[0], 'similar <url>');
  if (!isValidUrl(url)) {
    throw new UsageError(
      `Invalid URL "${url}". URLs must use HTTP or HTTPS protocol.`
    );
  }
  const { contents, betas } = await buildContents(args);

  const response = await client.request<SearchResponse>(
    'POST',
    '/findSimilar',
    {
      body: compact({
        url,
        ...buildResultFilters(args),
        excludeSourceDomain: args['exclude-source-domain'] || undefined,
        contents,
      }),
      headers: betaHeaders(betas),
    }
  );
  printOutput(response, args, formatSearchResults);
}
