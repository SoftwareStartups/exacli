import type { ExaClient } from '../client.js';
import {
  formatBatch,
  formatBatchList,
  formatSuccess,
} from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import { compact, paginationQuery } from '../utils/options.js';
import {
  UsageError,
  parseJsonObject,
  requireArg,
} from '../utils/validation.js';
import {
  BATCHES_BETA,
  type Batch,
  type CliArgs,
  type ListResponse,
} from './types.js';

const headers = { 'Exa-Beta': BATCHES_BETA };
const batchPath = (id: string, suffix = '') =>
  `/batches/${encodeURIComponent(id)}${suffix}`;

/** Parses a JSON array or JSONL of `{customId, method, url, body}` requests. */
export function parseBatchRequests(source: string): unknown[] {
  const trimmed = source.trim();
  try {
    const requests: unknown = trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : trimmed
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line) => JSON.parse(line));
    if (Array.isArray(requests) && requests.length > 0) return requests;
  } catch {
    // fall through to the usage error below
  }
  throw new UsageError(
    'Batch input must be a non-empty JSON array or JSONL of {customId, method, url, body} requests'
  );
}

export async function batchCreate(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const file = requireArg(positionals[0], 'batch create <file|->');
  const source =
    file === '-' ? await Bun.stdin.text() : await Bun.file(file).text();

  const batch = await client.request<Batch>('POST', '/batches', {
    body: compact({
      requests: parseBatchRequests(source),
      metadata: await parseJsonObject('metadata', args.metadata),
    }),
    headers,
  });
  printOutput(batch, args, formatBatch);
}

export async function batchList(
  client: ExaClient,
  _positionals: string[],
  args: CliArgs
): Promise<void> {
  if (args.status && args.status !== 'completed') {
    throw new UsageError('--status only supports: completed');
  }
  const batches = await client.request<ListResponse<Batch>>('GET', '/batches', {
    query: { ...paginationQuery(args), status: args.status },
    headers,
  });
  printOutput(batches, args, formatBatchList);
}

export async function batchGet(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'batch get <batch-id>');
  const batch = await client.request<Batch>('GET', batchPath(id), { headers });
  printOutput(batch, args, formatBatch);
}

export async function batchCancel(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'batch cancel <batch-id>');
  const batch = await client.request<Batch>('POST', batchPath(id, '/cancel'), {
    headers,
  });
  printOutput(batch, args, formatBatch);
}

export async function batchDelete(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'batch delete <batch-id>');
  const result = await client.request<{ id: string }>('DELETE', batchPath(id), {
    headers,
  });
  printOutput(result, args, () => formatSuccess(`Deleted batch ${id}`));
}

/** Downloads the JSONL results file of a completed batch. */
export async function batchResults(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'batch results <batch-id>');
  const batch = await client.request<Batch>('GET', batchPath(id), { headers });
  if (!batch.resultsUrl) {
    throw new UsageError(
      `Batch ${id} has no results yet (status: ${batch.status})`
    );
  }
  const response = await fetch(batch.resultsUrl);
  if (!response.ok) {
    throw new Error(`Failed to download results (HTTP ${response.status})`);
  }
  const jsonl = await response.text();
  const results = jsonl
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as unknown);
  printOutput(results, args, () => jsonl.trimEnd());
}
