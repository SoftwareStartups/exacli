import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { createClient, type ExaClient } from '../src/client.js';
import * as agent from '../src/commands/agent.js';
import { answer } from '../src/commands/answer.js';
import { contents } from '../src/commands/contents.js';
import * as monitor from '../src/commands/monitor.js';
import { search } from '../src/commands/search.js';
import { similar } from '../src/commands/similar.js';

// Real API calls. Kept to cheap requests; skipped without EXA_API_KEY.
const apiKey = process.env.EXA_API_KEY;
const client: ExaClient | undefined = apiKey ? createClient(apiKey) : undefined;
const TIMEOUT = 60_000;

let logSpy: ReturnType<typeof spyOn<Console, 'log'>>;

beforeEach(() => {
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

/** Parses the --json envelope printed by the last command. */
function envelope(): { ok: boolean; data: Record<string, unknown> } {
  return JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
}

describe.skipIf(!client)('E2E - real Exa API', () => {
  const exa = client as ExaClient;

  test(
    'search returns highlights',
    async () => {
      await search(exa, ['Bun JavaScript runtime'], {
        'num-results': '2',
        highlights: true,
        json: true,
      });
      const { ok, data } = envelope();
      expect(ok).toBe(true);
      const results = data.results as Array<{ highlights?: string[] }>;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.highlights?.length).toBeGreaterThan(0);
    },
    TIMEOUT
  );

  test(
    'search with an output schema returns synthesized output',
    async () => {
      await search(exa, ['Who founded Exa AI?'], {
        'num-results': '3',
        'output-schema': '{"type":"text"}',
        json: true,
      });
      expect(envelope().data.output).toBeDefined();
    },
    TIMEOUT
  );

  test(
    'contents extracts capped text',
    async () => {
      await contents(exa, ['https://example.com'], {
        text: true,
        'max-characters': '100',
        json: true,
      });
      const results = envelope().data.results as Array<{ text?: string }>;
      expect(results[0]?.text?.length).toBeLessThanOrEqual(100);
    },
    TIMEOUT
  );

  test(
    'similar finds related pages',
    async () => {
      await similar(exa, ['https://bun.com'], {
        'num-results': '2',
        json: true,
      });
      expect(envelope().ok).toBe(true);
    },
    TIMEOUT
  );

  test(
    'answer returns citations',
    async () => {
      await answer(exa, ['What is the capital of France?'], { json: true });
      expect(envelope().data.citations).toBeArray();
    },
    TIMEOUT
  );

  test(
    'agent and monitor lists respond',
    async () => {
      await agent.agentList(exa, [], { limit: '1', json: true });
      expect(envelope().data.data).toBeArray();
      await monitor.monitorList(exa, [], { limit: '1', json: true });
      expect(envelope().data.data).toBeArray();
    },
    TIMEOUT
  );
});
