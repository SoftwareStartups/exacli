import type { ContentArgs, Citation } from '../commands/types.js';
import * as format from '../formatters/markdown.js';

export function hasContentOptions(args: ContentArgs): boolean {
  return (
    args.text === true || args.highlights === true || args.summary === true
  );
}

export function applyContentOptions(
  options: Record<string, unknown>,
  args: ContentArgs
): void {
  if (args.text === true) {
    options.text = true;
  }
  if (args.highlights === true) {
    options.highlights = true;
  }
  if (args.summary === true) {
    options.summary = true;
  }
}

export async function runCommand(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(await format.formatError(error));
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
