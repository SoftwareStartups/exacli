/**
 * Shared command plumbing: output envelope and error handling.
 */

import { ExaApiError } from '../client.js';
import type { CliArgs } from '../commands/types.js';
import { UsageError } from './validation.js';

export function printOutput<T>(
  data: T,
  args: CliArgs,
  toMarkdown: (data: T) => string
): void {
  console.log(
    args.json ? JSON.stringify({ ok: true, data }) : toMarkdown(data)
  );
}

/** Prints one streamed item: an NDJSON envelope line in --json mode. */
export function printStreamItem(data: unknown, args: CliArgs): void {
  if (args.json) console.log(JSON.stringify({ ok: true, data }));
}

/** Progress and status messages go to stderr so stdout stays data-only. */
export function logStatus(message: string): void {
  console.error(message);
}

function errorCode(error: unknown): string {
  if (error instanceof UsageError) return 'USAGE_ERROR';
  if (error instanceof ExaApiError) return error.tag ?? `HTTP_${error.status}`;
  return 'ERROR';
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const invalidKey =
    error instanceof ExaApiError &&
    error.status === 401 &&
    (error.tag === 'INVALID_API_KEY' || /api key/i.test(message));
  if (invalidKey) {
    return `${message} Run "exacli login" or set EXA_API_KEY.`;
  }
  return message;
}

export async function runCommand(
  args: CliArgs,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = errorMessage(error);
    if (args.json) {
      console.log(
        JSON.stringify({ ok: false, error: message, code: errorCode(error) })
      );
    } else {
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  }
}
