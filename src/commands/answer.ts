import type { ExaClient } from '../client.js';
import { formatAnswerResponse } from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import { buildUserLocation, compact } from '../utils/options.js';
import { streamCompletion } from '../utils/stream.js';
import { parseEnum, parseJsonObject, requireArg } from '../utils/validation.js';
import { ANSWER_MODELS, type AnswerResponse, type CliArgs } from './types.js';

export async function answer(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const query = requireArg(positionals.join(' '), 'answer <query>');
  const body = compact({
    query,
    model: parseEnum('model', args.model, ANSWER_MODELS),
    text: args.text || undefined,
    systemPrompt: args['system-prompt'],
    outputSchema: await parseJsonObject('output-schema', args['output-schema']),
    userLocation: buildUserLocation(args),
    userIdentifier: args['user-id'],
  });

  if (args.stream) {
    await streamCompletion(client, '/answer', body, undefined, args);
    return;
  }

  const response = await client.request<AnswerResponse>('POST', '/answer', {
    body,
  });
  printOutput(response, args, formatAnswerResponse);
}
