import type { ContentArgs, Citation } from '../commands/types.js';
import * as format from '../formatters/markdown.js';
import { parseNumber, parseStringList } from './validation.js';

export function hasContentOptions(args: ContentArgs): boolean {
  return (
    args.text === true ||
    args.highlights === true ||
    args.summary === true ||
    args.livecrawl !== undefined ||
    args['livecrawl-timeout'] !== undefined ||
    args['max-age-hours'] !== undefined ||
    args['max-characters'] !== undefined ||
    args.subpages !== undefined ||
    args['subpage-target'] !== undefined ||
    args['extras-links'] !== undefined ||
    args['extras-image-links'] !== undefined
  );
}

export function applyContentOptions(
  options: Record<string, unknown>,
  args: ContentArgs
): void {
  const maxCharacters = parseNumber(args['max-characters']);
  if (maxCharacters !== undefined) {
    options.text = { maxCharacters };
  } else if (args.text === true) {
    options.text = true;
  }

  if (args.highlights === true) {
    options.highlights = true;
  }
  if (args.summary === true) {
    options.summary = true;
  }

  if (args.livecrawl) {
    options.livecrawl = args.livecrawl;
  }

  const livecrawlTimeout = parseNumber(args['livecrawl-timeout']);
  if (livecrawlTimeout !== undefined) {
    options.livecrawlTimeout = livecrawlTimeout;
  }

  const maxAgeHours = parseNumber(args['max-age-hours']);
  if (maxAgeHours !== undefined) {
    options.maxAgeHours = maxAgeHours;
  }

  const subpages = parseNumber(args.subpages);
  if (subpages !== undefined) {
    options.subpages = subpages;
  }

  const subpageTarget = parseStringList(args['subpage-target']);
  if (subpageTarget && subpageTarget.length > 0) {
    options.subpageTarget = subpageTarget;
  }

  const extras: Record<string, number> = {};
  const extrasLinks = parseNumber(args['extras-links']);
  if (extrasLinks !== undefined) {
    extras.links = extrasLinks;
  }
  const extrasImageLinks = parseNumber(args['extras-image-links']);
  if (extrasImageLinks !== undefined) {
    extras.imageLinks = extrasImageLinks;
  }
  if (Object.keys(extras).length > 0) {
    options.extras = extras;
  }
}

export async function runCommand(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(format.formatError(error));
    process.exit(1);
  }
}

export function dedupCitations(
  existing: Citation[],
  incoming: Citation[] | undefined
): void {
  if (!incoming) return;
  for (const citation of incoming) {
    if (citation && !existing.some((c) => c.url === citation.url)) {
      existing.push(citation);
    }
  }
}
