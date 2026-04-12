import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { sanitizeCredential, setSecret } from '../../auth/keychain.js';
import { createClient } from '../../client.js';
import * as format from '../../formatters/markdown.js';

export interface LoginArgs {
  'api-key'?: string;
  'skip-validation'?: boolean;
}

export async function login(args: LoginArgs): Promise<void> {
  const raw = args['api-key'] || (await promptForApiKey());

  let apiKey: string;
  try {
    apiKey = sanitizeCredential(raw);
  } catch (err: unknown) {
    console.error(
      `Error: ${err instanceof Error ? err.message : 'Invalid credential.'}`
    );
    process.exit(1);
  }

  if (args['skip-validation'] !== true) {
    const valid = await validateApiKey(apiKey);
    if (!valid) {
      console.error(
        'Warning: Could not validate API key. The key may be invalid or the API may be unreachable.'
      );
      console.error('Storing the key anyway.');
    }
  }

  try {
    await setSecret('EXA_API_KEY', apiKey);
  } catch {
    console.error(
      'Error: OS keychain not available. Set EXA_API_KEY environment variable instead.'
    );
    process.exit(1);
  }

  console.log(await format.formatSuccess('API key saved to OS keychain.'));
}

async function promptForApiKey(): Promise<string> {
  if (!process.stdin.isTTY) {
    console.error(
      'Error: No TTY detected. Use --api-key to provide the key non-interactively.'
    );
    process.exit(1);
  }

  const mutableOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableOutput,
    terminal: true,
  });

  return new Promise<string>((resolve) => {
    process.stderr.write('Enter your Exa API key: ');
    rl.question('', (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer);
    });
  });
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = createClient(apiKey);
    await client.search('test', { numResults: 1 });
    return true;
  } catch {
    return false;
  }
}
