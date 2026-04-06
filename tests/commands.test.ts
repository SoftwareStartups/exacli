import { describe, test, expect, mock } from 'bun:test';
import type { ExaClient } from '../src/client.js';
import * as search from '../src/commands/search.js';
import * as contents from '../src/commands/contents.js';
import * as similar from '../src/commands/similar.js';
import * as answer from '../src/commands/answer.js';
import * as research from '../src/commands/research.js';

function stubProcessExit() {
  const originalExit = process.exit;
  process.exit = mock(() => {}) as unknown as (code?: number) => never;
  return () => {
    process.exit = originalExit;
  };
}

describe('search command', () => {
  const mockClient = {
    search: mock(() => ({ results: [] })),
    searchAndContents: mock(() => ({ results: [] })),
  } as unknown as ExaClient;

  test('calls search with numResults option', async () => {
    const restore = stubProcessExit();

    await search.search(mockClient, 'test query', {
      'num-results': '10',
      text: false,
      highlights: false,
      summary: false,
    });

    restore();
    expect(
      (mockClient as unknown as { search: { mock: unknown } }).search
    ).toHaveBeenCalled();
  });

  test('calls searchAndContents when content options are present', async () => {
    const restore = stubProcessExit();

    await search.search(mockClient, 'test query', {
      text: true,
      highlights: false,
      summary: false,
    });

    restore();
    expect(
      (
        mockClient as unknown as {
          searchAndContents: { mock: unknown };
        }
      ).searchAndContents
    ).toHaveBeenCalled();
  });

  test('handles include-domains and exclude-domains', async () => {
    const restore = stubProcessExit();

    await search.search(mockClient, 'test query', {
      'include-domains': 'example.com,test.com',
      'exclude-domains': 'spam.com',
      text: false,
      highlights: false,
      summary: false,
    });

    restore();
    expect(
      (mockClient as unknown as { search: { mock: unknown } }).search
    ).toHaveBeenCalled();
  });
});

describe('contents command', () => {
  test('validates URLs before processing', async () => {
    const mockClient = {
      getContents: mock(() => ({ results: [] })),
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await contents.contents(mockClient, ['https://example.com'], {});

    restore();
    expect(
      (mockClient as unknown as { getContents: { mock: unknown } }).getContents
    ).toHaveBeenCalled();
  });

  test('rejects invalid URLs', async () => {
    const mockClient = {
      getContents: mock(() => ({ results: [] })),
    } as unknown as ExaClient;

    const originalExit = process.exit;
    const exitMock = mock(() => {
      throw new Error('process.exit called');
    }) as unknown as (code?: number) => never;
    process.exit = exitMock;

    await expect(
      contents.contents(mockClient, ['not-a-url'], {})
    ).rejects.toThrow('process.exit called');

    process.exit = originalExit;
    expect(
      (mockClient as unknown as { getContents: { mock: unknown } }).getContents
    ).not.toHaveBeenCalled();
  });

  test('handles multiple URLs', async () => {
    const mockClient = {
      getContents: mock(() => ({ results: [] })),
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await contents.contents(
      mockClient,
      ['https://example.com', 'https://test.com'],
      {}
    );

    restore();
    expect(
      (mockClient as unknown as { getContents: { mock: unknown } }).getContents
    ).toHaveBeenCalled();
  });
});

describe('similar command', () => {
  test('calls similar with URL', async () => {
    const mockClient = {
      findSimilar: mock(() => ({ results: [] })),
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await similar.similar(mockClient, 'https://example.com', {});

    restore();
    expect(
      (mockClient as unknown as { findSimilar: { mock: unknown } }).findSimilar
    ).toHaveBeenCalled();
  });
});

describe('answer command', () => {
  test('calls answer without streaming', async () => {
    const mockClient = {
      answer: mock(() => ({ answer: 'test answer' })),
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await answer.answer(mockClient, 'test query', { stream: false });

    restore();
    expect(
      (mockClient as unknown as { answer: { mock: unknown } }).answer
    ).toHaveBeenCalled();
  });

  test('calls streamAnswer when stream is true', async () => {
    const mockClient = {
      streamAnswer: mock(async function* () {
        yield { content: 'test', citations: [] };
      }),
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await answer.answer(mockClient, 'test query', { stream: true });

    restore();
    expect(
      (mockClient as unknown as { streamAnswer: { mock: unknown } })
        .streamAnswer
    ).toHaveBeenCalled();
  });
});

describe('research commands', () => {
  test('researchCreate creates task with instructions', async () => {
    const mockClient = {
      research: {
        create: mock(() => ({
          researchId: 'test-id',
          status: 'in_progress',
        })),
        pollUntilFinished: mock(() => ({
          researchId: 'test-id',
          status: 'completed',
        })),
      },
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await research.researchCreate(mockClient, 'test instructions', {});

    restore();
    expect(
      (
        mockClient as unknown as {
          research: { create: { mock: unknown } };
        }
      ).research.create
    ).toHaveBeenCalled();
  });

  test('researchCreate maps model correctly', async () => {
    const mockClient = {
      research: {
        create: mock(() => ({
          researchId: 'test-id',
          status: 'in_progress',
        })),
      },
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await research.researchCreate(mockClient, 'test instructions', {
      model: 'fast',
    });

    restore();
    expect(
      (
        mockClient as unknown as {
          research: { create: { mock: unknown } };
        }
      ).research.create
    ).toHaveBeenCalledWith({
      instructions: 'test instructions',
      model: 'exa-research-fast',
    });
  });

  test('researchStatus fetches task by ID', async () => {
    const mockClient = {
      research: {
        get: mock(() => ({ researchId: 'test-id', status: 'completed' })),
      },
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await research.researchStatus(mockClient, 'test-id', {});

    restore();
    expect(
      (
        mockClient as unknown as {
          research: { get: { mock: unknown } };
        }
      ).research.get
    ).toHaveBeenCalledWith('test-id');
  });

  test('researchList fetches all tasks', async () => {
    const mockClient = {
      research: {
        list: mock(() => ({ data: [], hasMore: false })),
      },
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await research.researchList(mockClient, {});

    restore();
    expect(
      (
        mockClient as unknown as {
          research: { list: { mock: unknown } };
        }
      ).research.list
    ).toHaveBeenCalled();
  });

  test('researchList respects limit and cursor', async () => {
    const mockClient = {
      research: {
        list: mock(() => ({ data: [], hasMore: false })),
      },
    } as unknown as ExaClient;

    const restore = stubProcessExit();

    await research.researchList(mockClient, {
      limit: '10',
      cursor: 'test-cursor',
    });

    restore();
    expect(
      (
        mockClient as unknown as {
          research: { list: { mock: unknown } };
        }
      ).research.list
    ).toHaveBeenCalledWith({
      limit: 10,
      cursor: 'test-cursor',
    });
  });
});
