/**
 * Renders streamed /answer and /search (outputSchema) responses. Both endpoints
 * stream OpenAI-style chat completion chunks with optional citations.
 */

import { type ExaClient, parseEventData } from '../client.js';
import type { Citation, CliArgs } from '../commands/types.js';
import { formatCitations } from '../formatters/markdown.js';
import { logStatus, printStreamItem, sanitize } from './commands.js';

/** Union of the /answer and /search stream chunk shapes we render. */
interface CompletionChunk {
  type?: string;
  delta?: unknown;
  choices?: Array<{ delta?: { content?: string; citations?: Citation[] } }>;
  citations?: Citation[] | null;
  grounding?: Array<{ citations?: Citation[] }>;
  error?: { message?: string };
  tag?: string;
  payload?: { error?: { message?: string } };
}

function streamError(chunk: CompletionChunk): string | undefined {
  if (chunk.type === 'error') return chunk.error?.message ?? 'Stream error';
  if (chunk.tag === 'ERROR') {
    return chunk.payload?.error?.message ?? 'Stream error';
  }
  return undefined;
}

function chunkCitations(chunk: CompletionChunk): Citation[] {
  return [
    ...(chunk.citations ?? []),
    ...(chunk.choices ?? []).flatMap((c) => c.delta?.citations ?? []),
    ...(chunk.grounding ?? []).flatMap((g) => g.citations ?? []),
  ];
}

export async function streamCompletion(
  client: ExaClient,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> | undefined,
  args: CliArgs
): Promise<void> {
  const citations: Citation[] = [];
  let done = false;

  for await (const event of client.stream(path, {
    body: { ...body, stream: true },
    headers,
  })) {
    if (event.data === '[DONE]') {
      done = true;
      break;
    }
    const chunk = parseEventData(event.data) as CompletionChunk;
    const error = streamError(chunk);
    if (error) throw new Error(error);
    if (args.json) {
      printStreamItem(chunk);
      continue;
    }
    if (chunk.type === 'stream-reset') {
      logStatus('[stream restarted]');
      process.stdout.write('\n\n');
      continue;
    }
    // /search sends the text in `delta`; /answer only in `choices`.
    const content = chunk.delta ?? chunk.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content) {
      process.stdout.write(sanitize(content));
    }
    for (const citation of chunkCitations(chunk)) {
      if (!citations.some((c) => c.url === citation.url)) {
        citations.push(citation);
      }
    }
  }

  if (!done) throw new Error('Stream ended before completion');
  if (!args.json) {
    console.log('\n');
    if (citations.length > 0) console.log(sanitize(formatCitations(citations)));
  }
}
