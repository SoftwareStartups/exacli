import { describe, test, expect, mock } from 'bun:test';
import * as search from '../src/commands/search.js';
import * as contents from '../src/commands/contents.js';
import * as similar from '../src/commands/similar.js';
import * as answer from '../src/commands/answer.js';
import * as research from '../src/commands/research.js';
import {
  hasContentOptions,
  applyContentOptions,
  dedupCitations,
  runCommand,
} from '../src/utils/commands.js';
import { asExaClient } from './helpers/mock-client.js';
import { stubProcessExit } from './helpers/process-exit.js';

describe('search command', () => {
  test('passes numResults option to search', async () => {
    const searchMock = mock(() => ({ results: [] }));
    const client = asExaClient({ search: searchMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', { 'num-results': '10' });

    restore();
    expect(searchMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({ numResults: 10 })
    );
  });

  test('routes to searchAndContents when text option is set', async () => {
    const searchAndContentsMock = mock(() => ({ results: [] }));
    const client = asExaClient({ searchAndContents: searchAndContentsMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', { text: true });

    restore();
    expect(searchAndContentsMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({ text: true })
    );
  });

  test('passes include-domains and exclude-domains as parsed lists', async () => {
    const searchMock = mock(() => ({ results: [] }));
    const client = asExaClient({ search: searchMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', {
      'include-domains': 'example.com,test.com',
      'exclude-domains': 'spam.com',
    });

    restore();
    expect(searchMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        includeDomains: ['example.com', 'test.com'],
        excludeDomains: ['spam.com'],
      })
    );
  });

  test('maps text/crawl filters, user location, and moderation', async () => {
    const searchMock = mock(() => ({ results: [] }));
    const client = asExaClient({ search: searchMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', {
      'include-text': 'GPT',
      'exclude-text': 'spam',
      'start-crawl-date': '2024-01-01',
      'end-crawl-date': '2024-12-31',
      'user-location': 'US',
      moderation: true,
    });

    restore();
    expect(searchMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        includeText: ['GPT'],
        excludeText: ['spam'],
        startCrawlDate: '2024-01-01',
        endCrawlDate: '2024-12-31',
        userLocation: 'US',
        moderation: true,
      })
    );
  });

  test('maps additional-queries as a parsed list', async () => {
    const searchMock = mock(() => ({ results: [] }));
    const client = asExaClient({ search: searchMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', {
      type: 'deep',
      'additional-queries': 'ml,neural networks',
    });

    restore();
    expect(searchMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        type: 'deep',
        additionalQueries: ['ml', 'neural networks'],
      })
    );
  });

  test('routes to searchAndContents for content-only options like livecrawl', async () => {
    const searchAndContentsMock = mock(() => ({ results: [] }));
    const client = asExaClient({ searchAndContents: searchAndContentsMock });
    const restore = stubProcessExit();

    await search.search(client, 'test query', { livecrawl: 'always' });

    restore();
    expect(searchAndContentsMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({ livecrawl: 'always' })
    );
  });
});

describe('contents command', () => {
  test('passes URL list to getContents for valid URLs', async () => {
    const getContentsMock = mock(() => ({ results: [] }));
    const client = asExaClient({ getContents: getContentsMock });
    const restore = stubProcessExit();

    await contents.contents(
      client,
      ['https://example.com', 'https://test.com'],
      {}
    );

    restore();
    expect(getContentsMock).toHaveBeenCalledWith(
      ['https://example.com', 'https://test.com'],
      expect.any(Object)
    );
  });

  test('exits without calling getContents when a URL is invalid', async () => {
    const getContentsMock = mock(() => ({ results: [] }));
    const client = asExaClient({ getContents: getContentsMock });
    const restore = stubProcessExit();

    await expect(contents.contents(client, ['not-a-url'], {})).rejects.toThrow(
      'process.exit called'
    );

    restore();
    expect(getContentsMock).not.toHaveBeenCalled();
  });
});

describe('similar command', () => {
  test('passes URL to findSimilar', async () => {
    const findSimilarMock = mock(() => ({ results: [] }));
    const client = asExaClient({ findSimilar: findSimilarMock });
    const restore = stubProcessExit();

    await similar.similar(client, 'https://example.com', {});

    restore();
    expect(findSimilarMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.any(Object)
    );
  });

  test('routes to findSimilarAndContents when content options are set', async () => {
    const findSimilarAndContentsMock = mock(() => ({ results: [] }));
    const client = asExaClient({
      findSimilarAndContents: findSimilarAndContentsMock,
    });
    const restore = stubProcessExit();

    await similar.similar(client, 'https://example.com', { text: true });

    restore();
    expect(findSimilarAndContentsMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ text: true })
    );
  });
});

describe('answer command', () => {
  test('passes query to answer when not streaming', async () => {
    const answerMock = mock(() => ({ answer: 'test answer' }));
    const client = asExaClient({ answer: answerMock });
    const restore = stubProcessExit();

    await answer.answer(client, 'test query', { stream: false });

    restore();
    expect(answerMock).toHaveBeenCalledWith('test query', expect.any(Object));
  });

  test('routes to streamAnswer when stream flag is true', async () => {
    const streamAnswerMock = mock(async function* () {
      yield { content: 'test', citations: [] };
    });
    const client = asExaClient({ streamAnswer: streamAnswerMock });
    const restore = stubProcessExit();

    await answer.answer(client, 'test query', { stream: true });

    restore();
    expect(streamAnswerMock).toHaveBeenCalledWith(
      'test query',
      expect.any(Object)
    );
  });

  test('maps system prompt and user location', async () => {
    const answerMock = mock(() => ({ answer: 'test answer' }));
    const client = asExaClient({ answer: answerMock });
    const restore = stubProcessExit();

    await answer.answer(client, 'test query', {
      'system-prompt': 'Be concise',
      'user-location': 'US',
    });

    restore();
    expect(answerMock).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        systemPrompt: 'Be concise',
        userLocation: 'US',
      })
    );
  });
});

describe('research commands', () => {
  test('researchCreate maps model alias to API model name', async () => {
    const createMock = mock(() => ({
      researchId: 'test-id',
      status: 'in_progress',
    }));
    const client = asExaClient({ research: { create: createMock } });
    const restore = stubProcessExit();

    await research.researchCreate(client, 'test instructions', {
      model: 'fast',
    });

    restore();
    expect(createMock).toHaveBeenCalledWith({
      instructions: 'test instructions',
      model: 'exa-research-fast',
    });
  });

  test('researchStatus requests events for the given ID', async () => {
    const getMock = mock(() => ({
      researchId: 'test-id',
      status: 'completed',
    }));
    const client = asExaClient({ research: { get: getMock } });
    const restore = stubProcessExit();

    await research.researchStatus(client, 'test-id', {});

    restore();
    expect(getMock).toHaveBeenCalledWith('test-id', { events: true });
  });

  test('researchList forwards limit and cursor as parsed values', async () => {
    const listMock = mock(() => ({ data: [], hasMore: false }));
    const client = asExaClient({ research: { list: listMock } });
    const restore = stubProcessExit();

    await research.researchList(client, {
      limit: '10',
      cursor: 'test-cursor',
    });

    restore();
    expect(listMock).toHaveBeenCalledWith({
      limit: 10,
      cursor: 'test-cursor',
    });
  });
});

describe('hasContentOptions', () => {
  test('returns true when text is true', () => {
    expect(hasContentOptions({ text: true })).toBe(true);
  });

  test('returns true when highlights is true', () => {
    expect(hasContentOptions({ highlights: true })).toBe(true);
  });

  test('returns true when summary is true', () => {
    expect(hasContentOptions({ summary: true })).toBe(true);
  });

  test('returns true for content-only options', () => {
    expect(hasContentOptions({ livecrawl: 'always' })).toBe(true);
    expect(hasContentOptions({ subpages: '2' })).toBe(true);
    expect(hasContentOptions({ 'max-characters': '500' })).toBe(true);
    expect(hasContentOptions({ 'max-age-hours': '24' })).toBe(true);
    expect(hasContentOptions({ 'extras-links': '5' })).toBe(true);
  });

  test('returns false when no content options set', () => {
    expect(hasContentOptions({})).toBe(false);
  });

  test('returns false when all options are false', () => {
    expect(
      hasContentOptions({ text: false, highlights: false, summary: false })
    ).toBe(false);
  });
});

describe('applyContentOptions', () => {
  test('applies text, highlights, and summary when true', () => {
    const options: Record<string, unknown> = {};
    applyContentOptions(options, {
      text: true,
      highlights: true,
      summary: true,
    });
    expect(options).toEqual({ text: true, highlights: true, summary: true });
  });

  test('does not apply false options', () => {
    const options: Record<string, unknown> = {};
    applyContentOptions(options, { text: false, highlights: true });
    expect(options).toEqual({ highlights: true });
  });

  test('does nothing for empty args', () => {
    const options: Record<string, unknown> = { existing: 'value' };
    applyContentOptions(options, {});
    expect(options).toEqual({ existing: 'value' });
  });

  test('promotes text to an object when max-characters is set', () => {
    const options: Record<string, unknown> = {};
    applyContentOptions(options, { text: true, 'max-characters': '500' });
    expect(options).toEqual({ text: { maxCharacters: 500 } });
  });

  test('maps livecrawl, subpages, and max-age-hours', () => {
    const options: Record<string, unknown> = {};
    applyContentOptions(options, {
      livecrawl: 'always',
      'livecrawl-timeout': '5000',
      'max-age-hours': '24',
      subpages: '3',
      'subpage-target': 'about,pricing',
    });
    expect(options).toEqual({
      livecrawl: 'always',
      livecrawlTimeout: 5000,
      maxAgeHours: 24,
      subpages: 3,
      subpageTarget: ['about', 'pricing'],
    });
  });

  test('builds extras from links and image links', () => {
    const options: Record<string, unknown> = {};
    applyContentOptions(options, {
      'extras-links': '5',
      'extras-image-links': '2',
    });
    expect(options).toEqual({ extras: { links: 5, imageLinks: 2 } });
  });
});

describe('dedupCitations', () => {
  test('adds new citations', () => {
    const existing = [{ url: 'https://a.com', title: 'A' }];
    dedupCitations(existing, [{ url: 'https://b.com', title: 'B' }]);
    expect(existing).toHaveLength(2);
    expect(existing[1]?.url).toBe('https://b.com');
  });

  test('skips duplicate URLs', () => {
    const existing = [{ url: 'https://a.com', title: 'A' }];
    dedupCitations(existing, [{ url: 'https://a.com', title: 'A duplicate' }]);
    expect(existing).toHaveLength(1);
  });

  test('handles undefined incoming', () => {
    const existing = [{ url: 'https://a.com', title: 'A' }];
    dedupCitations(existing, undefined);
    expect(existing).toHaveLength(1);
  });
});

describe('runCommand', () => {
  test('executes function successfully', async () => {
    let called = false;
    await runCommand(async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  test('calls process.exit(1) on error', async () => {
    const restore = stubProcessExit();

    await expect(
      runCommand(async () => {
        throw new Error('test error');
      })
    ).rejects.toThrow('process.exit called');

    restore();
  });
});
