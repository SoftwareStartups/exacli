/**
 * Renders streamed /answer and /search (outputSchema) responses. Both endpoints
 * stream OpenAI-style chat completion chunks with optional citations.
 */

import type { ExaClient } from '../client.js';
import type { CliArgs, Citation } from '../commands/types.js';
import { formatCitations } from '../formatters/markdown.js';
import { printStreamItem } from './commands.js';

interface CompletionChunk {
  choices?: Array<{ delta?: { content?: string } }>;
  citations?: Citation[] | null;
}

export async function streamCompletion(
  client: ExaClient,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> | undefined,
  args: CliArgs
): Promise<void> {
  const citations: Citation[] = [];

  for await (const event of client.stream(path, {
    body: { ...body, stream: true },
    headers,
  })) {
    if (event.data === '[DONE]') break;
    const chunk = JSON.parse(event.data) as CompletionChunk;
    if (args.json) {
      printStreamItem(chunk, args);
      continue;
    }
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) process.stdout.write(content);
    for (const citation of chunk.citations ?? []) {
      if (!citations.some((c) => c.url === citation.url)) {
        citations.push(citation);
      }
    }
  }

  if (!args.json) {
    console.log('\n');
    if (citations.length > 0) console.log(formatCitations(citations));
  }
}
