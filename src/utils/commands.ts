/**
 * Shared command plumbing: output envelope and error handling.
 */

import { ExaApiError } from '../client.js';
import type { CliArgs } from '../commands/types.js';
import { UsageError } from './validation.js';

// C0/C1 control characters except tab and newline, plus bidi overrides.
const CONTROL_CHARS =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
  /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Strips terminal control sequences from text that may come from crawled
 * pages, so a page cannot inject escape codes into the user's terminal.
 */
export function sanitize(text: string): string {
  return text.replace(CONTROL_CHARS, '');
}

/** Prints human-readable output with control characters removed. */
export function printText(text: string): void {
  console.log(sanitize(text));
}

export function printOutput<T>(
  data: T,
  args: CliArgs,
  toMarkdown: (data: T) => string
): void {
  if (args.json) console.log(JSON.stringify({ ok: true, data }));
  else printText(toMarkdown(data));
}

/** Prints one streamed item as an NDJSON envelope line. */
export function printStreamItem(data: unknown): void {
  console.log(JSON.stringify({ ok: true, data }));
}

/** Progress and status messages go to stderr so stdout stays data-only. */
export function logStatus(message: string): void {
  console.error(sanitize(message));
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
      console.error(`Error: ${sanitize(message)}`);
    }
    process.exit(1);
  }
}
