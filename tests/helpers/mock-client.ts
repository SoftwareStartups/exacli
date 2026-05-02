import type { ExaClient } from '../../src/client.js';

export function asExaClient(partial: Record<string, unknown>): ExaClient {
  return partial as unknown as ExaClient;
}
