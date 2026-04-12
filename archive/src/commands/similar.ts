import type { ExaClient } from '../client.js';
import * as format from '../formatters/markdown.js';
import type { SimilarCommandArgs } from './types.js';
import {
  hasContentOptions,
  applyContentOptions,
  runCommand,
} from '../utils/commands.js';
import { parseNumber } from '../utils/validation.js';

export async function similar(
  client: ExaClient,
  url: string,
  args: SimilarCommandArgs
) {
  await runCommand(async () => {
    const options = buildSimilarOptions(args);

    const response = hasContentOptions(args)
      ? await client.findSimilarAndContents(url, options)
      : await client.findSimilar(url, options);

    console.log(
      await format.formatSearchResults(response, {
        json: args.json === true,
        toon: args.toon === true,
      })
    );
  });
}

function buildSimilarOptions(args: SimilarCommandArgs) {
  const options: Record<string, unknown> = {};

  const numResults = parseNumber(args['num-results']);
  if (numResults !== undefined) {
    options.numResults = numResults;
  }

  if (args['exclude-source-domain'] === true) {
    options.excludeSourceDomain = true;
  }

  if (args.category) {
    options.category = args.category;
  }

  applyContentOptions(options, args);

  return options;
}
