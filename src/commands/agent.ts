import type { ExaClient } from '../client.js';
import {
  formatAgentEvents,
  formatAgentRun,
  formatAgentRunList,
  formatSuccess,
} from '../formatters/markdown.js';
import { logStatus, printOutput, printStreamItem } from '../utils/commands.js';
import { compact, nonEmpty, paginationQuery } from '../utils/options.js';
import {
  parseEnum,
  parseInteger,
  parseJsonObject,
  parseNumber,
  parseStringList,
  requireArg,
} from '../utils/validation.js';
import {
  AGENT_EFFORTS,
  type AgentRun,
  type CliArgs,
  type ListResponse,
} from './types.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const TERMINAL_EVENTS = new Set(
  [...TERMINAL_STATUSES].map((status) => `agent_run.${status}`)
);
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 30 * 60_000;

const runPath = (id: string, suffix = '') =>
  `/agent/runs/${encodeURIComponent(id)}${suffix}`;

async function buildAgentRunBody(
  query: string,
  args: CliArgs
): Promise<Record<string, unknown>> {
  return compact({
    query,
    effort: parseEnum('effort', args.effort, AGENT_EFFORTS),
    systemPrompt: args['system-prompt'],
    outputSchema: await parseJsonObject('output-schema', args['output-schema']),
    input: await parseJsonObject('input', args.input),
    previousRunId: args['previous-run'],
    metadata: await parseJsonObject('metadata', args.metadata),
    dataSources: parseStringList(args['data-sources'])?.map((provider) => ({
      provider,
    })),
    budget: nonEmpty({
      maxCostDollars: parseNumber('max-cost', args['max-cost']),
      maxDurationSeconds: parseInteger('max-duration', args['max-duration']),
    }),
    userIdentifier: args['user-id'],
  });
}

export async function agentRun(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const query = requireArg(positionals.join(' '), 'agent run <query>');
  const body = await buildAgentRunBody(query, args);

  if (args.stream) {
    for await (const event of client.stream('/agent/runs', { body })) {
      const { name, data } = unwrapAgentEvent(event.event, event.data);
      if (args.json) {
        printStreamItem({ event: name, id: event.id, data }, args);
      } else if (name && TERMINAL_EVENTS.has(name)) {
        console.log(formatAgentRun(data as AgentRun));
      } else {
        logStatus(name ?? 'event');
      }
    }
    return;
  }

  const run = await client.request<AgentRun>('POST', '/agent/runs', { body });
  const result = args.wait ? await waitForRun(client, run, args) : run;
  printOutput(result, args, formatAgentRun);
}

/**
 * The live API puts the event name on the SSE `event:` line and the run in
 * `data:`; the spec models the payload as `{id, event, data}`. Accept both.
 */
function unwrapAgentEvent(
  sseEvent: string | undefined,
  raw: string
): { name?: string; data: unknown } {
  const payload: unknown = JSON.parse(raw);
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'event' in payload &&
    'data' in payload
  ) {
    const wrapped = payload as { event?: string; data: unknown };
    return { name: wrapped.event ?? sseEvent, data: wrapped.data };
  }
  return { name: sseEvent, data: payload };
}

async function waitForRun(
  client: ExaClient,
  run: AgentRun,
  args: CliArgs
): Promise<AgentRun> {
  const interval =
    parseInteger('poll-interval', args['poll-interval']) ??
    DEFAULT_POLL_INTERVAL_MS;
  const timeout = parseInteger('timeout', args.timeout) ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeout;
  let current = run;
  logStatus(`Run ${run.id}: ${run.status}`);

  while (!TERMINAL_STATUSES.has(current.status)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for run ${run.id} (status: ${current.status}). Check later with: exacli agent get ${run.id}`
      );
    }
    await Bun.sleep(interval);
    const previous = current.status;
    current = await client.request<AgentRun>('GET', runPath(run.id));
    if (current.status !== previous) {
      logStatus(`Run ${run.id}: ${current.status}`);
    }
  }
  return current;
}

export async function agentGet(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'agent get <run-id>');
  const run = await client.request<AgentRun>('GET', runPath(id));
  printOutput(run, args, formatAgentRun);
}

export async function agentList(
  client: ExaClient,
  _positionals: string[],
  args: CliArgs
): Promise<void> {
  const runs = await client.request<ListResponse<AgentRun>>(
    'GET',
    '/agent/runs',
    { query: paginationQuery(args) }
  );
  printOutput(runs, args, formatAgentRunList);
}

export async function agentCancel(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'agent cancel <run-id>');
  const run = await client.request<AgentRun>('POST', runPath(id, '/cancel'));
  printOutput(run, args, formatAgentRun);
}

export async function agentStop(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'agent stop <run-id>');
  const run = await client.request<AgentRun>('POST', runPath(id, '/stop'));
  printOutput(run, args, formatAgentRun);
}

export async function agentDelete(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'agent delete <run-id>');
  const result = await client.request<{ id: string }>('DELETE', runPath(id));
  printOutput(result, args, () => formatSuccess(`Deleted agent run ${id}`));
}

export async function agentEvents(
  client: ExaClient,
  positionals: string[],
  args: CliArgs
): Promise<void> {
  const id = requireArg(positionals[0], 'agent events <run-id>');
  const events = await client.request<
    ListResponse<{ id?: string; event: string; createdAt?: string }>
  >('GET', runPath(id, '/events'), { query: paginationQuery(args) });
  printOutput(events, args, formatAgentEvents);
}
