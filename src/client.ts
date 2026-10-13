/**
 * Thin HTTP client for the Exa REST API (https://exa.ai/docs/exa-spec.yaml).
 */

import pkg from '../package.json' with { type: 'json' };

const API_BASE_URL = 'https://api.exa.ai';
const REQUEST_TIMEOUT_MS = 5 * 60_000;
const MAX_SSE_BUFFER = 10 * 1024 * 1024;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | string[] | undefined;

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
}

export interface SseEvent {
  event?: string;
  id?: string;
  data: string;
}

export interface ExaClient {
  request<T = unknown>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions
  ): Promise<T>;
  stream(path: string, options?: RequestOptions): AsyncGenerator<SseEvent>;
}

export class RequestTimeoutError extends Error {
  constructor() {
    super(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    this.name = 'RequestTimeoutError';
  }
}

export class ExaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly tag?: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ExaApiError';
  }
}

export function createClient(
  apiKey: string,
  baseUrl: string = API_BASE_URL
): ExaClient {
  const send = async (
    method: HttpMethod,
    path: string,
    options: RequestOptions,
    accept: string,
    signal?: AbortSignal
  ): Promise<Response> => {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      for (const item of [value].flat()) {
        if (item !== undefined) url.searchParams.append(key, String(item));
      }
    }
    const response = await fetch(url, {
      method,
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        accept,
        'user-agent': `exacli/${pkg.version}`,
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
    if (!response.ok) throw await toApiError(response);
    return response;
  };

  return {
    async request<T>(
      method: HttpMethod,
      path: string,
      options: RequestOptions = {}
    ) {
      // The timeout covers reading the body, so it stays inside withTimeout.
      const { response, text } = await withTimeout(async (signal) => {
        const res = await send(
          method,
          path,
          options,
          'application/json',
          signal
        );
        return { response: res, text: await res.text() };
      });
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ExaApiError(
          'Exa API returned a response that is not JSON',
          response.status
        );
      }
    },
    async *stream(path: string, options: RequestOptions = {}) {
      const response = await send('POST', path, options, 'text/event-stream');
      if (!response.body) {
        throw new ExaApiError('No response body for stream', response.status);
      }
      yield* parseSse(response.body);
    },
  };
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  try {
    return await fn(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new RequestTimeoutError();
    }
    throw error;
  }
}

export interface ExternalResponse {
  ok: boolean;
  status: number;
  text: string;
}

/**
 * Fetches a URL handed out by the API (batch results, import uploads) and
 * reads its body. Only https is allowed, so a bad response cannot point at
 * local files.
 */
export async function fetchExternal(
  url: string,
  init: RequestInit = {}
): Promise<ExternalResponse> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Refusing to fetch invalid URL from the API: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing to fetch non-https URL from the API: ${url}`);
  }
  return withTimeout(async (signal) => {
    const response = await fetch(parsed, { ...init, signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  });
}

/** Parses an SSE data payload, reporting non-JSON data clearly. */
export function parseEventData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new Error(`Unexpected stream data: ${data.slice(0, 200)}`);
  }
}

async function toApiError(response: Response): Promise<ExaApiError> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as {
      error?: string | { message?: string; code?: string };
      message?: string;
      tag?: string;
      requestId?: string;
    };
    // Search/Agent APIs send {error, tag}; Websets sends {error, message}.
    const message =
      body.message ??
      (typeof body.error === 'string' ? body.error : body.error?.message) ??
      text;
    const tag =
      body.tag ??
      (typeof body.error === 'object' ? body.error.code : undefined);
    return new ExaApiError(message, response.status, tag, body.requestId);
  } catch {
    return new ExaApiError(
      text || `Request failed with status ${response.status}`,
      response.status
    );
  }
}

export async function* parseSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  // A CR at a chunk boundary may be the first half of CRLF.
  let pendingCr = false;
  const append = (text: string) => {
    let next = (pendingCr ? '\r' : '') + text;
    pendingCr = next.endsWith('\r');
    if (pendingCr) next = next.slice(0, -1);
    buffer += next.replace(/\r\n?/g, '\n');
    if (buffer.length > MAX_SSE_BUFFER) {
      throw new Error('Stream event exceeded the 10 MB limit');
    }
  };
  for await (const chunk of body) {
    append(decoder.decode(chunk, { stream: true }));
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const event = parseSseBlock(part);
      if (event) yield event;
    }
  }
  append(decoder.decode());
  if (pendingCr) buffer += '\n';
  for (const part of buffer.split('\n\n')) {
    const event = parseSseBlock(part);
    if (event) yield event;
  }
}

function parseSseBlock(block: string): SseEvent | undefined {
  const event: SseEvent = { data: '' };
  const data: string[] = [];
  for (const line of block.split('\n')) {
    // Lines starting with ':' are comments; a line without ':' is a bare field.
    const colon = line.indexOf(':');
    if (colon === 0 || line === '') continue;
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') data.push(value);
    else if (field === 'event') event.event = value;
    else if (field === 'id') event.id = value;
  }
  if (data.length === 0) return undefined;
  event.data = data.join('\n');
  return event;
}
