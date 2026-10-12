import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as websets from '../src/commands/websets.js';
import { mockClient, requestCall } from './helpers/mock-client.js';

let logSpy: ReturnType<typeof spyOn<Console, 'log'>>;

beforeEach(() => {
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

const ok = () => mockClient(() => ({ id: 'x', status: 'idle', data: [] }));

describe('webset', () => {
  test('create nests search fields and repeatable criteria and enrichments', async () => {
    const m = ok();

    await websets.websets.create?.(m.client, [], {
      query: 'AI startups in Berlin',
      count: '25',
      entity: 'company',
      criterion: ['founded after 2020', 'raised a seed round'],
      enrichment: ['CEO name'],
      title: 'Berlin AI',
      recall: true,
    });

    expect(requestCall(m)).toEqual([
      'POST',
      '/websets/v0/websets',
      {
        body: {
          title: 'Berlin AI',
          search: {
            query: 'AI startups in Berlin',
            count: 25,
            entity: { type: 'company' },
            criteria: [
              { description: 'founded after 2020' },
              { description: 'raised a seed round' },
            ],
            recall: true,
          },
          enrichments: [{ description: 'CEO name' }],
        },
        query: undefined,
      },
    ]);
  });

  test('--body supplies extra spec fields and flags override it', async () => {
    const m = ok();

    await websets.websets.create?.(m.client, [], {
      body: '{"title":"from body","exclude":[{"source":"webset","id":"w0"}]}',
      title: 'from flag',
    });

    expect(requestCall(m)[2]?.body).toEqual({
      title: 'from flag',
      exclude: [{ source: 'webset', id: 'w0' }],
    });
  });

  test('flags merge into nested --body objects instead of replacing them', async () => {
    const m = ok();
    await websets.websets.create?.(m.client, [], {
      body: '{"search":{"query":"x","exclude":[{"source":"webset","id":"w0"}]}}',
      count: '5',
    });
    expect(requestCall(m)[2]?.body).toEqual({
      search: {
        query: 'x',
        exclude: [{ source: 'webset', id: 'w0' }],
        count: 5,
      },
    });
  });

  test('custom entities require a description', async () => {
    await expect(
      websets.websets.create?.(ok().client, [], { entity: 'custom' })
    ).rejects.toThrow('--entity custom requires --entity-description');
  });

  test('get, items, and item address nested paths with query params', async () => {
    const m = ok();
    await websets.websets.get?.(m.client, ['ws_1'], { expand: 'items' });
    await websets.websets.items?.(m.client, ['ws_1'], {
      limit: '50',
      'source-id': 'imp_1',
    });
    await websets.websets['item-delete']?.(m.client, ['ws_1', 'it/1'], {});

    expect(requestCall(m, 0).slice(1)).toEqual([
      '/websets/v0/websets/ws_1',
      { body: undefined, query: { expand: ['items'] } },
    ]);
    expect(requestCall(m, 1).slice(1)).toEqual([
      '/websets/v0/websets/ws_1/items',
      { query: { limit: 50, sourceId: 'imp_1' } },
    ]);
    expect(requestCall(m, 2).slice(0, 2)).toEqual([
      'DELETE',
      '/websets/v0/websets/ws_1/items/it%2F1',
    ]);
  });

  test('preview requires a query and can include sample items', async () => {
    const m = ok();
    await websets.websets.preview?.(m.client, [], {
      query: 'fintechs',
      'with-items': true,
    });
    expect(requestCall(m)[2]).toEqual({
      body: { search: { query: 'fintechs' } },
      query: { search: true },
    });
    await expect(
      websets.websets.preview?.(ok().client, [], {})
    ).rejects.toThrow('Missing --search');
  });

  test('requires ids for id-scoped subcommands', async () => {
    await expect(websets.websets.get?.(ok().client, [], {})).rejects.toThrow(
      'Usage: exacli webset get <webset-id>'
    );
  });
});

describe('webset-search and webset-enrichment', () => {
  test('search create requires query and count', async () => {
    const m = ok();
    await websets.websetSearches.create?.(m.client, ['ws_1'], {
      query: 'more',
      count: '10',
      behavior: 'append',
    });
    expect(requestCall(m).slice(1, 3)).toEqual([
      '/websets/v0/websets/ws_1/searches',
      {
        body: { query: 'more', count: 10, behavior: 'append' },
        query: undefined,
      },
    ]);
    await expect(
      websets.websetSearches.create?.(ok().client, ['ws_1'], { query: 'q' })
    ).rejects.toThrow('Missing --count');
  });

  test('enrichment create maps options to labels', async () => {
    const m = ok();
    await websets.websetEnrichments.create?.(m.client, ['ws_1'], {
      description: 'Company stage',
      format: 'options',
      options: 'seed,series a',
    });
    expect(requestCall(m)[2]?.body).toEqual({
      description: 'Company stage',
      format: 'options',
      options: [{ label: 'seed' }, { label: 'series a' }],
    });
  });

  test('enrichment cancel targets the cancel endpoint', async () => {
    const m = ok();
    await websets.websetEnrichments.cancel?.(m.client, ['ws_1', 'en_1'], {});
    expect(requestCall(m).slice(0, 2)).toEqual([
      'POST',
      '/websets/v0/websets/ws_1/enrichments/en_1/cancel',
    ]);
  });
});

describe('webset-monitor', () => {
  test('create builds cadence and search behavior', async () => {
    const m = ok();
    await websets.websetMonitors.create?.(m.client, ['ws_1'], {
      cron: '0 9 * * 1',
      timezone: 'Europe/Amsterdam',
      count: '5',
      behavior: 'append',
    });
    expect(requestCall(m)).toEqual([
      'POST',
      '/websets/v0/monitors',
      {
        body: {
          websetId: 'ws_1',
          cadence: { cron: '0 9 * * 1', timezone: 'Europe/Amsterdam' },
          behavior: {
            type: 'search',
            config: { count: 5, behavior: 'append' },
          },
        },
      },
    ]);
  });

  test('create requires a cadence and behavior', async () => {
    await expect(
      websets.websetMonitors.create?.(ok().client, ['ws_1'], {})
    ).rejects.toThrow('Missing --cadence, --behavior');
  });

  test('update accepts status only', async () => {
    const m = ok();
    await websets.websetMonitors.update?.(m.client, ['mon_1'], {
      status: 'disabled',
    });
    expect(requestCall(m)[2]?.body).toEqual({ status: 'disabled' });
    await expect(
      websets.websetMonitors.update?.(ok().client, ['mon_1'], {
        status: 'paused',
      })
    ).rejects.toThrow('--status must be one of: enabled, disabled');
  });
});

describe('webset-import', () => {
  test('create sizes the CSV, creates the import, and uploads the file', async () => {
    const path = `${import.meta.dir}/.tmp-import.csv`;
    const csv = 'url\nhttps://a.com\nhttps://b.com\n';
    await Bun.write(path, csv);
    const uploads: Array<{ url: string; body: string }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      uploads.push({ url, body: String(init.body) });
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;
    const m = mockClient(() => ({
      id: 'imp_1',
      uploadUrl: 'https://upload.example.com/imp_1',
    }));
    try {
      await websets.websetImports.create?.(m.client, [path], {
        entity: 'company',
        'identifier-column': '0',
      });
    } finally {
      globalThis.fetch = originalFetch;
      await Bun.file(path).delete();
    }

    expect(requestCall(m)[2]?.body).toEqual({
      format: 'csv',
      size: csv.length,
      count: 2,
      entity: { type: 'company' },
      csv: { identifier: 0 },
    });
    expect(uploads).toEqual([
      { url: 'https://upload.example.com/imp_1', body: csv },
    ]);
  });
});

describe('webset-webhook, webset-event, and team', () => {
  test('webhook create requires url and events', async () => {
    const m = ok();
    await websets.websetWebhooks.create?.(m.client, [], {
      'webhook-url': 'https://hooks.example.com',
      events: 'webset.created,webset.item.created',
    });
    expect(requestCall(m)[2]?.body).toEqual({
      url: 'https://hooks.example.com',
      events: ['webset.created', 'webset.item.created'],
    });
    await expect(
      websets.websetWebhooks.create?.(ok().client, [], {})
    ).rejects.toThrow('Missing --url, --events');
  });

  test('webhook attempts and events forward filters', async () => {
    const m = ok();
    await websets.websetWebhooks.attempts?.(m.client, ['wh_1'], {
      successful: 'false',
    });
    await websets.websetEvents.list?.(m.client, [], {
      types: 'webset.created,webset.idle',
      'created-after': '2026-10-01',
    });
    expect(requestCall(m, 0)[2]?.query).toEqual({ successful: 'false' });
    expect(requestCall(m, 1)[2]?.query).toEqual({
      types: ['webset.created', 'webset.idle'],
      createdAfter: '2026-10-01',
    });
  });

  test('team reads /teams/me', async () => {
    const m = ok();
    await websets.team(m.client, [], { json: true });
    expect(requestCall(m).slice(0, 2)).toEqual(['GET', '/websets/v0/teams/me']);
    expect(JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]))).toMatchObject({
      ok: true,
    });
  });
});
