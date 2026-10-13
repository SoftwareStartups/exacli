/**
 * Websets API (https://api.exa.ai/websets/v0). Convenience flags cover the
 * common fields; --body <json|@file> passes any other spec field, and flags
 * override keys from --body.
 */

import {
  type ExaClient,
  fetchExternal,
  type HttpMethod,
  type QueryValue,
} from '../client.js';
import { formatResource, formatResourceList } from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import { compact, nonEmpty, paginationQuery } from '../utils/options.js';
import {
  parseEnum,
  parseInteger,
  parseJsonObject,
  parseMetadata,
  parseStringList,
  pathSegment,
  readTextFile,
  requireArg,
  UsageError,
} from '../utils/validation.js';
import {
  BOOLEAN_STRINGS,
  type CliArgs,
  ENRICHMENT_FORMATS,
  type Handler,
  type ListResponse,
  WEBSET_ENTITY_TYPES,
  WEBSET_MONITOR_STATUSES,
  WEBSET_SEARCH_BEHAVIORS,
} from './types.js';

type Body = Record<string, unknown>;
type Resource = Record<string, unknown>;

const BASE = '/websets/v0';

const path = (...segments: string[]) =>
  [BASE, ...segments.map(pathSegment)].join('/');

const isPlainObject = (value: unknown): value is Body =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Merges flag fields over --body; nested objects (e.g. search) merge too. */
async function withBody(args: CliArgs, fields: Body): Promise<Body> {
  const body = (await parseJsonObject('body', args.body)) ?? {};
  for (const [key, value] of Object.entries(compact(fields))) {
    const base = body[key];
    body[key] =
      isPlainObject(base) && isPlainObject(value)
        ? { ...base, ...value }
        : value;
  }
  return body;
}

function buildEntity(args: CliArgs): Body | undefined {
  const type = parseEnum('entity', args.entity, WEBSET_ENTITY_TYPES);
  if (type === 'custom' && !args['entity-description']) {
    throw new UsageError('--entity custom requires --entity-description');
  }
  return type
    ? compact({ type, description: args['entity-description'] })
    : undefined;
}

function buildCriteria(args: CliArgs): Body[] | undefined {
  return args.criterion?.map((description) => ({ description }));
}

/** Search fields shared by webset create, search create, and monitors. */
function buildSearchFields(args: CliArgs): Body {
  return {
    query: args.query,
    count: parseInteger('count', args.count),
    entity: buildEntity(args),
    criteria: buildCriteria(args),
  };
}

function requireFields(body: Body, fields: string[], usage: string): Body {
  const missing = fields.filter((field) => body[field] === undefined);
  if (missing.length > 0) {
    throw new UsageError(
      `Missing ${missing.map((f) => `--${f}`).join(', ')} (or set them in --body). Usage: exacli ${usage}`
    );
  }
  return body;
}

/** Builds a handler that sends one request and prints one resource. */
function resourceHandler(
  method: HttpMethod,
  title: string,
  usage: string,
  ids: number,
  pathFor: (ids: string[]) => string,
  bodyFor?: (args: CliArgs) => Promise<Body | undefined>,
  queryFor?: (args: CliArgs) => Record<string, QueryValue>
): Handler {
  return async (client, positionals, args) => {
    const values = Array.from({ length: ids }, (_, i) =>
      requireArg(positionals[i], usage)
    );
    const result = await client.request<Resource>(method, pathFor(values), {
      body: bodyFor ? await bodyFor(args) : undefined,
      query: queryFor?.(args),
    });
    printOutput(result, args, formatResource(title));
  };
}

/** Builds a handler for a paginated list endpoint. */
function listHandler(
  title: string,
  usage: string,
  ids: number,
  pathFor: (ids: string[]) => string,
  queryFor: (args: CliArgs) => Record<string, QueryValue> = () => ({})
): Handler {
  return async (client, positionals, args) => {
    const values = Array.from({ length: ids }, (_, i) =>
      requireArg(positionals[i], usage)
    );
    const result = await client.request<ListResponse<Resource>>(
      'GET',
      pathFor(values),
      { query: { ...paginationQuery(args), ...queryFor(args) } }
    );
    printOutput(result, args, formatResourceList(title));
  };
}

// Websets

export const websets: Record<string, Handler> = {
  create: resourceHandler(
    'POST',
    'Webset',
    'webset create --query <q>',
    0,
    () => path('websets'),
    async (args) => {
      const search = nonEmpty({
        ...buildSearchFields(args),
        recall: args.recall || undefined,
      });
      return withBody(args, {
        title: args.title,
        externalId: args['external-id'],
        search,
        enrichments: args.enrichment?.map((description) => ({ description })),
        metadata: await parseMetadata('metadata', args.metadata),
      });
    }
  ),
  list: listHandler(
    'Websets',
    'webset list',
    0,
    () => path('websets'),
    (args) => ({
      search: args.query,
    })
  ),
  get: resourceHandler(
    'GET',
    'Webset',
    'webset get <webset-id>',
    1,
    ([id = '']) => path('websets', id),
    undefined,
    (args) => ({ expand: parseStringList(args.expand) })
  ),
  update: resourceHandler(
    'POST',
    'Webset',
    'webset update <webset-id>',
    1,
    ([id = '']) => path('websets', id),
    async (args) =>
      withBody(args, {
        title: args.title,
        metadata: await parseMetadata('metadata', args.metadata),
      })
  ),
  delete: resourceHandler(
    'DELETE',
    'Deleted Webset',
    'webset delete <webset-id>',
    1,
    ([id = '']) => path('websets', id)
  ),
  cancel: resourceHandler(
    'POST',
    'Webset',
    'webset cancel <webset-id>',
    1,
    ([id = '']) => path('websets', id, 'cancel')
  ),
  preview: resourceHandler(
    'POST',
    'Webset Preview',
    'webset preview --query <q>',
    0,
    () => path('websets', 'preview'),
    async (args) => {
      const body = await withBody(args, {
        search: nonEmpty({
          query: args.query,
          count: parseInteger('count', args.count),
          entity: buildEntity(args),
        }),
      });
      return requireFields(body, ['search'], 'webset preview --query <q>');
    },
    (args) => ({ search: args['with-items'] || undefined })
  ),
  items: listHandler(
    'Webset Items',
    'webset items <webset-id>',
    1,
    ([id = '']) => path('websets', id, 'items'),
    (args) => ({ sourceId: args['source-id'] })
  ),
  item: resourceHandler(
    'GET',
    'Webset Item',
    'webset item <webset-id> <item-id>',
    2,
    ([webset = '', id = '']) => path('websets', webset, 'items', id)
  ),
  'item-delete': resourceHandler(
    'DELETE',
    'Deleted Webset Item',
    'webset item-delete <webset-id> <item-id>',
    2,
    ([webset = '', id = '']) => path('websets', webset, 'items', id)
  ),
};

// Searches within a webset

export const websetSearches: Record<string, Handler> = {
  create: resourceHandler(
    'POST',
    'Webset Search',
    'webset-search create <webset-id> --query <q> --count <n>',
    1,
    ([webset = '']) => path('websets', webset, 'searches'),
    async (args) =>
      requireFields(
        await withBody(args, {
          ...buildSearchFields(args),
          behavior: parseEnum(
            'behavior',
            args.behavior,
            WEBSET_SEARCH_BEHAVIORS
          ),
          recall: args.recall || undefined,
          metadata: await parseMetadata('metadata', args.metadata),
        }),
        ['query', 'count'],
        'webset-search create <webset-id> --query <q> --count <n>'
      )
  ),
  get: resourceHandler(
    'GET',
    'Webset Search',
    'webset-search get <webset-id> <search-id>',
    2,
    ([webset = '', id = '']) => path('websets', webset, 'searches', id)
  ),
  cancel: resourceHandler(
    'POST',
    'Webset Search',
    'webset-search cancel <webset-id> <search-id>',
    2,
    ([webset = '', id = '']) =>
      path('websets', webset, 'searches', id, 'cancel')
  ),
};

// Enrichments

async function enrichmentBody(args: CliArgs): Promise<Body> {
  return withBody(args, {
    description: args.description,
    format: parseEnum('format', args.format, ENRICHMENT_FORMATS),
    options: parseStringList(args.options)?.map((label) => ({ label })),
    metadata: await parseMetadata('metadata', args.metadata),
  });
}

const enrichmentPath = ([webset = '', id = '']: string[], ...rest: string[]) =>
  path('websets', webset, 'enrichments', id, ...rest);

export const websetEnrichments: Record<string, Handler> = {
  create: resourceHandler(
    'POST',
    'Enrichment',
    'webset-enrichment create <webset-id> --description <text>',
    1,
    ([webset = '']) => path('websets', webset, 'enrichments'),
    async (args) =>
      requireFields(
        await enrichmentBody(args),
        ['description'],
        'webset-enrichment create <webset-id> --description <text>'
      )
  ),
  get: resourceHandler(
    'GET',
    'Enrichment',
    'webset-enrichment get <webset-id> <enrichment-id>',
    2,
    (ids) => enrichmentPath(ids)
  ),
  update: resourceHandler(
    'PATCH',
    'Enrichment',
    'webset-enrichment update <webset-id> <enrichment-id>',
    2,
    (ids) => enrichmentPath(ids),
    enrichmentBody
  ),
  delete: resourceHandler(
    'DELETE',
    'Deleted Enrichment',
    'webset-enrichment delete <webset-id> <enrichment-id>',
    2,
    (ids) => enrichmentPath(ids)
  ),
  cancel: resourceHandler(
    'POST',
    'Enrichment',
    'webset-enrichment cancel <webset-id> <enrichment-id>',
    2,
    (ids) => enrichmentPath(ids, 'cancel')
  ),
};

// Webset monitors (cron-scheduled searches that add items to a webset)

async function websetMonitorFields(args: CliArgs): Promise<Body> {
  const config = nonEmpty({
    ...buildSearchFields(args),
    behavior: parseEnum('behavior', args.behavior, WEBSET_SEARCH_BEHAVIORS),
  });
  return {
    cadence: args.cron
      ? compact({ cron: args.cron, timezone: args.timezone })
      : undefined,
    behavior: config ? { type: 'search', config } : undefined,
    metadata: await parseMetadata('metadata', args.metadata),
  };
}

async function websetMonitorCreate(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const usage = 'webset-monitor create <webset-id> --cron <expr> --count <n>';
  const websetId = requireArg(positionals[0], usage);
  const body = await withBody(args, {
    websetId,
    ...(await websetMonitorFields(args)),
  });
  requireFields(body, ['cadence', 'behavior'], usage);
  const config = (body.behavior as { config?: Body }).config;
  if (config?.count === undefined) {
    throw new UsageError(
      `Missing --count (or behavior.config.count in --body). Usage: exacli ${usage}`
    );
  }
  const result = await client.request<Resource>('POST', path('monitors'), {
    body,
  });
  printOutput(result, args, formatResource('Webset Monitor'));
}

export const websetMonitors: Record<string, Handler> = {
  create: websetMonitorCreate,
  list: listHandler(
    'Webset Monitors',
    'webset-monitor list',
    0,
    () => path('monitors'),
    (args) => ({
      websetId: args.webset,
    })
  ),
  get: resourceHandler(
    'GET',
    'Webset Monitor',
    'webset-monitor get <monitor-id>',
    1,
    ([id = '']) => path('monitors', id)
  ),
  update: resourceHandler(
    'PATCH',
    'Webset Monitor',
    'webset-monitor update <monitor-id>',
    1,
    ([id = '']) => path('monitors', id),
    async (args) =>
      withBody(args, {
        ...(await websetMonitorFields(args)),
        status: parseEnum('status', args.status, WEBSET_MONITOR_STATUSES),
      })
  ),
  delete: resourceHandler(
    'DELETE',
    'Deleted Webset Monitor',
    'webset-monitor delete <monitor-id>',
    1,
    ([id = '']) => path('monitors', id)
  ),
  runs: listHandler(
    'Webset Monitor Runs',
    'webset-monitor runs <monitor-id>',
    1,
    ([id = '']) => path('monitors', id, 'runs')
  ),
  run: resourceHandler(
    'GET',
    'Webset Monitor Run',
    'webset-monitor run <monitor-id> <run-id>',
    2,
    ([id = '', run = '']) => path('monitors', id, 'runs', run)
  ),
};

// Imports

/**
 * Counts non-blank CSV records. A quote only opens a quoted field at the
 * start of a field, so newlines inside quoted fields do not count.
 */
export function countCsvRecords(csv: string): number {
  let records = 0;
  let inQuotes = false;
  let fieldStart = true;
  let hasContent = false;
  for (const char of csv.replace(/\r\n?/g, '\n')) {
    if (char === '"' && (inQuotes || fieldStart)) inQuotes = !inQuotes;
    if (char === '\n' && !inQuotes) {
      if (hasContent) records++;
      hasContent = false;
    } else if (char.trim() !== '') {
      hasContent = true;
    }
    fieldStart = !inQuotes && (char === ',' || char === '\n');
  }
  return hasContent ? records + 1 : records;
}

/**
 * Creates a CSV import and uploads the file to the returned upload URL.
 * The first CSV row is treated as a header and not counted.
 */
async function importCreate(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const usage = 'webset-import create <file.csv> --entity <type>';
  const csvPath = requireArg(positionals[0], usage);
  const file = Bun.file(csvPath);
  const csv = await readTextFile('webset-import create', csvPath);
  const body = requireFields(
    await withBody(args, {
      format: 'csv',
      size: file.size,
      count: Math.max(countCsvRecords(csv) - 1, 0),
      title: args.title,
      entity: buildEntity(args),
      csv: nonEmpty({
        identifier: parseInteger(
          'identifier-column',
          args['identifier-column']
        ),
      }),
      metadata: await parseMetadata('metadata', args.metadata),
    }),
    ['entity'],
    usage
  );

  const created = await client.request<Resource & { uploadUrl?: string }>(
    'POST',
    path('imports'),
    { body }
  );
  if (!created.uploadUrl) {
    throw new Error(`Import ${created.id} created but no upload URL returned`);
  }
  // Upload the original bytes; decoding to text would alter non-UTF-8 files.
  const upload = await fetchExternal(created.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'text/csv' },
    body: file,
  });
  if (!upload.ok) {
    throw new Error(
      `Import ${created.id} created but the CSV upload failed (HTTP ${upload.status})`
    );
  }
  printOutput(created, args, formatResource('Import'));
}

export const websetImports: Record<string, Handler> = {
  create: importCreate,
  list: listHandler('Imports', 'webset-import list', 0, () => path('imports')),
  get: resourceHandler(
    'GET',
    'Import',
    'webset-import get <import-id>',
    1,
    ([id = '']) => path('imports', id)
  ),
  update: resourceHandler(
    'PATCH',
    'Import',
    'webset-import update <import-id>',
    1,
    ([id = '']) => path('imports', id),
    async (args) =>
      withBody(args, {
        title: args.title,
        metadata: await parseMetadata('metadata', args.metadata),
      })
  ),
  delete: resourceHandler(
    'DELETE',
    'Deleted Import',
    'webset-import delete <import-id>',
    1,
    ([id = '']) => path('imports', id)
  ),
};

// Webhooks and events

async function webhookBody(args: CliArgs): Promise<Body> {
  return withBody(args, {
    url: args['webhook-url'],
    events: parseStringList(args.events),
    metadata: await parseMetadata('metadata', args.metadata),
  });
}

export const websetWebhooks: Record<string, Handler> = {
  create: resourceHandler(
    'POST',
    'Webhook',
    'webset-webhook create --webhook-url <url> --events <list>',
    0,
    () => path('webhooks'),
    async (args) =>
      requireFields(
        await webhookBody(args),
        ['url', 'events'],
        'webset-webhook create --webhook-url <url> --events <list>'
      )
  ),
  list: listHandler('Webhooks', 'webset-webhook list', 0, () =>
    path('webhooks')
  ),
  get: resourceHandler(
    'GET',
    'Webhook',
    'webset-webhook get <webhook-id>',
    1,
    ([id = '']) => path('webhooks', id)
  ),
  update: resourceHandler(
    'PATCH',
    'Webhook',
    'webset-webhook update <webhook-id>',
    1,
    ([id = '']) => path('webhooks', id),
    webhookBody
  ),
  delete: resourceHandler(
    'DELETE',
    'Deleted Webhook',
    'webset-webhook delete <webhook-id>',
    1,
    ([id = '']) => path('webhooks', id)
  ),
  attempts: listHandler(
    'Webhook Attempts',
    'webset-webhook attempts <webhook-id>',
    1,
    ([id = '']) => path('webhooks', id, 'attempts'),
    (args) => ({
      eventType: args['event-type'],
      successful: parseEnum('successful', args.successful, BOOLEAN_STRINGS),
    })
  ),
};

export const websetEvents: Record<string, Handler> = {
  list: listHandler(
    'Events',
    'webset-event list',
    0,
    () => path('events'),
    (args) => ({
      types: parseStringList(args.types),
      createdAfter: args['created-after'],
      createdBefore: args['created-before'],
    })
  ),
  get: resourceHandler(
    'GET',
    'Event',
    'webset-event get <event-id>',
    1,
    ([id = '']) => path('events', id)
  ),
};

export const team: Handler = resourceHandler('GET', 'Team', 'team', 0, () =>
  path('teams', 'me')
);
