/**
 * Authentication commands (login/logout)
 */

import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { createClient } from '../client.js';
import * as format from '../formatters/markdown.js';
import {
  writeConfig,
  deleteConfig,
  readConfig,
  getConfigPath,
} from '../utils/config.js';

export interface LoginArgs {
  'api-key'?: string;
  'skip-validation'?: boolean;
}

export async function login(args: LoginArgs): Promise<void> {
  const apiKey = args['api-key'] || (await promptForApiKey());

  if (!apiKey || apiKey.trim().length === 0) {
    console.error('Error: API key cannot be empty.');
    process.exit(1);
  }

  const trimmedKey = apiKey.trim();

  if (args['skip-validation'] !== true) {
    const valid = await validateApiKey(trimmedKey);
    if (!valid) {
      console.error(
        'Warning: Could not validate API key. The key may be invalid or the API may be unreachable.'
      );
      console.error('Storing the key anyway.');
    }
  }

  writeConfig({ api_key: trimmedKey });
  console.log(format.formatSuccess(`API key saved to ${getConfigPath()}`));
}

export async function logout(): Promise<void> {
  const config = readConfig();
  if (!config) {
    console.log('No stored API key found. Already logged out.');
    return;
  }

  const removed = deleteConfig();
  if (removed) {
    console.log(format.formatSuccess('API key removed.'));
  } else {
    console.error('Error: Failed to remove config file.');
    process.exit(1);
  }
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
    process.stdout.write('Enter your Exa API key: ');
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
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
