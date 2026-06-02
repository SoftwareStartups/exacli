import type { ExaClient } from '../client.js';
import * as format from '../formatters/markdown.js';
import type { ContentsCommandArgs } from './types.js';
import { applyContentOptions, runCommand } from '../utils/commands.js';
import { isValidUrl } from '../utils/validation.js';

export async function contents(
  client: ExaClient,
  urls: string[],
  args: ContentsCommandArgs
) {
  await runCommand(async () => {
    for (const url of urls) {
      if (!isValidUrl(url)) {
        console.error(
          `Error: Invalid URL "${url}". URLs must use HTTP or HTTPS protocol.`
        );
        process.exit(1);
      }
    }

    const options = buildContentsOptions(args);
    const response = await client.getContents(urls, options);
    console.log(
      format.formatSearchResults(response, { json: args.json === true })
    );
  });
}

function buildContentsOptions(args: ContentsCommandArgs) {
  const options: Record<string, unknown> = {};

  applyContentOptions(options, args);

  return options;
}
