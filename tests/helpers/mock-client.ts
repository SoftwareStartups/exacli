import { mock } from 'bun:test';
import type {
  ExaClient,
  HttpMethod,
  RequestOptions,
  SseEvent,
} from '../../src/client.js';

export interface MockClient {
  client: ExaClient;
  request: ReturnType<typeof mock<ExaClient['request']>>;
  stream: ReturnType<typeof mock<ExaClient['stream']>>;
}

/**
 * Builds a mock ExaClient. `respond` returns the response for each request;
 * `events` are yielded by stream().
 */
export function mockClient(
  respond: (
    method: HttpMethod,
    path: string,
    options?: RequestOptions
  ) => unknown = () => ({}),
  events: SseEvent[] = []
): MockClient {
  const request = mock(
    async (method: HttpMethod, path: string, options?: RequestOptions) =>
      respond(method, path, options)
  ) as unknown as MockClient['request'];
  const stream = mock(async function* () {
    yield* events;
  }) as unknown as MockClient['stream'];
  return { client: { request, stream }, request, stream };
}

/** The request options of the nth request() call. */
export function requestCall(
  mocked: MockClient,
  index = 0
): [HttpMethod, string, RequestOptions | undefined] {
  const call = mocked.request.mock.calls[index];
  if (!call) throw new Error(`request() call ${index} not made`);
  return call as [HttpMethod, string, RequestOptions | undefined];
}
