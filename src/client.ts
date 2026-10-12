/**
 * Thin HTTP client for the Exa REST API (https://exa.ai/docs/exa-spec.yaml).
 */

import pkg from '../package.json' with { type: 'json' };

export const API_BASE_URL = 'https://api.exa.ai';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | undefined;

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
    accept: string
  ): Promise<Response> => {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.append(key, String(value));
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
      const response = await send(method, path, options, 'application/json');
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
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

async function toApiError(response: Response): Promise<ExaApiError> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as {
      error?: string | { message?: string; code?: string };
      message?: string;
      tag?: string;
      requestId?: string;
    };
    const message =
      typeof body.error === 'string'
        ? body.error
        : (body.error?.message ?? body.message ?? text);
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
  for await (const chunk of body) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(
      /\r\n/g,
      '\n'
    );
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const event = parseSseBlock(part);
      if (event) yield event;
    }
  }
  const event = parseSseBlock(buffer);
  if (event) yield event;
}

function parseSseBlock(block: string): SseEvent | undefined {
  const event: SseEvent = { data: '' };
  const data: string[] = [];
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') data.push(value);
    else if (field === 'event') event.event = value;
    else if (field === 'id') event.id = value;
  }
  if (data.length === 0) return undefined;
  event.data = data.join('\n');
  return event;
}
