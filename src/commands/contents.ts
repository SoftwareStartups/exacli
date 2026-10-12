import type { ExaClient } from '../client.js';
import { formatSearchResults } from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import { betaHeaders, buildContents, compact } from '../utils/options.js';
import {
  UsageError,
  isValidUrl,
  parseEnum,
  requireArg,
} from '../utils/validation.js';
import {
  type CliArgs,
  COMPLIANCE_MODES,
  type SearchResponse,
} from './types.js';

export async function contents(
  client: ExaClient,
  urls: string[],
  args: CliArgs
): Promise<void> {
  requireArg(urls[0], 'contents <url...>');
  const invalid = urls.find((url) => !isValidUrl(url));
  if (invalid) {
    throw new UsageError(
      `Invalid URL "${invalid}". URLs must use HTTP or HTTPS protocol.`
    );
  }
  const { contents: options, betas } = await buildContents(args);

  const response = await client.request<SearchResponse>('POST', '/contents', {
    body: compact({
      urls,
      ...options,
      userIdentifier: args['user-id'],
      compliance: parseEnum('compliance', args.compliance, COMPLIANCE_MODES),
    }),
    headers: betaHeaders(betas),
  });
  printOutput(response, args, formatSearchResults);
}
