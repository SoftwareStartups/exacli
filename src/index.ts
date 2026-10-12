#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { getSecret } from './auth/keychain.js';
import * as loginCmd from './cli/commands/login.js';
import * as logoutCmd from './cli/commands/logout.js';
import { type ExaClient, createClient } from './client.js';
import * as agent from './commands/agent.js';
import { answer } from './commands/answer.js';
import * as batch from './commands/batch.js';
import { contents } from './commands/contents.js';
import * as monitor from './commands/monitor.js';
import { search } from './commands/search.js';
import { similar } from './commands/similar.js';
import type { CliArgs } from './commands/types.js';
import { COMMAND_HELP, MAIN_HELP } from './help.js';
import { runCommand } from './utils/commands.js';
import { UsageError } from './utils/validation.js';

type Handler = (
  client: ExaClient,
  positionals: string[],
  args: CliArgs
) => Promise<void>;

const COMMANDS: Record<string, Handler | Record<string, Handler>> = {
  search,
  contents,
  answer,
  similar,
  agent: {
    run: agent.agentRun,
    get: agent.agentGet,
    list: agent.agentList,
    cancel: agent.agentCancel,
    stop: agent.agentStop,
    delete: agent.agentDelete,
    events: agent.agentEvents,
  },
  monitor: {
    create: monitor.monitorCreate,
    list: monitor.monitorList,
    get: monitor.monitorGet,
    update: monitor.monitorUpdate,
    delete: monitor.monitorDelete,
    trigger: monitor.monitorTrigger,
    runs: monitor.monitorRuns,
    run: monitor.monitorRun,
    batch: monitor.monitorBatch,
  },
  batch: {
    create: batch.batchCreate,
    list: batch.batchList,
    get: batch.batchGet,
    cancel: batch.batchCancel,
    delete: batch.batchDelete,
    results: batch.batchResults,
  },
};

const RETIRED_COMMANDS = new Set([
  'research',
  'research-status',
  'research-list',
]);

const BOOLEAN_FLAGS = [
  'json',
  'help',
  'version',
  'skip-validation',
  'moderation',
  'stream',
  'exclude-source-domain',
  'text',
  'include-html-tags',
  'highlights',
  'dynamic-highlights',
  'summary',
  'wait',
  'remove-schedule',
  'execute',
] as const;

const STRING_FLAGS = [
  'api-key',
  'num-results',
  'type',
  'category',
  'include-domains',
  'exclude-domains',
  'include-text',
  'exclude-text',
  'start-date',
  'end-date',
  'user-location',
  'latitude',
  'longitude',
  'additional-queries',
  'objective',
  'system-prompt',
  'output-schema',
  'user-id',
  'compliance',
  'max-characters',
  'text-verbosity',
  'include-sections',
  'exclude-sections',
  'highlights-query',
  'highlights-max-characters',
  'highlights-verbosity',
  'summary-query',
  'summary-schema',
  'max-age-hours',
  'livecrawl',
  'livecrawl-timeout',
  'snapshot-as-of',
  'subpages',
  'subpage-target',
  'extras-links',
  'extras-image-links',
  'extras-rich-links',
  'extras-rich-image-links',
  'extras-code-blocks',
  'model',
  'effort',
  'input',
  'previous-run',
  'data-sources',
  'max-cost',
  'max-duration',
  'poll-interval',
  'timeout',
  'name',
  'status',
  'query',
  'period',
  'webhook-url',
  'webhook-events',
  'metadata',
  'limit',
  'cursor',
] as const;

interface OptionSpec {
  type: 'boolean' | 'string';
  short?: string;
}

const OPTIONS: Record<string, OptionSpec> = {
  ...Object.fromEntries(BOOLEAN_FLAGS.map((f) => [f, { type: 'boolean' }])),
  ...Object.fromEntries(STRING_FLAGS.map((f) => [f, { type: 'string' }])),
  help: { type: 'boolean', short: 'h' },
};

interface MainArgs extends CliArgs {
  help?: boolean;
  version?: boolean;
  'api-key'?: string;
  'skip-validation'?: boolean;
}

function exitWithUsage(message: string, help: string): never {
  console.error(`Error: ${message}`);
  console.error(help);
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = Bun.argv.slice(2);
  let args: MainArgs;
  let positionalArgs: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: true,
    });
    args = parsed.values as MainArgs;
    positionalArgs = parsed.positionals;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runCommand({ json: argv.includes('--json') }, () => {
      throw new UsageError(message);
    });
    return;
  }
  const [command, ...rest] = positionalArgs;

  if (args.version) {
    console.log(`exacli v${pkg.version}`);
    return;
  }
  if (!command) {
    console.log(MAIN_HELP);
    return;
  }
  if (args.help) {
    console.log(COMMAND_HELP[command] ?? MAIN_HELP);
    return;
  }

  if (command === 'login') {
    await loginCmd.login(args);
    return;
  }
  if (command === 'logout') {
    await logoutCmd.logout();
    return;
  }
  if (RETIRED_COMMANDS.has(command)) {
    exitWithUsage(
      `"${command}" was removed: Exa retired the Research API. Use "exacli agent run" instead.`,
      COMMAND_HELP.agent ?? MAIN_HELP
    );
  }

  const entry = COMMANDS[command];
  if (!entry) exitWithUsage(`Unknown command "${command}"`, MAIN_HELP);

  let handler: Handler;
  let positionals = rest;
  if (typeof entry === 'function') {
    handler = entry;
  } else {
    const [sub, ...subRest] = rest;
    const subHandler = sub ? entry[sub] : undefined;
    if (!subHandler) {
      exitWithUsage(
        sub
          ? `Unknown ${command} subcommand "${sub}"`
          : `${command} requires a subcommand`,
        COMMAND_HELP[command] ?? MAIN_HELP
      );
    }
    handler = subHandler;
    positionals = subRest;
  }

  await runCommand(args, async () => {
    const client = createClient(await resolveApiKey(args['api-key']));
    await handler(client, positionals, args);
  });
}

async function resolveApiKey(flag: string | undefined): Promise<string> {
  const apiKey =
    flag || process.env.EXA_API_KEY || (await getSecret('EXA_API_KEY'));
  if (!apiKey) {
    throw new UsageError(
      'No API key found. Run "exacli login", use --api-key, or set EXA_API_KEY.'
    );
  }
  return apiKey;
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
