import type { ExaClient } from '../client.js';
import * as format from '../formatters/markdown.js';
import type { SearchCommandArgs } from './types.js';
import {
  hasContentOptions,
  applyContentOptions,
  runCommand,
} from '../utils/commands.js';
import { parseNumber, parseStringList } from '../utils/validation.js';

export async function search(
  client: ExaClient,
  query: string,
  args: SearchCommandArgs
) {
  await runCommand(async () => {
    const options = buildSearchOptions(args);

    const response = hasContentOptions(args)
      ? await client.searchAndContents(query, options)
      : await client.search(query, options);

    console.log(
      await format.formatSearchResults(response, {
        json: args.json === true,
        toon: args.toon === true,
      })
    );
  });
}

function buildSearchOptions(args: SearchCommandArgs) {
  const options: Record<string, unknown> = {};

  const numResults = parseNumber(args['num-results']);
  if (numResults !== undefined) {
    options.numResults = numResults;
  }

  const includeDomains = parseStringList(args['include-domains']);
  if (includeDomains && includeDomains.length > 0) {
    options.includeDomains = includeDomains;
  }

  const excludeDomains = parseStringList(args['exclude-domains']);
  if (excludeDomains && excludeDomains.length > 0) {
    options.excludeDomains = excludeDomains;
  }

  if (args.category) {
    options.category = args.category;
  }

  if (args['start-date']) {
    options.startPublishedDate = args['start-date'];
  }

  if (args['end-date']) {
    options.endPublishedDate = args['end-date'];
  }

  if (args.autoprompt === true) {
    options.useAutoprompt = true;
  }

  if (args.type) {
    options.type = args.type;
  }

  applyContentOptions(options, args);

  return options;
}
