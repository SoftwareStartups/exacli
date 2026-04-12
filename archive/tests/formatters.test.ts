import { describe, test, expect } from 'bun:test';
import {
  formatSearchResults,
  formatAnswerResponse,
  formatResearchTask,
  formatError,
  formatSuccess,
} from '../src/formatters/markdown.js';

describe('formatSearchResults', () => {
  const mockSearchResponse = {
    requestId: 'test-123',
    costDollars: { total: 0.05 },
    results: [
      {
        title: 'Test Result',
        url: 'https://example.com',
        id: 'https://example.com',
        publishedDate: '2024-01-15',
        author: 'Test Author',
        score: 0.95,
        text: 'This is the content',
        highlights: ['highlight 1', 'highlight 2'],
        highlightScores: [0.9, 0.8],
        summary: 'This is a summary',
      },
    ],
  };

  test('formats search results in markdown', async () => {
    const output = await formatSearchResults(mockSearchResponse);
    expect(output).toContain('# Search Results');
    expect(output).toContain('Test Result');
    expect(output).toContain('https://example.com');
    expect(output).toContain('test-123');
    expect(output).toContain('$0.0500');
    expect(output).toContain('Test Author');
    expect(output).toContain('0.950');
    expect(output).toContain('This is the content');
    expect(output).toContain('highlight 1');
    expect(output).toContain('This is a summary');
  });

  test('returns JSON when json option is true', async () => {
    const output = await formatSearchResults(mockSearchResponse, {
      json: true,
    });
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.requestId).toBe('test-123');
  });

  test('handles empty results', async () => {
    const emptyResponse = { requestId: 'test-456', results: [] };
    const output = await formatSearchResults(emptyResponse);
    expect(output).toContain('No results found');
  });

  test('handles results without optional fields', async () => {
    const minimalResponse = {
      results: [
        {
          title: null,
          url: 'https://example.com',
          id: 'https://example.com',
        },
      ],
    };
    const output = await formatSearchResults(minimalResponse);
    expect(output).toContain('Untitled');
  });

  test('returns TOON when toon option is true', async () => {
    const output = await formatSearchResults(mockSearchResponse, {
      toon: true,
    });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output.startsWith('#')).toBe(false); // not markdown
    expect(() => JSON.parse(output)).toThrow(); // not JSON
  });
});

describe('formatAnswerResponse', () => {
  const mockAnswerResponse = {
    requestId: 'answer-123',
    costDollars: { total: 0.02 },
    answer: 'This is the answer',
    citations: [
      { title: 'Source 1', url: 'https://source1.com' },
      { title: null, url: 'https://source2.com' },
    ],
  };

  test('formats answer in markdown', async () => {
    const output = await formatAnswerResponse(mockAnswerResponse);
    expect(output).toContain('# Answer');
    expect(output).toContain('This is the answer');
    expect(output).toContain('answer-123');
    expect(output).toContain('$0.0200');
    expect(output).toContain('Source 1');
    expect(output).toContain('Untitled');
  });

  test('formats object answers as JSON', async () => {
    const objectResponse = {
      answer: { key: 'value', number: 42 },
      citations: [],
    };
    const output = await formatAnswerResponse(objectResponse);
    expect(output).toContain('```json');
    expect(output).toContain('"key": "value"');
  });

  test('returns JSON when json option is true', async () => {
    const output = await formatAnswerResponse(mockAnswerResponse, {
      json: true,
    });
    const parsed = JSON.parse(output);
    expect(parsed.answer).toBe('This is the answer');
  });

  test('returns TOON when toon option is true', async () => {
    const output = await formatAnswerResponse(mockAnswerResponse, {
      toon: true,
    });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output.startsWith('#')).toBe(false);
    expect(() => JSON.parse(output)).toThrow();
  });
});

describe('formatResearchTask', () => {
  const mockTask = {
    researchId: 'task-123',
    status: 'completed',
    instructions: 'Research something',
    costDollars: {
      total: 0.0059,
      numSearches: 1,
      numPages: 2,
      reasoningTokens: 100,
    },
    output: {
      parsed: { result: 'value' },
      content: 'Raw output content',
    },
    citations: [
      { url: 'https://example.com/1', title: 'Source One' },
      { url: 'https://example.com/2', title: null },
    ],
    events: [
      {
        createdAt: 1705315200000,
        eventType: 'research-start',
        message: 'Started research',
      },
    ],
  };

  test('formats research task in markdown', async () => {
    const output = await formatResearchTask(mockTask);
    expect(output).toContain('# Research Task');
    expect(output).toContain('task-123');
    expect(output).toContain('completed');
    expect(output).toContain('Research something');
    expect(output).toContain('"result": "value"');
    expect(output).toContain('Raw output content');
    expect(output).toContain('research-start');
  });

  test('formats citations as sources', async () => {
    const output = await formatResearchTask(mockTask);
    expect(output).toContain('## Sources');
    expect(output).toContain('[Source One](https://example.com/1)');
    expect(output).toContain('[Untitled](https://example.com/2)');
  });

  test('formats cost breakdown', async () => {
    const output = await formatResearchTask(mockTask);
    expect(output).toContain('$0.0059');
    expect(output).toContain('1 searches');
    expect(output).toContain('2 pages');
    expect(output).toContain('100 reasoning tokens');
  });

  test('handles tasks without output or events', async () => {
    const minimalTask = {
      researchId: 'task-456',
      status: 'pending',
    };
    const output = await formatResearchTask(minimalTask);
    expect(output).toContain('task-456');
    expect(output).toContain('pending');
    expect(output).not.toContain('## Output');
    expect(output).not.toContain('## Events');
  });

  test('returns JSON when json option is true', async () => {
    const output = await formatResearchTask(mockTask, { json: true });
    const parsed = JSON.parse(output);
    expect(parsed.researchId).toBe('task-123');
  });

  test('returns TOON when toon option is true', async () => {
    const output = await formatResearchTask(mockTask, { toon: true });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output.startsWith('#')).toBe(false);
    expect(() => JSON.parse(output)).toThrow();
  });
});

describe('formatError', () => {
  test('formats Error instances', async () => {
    const error = new Error('Something went wrong');
    expect(await formatError(error)).toBe('Error: Something went wrong');
  });

  test('formats non-Error values', async () => {
    expect(await formatError('string error')).toBe('Error: string error');
    expect(await formatError(42)).toBe('Error: 42');
    expect(await formatError(null)).toBe('Error: null');
    expect(await formatError(undefined)).toBe('Error: undefined');
  });

  test('returns TOON when toon option is true', async () => {
    const output = await formatError(new Error('Something went wrong'), {
      toon: true,
    });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output.startsWith('Error:')).toBe(false);
  });
});

describe('formatSuccess', () => {
  test('formats success messages', async () => {
    expect(await formatSuccess('Task completed')).toBe('[OK] Task completed');
    expect(await formatSuccess('Operation successful')).toBe(
      '[OK] Operation successful'
    );
  });

  test('returns TOON when toon option is true', async () => {
    const output = await formatSuccess('Task completed', { toon: true });
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output.startsWith('[OK]')).toBe(false);
  });
});
