import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  createClient,
  ExaApiError,
  fetchExternal,
  parseEventData,
  parseSse,
} from '../src/client.js';

const originalFetch = globalThis.fetch;

function mockFetch(response: Response) {
  const fetchMock = mock(async (_url: URL, _init: RequestInit) => response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function chunkedBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
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

  test('repeats array query parameters', async () => {
    const fetchMock = mockFetch(Response.json({ data: [] }));
    await createClient('k', 'https://api.test').request('GET', '/events', {
      query: { types: ['a', 'b'] },
    });
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
      'https://api.test/events?types=a&types=b'
    );
  });

  test('prefers the message field of Websets errors', async () => {
    mockFetch(
      Response.json(
        { statusCode: 401, error: 'Unauthorized', message: 'Upgrade to Pro.' },
        { status: 401 }
      )
    );
    const error = await createClient('k')
      .request('GET', '/websets/v0/websets')
      .catch((e) => e);
    expect(error).toMatchObject({ message: 'Upgrade to Pro.', status: 401 });
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

describe('client error handling', () => {
  test('reports a 2xx response that is not JSON as an ExaApiError', async () => {
    mockFetch(new Response('<html>captive portal</html>', { status: 200 }));
    const error = await createClient('k', 'https://api.test')
      .request('GET', '/x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExaApiError);
    expect((error as ExaApiError).message).toBe(
      'Exa API returned a response that is not JSON'
    );
  });

  test('passes an abort signal so requests cannot hang forever', async () => {
    const fetchMock = mockFetch(Response.json({}));
    await createClient('k', 'https://api.test').request('GET', '/x');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  test('parseEventData reports non-JSON stream data clearly', () => {
    expect(parseEventData('{"a":1}')).toEqual({ a: 1 });
    expect(() => parseEventData('ping')).toThrow(
      'Unexpected stream data: ping'
    );
  });
});

describe('fetchExternal', () => {
  test('fetches https URLs handed out by the API', async () => {
    const fetchMock = mockFetch(new Response('ok'));
    const response = await fetchExternal('https://files.exa.ai/r.jsonl');
    expect(await response.text()).toBe('ok');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://files.exa.ai/r.jsonl'
    );
  });

  test('refuses file, http, and malformed URLs', async () => {
    const fetchMock = mockFetch(new Response('secret'));
    for (const url of [
      'file:///etc/hosts',
      'http://169.254.169.254/',
      'nope',
    ]) {
      await expect(fetchExternal(url)).rejects.toThrow('Refusing to fetch');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('parseSse edge cases', () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  test('joins a CRLF split across chunks', async () => {
    const events = await collect(
      parseSse(chunkedBody([encode('data: one\r'), encode('\n\r\ndata: two')]))
    );
    expect(events.map((e) => e.data)).toEqual(['one', 'two']);
  });

  test('treats a lone CR as a line ending', async () => {
    const events = await collect(parseSse(sseBody('data: one\r\rdata: two')));
    expect(events.map((e) => e.data)).toEqual(['one', 'two']);
  });

  test('keeps a multibyte character split across chunks', async () => {
    const bytes = encode('data: café');
    const events = await collect(
      parseSse(chunkedBody([bytes.slice(0, -1), bytes.slice(-1)]))
    );
    expect(events.map((e) => e.data)).toEqual(['café']);
  });

  test('reads a bare data line as an empty value', async () => {
    const events = await collect(parseSse(sseBody('data\n\ndata: x')));
    expect(events.map((e) => e.data)).toEqual(['', 'x']);
  });
});
