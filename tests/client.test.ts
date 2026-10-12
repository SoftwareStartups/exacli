import { afterEach, describe, expect, mock, test } from 'bun:test';
import { ExaApiError, createClient, parseSse } from '../src/client.js';

const originalFetch = globalThis.fetch;

function mockFetch(response: Response) {
  const fetchMock = mock(async (_url: URL, _init: RequestInit) => response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function sseBody(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      // Split mid-event to exercise buffering across chunks.
      controller.enqueue(bytes.slice(0, 10));
      controller.enqueue(bytes.slice(10));
      controller.close();
    },
  });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) items.push(item);
  return items;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createClient().request', () => {
  test('sends auth, JSON body, and query parameters', async () => {
    const fetchMock = mockFetch(Response.json({ results: [] }));
    const client = createClient('key-123', 'https://api.test');

    const result = await client.request('POST', '/search', {
      body: { query: 'q' },
      query: { limit: 5, cursor: undefined },
      headers: { 'Exa-Beta': 'beta-1' },
    });

    expect(result).toEqual({ results: [] });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url?.toString()).toBe('https://api.test/search?limit=5');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"query":"q"}');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('key-123');
    expect(headers['Exa-Beta']).toBe('beta-1');
    expect(headers['user-agent']).toStartWith('exacli/');
  });

  test('returns an empty object for empty success bodies', async () => {
    mockFetch(new Response('', { status: 200 }));
    const client = createClient('k');
    expect(await client.request('DELETE', '/agent/runs/x')).toEqual({});
  });

  test('raises ExaApiError with the API error envelope fields', async () => {
    mockFetch(
      Response.json(
        { requestId: 'r1', error: 'Invalid API key.', tag: 'INVALID_API_KEY' },
        { status: 401 }
      )
    );
    const client = createClient('bad');

    const error = await client.request('GET', '/monitors').catch((e) => e);
    expect(error).toBeInstanceOf(ExaApiError);
    expect(error).toMatchObject({
      message: 'Invalid API key.',
      status: 401,
      tag: 'INVALID_API_KEY',
      requestId: 'r1',
    });
  });

  test('falls back to the raw body for non-JSON errors', async () => {
    mockFetch(new Response('Bad gateway', { status: 502 }));
    const error = await createClient('k')
      .request('GET', '/batches')
      .catch((e) => e);
    expect(error).toMatchObject({ message: 'Bad gateway', status: 502 });
  });
});

describe('createClient().stream', () => {
  test('requests SSE and yields parsed events', async () => {
    const fetchMock = mockFetch(
      new Response(sseBody('event: agent_run.created\ndata: {"id":"r"}\n\n'))
    );
    const events = await collect(
      createClient('k').stream('/agent/runs', { body: { query: 'q' } })
    );

    expect(events).toEqual([
      { event: 'agent_run.created', data: '{"id":"r"}' },
    ]);
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).accept).toBe(
      'text/event-stream'
    );
  });
});

describe('parseSse', () => {
  test('parses ids, events, multi-line data, and skips comments', async () => {
    const events = await collect(
      parseSse(
        sseBody(
          ': keep-alive\n\nid: 1\nevent: a\ndata: {"x":1}\n\ndata: line1\ndata: line2\n\ndata: [DONE]'
        )
      )
    );
    expect(events).toEqual([
      { id: '1', event: 'a', data: '{"x":1}' },
      { data: 'line1\nline2' },
      { data: '[DONE]' },
    ]);
  });

  test('handles CRLF line endings', async () => {
    const events = await collect(
      parseSse(sseBody('data: one\r\n\r\ndata: two'))
    );
    expect(events.map((e) => e.data)).toEqual(['one', 'two']);
  });
});
