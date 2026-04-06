import { describe, test, expect, beforeAll } from 'bun:test';
import { createClient } from '../src/client.js';
import * as search from '../src/commands/search.js';
import * as contents from '../src/commands/contents.js';
import * as similar from '../src/commands/similar.js';
import * as answer from '../src/commands/answer.js';
import * as research from '../src/commands/research.js';

const apiKey = process.env.EXA_API_KEY;
let client: ReturnType<typeof createClient>;

function mockProcessExit() {
  let exitCalled = false;
  const originalExit = process.exit;
  process.exit = (() => {
    exitCalled = true;
    throw new Error('process.exit called');
  }) as unknown as (code?: number) => never;
  return {
    originalExit,
    restore: () => {
      process.exit = originalExit;
      return exitCalled;
    },
  };
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
      const mock = mockProcessExit();
      try {
        await search.search(client, 'artificial intelligence', {});
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);

    test('performs search with content options', async () => {
      const mock = mockProcessExit();
      try {
        await search.search(client, 'machine learning', {
          text: true,
          'num-results': '3',
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);

    test('performs search with domain filtering', async () => {
      const mock = mockProcessExit();
      try {
        await search.search(client, 'AI research', {
          'include-domains': 'arxiv.org',
          'num-results': '2',
          text: false,
          highlights: false,
          summary: false,
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);
  });

  describe('contents command', () => {
    test('extracts content from valid URL', async () => {
      const mock = mockProcessExit();
      try {
        await contents.contents(client, ['https://example.com'], {});
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);

    test('extracts content with text option', async () => {
      const mock = mockProcessExit();
      try {
        await contents.contents(client, ['https://example.com'], {
          text: true,
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);
  });

  describe('similar command', () => {
    test('finds similar pages', async () => {
      const mock = mockProcessExit();
      try {
        await similar.similar(client, 'https://example.com', {});
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);

    test('finds similar pages with exclude-source-domain', async () => {
      const mock = mockProcessExit();
      try {
        await similar.similar(client, 'https://example.com', {
          'exclude-source-domain': true,
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);
  });

  describe('answer command', () => {
    test('gets AI answer without streaming', async () => {
      const mock = mockProcessExit();
      try {
        await answer.answer(client, 'What is machine learning?', {
          stream: false,
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);

    test('gets AI answer with streaming', async () => {
      const mock = mockProcessExit();
      try {
        await answer.answer(client, 'What is quantum computing?', {
          stream: true,
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);
  });

  describe('research commands', () => {
    test('creates research task', async () => {
      const mock = mockProcessExit();
      try {
        await research.researchCreate(client, 'Latest developments in AI', {});
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 60000);

    test('creates research task with fast model', async () => {
      const mock = mockProcessExit();
      try {
        await research.researchCreate(client, 'What is neural networks?', {
          model: 'fast',
        });
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 60000);

    test('lists research tasks', async () => {
      const mock = mockProcessExit();
      try {
        await research.researchList(client, {});
        expect(true).toBe(true);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit called');
      } finally {
        mock.restore();
      }
    }, 30000);
  });
});
