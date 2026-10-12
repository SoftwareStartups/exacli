import type { ExaClient, QueryValue } from '../client.js';
import {
  formatMonitor,
  formatMonitorBatch,
  formatMonitorList,
  formatMonitorRun,
  formatMonitorRunList,
  formatSuccess,
} from '../formatters/markdown.js';
import { printOutput } from '../utils/commands.js';
import {
  betaHeaders,
  buildContents,
  compact,
  nonEmpty,
  paginationQuery,
} from '../utils/options.js';
import {
  UsageError,
  parseEnum,
  parseInteger,
  parseJsonObject,
  parseStringList,
  requireArg,
} from '../utils/validation.js';
import {
  type CliArgs,
  type ListResponse,
  MONITOR_BATCH_ACTIONS,
  MONITOR_STATUSES,
  type Monitor,
  type MonitorRun,
} from './types.js';

const monitorPath = (id: string, suffix = '') =>
  `/monitors/${encodeURIComponent(id)}${suffix}`;

async function buildSearch(
  query: string | undefined,
  args: CliArgs
): Promise<{ search?: Record<string, unknown>; betas: string[] }> {
  const { contents, betas } = await buildContents(args);
  const search = nonEmpty({
    query,
    numResults: parseInteger('num-results', args['num-results']),
    includeDomains: parseStringList(args['include-domains']),
    excludeDomains: parseStringList(args['exclude-domains']),
    contents,
  });
  return { search, betas };
}

function buildWebhook(args: CliArgs): Record<string, unknown> | undefined {
  return nonEmpty({
    url: args['webhook-url'],
    events: parseStringList(args['webhook-events']),
  });
}

export async function monitorCreate(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const query = requireArg(
    positionals.join(' '),
    'monitor create <query> --webhook-url <url>'
  );
  if (!args['webhook-url']) throw new UsageError('--webhook-url is required');
  const { search, betas } = await buildSearch(query, args);

  const monitor = await client.request<Monitor>('POST', '/monitors', {
    body: compact({
      name: args.name,
      search,
      trigger: args.period
        ? { type: 'interval', period: args.period }
        : undefined,
      outputSchema: await parseJsonObject(
        'output-schema',
        args['output-schema']
      ),
      metadata: await parseJsonObject('metadata', args.metadata),
      webhook: buildWebhook(args),
    }),
    headers: betaHeaders(betas),
  });
  printOutput(monitor, args, formatMonitor);
}

export async function monitorUpdate(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'monitor update <monitor-id>');
  if (args['remove-schedule'] && args.period) {
    throw new UsageError('Use either --period or --remove-schedule, not both');
  }
  const { search, betas } = await buildSearch(args.query, args);
  const body = compact({
    name: args.name,
    status: parseEnum('status', args.status, ['active', 'paused'] as const),
    search,
    trigger: args['remove-schedule']
      ? null
      : args.period
        ? { type: 'interval', period: args.period }
        : undefined,
    outputSchema: await parseJsonObject('output-schema', args['output-schema']),
    metadata: await parseJsonObject('metadata', args.metadata),
    webhook: buildWebhook(args),
  });
  if (Object.keys(body).length === 0) {
    throw new UsageError('Nothing to update. Pass at least one option.');
  }

  const monitor = await client.request<Monitor>('PATCH', monitorPath(id), {
    body,
    headers: betaHeaders(betas),
  });
  printOutput(monitor, args, formatMonitor);
}

/** Expands `{"team":"x"}` into the `metadata[team]=x` query filter. */
async function metadataQuery(
  args: CliArgs
): Promise<Record<string, QueryValue>> {
  const metadata = (await parseJsonObject('metadata', args.metadata)) ?? {};
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      `metadata[${key}]`,
      String(value),
    ])
  );
}

export async function monitorList(
  client: ExaClient,
  _positionals: string[],
  args: CliArgs
): Promise<void> {
  const monitors = await client.request<ListResponse<Monitor>>(
    'GET',
    '/monitors',
    {
      query: {
        ...paginationQuery(args),
        status: parseEnum('status', args.status, MONITOR_STATUSES),
        name: args.name,
        ...(await metadataQuery(args)),
      },
    }
  );
  printOutput(monitors, args, formatMonitorList);
}

export async function monitorGet(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'monitor get <monitor-id>');
  const monitor = await client.request<Monitor>('GET', monitorPath(id));
  printOutput(monitor, args, formatMonitor);
}

export async function monitorDelete(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'monitor delete <monitor-id>');
  const monitor = await client.request<Monitor>('DELETE', monitorPath(id));
  printOutput(monitor, args, () => formatSuccess(`Deleted monitor ${id}`));
}

export async function monitorTrigger(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'monitor trigger <monitor-id>');
  const result = await client.request<{ triggered: boolean }>(
    'POST',
    monitorPath(id, '/trigger')
  );
  printOutput(result, args, (r) =>
    r.triggered
      ? formatSuccess(`Triggered monitor ${id}`)
      : `Monitor ${id} was not triggered`
  );
}

export async function monitorRuns(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'monitor runs <monitor-id>');
  const runs = await client.request<ListResponse<MonitorRun>>(
    'GET',
    monitorPath(id, '/runs'),
    { query: paginationQuery(args) }
  );
  printOutput(runs, args, formatMonitorRunList);
}

export async function monitorRun(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const usage = 'monitor run <monitor-id> <run-id>';
  const id = requireArg(positionals[0], usage);
  const runId = requireArg(positionals[1], usage);
  const run = await client.request<MonitorRun>(
    'GET',
    monitorPath(id, `/runs/${encodeURIComponent(runId)}`)
  );
  printOutput(run, args, formatMonitorRun);
}

export async function monitorBatch(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const action = parseEnum(
    'action',
    requireArg(positionals[0], 'monitor batch <delete|pause|unpause>'),
    MONITOR_BATCH_ACTIONS
  );
  const filter = nonEmpty({
    name: args.name,
    status: parseEnum('status', args.status, MONITOR_STATUSES),
    metadata: await parseJsonObject('metadata', args.metadata),
  });
  if (!filter) {
    throw new UsageError(
      'monitor batch needs at least one filter: --name, --status, or --metadata'
    );
  }

  const result = await client.request<{
    action: string;
    affected: number;
    ids: string[];
    dry_run: boolean;
    has_more?: boolean;
  }>('POST', '/monitors/batch', {
    body: compact({
      action,
      filter,
      dry_run: !args.execute,
      limit: parseInteger('limit', args.limit),
    }),
  });
  printOutput(result, args, formatMonitorBatch);
}
