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
      format.formatSearchResults(response, { json: args.json === true })
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

  const includeText = parseStringList(args['include-text']);
  if (includeText && includeText.length > 0) {
    options.includeText = includeText;
  }

  const excludeText = parseStringList(args['exclude-text']);
  if (excludeText && excludeText.length > 0) {
    options.excludeText = excludeText;
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

  if (args['start-crawl-date']) {
    options.startCrawlDate = args['start-crawl-date'];
  }

  if (args['end-crawl-date']) {
    options.endCrawlDate = args['end-crawl-date'];
  }

  if (args['user-location']) {
    options.userLocation = args['user-location'];
  }

  if (args.moderation === true) {
    options.moderation = true;
  }

  if (args.autoprompt === true) {
    options.useAutoprompt = true;
  }

  if (args.type) {
    options.type = args.type;
  }

  const additionalQueries = parseStringList(args['additional-queries']);
  if (additionalQueries && additionalQueries.length > 0) {
    options.additionalQueries = additionalQueries;
  }

  applyContentOptions(options, args);

  return options;
}
