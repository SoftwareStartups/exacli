import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { ExaApiError, RequestTimeoutError } from '../src/client.js';
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
import {
  exitOnBrokenPipe,
  runCommand,
  sanitize,
} from '../src/utils/commands.js';
import { UsageError } from '../src/utils/validation.js';
import { withFetch } from './helpers/fetch-stub.js';
import { mockClient, requestCall } from './helpers/mock-client.js';
import { stubProcessExit } from './helpers/process-exit.js';
import { withTempFile } from './helpers/temp-file.js';

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

  test('collects citations from search delta and grounding chunks', async () => {
    const m = mockClient(undefined, [
      {
        data: '{"type":"text-delta","choices":[{"delta":{"content":"Hi","citations":[{"url":"https://a.com","title":"A","id":"1"}]}}]}',
      },
      {
        data: '{"type":"grounding","grounding":[{"field":"x","confidence":"high","citations":[{"url":"https://b.com","title":"B"}]}]}',
      },
      { data: '[DONE]' },
    ]);
    await search(m.client, ['q'], {
      stream: true,
      'output-schema': '{"type":"text"}',
    });
    const printed = String(logSpy.mock.calls.at(-1)?.[0]);
    expect(printed).toContain('[A](https://a.com)');
    expect(printed).toContain('[B](https://b.com)');
  });

  test('fails on error chunks inside search and answer streams', async () => {
    const searchStream = mockClient(undefined, [
      { data: '{"type":"error","error":{"message":"synthesis failed"}}' },
    ]);
    await expect(
      search(searchStream.client, ['q'], {
        stream: true,
        'output-schema': '{"type":"text"}',
      })
    ).rejects.toThrow('synthesis failed');

    const answerStream = mockClient(undefined, [
      {
        data: '{"tag":"ERROR","payload":{"error":{"code":500,"message":"boom"}}}',
      },
    ]);
    await expect(
      answer(answerStream.client, ['q'], { stream: true })
    ).rejects.toThrow('boom');
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

    const sleep = spyOn(Bun, 'sleep').mockResolvedValue(undefined);
    await agent.agentRun(m.client, ['q'], {
      wait: true,
      'poll-interval': '1000',
      json: true,
    });
    sleep.mockRestore();

    expect(m.request).toHaveBeenCalledTimes(3);
    expect(requestCall(m, 1).slice(0, 2)).toEqual(['GET', '/agent/runs/r1']);
    expect(printedJson()).toEqual({
      ok: true,
      data: { id: 'r1', status: 'completed' },
    });
  });

  test('run --wait gives up after the timeout', async () => {
    const m = mockClient(() => ({ id: 'r1', status: 'running' }));
    const sleep = spyOn(Bun, 'sleep').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 2))
    );
    await expect(
      agent.agentRun(m.client, ['q'], {
        wait: true,
        'poll-interval': '1000',
        timeout: '1',
      })
    ).rejects.toThrow('Timed out waiting for run r1');
    sleep.mockRestore();
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

  test('run --stream also accepts spec-shaped {event, data} payloads', async () => {
    const m = mockClient(undefined, [
      {
        data: '{"id":"1","event":"agent_run.completed","data":{"id":"r1","status":"completed","output":{"text":"Wrapped"}},"createdAt":"2026-10-12T00:00:00Z"}',
      },
    ]);
    await agent.agentRun(m.client, ['q'], { stream: true });
    expect(String(logSpy.mock.calls.at(-1)?.[0])).toContain('Wrapped');
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

  test('create sends the beta header for dynamic highlights', async () => {
    const m = mockClient(() => ({ id: 'm1', status: 'active' }));
    await monitor.monitorCreate(m.client, ['q'], {
      'webhook-url': 'https://hooks.example.com/exa',
      'dynamic-highlights': true,
    });
    expect(requestCall(m)[2]?.headers).toEqual({
      'Exa-Beta': DYNAMIC_HIGHLIGHTS_BETA,
    });
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
  const completedBatch = (resultsUrl = 'https://files.example.com/b1.jsonl') =>
    mockClient(() => ({ id: 'b1', status: 'completed', resultsUrl }));
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
    const m = mockClient(() => ({ id: 'b1', status: 'in_progress' }));
    await withTempFile('.jsonl', JSON.stringify(requests[0]), (path) =>
      batch.batchCreate(m.client, [path], { metadata: '{"job":"1"}' })
    );

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
    await withFetch(
      async () => new Response('{"customId":"a"}\n{"customId":"b"}\n'),
      () => batch.batchResults(completedBatch().client, ['b1'], { json: true })
    );
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

  test('only suggests login for invalid API keys', async () => {
    const restore = stubProcessExit();
    try {
      await expect(
        runCommand({ json: true }, async () => {
          throw new ExaApiError('Upgrade to a Pro plan.', 401);
        })
      ).rejects.toThrow('process.exit called');
    } finally {
      restore();
    }
    expect(printedJson()).toEqual({
      ok: false,
      error: 'Upgrade to a Pro plan.',
      code: 'HTTP_401',
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

describe('exitOnBrokenPipe', () => {
  const pipeError = (code: string) =>
    Object.assign(new Error('write failed'), { code });

  test('exits 0 when the stdout reader goes away', () => {
    const stdout = new EventEmitter();
    exitOnBrokenPipe(stdout);
    const restore = stubProcessExit();
    try {
      expect(() => stdout.emit('error', pipeError('EPIPE'))).toThrow(
        'process.exit called'
      );
      expect(process.exit).toHaveBeenCalledWith(0);
    } finally {
      restore();
    }
  });

  test('rethrows other stdout errors', () => {
    const stdout = new EventEmitter();
    exitOnBrokenPipe(stdout);
    expect(() => stdout.emit('error', pipeError('EIO'))).toThrow(
      'write failed'
    );
  });
});

describe('agent exit codes, retries, and streams', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  test('run --wait exits 1 when the run fails', async () => {
    const m = mockClient((method) => ({
      id: 'r1',
      status: method === 'POST' ? 'running' : 'failed',
    }));
    const sleep = spyOn(Bun, 'sleep').mockResolvedValue(undefined);
    await agent.agentRun(m.client, ['q'], { wait: true, json: true });
    sleep.mockRestore();
    expect(printedJson()).toEqual({
      ok: true,
      data: { id: 'r1', status: 'failed' },
    });
    expect(process.exitCode).toBe(1);
  });

  test('run --wait retries polls that hit transient errors', async () => {
    let polls = 0;
    const m = mockClient((method) => {
      if (method === 'POST') return { id: 'r1', status: 'running' };
      polls++;
      if (polls === 1) throw new ExaApiError('busy', 503);
      return { id: 'r1', status: 'completed' };
    });
    const sleep = spyOn(Bun, 'sleep').mockResolvedValue(undefined);
    await agent.agentRun(m.client, ['q'], { wait: true, json: true });
    sleep.mockRestore();
    expect(polls).toBe(2);
    expect(process.exitCode).toBe(0);
  });

  test('run --wait retries timed-out polls and reports the last failure', async () => {
    const m = mockClient((method) => {
      if (method === 'POST') return { id: 'r1', status: 'running' };
      throw new RequestTimeoutError();
    });
    const sleep = spyOn(Bun, 'sleep').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 2))
    );
    await expect(
      agent.agentRun(m.client, ['q'], { wait: true, timeout: '20' })
    ).rejects.toThrow('last poll failed: Request timed out after 300 seconds');
    sleep.mockRestore();
    expect(m.request.mock.calls.length).toBeGreaterThan(2);
  });

  test('run --wait does not retry client errors', async () => {
    const m = mockClient((method) => {
      if (method === 'POST') return { id: 'r1', status: 'running' };
      throw new ExaApiError('not found', 404);
    });
    const sleep = spyOn(Bun, 'sleep').mockResolvedValue(undefined);
    await expect(
      agent.agentRun(m.client, ['q'], { wait: true })
    ).rejects.toThrow('not found');
    sleep.mockRestore();
  });

  test('run --wait rejects a poll interval under one second', async () => {
    const m = mockClient(() => ({ id: 'r1', status: 'running' }));
    await expect(
      agent.agentRun(m.client, ['q'], { wait: true, 'poll-interval': '5' })
    ).rejects.toThrow('--poll-interval must be at least 1000');
  });

  test('run --stream --json prints one envelope per event and exits 1 on cancel', async () => {
    const m = mockClient(undefined, [
      {
        event: 'agent_run.created',
        id: '1',
        data: '{"id":"r1","status":"queued"}',
      },
      {
        id: '2',
        data: '{"event":"agent_run.cancelled","data":{"id":"r1","status":"cancelled"}}',
      },
    ]);
    await agent.agentRun(m.client, ['q'], { stream: true, json: true });
    const lines = logSpy.mock.calls.map((call) => JSON.parse(String(call[0])));
    expect(lines).toEqual([
      {
        ok: true,
        data: {
          event: 'agent_run.created',
          id: '1',
          data: { id: 'r1', status: 'queued' },
        },
      },
      {
        ok: true,
        data: {
          event: 'agent_run.cancelled',
          id: '2',
          data: { id: 'r1', status: 'cancelled' },
        },
      },
    ]);
    expect(process.exitCode).toBe(1);
  });

  test('run --stream fails when the stream ends before a terminal event', async () => {
    const m = mockClient(undefined, [
      { event: 'agent_run.started', data: '{"id":"r1","status":"running"}' },
    ]);
    await expect(
      agent.agentRun(m.client, ['q'], { stream: true })
    ).rejects.toThrow('Stream ended before the run finished');
  });

  test('rejects dot-segment run IDs', async () => {
    const m = mockClient();
    await expect(agent.agentCancel(m.client, ['..'], {})).rejects.toThrow(
      'Invalid ID ".."'
    );
    expect(m.request).not.toHaveBeenCalled();
  });
});

describe('completion streams', () => {
  const schema = { stream: true, 'output-schema': '{"type":"text"}' };

  test('search renders the top-level delta when choices are absent', async () => {
    const m = mockClient(undefined, [
      { data: '{"type":"text-delta","delta":"Hello"}' },
      { data: '[DONE]' },
    ]);
    await search(m.client, ['q'], schema);
    expect(writeSpy).toHaveBeenCalledWith('Hello');
  });

  test('ignores a non-string delta', async () => {
    const m = mockClient(undefined, [
      { data: '{"type":"text-delta","delta":{"a":1}}' },
      { data: '[DONE]' },
    ]);
    await search(m.client, ['q'], schema);
    expect(writeSpy).not.toHaveBeenCalledWith(expect.anything());
  });

  test('fails when the stream ends without [DONE]', async () => {
    const m = mockClient(undefined, [
      { data: '{"type":"text-delta","delta":"partial"}' },
    ]);
    await expect(search(m.client, ['q'], schema)).rejects.toThrow(
      'Stream ended before completion'
    );
  });

  test('logs stream resets and prints each citation once', async () => {
    const citation = '{"url":"https://a.com","title":"A","id":"1"}';
    const m = mockClient(undefined, [
      {
        data: `{"type":"text-delta","delta":"x","choices":[{"delta":{"citations":[${citation}]}}]}`,
      },
      { data: '{"type":"stream-reset"}' },
      {
        data: `{"type":"text-delta","delta":"y","choices":[{"delta":{"citations":[${citation}]}}]}`,
      },
      { data: '[DONE]' },
    ]);
    await search(m.client, ['q'], schema);
    expect(errorSpy).toHaveBeenCalledWith('[stream restarted]');
    const printed = String(logSpy.mock.calls.at(-1)?.[0]);
    expect(printed.match(/https:\/\/a\.com/g)).toHaveLength(1);
  });

  test('strips terminal escape sequences from streamed text', async () => {
    const m = mockClient(undefined, [
      {
        data: '{"type":"text-delta","delta":"safe\\u001b]52;c;ZXZpbA==\\u0007"}',
      },
      { data: '[DONE]' },
    ]);
    await search(m.client, ['q'], schema);
    expect(writeSpy).toHaveBeenCalledWith('safe]52;c;ZXZpbA==');
  });
});

describe('terminal output and usage errors', () => {
  test('sanitize removes bidi overrides but keeps accented text', () => {
    expect(sanitize('caf\u00e9 \u202eevil\u2066')).toBe('caf\u00e9 evil');
  });

  test('sanitize removes control characters but keeps newlines and tabs', () => {
    expect(sanitize('a\u001b[31mred\u0007\tb\nc\u009b')).toBe('a[31mred\tb\nc');
  });

  test('unknown commands print a JSON envelope with --json', () => {
    const result = Bun.spawnSync(['bun', 'src/index.ts', 'nope', '--json'], {
      cwd: `${import.meta.dir}/..`,
      env: { ...process.env, EXA_API_KEY: 'x' },
    });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout.toString())).toEqual({
      ok: false,
      error: 'Unknown command "nope"',
      code: 'USAGE_ERROR',
    });
  });
});

describe('monitor validation', () => {
  test('batch treats empty metadata as no filter', async () => {
    const m = mockClient();
    await expect(
      monitor.monitorBatch(m.client, ['delete'], {
        metadata: '{}',
        execute: true,
      })
    ).rejects.toThrow('monitor batch needs at least one filter');
    expect(m.request).not.toHaveBeenCalled();
  });

  test('batch names the positional action in its error', async () => {
    await expect(
      monitor.monitorBatch(mockClient().client, ['archive'], { name: 'x' })
    ).rejects.toThrow('Unknown batch action "archive"');
  });

  test('update rejects --period with --remove-schedule', async () => {
    const m = mockClient();
    await expect(
      monitor.monitorUpdate(m.client, ['m1'], {
        period: '1d',
        'remove-schedule': true,
      })
    ).rejects.toThrow('not both');
    expect(m.request).not.toHaveBeenCalled();
  });

  test('create rejects content options monitors do not support', async () => {
    for (const flag of ['summary-schema', 'snapshot-as-of'] as const) {
      await expect(
        monitor.monitorCreate(mockClient().client, ['q'], {
          'webhook-url': 'https://hooks.example.com',
          [flag]: flag === 'summary-schema' ? '{}' : '2026-01-01',
        })
      ).rejects.toThrow(`--${flag} is not supported for monitors`);
    }
  });

  test('list rejects non-string metadata values', async () => {
    await expect(
      monitor.monitorList(mockClient().client, [], {
        metadata: '{"a":{"b":1}}',
      })
    ).rejects.toThrow('--metadata values must be strings');
  });
});

describe('batch results download', () => {
  const run = (resultsUrl: string, args = {}) =>
    batch.batchResults(
      mockClient(() => ({ id: 'b1', status: 'completed', resultsUrl })).client,
      ['b1'],
      args
    );

  test('refuses results URLs that are not https', async () => {
    await expect(run('file:///etc/hosts')).rejects.toThrow(
      'Refusing to fetch non-https URL'
    );
  });

  test('reports failed downloads', async () => {
    await withFetch(
      async () => new Response('denied', { status: 403 }),
      () =>
        expect(run('https://files.example.com/b1.jsonl')).rejects.toThrow(
          'Failed to download results (HTTP 403)'
        )
    );
  });

  test('prints the raw JSONL without parsing it in markdown mode', async () => {
    await withFetch(
      async () => new Response('{"customId":"a"}\nnot json\n'),
      () => run('https://files.example.com/b1.jsonl')
    );
    expect(logSpy).toHaveBeenCalledWith('{"customId":"a"}\nnot json');
  });

  test('names the malformed line in --json mode', async () => {
    await withFetch(
      async () => new Response('{"customId":"a"}\nnot json\n'),
      () =>
        expect(
          run('https://files.example.com/b1.jsonl', { json: true })
        ).rejects.toThrow('Results line 2 is not valid JSON')
    );
  });
});
