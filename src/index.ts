#!/usr/bin/env bun

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from './client.js';
import * as search from './commands/search.js';
import * as contents from './commands/contents.js';
import * as similar from './commands/similar.js';
import * as answer from './commands/answer.js';
import * as research from './commands/research.js';
import type {
  SearchCommandArgs,
  SimilarCommandArgs,
  ContentsCommandArgs,
  AnswerCommandArgs,
  ResearchCreateArgs,
  ResearchStatusArgs,
  ResearchListArgs,
} from './commands/types.js';
import {
  isValidSearchType,
  isValidAnswerModel,
  isValidResearchModel,
} from './utils/validation.js';

function readVersion(): string {
  try {
    const pkgPath = path.join(import.meta.dir, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}

const VERSION = readVersion();

const HELP_TEXT = `
Exacli - AI-powered search and content retrieval

Usage: exacli <command> [options] [arguments]

Commands:
  search <query>           Search the web
  contents <url...>         Get contents of URLs
  similar <url>             Find similar pages
  answer <query>            Get AI-powered answers
  research <instructions>   Create a research task
  research-status <id>      Check research task status
  research-list             List research tasks

Global Options:
  --api-key <key>          Exa API key (or EXA_API_KEY env var)
  --json                   Output raw JSON instead of markdown
  --version                Show version information
  -h, --help              Show this help message

Search Options:
  --num-results <n>        Number of results (default: 10)
  --type <auto|fast|deep|instant>  Search type
  --text                   Include text content
  --highlights             Include highlights
  --summary                Include summary
  --category <category>    Filter by category
  --include-domains <list> Comma-separated domain list
  --exclude-domains <list> Comma-separated domain list
  --start-date <date>     Start date (ISO format)
  --end-date <date>       End date (ISO format)
  --autoprompt             Use autoprompt

Answer Options:
  --model <exa|exa-pro>      Model to use
  --stream                 Stream the response
  --system-prompt <text>   System prompt

Research Options:
  --model <fast|regular|pro>  Research model
  --poll                   Poll until completion
  --poll-interval <ms>     Polling interval (default: 1000)
  --timeout <ms>           Timeout in ms (default: 600000)
  --limit <n>              Number of tasks to list
  --cursor <token>         Pagination cursor

Examples:
  exacli search "AI startups" --num-results 5 --text
  exacli contents "https://example.com" --text
  exacli answer "What is quantum computing?"
  exacli similar "https://example.com" --exclude-source-domain
  exacli research "Latest AI developments" --poll
  exacli research-status abc-123
`;

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'api-key': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
      'num-results': { type: 'string' },
      type: { type: 'string' },
      text: { type: 'boolean' },
      highlights: { type: 'boolean' },
      summary: { type: 'boolean' },
      category: { type: 'string' },
      'include-domains': { type: 'string' },
      'exclude-domains': { type: 'string' },
      'start-date': { type: 'string' },
      'end-date': { type: 'string' },
      autoprompt: { type: 'boolean' },
      model: { type: 'string' },
      stream: { type: 'boolean' },
      'system-prompt': { type: 'string' },
      poll: { type: 'boolean' },
      'poll-interval': { type: 'string' },
      timeout: { type: 'string' },
      limit: { type: 'string' },
      cursor: { type: 'string' },
      'exclude-source-domain': { type: 'boolean' },
      'max-age-hours': { type: 'string' },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.version) {
    console.log(`exacli v${VERSION}`);
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const client = createClient(resolveApiKey(values));
  const command = positionals[0];
  const args = positionals.slice(1);
  const commandArgs: Record<string, unknown> = { ...values };

  switch (command) {
    case 'search': {
      requireArgs(args, 'search', 'a query argument');
      if (commandArgs.type && !isValidSearchType(commandArgs.type)) {
        console.error(
          'Error: --type must be one of: auto, fast, deep, instant'
        );
        process.exit(1);
      }
      const query = args.join(' ');
      await search.search(
        client,
        query,
        commandArgs as unknown as SearchCommandArgs
      );
      break;
    }

    case 'contents': {
      requireArgs(args, 'contents', 'at least one URL');
      await contents.contents(
        client,
        args,
        commandArgs as unknown as ContentsCommandArgs
      );
      break;
    }

    case 'similar': {
      const url = args[0];
      if (!url) {
        console.error('Error: similar requires a URL argument');
        process.exit(1);
      }
      await similar.similar(
        client,
        url,
        commandArgs as unknown as SimilarCommandArgs
      );
      break;
    }

    case 'answer': {
      requireArgs(args, 'answer', 'a query argument');
      if (commandArgs.model && !isValidAnswerModel(commandArgs.model)) {
        console.error('Error: --model must be one of: exa, exa-pro');
        process.exit(1);
      }
      const query = args.join(' ');
      await answer.answer(
        client,
        query,
        commandArgs as unknown as AnswerCommandArgs
      );
      break;
    }

    case 'research': {
      requireArgs(args, 'research', 'instructions argument');
      if (commandArgs.model && !isValidResearchModel(commandArgs.model)) {
        console.error('Error: --model must be one of: fast, regular, pro');
        process.exit(1);
      }
      const instructions = args.join(' ');
      await research.researchCreate(
        client,
        instructions,
        commandArgs as unknown as ResearchCreateArgs
      );
      break;
    }

    case 'research-status': {
      const researchId = args[0];
      if (!researchId) {
        console.error('Error: research-status requires a task ID');
        process.exit(1);
      }
      await research.researchStatus(
        client,
        researchId,
        commandArgs as unknown as ResearchStatusArgs
      );
      break;
    }

    case 'research-list': {
      await research.researchList(
        client,
        commandArgs as unknown as ResearchListArgs
      );
      break;
    }

    default: {
      console.error(`Error: Unknown command "${command}"`);
      console.log(HELP_TEXT);
      process.exit(1);
    }
  }
}

function resolveApiKey(values: Record<string, unknown>): string {
  const apiKey = values['api-key'] || process.env.EXA_API_KEY;
  if (!apiKey || typeof apiKey !== 'string') {
    console.error(
      'Error: EXA_API_KEY not set. Use --api-key or set EXA_API_KEY environment variable.'
    );
    process.exit(1);
  }
  return apiKey;
}

function requireArgs(
  args: string[],
  command: string,
  description: string
): void {
  if (args.length === 0) {
    console.error(`Error: ${command} requires ${description}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
