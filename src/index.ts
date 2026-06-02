#!/usr/bin/env bun

import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { createClient } from './client.js';
import * as search from './commands/search.js';
import * as contents from './commands/contents.js';
import * as similar from './commands/similar.js';
import * as answer from './commands/answer.js';
import * as research from './commands/research.js';
import { getSecret } from './auth/keychain.js';
import * as loginCmd from './cli/commands/login.js';
import * as logoutCmd from './cli/commands/logout.js';
import * as format from './formatters/markdown.js';
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
  isValidLivecrawl,
} from './utils/validation.js';

const VERSION = pkg.version;

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
  login                    Store API key locally
  logout                   Remove stored API key

Global Options:
  --api-key <key>          Exa API key (or EXA_API_KEY env var)
  --json                   Output raw JSON instead of markdown
  --version                Show version information
  -h, --help              Show this help message

Authentication Options:
  --skip-validation        Skip API key validation on login

Search Options:
  --num-results <n>        Number of results (default: 10)
  --type <type>            Search type: auto, fast, instant, keyword, neural,
                           hybrid, deep-lite, deep, deep-reasoning
  --category <category>    Filter by category
  --include-domains <list> Comma-separated domain list
  --exclude-domains <list> Comma-separated domain list
  --include-text <list>    Required text (max 1 string, 5 words)
  --exclude-text <list>    Forbidden text (max 1 string, 5 words)
  --start-date <date>     Start published date (ISO format)
  --end-date <date>       End published date (ISO format)
  --start-crawl-date <date>  Start crawl date (ISO format)
  --end-crawl-date <date>    End crawl date (ISO format)
  --user-location <cc>     Two-letter ISO country code (e.g. US)
  --moderation             Enable safety filtering
  --autoprompt             Use autoprompt
  --additional-queries <list>  Alternative queries (deep search types only)

Content Options (search, contents, similar):
  --text                   Include text content
  --max-characters <n>     Limit text to n characters
  --highlights             Include highlights
  --summary                Include summary
  --livecrawl <mode>       Livecrawl: never, fallback, always, auto, preferred
  --livecrawl-timeout <ms> Livecrawl timeout in ms
  --max-age-hours <n>      Max cache age (0 = always fresh, -1 = cache only)
  --subpages <n>           Number of subpages per result
  --subpage-target <list>  Text to match/rank subpages
  --extras-links <n>       Include n links per result
  --extras-image-links <n> Include n image links per result

Answer Options:
  --model <exa>            Model to use
  --stream                 Stream the response
  --system-prompt <text>   System prompt
  --user-location <cc>     Two-letter ISO country code (e.g. US)

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
      'include-text': { type: 'string' },
      'exclude-text': { type: 'string' },
      'start-date': { type: 'string' },
      'end-date': { type: 'string' },
      'start-crawl-date': { type: 'string' },
      'end-crawl-date': { type: 'string' },
      'user-location': { type: 'string' },
      'additional-queries': { type: 'string' },
      moderation: { type: 'boolean' },
      autoprompt: { type: 'boolean' },
      livecrawl: { type: 'string' },
      'livecrawl-timeout': { type: 'string' },
      'max-characters': { type: 'string' },
      subpages: { type: 'string' },
      'subpage-target': { type: 'string' },
      'extras-links': { type: 'string' },
      'extras-image-links': { type: 'string' },
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
      'skip-validation': { type: 'boolean' },
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

  const command = positionals[0];
  const args = positionals.slice(1);
  const commandArgs: Record<string, unknown> = { ...values };

  // Commands that don't require a client
  switch (command) {
    case 'login': {
      await loginCmd.login(commandArgs as unknown as loginCmd.LoginArgs);
      return;
    }
    case 'logout': {
      await logoutCmd.logout();
      return;
    }
  }

  const client = createClient(await resolveApiKey(values));

  switch (command) {
    case 'search': {
      requireArgs(args, 'search', 'a query argument');
      if (commandArgs.type && !isValidSearchType(commandArgs.type)) {
        console.error(
          'Error: --type must be one of: auto, fast, instant, keyword, neural, hybrid, deep-lite, deep, deep-reasoning'
        );
        process.exit(1);
      }
      if (commandArgs.livecrawl && !isValidLivecrawl(commandArgs.livecrawl)) {
        console.error(
          'Error: --livecrawl must be one of: never, fallback, always, auto, preferred'
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
      if (commandArgs.livecrawl && !isValidLivecrawl(commandArgs.livecrawl)) {
        console.error(
          'Error: --livecrawl must be one of: never, fallback, always, auto, preferred'
        );
        process.exit(1);
      }
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
      if (commandArgs.livecrawl && !isValidLivecrawl(commandArgs.livecrawl)) {
        console.error(
          'Error: --livecrawl must be one of: never, fallback, always, auto, preferred'
        );
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
        console.error('Error: --model must be: exa');
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

async function resolveApiKey(values: Record<string, unknown>): Promise<string> {
  if (values['api-key'] && typeof values['api-key'] === 'string') {
    return values['api-key'];
  }

  if (process.env.EXA_API_KEY) {
    return process.env.EXA_API_KEY;
  }

  const keychainKey = await getSecret('EXA_API_KEY');
  if (keychainKey) {
    return keychainKey;
  }

  console.error(
    'Error: No API key found. Run "exacli login", use --api-key, or set EXA_API_KEY environment variable.'
  );
  process.exit(1);
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
  console.error(format.formatError(error));
  process.exit(1);
});
