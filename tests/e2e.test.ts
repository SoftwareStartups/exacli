import { describe, test, beforeAll } from 'bun:test';
import { createClient } from '../src/client.js';
import * as search from '../src/commands/search.js';
import * as contents from '../src/commands/contents.js';
import * as similar from '../src/commands/similar.js';
import * as answer from '../src/commands/answer.js';
import * as research from '../src/commands/research.js';
import { stubProcessExit } from './helpers/process-exit.js';

const apiKey = process.env.EXA_API_KEY;
let client: ReturnType<typeof createClient>;

async function withRealApi(fn: () => Promise<void>): Promise<void> {
  const restore = stubProcessExit();
  try {
    await fn();
  } finally {
    restore();
  }
}

describe('E2E Tests - Real API', () => {
  beforeAll(() => {
    if (!apiKey) {
      console.warn(
        'Skipping E2E tests: EXA_API_KEY environment variable not set'
      );
      process.exit(0);
    }
    client = createClient(apiKey);
  });

  describe('search command', () => {
    test('performs basic web search', async () => {
      await withRealApi(() =>
        search.search(client, 'artificial intelligence', {})
      );
    }, 30000);

    test('performs search with content options', async () => {
      await withRealApi(() =>
        search.search(client, 'machine learning', {
          text: true,
          'num-results': '3',
        })
      );
    }, 30000);

    test('performs search with domain filtering', async () => {
      await withRealApi(() =>
        search.search(client, 'AI research', {
          'include-domains': 'arxiv.org',
          'num-results': '2',
        })
      );
    }, 30000);
  });

  describe('contents command', () => {
    test('extracts content from valid URL', async () => {
      await withRealApi(() =>
        contents.contents(client, ['https://example.com'], {})
      );
    }, 30000);

    test('extracts content with text option', async () => {
      await withRealApi(() =>
        contents.contents(client, ['https://example.com'], { text: true })
      );
    }, 30000);
  });

  describe('similar command', () => {
    test('finds similar pages', async () => {
      await withRealApi(() =>
        similar.similar(client, 'https://example.com', {})
      );
    }, 30000);

    test('finds similar pages with exclude-source-domain', async () => {
      await withRealApi(() =>
        similar.similar(client, 'https://example.com', {
          'exclude-source-domain': true,
        })
      );
    }, 30000);
  });

  describe('answer command', () => {
    test('gets AI answer without streaming', async () => {
      await withRealApi(() =>
        answer.answer(client, 'What is machine learning?', { stream: false })
      );
    }, 30000);

    test('gets AI answer with streaming', async () => {
      await withRealApi(() =>
        answer.answer(client, 'What is quantum computing?', { stream: true })
      );
    }, 30000);
  });

  describe('research commands', () => {
    test('creates research task', async () => {
      await withRealApi(() =>
        research.researchCreate(client, 'Latest developments in AI', {})
      );
    }, 60000);

    test('creates research task with fast model', async () => {
      await withRealApi(() =>
        research.researchCreate(client, 'What is neural networks?', {
          model: 'fast',
        })
      );
    }, 60000);

    test('lists research tasks', async () => {
      await withRealApi(() => research.researchList(client, {}));
    }, 60000);
  });
});
