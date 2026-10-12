import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as agent from '../src/commands/agent.js';
import { answer } from '../src/commands/answer.js';
import * as batch from '../src/commands/batch.js';
import { contents } from '../src/commands/contents.js';
import * as monitor from '../src/commands/monitor.js';
import { search } from '../src/commands/search.js';
import { similar } from '../src/commands/similar.js';
import {
  BATCHES_BETA,
  DYNAMIC_HIGHLIGHTS_BETA,
} from '../src/commands/types.js';
import { ExaApiError } from '../src/client.js';
import { runCommand } from '../src/utils/commands.js';
import { UsageError } from '../src/utils/validation.js';
import { mockClient, requestCall } from './helpers/mock-client.js';
import { stubProcessExit } from './helpers/process-exit.js';

let logSpy: ReturnType<typeof spyOn<Console, 'log'>>;
let errorSpy: ReturnType<typeof spyOn<Console, 'error'>>;
let writeSpy: ReturnType<typeof spyOn<typeof process.stdout, 'write'>>;

beforeEach(() => {
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  writeSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  writeSpy.mockRestore();
});

function printedJson(): unknown {
  return JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
}

describe('search', () => {
  test('posts the query with filters and omits unset fields', async () => {
    const m = mockClient(() => ({ results: [] }));

    await search(m.client, ['AI', 'startups'], {
      'num-results': '5',
      type: 'fast',
      'include-domains': 'a.com,b.com',
      objective: 'find seed-stage companies',
      'user-id': 'user_1',
    });

    const [method, path, options] = requestCall(m);
    expect(method).toBe('POST');
    expect(path).toBe('/search');
    expect(options?.body).toEqual({
      query: 'AI startups',
      type: 'fast',
      numResults: 5,
      includeDomains: ['a.com', 'b.com'],
      objective: 'find seed-stage companies',
      userIdentifier: 'user_1',
    });
    expect(options?.headers).toBeUndefined();
  });

  test('nests content options under contents and sends beta headers', async () => {
    const m = mockClient(() => ({ results: [] }));

    await search(m.client, ['q'], {
      highlights: true,
      'dynamic-highlights': true,
    });

    const [, , options] = requestCall(m);
    expect(options?.body).toEqual({
      query: 'q',
      contents: { highlights: { dynamic: true } },
    });
    expect(options?.headers).toEqual({ 'Exa-Beta': DYNAMIC_HIGHLIGHTS_BETA });
  });

  test('passes deep-search synthesis options', async () => {
    const m = mockClient(() => ({ results: [] }));

    await search(m.client, ['q'], {
      type: 'deep',
      'additional-queries': 'a,b',
      'system-prompt': 'prefer primary sources',
      'output-schema': '{"type":"text"}',
      'user-location': 'US',
      moderation: true,
    });

    expect(requestCall(m)[2]?.body).toEqual({
      query: 'q',
      type: 'deep',
      additionalQueries: ['a', 'b'],
      systemPrompt: 'prefer primary sources',
      outputSchema: { type: 'text' },
      userLocation: 'US',
      moderation: true,
    });
  });

  test('rejects additional queries without a deep search type', async () => {
    const m = mockClient();
    await expect(
      search(m.client, ['q'], { 'additional-queries': 'a' })
    ).rejects.toThrow('--additional-queries requires --type deep-lite');
    expect(m.request).not.toHaveBeenCalled();
  });

  test('rejects search types the API no longer accepts', async () => {
    await expect(
      search(mockClient().client, ['q'], { type: 'neural' })
    ).rejects.toThrow(UsageError);
  });

  test('requires a query', async () => {
    await expect(search(mockClient().client, [], {})).rejects.toThrow(
      'Usage: exacli search <query>'
    );
  });

  test('streams synthesized output when --stream has a schema', async () => {
    const m = mockClient(undefined, [
      { data: '{"choices":[{"delta":{"content":"Hello"}}]}' },
      { data: '{"citations":[{"url":"https://a.com","title":"A"}]}' },
      { data: '[DONE]' },
    ]);

    await search(m.client, ['q'], {
      stream: true,
      'output-schema': '{"type":"text"}',
    });

    expect(m.request).not.toHaveBeenCalled();
    const [path, options] = m.stream.mock.calls[0] ?? [];
    expect(path).toBe('/search');
    expect(options?.body).toMatchObject({ query: 'q', stream: true });
    expect(writeSpy).toHaveBeenCalledWith('Hello');
    expect(String(logSpy.mock.calls.at(-1)?.[0])).toContain(
      '[A](https://a.com)'
    );
  });

  test('requires an output schema to stream', async () => {
    await expect(
      search(mockClient().client, ['q'], { stream: true })
    ).rejects.toThrow('--stream requires --output-schema');
  });

  test('prints the ok envelope in --json mode', async () => {
    const m = mockClient(() => ({ requestId: 'r', results: [] }));
    await search(m.client, ['q'], { json: true });
    expect(printedJson()).toEqual({
      ok: true,
      data: { requestId: 'r', results: [] },
    });
  });
});

describe('contents', () => {
  test('posts URLs with top-level content options', async () => {
    const m = mockClient(() => ({ results: [] }));

    await contents(m.client, ['https://a.com', 'https://b.com'], {
      text: true,
      'max-age-hours': '0',
    });

    expect(requestCall(m)).toEqual([
      'POST',
      '/contents',
      {
        body: {
          urls: ['https://a.com', 'https://b.com'],
          text: true,
          maxAgeHours: 0,
        },
        headers: undefined,
      },
    ]);
  });

  test('rejects invalid URLs before calling the API', async () => {
    const m = mockClient();
    await expect(contents(m.client, ['not-a-url'], {})).rejects.toThrow(
      'Invalid URL "not-a-url"'
    );
    expect(m.request).not.toHaveBeenCalled();
  });
});

describe('similar', () => {
  test('posts to /findSimilar with filters and contents', async () => {
    const m = mockClient(() => ({ results: [] }));

    await similar(m.client, ['https://a.com'], {
      'exclude-source-domain': true,
      'num-results': '3',
      summary: true,
    });

    expect(requestCall(m)[1]).toBe('/findSimilar');
    expect(requestCall(m)[2]?.body).toEqual({
      url: 'https://a.com',
      numResults: 3,
      excludeSourceDomain: true,
      contents: { summary: true },
    });
  });
});

describe('answer', () => {
  test('posts the query with model and structured output', async () => {
    const m = mockClient(() => ({ answer: 'Paris', citations: [] }));

    await answer(m.client, ['capital', 'of', 'France'], {
      model: 'exa-pro',
      text: true,
      'system-prompt': 'Be brief',
      'output-schema': '{"type":"object"}',
      'user-id': 'u1',
    });

    expect(requestCall(m)).toEqual([
      'POST',
      '/answer',
      {
        body: {
          query: 'capital of France',
          model: 'exa-pro',
          text: true,
          systemPrompt: 'Be brief',
          outputSchema: { type: 'object' },
          userIdentifier: 'u1',
        },
      },
    ]);
  });

  test('rejects unknown models', async () => {
    await expect(
      answer(mockClient().client, ['q'], { model: 'gpt' })
    ).rejects.toThrow('--model must be one of: exa, exa-pro');
  });

  test('emits NDJSON envelopes when streaming with --json', async () => {
    const m = mockClient(undefined, [
      { data: '{"choices":[{"delta":{"content":"Hi"}}]}' },
      { data: '[DONE]' },
    ]);

    await answer(m.client, ['q'], { stream: true, json: true });

    expect(m.stream.mock.calls[0]?.[0]).toBe('/answer');
    expect(printedJson()).toEqual({
      ok: true,
      data: { choices: [{ delta: { content: 'Hi' } }] },
    });
  });
});

describe('agent', () => {
  test('run maps flags to the Agent API body', async () => {
    const m = mockClient(() => ({ id: 'agent_run_1', status: 'queued' }));

    await agent.agentRun(m.client, ['find', 'startups'], {
      effort: 'ultra',
      'output-schema': '{"type":"object"}',
      input: '{"data":[{"name":"Acme"}]}',
      'previous-run': 'agent_run_0',
      'data-sources': 'fiber,similarweb',
      'max-cost': '25',
      'max-duration': '600',
      metadata: '{"team":"growth"}',
    });

    expect(requestCall(m)).toEqual([
      'POST',
      '/agent/runs',
      {
        body: {
          query: 'find startups',
          effort: 'ultra',
          outputSchema: { type: 'object' },
          input: { data: [{ name: 'Acme' }] },
          previousRunId: 'agent_run_0',
          metadata: { team: 'growth' },
          dataSources: [{ provider: 'fiber' }, { provider: 'similarweb' }],
          budget: { maxCostDollars: 25, maxDurationSeconds: 600 },
        },
      },
    ]);
  });

  test('run --wait polls until the run is terminal', async () => {
    const statuses = ['queued', 'running', 'completed'];
    const m = mockClient((_method, _path) => ({
      id: 'r1',
      status: statuses.shift(),
    }));

    await agent.agentRun(m.client, ['q'], {
      wait: true,
      'poll-interval': '1',
      json: true,
    });

    expect(m.request).toHaveBeenCalledTimes(3);
    expect(requestCall(m, 1).slice(0, 2)).toEqual(['GET', '/agent/runs/r1']);
    expect(printedJson()).toEqual({
      ok: true,
      data: { id: 'r1', status: 'completed' },
    });
  });

  test('run --wait gives up after the timeout', async () => {
    const m = mockClient(() => ({ id: 'r1', status: 'running' }));
    await expect(
      agent.agentRun(m.client, ['q'], {
        wait: true,
        'poll-interval': '1',
        timeout: '0',
      })
    ).rejects.toThrow('Timed out waiting for run r1');
  });

  test('run --stream prints the terminal run', async () => {
    const m = mockClient(undefined, [
      { event: 'agent_run.created', data: '{"id":"r1","status":"queued"}' },
      { event: 'agent_run.source.added', data: '{"url":"https://a.com"}' },
      {
        event: 'agent_run.completed',
        data: '{"id":"r1","status":"completed","output":{"text":"Done"}}',
      },
    ]);

    await agent.agentRun(m.client, ['q'], { stream: true });

    expect(errorSpy.mock.calls.map((c) => c[0])).toEqual([
      'agent_run.created',
      'agent_run.source.added',
    ]);
    expect(String(logSpy.mock.calls.at(-1)?.[0])).toContain('Done');
  });

  test('run rejects unknown effort levels', async () => {
    await expect(
      agent.agentRun(mockClient().client, ['q'], { effort: 'huge' })
    ).rejects.toThrow('--effort must be one of');
  });

  test.each([
    [agent.agentGet, 'GET', '/agent/runs/r%2F1'],
    [agent.agentCancel, 'POST', '/agent/runs/r%2F1/cancel'],
    [agent.agentStop, 'POST', '/agent/runs/r%2F1/stop'],
    [agent.agentDelete, 'DELETE', '/agent/runs/r%2F1'],
  ] as const)('%p calls %s %s with an encoded id', async (fn, method, path) => {
    const m = mockClient(() => ({ id: 'r/1', status: 'cancelled' }));
    await fn(m.client, ['r/1'], {});
    expect(requestCall(m).slice(0, 2)).toEqual([method, path]);
  });

  test('list and events forward pagination', async () => {
    const m = mockClient(() => ({ data: [], hasMore: false }));
    await agent.agentList(m.client, [], { limit: '10', cursor: 'c' });
    await agent.agentEvents(m.client, ['r1'], { limit: '5' });
    expect(requestCall(m, 0)[2]?.query).toEqual({ limit: 10, cursor: 'c' });
    expect(requestCall(m, 1).slice(0, 2)).toEqual([
      'GET',
      '/agent/runs/r1/events',
    ]);
  });
});

describe('monitor', () => {
  test('create builds search, trigger, and webhook objects', async () => {
    const m = mockClient(() => ({ id: 'm1', status: 'active' }));

    await monitor.monitorCreate(m.client, ['AI', 'news'], {
      name: 'ai-news',
      period: '1d',
      'webhook-url': 'https://hooks.example.com/exa',
      'webhook-events': 'monitor.run.completed',
      'num-results': '5',
      highlights: true,
      'output-schema': '{"type":"text"}',
    });

    expect(requestCall(m)).toEqual([
      'POST',
      '/monitors',
      {
        body: {
          name: 'ai-news',
          search: {
            query: 'AI news',
            numResults: 5,
            contents: { highlights: true },
          },
          trigger: { type: 'interval', period: '1d' },
          outputSchema: { type: 'text' },
          webhook: {
            url: 'https://hooks.example.com/exa',
            events: ['monitor.run.completed'],
          },
        },
      },
    ]);
  });

  test('create requires a webhook URL', async () => {
    await expect(
      monitor.monitorCreate(mockClient().client, ['q'], {})
    ).rejects.toThrow('--webhook-url is required');
  });

  test('update sends only changed fields and can remove the schedule', async () => {
    const m = mockClient(() => ({ id: 'm1', status: 'paused' }));

    await monitor.monitorUpdate(m.client, ['m1'], {
      status: 'paused',
      query: 'new query',
      'remove-schedule': true,
    });

    expect(requestCall(m)).toEqual([
      'PATCH',
      '/monitors/m1',
      {
        body: {
          status: 'paused',
          search: { query: 'new query' },
          trigger: null,
        },
      },
    ]);
  });

  test('update rejects an empty change set', async () => {
    await expect(
      monitor.monitorUpdate(mockClient().client, ['m1'], {})
    ).rejects.toThrow('Nothing to update');
  });

  test('list expands metadata into bracketed query filters', async () => {
    const m = mockClient(() => ({ data: [] }));

    await monitor.monitorList(m.client, [], {
      status: 'active',
      name: 'ai',
      metadata: '{"team":"growth"}',
      limit: '20',
    });

    expect(requestCall(m)[2]?.query).toEqual({
      limit: 20,
      status: 'active',
      name: 'ai',
      'metadata[team]': 'growth',
    });
  });

  test('batch defaults to a dry run and needs a filter', async () => {
    const m = mockClient(() => ({
      action: 'pause',
      affected: 1,
      ids: ['m1'],
      dry_run: true,
    }));

    await monitor.monitorBatch(m.client, ['pause'], { name: 'ai' });
    expect(requestCall(m)[2]?.body).toEqual({
      action: 'pause',
      filter: { name: 'ai' },
      dry_run: true,
    });

    await monitor.monitorBatch(m.client, ['delete'], {
      status: 'paused',
      execute: true,
    });
    expect(requestCall(m, 1)[2]?.body).toMatchObject({ dry_run: false });

    await expect(monitor.monitorBatch(m.client, ['pause'], {})).rejects.toThrow(
      'needs at least one filter'
    );
  });

  test('runs and run address nested resources', async () => {
    const m = mockClient(() => ({ data: [], id: 'run1', status: 'completed' }));
    await monitor.monitorRuns(m.client, ['m1'], {});
    await monitor.monitorRun(m.client, ['m1', 'run1'], {});
    await monitor.monitorTrigger(m.client, ['m1'], {});
    expect(m.request.mock.calls.map((c) => `${c[0]} ${c[1]}`)).toEqual([
      'GET /monitors/m1/runs',
      'GET /monitors/m1/runs/run1',
      'POST /monitors/m1/trigger',
    ]);
  });
});

describe('batch', () => {
  const requests = [
    { customId: 'a', method: 'POST', url: '/search', body: { query: 'x' } },
  ];

  test('parseBatchRequests accepts JSON arrays and JSONL', () => {
    expect(batch.parseBatchRequests(JSON.stringify(requests))).toEqual(
      requests
    );
    const jsonl = `${JSON.stringify(requests[0])}\n\n${JSON.stringify(requests[0])}\n`;
    expect(batch.parseBatchRequests(jsonl)).toHaveLength(2);
    expect(() => batch.parseBatchRequests('[]')).toThrow(UsageError);
    expect(() => batch.parseBatchRequests('{bad')).toThrow(UsageError);
  });

  test('create posts requests from a file with the beta header', async () => {
    const path = `${import.meta.dir}/.tmp-batch.jsonl`;
    await Bun.write(path, JSON.stringify(requests[0]));
    const m = mockClient(() => ({ id: 'b1', status: 'in_progress' }));
    try {
      await batch.batchCreate(m.client, [path], { metadata: '{"job":"1"}' });
    } finally {
      await Bun.file(path).delete();
    }

    expect(requestCall(m)).toEqual([
      'POST',
      '/batches',
      {
        body: { requests, metadata: { job: '1' } },
        headers: { 'Exa-Beta': BATCHES_BETA },
      },
    ]);
  });

  test('list only accepts the completed status filter', async () => {
    await expect(
      batch.batchList(mockClient().client, [], { status: 'running' })
    ).rejects.toThrow('--status only supports: completed');
  });

  test('results refuses batches without a results URL', async () => {
    const m = mockClient(() => ({ id: 'b1', status: 'in_progress' }));
    await expect(batch.batchResults(m.client, ['b1'], {})).rejects.toThrow(
      'Batch b1 has no results yet (status: in_progress)'
    );
  });

  test('results downloads and parses the JSONL file', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        '{"customId":"a"}\n{"customId":"b"}\n'
      )) as unknown as typeof fetch;
    const m = mockClient(() => ({
      id: 'b1',
      status: 'completed',
      resultsUrl: 'https://files.example.com/b1.jsonl',
    }));
    try {
      await batch.batchResults(m.client, ['b1'], { json: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(printedJson()).toEqual({
      ok: true,
      data: [{ customId: 'a' }, { customId: 'b' }],
    });
  });
});

describe('runCommand', () => {
  test('prints the error envelope with the API tag in --json mode', async () => {
    const restore = stubProcessExit();
    try {
      await expect(
        runCommand({ json: true }, async () => {
          throw new ExaApiError('Invalid API key.', 401, 'INVALID_API_KEY');
        })
      ).rejects.toThrow('process.exit called');
    } finally {
      restore();
    }
    expect(printedJson()).toEqual({
      ok: false,
      error: 'Invalid API key. Run "exacli login" or set EXA_API_KEY.',
      code: 'INVALID_API_KEY',
    });
  });

  test('prints usage errors to stderr in markdown mode', async () => {
    const restore = stubProcessExit();
    try {
      await expect(
        runCommand({}, async () => {
          throw new UsageError('bad flag');
        })
      ).rejects.toThrow('process.exit called');
    } finally {
      restore();
    }
    expect(errorSpy).toHaveBeenCalledWith('Error: bad flag');
  });
});
