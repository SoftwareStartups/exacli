import type { ExaClient } from '../client.js';
import * as format from '../formatters/markdown.js';
import type { AnswerCommandArgs, Citation } from './types.js';
import { runCommand, dedupCitations } from '../utils/commands.js';

export async function answer(
  client: ExaClient,
  query: string,
  args: AnswerCommandArgs
) {
  await runCommand(async () => {
    const options = buildAnswerOptions(args);

    if (args.stream === true) {
      await streamAnswer(client, query, options, args.json === true);
    } else {
      const response = await client.answer(query, options);
      console.log(
        await format.formatAnswerResponse(response, {
          json: args.json === true,
          toon: args.toon === true,
        })
      );
    }
  });
}

async function streamAnswer(
  client: ExaClient,
  query: string,
  options: Record<string, unknown>,
  useJson: boolean
) {
  if (useJson) {
    const jsonResponse = {
      response: '',
      citations: [] as Citation[],
    };

    for await (const chunk of client.streamAnswer(query, options)) {
      if (chunk.content) {
        jsonResponse.response += chunk.content;
        process.stdout.write(chunk.content);
      }
      dedupCitations(jsonResponse.citations, chunk.citations);
    }

    console.log('\n');
    if (jsonResponse.citations.length > 0) {
      console.log(
        JSON.stringify({ citations: jsonResponse.citations }, null, 2)
      );
    }
  } else {
    console.log('# Answer (streaming)\n');
    console.log('## Response\n');

    const citations: Citation[] = [];

    for await (const chunk of client.streamAnswer(query, options)) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
      }
      dedupCitations(citations, chunk.citations);
    }

    console.log('\n');

    if (citations.length > 0) {
      console.log('## Citations\n');
      for (let i = 0; i < citations.length; i++) {
        const citation = citations[i];
        if (citation) {
          console.log(
            `${i + 1}. [${citation.title || 'Untitled'}](${citation.url})`
          );
        }
      }
      console.log('');
    }
  }
}

function buildAnswerOptions(args: AnswerCommandArgs) {
  const options: Record<string, unknown> = {};

  if (args.text === true) {
    options.text = true;
  }

  if (args.model) {
    options.model = args.model;
  }

  if (args['system-prompt']) {
    options.systemPrompt = args['system-prompt'];
  }

  return options;
}
