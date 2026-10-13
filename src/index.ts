#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { getSecret } from './auth/keychain.js';
import * as loginCmd from './cli/commands/login.js';
import * as logoutCmd from './cli/commands/logout.js';
import { createClient } from './client.js';
import * as agent from './commands/agent.js';
import { answer } from './commands/answer.js';
import * as batch from './commands/batch.js';
import { contents } from './commands/contents.js';
import * as monitor from './commands/monitor.js';
import { search } from './commands/search.js';
import { similar } from './commands/similar.js';
import {
  BOOLEAN_FLAGS,
  type CliArgs,
  type Handler,
  MULTIPLE_FLAGS,
  STRING_FLAGS,
} from './commands/types.js';
import * as websets from './commands/websets.js';
import { COMMAND_HELP, MAIN_HELP } from './help.js';
import { exitOnBrokenPipe, runCommand } from './utils/commands.js';
import { UsageError } from './utils/validation.js';

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
  webset: websets.websets,
  'webset-search': websets.websetSearches,
  'webset-enrichment': websets.websetEnrichments,
  'webset-monitor': websets.websetMonitors,
  'webset-import': websets.websetImports,
  'webset-webhook': websets.websetWebhooks,
  'webset-event': websets.websetEvents,
  team: websets.team,
};

const RETIRED_COMMANDS = new Set([
  'research',
  'research-status',
  'research-list',
]);

interface OptionSpec {
  type: 'boolean' | 'string';
  short?: string;
  multiple?: boolean;
}

const OPTIONS: Record<string, OptionSpec> = {
  ...Object.fromEntries(BOOLEAN_FLAGS.map((f) => [f, { type: 'boolean' }])),
  ...Object.fromEntries(STRING_FLAGS.map((f) => [f, { type: 'string' }])),
  ...Object.fromEntries(
    MULTIPLE_FLAGS.map((f) => [f, { type: 'string', multiple: true }])
  ),
  help: { type: 'boolean', short: 'h' },
};

function exitWithUsage(message: string, help: string, json?: boolean): never {
  if (json) {
    console.log(
      JSON.stringify({ ok: false, error: message, code: 'USAGE_ERROR' })
    );
  } else {
    console.error(`Error: ${message}`);
    console.error(help);
  }
  process.exit(1);
}

async function main(): Promise<void> {
  exitOnBrokenPipe();
  const argv = Bun.argv.slice(2);
  let args: CliArgs;
  let positionalArgs: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: true,
    });
    args = parsed.values as CliArgs;
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
      COMMAND_HELP.agent ?? MAIN_HELP,
      args.json
    );
  }

  const entry = Object.hasOwn(COMMANDS, command)
    ? COMMANDS[command]
    : undefined;
  if (!entry) {
    exitWithUsage(`Unknown command "${command}"`, MAIN_HELP, args.json);
  }

  let handler: Handler;
  let positionals = rest;
  if (typeof entry === 'function') {
    handler = entry;
  } else {
    const [sub, ...subRest] = rest;
    const subHandler =
      sub && Object.hasOwn(entry, sub) ? entry[sub] : undefined;
    if (!subHandler) {
      exitWithUsage(
        sub
          ? `Unknown ${command} subcommand "${sub}"`
          : `${command} requires a subcommand`,
        COMMAND_HELP[command] ?? MAIN_HELP,
        args.json
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
