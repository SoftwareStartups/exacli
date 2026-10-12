/**
 * Markdown output formatters (default output mode).
 */

import type {
  AgentRun,
  AnswerResponse,
  Batch,
  Citation,
  GroundingEntry,
  ListResponse,
  Monitor,
  MonitorRun,
  SearchResponse,
  SearchResult,
} from '../commands/types.js';

const COST_DECIMALS = 4;
const SCORE_DECIMALS = 3;

const EXTRAS_HEADINGS: Record<string, string> = {
  links: 'Links',
  imageLinks: 'Image Links',
  richLinks: 'Rich Links',
  richImageLinks: 'Rich Image Links',
  codeBlocks: 'Code Blocks',
};

function header(title: string, requestId?: string, cost?: number): string {
  let output = `# ${title}\n\n`;
  if (requestId) output += `Request ID: ${requestId}\n\n`;
  if (cost !== undefined) output += `Cost: $${cost.toFixed(COST_DECIMALS)}\n\n`;
  return output;
}

function jsonBlock(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
}

function content(value: unknown): string {
  return typeof value === 'string' ? `${value}\n\n` : jsonBlock(value);
}

function bullets(fields: Array<[string, unknown]>): string {
  return fields
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
    .map(([label, value]) => `- **${label}:** ${value}\n`)
    .join('');
}

function moreHint(list: ListResponse<unknown>): string {
  return list.hasMore && list.nextCursor
    ? `More results available. Use --cursor ${list.nextCursor}\n`
    : '';
}

export function formatCitations(
  citations: Citation[],
  title = 'Citations'
): string {
  if (citations.length === 0) return '';
  const lines = citations.map(
    (c, i) => `${i + 1}. [${c.title || 'Untitled'}](${c.url})`
  );
  return `## ${title}\n\n${lines.join('\n')}\n\n`;
}

function formatGrounding(
  grounding: GroundingEntry[] | null | undefined
): string {
  if (!grounding || grounding.length === 0) return '';
  let output = '## Grounding\n\n';
  for (const entry of grounding) {
    const confidence = entry.confidence ? ` (${entry.confidence})` : '';
    const sources = entry.citations.map((c) => c.url).join(', ');
    output += `- **${entry.field}**${confidence}: ${sources}\n`;
  }
  return `${output}\n`;
}

function formatResult(result: SearchResult, index: number): string {
  let output = `## ${index + 1}. ${result.title || 'Untitled'}\n\n`;
  output += bullets([
    ['URL', result.url],
    ['ID', result.id],
    ['Published', result.publishedDate],
    ['Author', result.author],
    ['Score', result.score?.toFixed(SCORE_DECIMALS)],
  ]);
  output += '\n';

  for (const entity of result.entities ?? []) {
    if (entity.properties?.name) {
      output += `Entity (${entity.type}): ${entity.properties.name}\n\n`;
    }
  }
  if (result.text) output += `### Content\n\n${result.text}\n\n`;
  if (result.highlights && result.highlights.length > 0) {
    output += '### Highlights\n\n';
    output += result.highlights.map((h) => `- ${h}\n`).join('');
    output += '\n';
  }
  if (result.summary) output += `### Summary\n\n${result.summary}\n\n`;

  for (const [key, items] of Object.entries(result.extras ?? {})) {
    if (!items || items.length === 0) continue;
    output += `### ${EXTRAS_HEADINGS[key] ?? key}\n\n`;
    output += items
      .map(
        (item) =>
          `- ${typeof item === 'string' ? item : JSON.stringify(item)}\n`
      )
      .join('');
    output += '\n';
  }

  if (result.subpages && result.subpages.length > 0) {
    output += '### Subpages\n\n';
    result.subpages.forEach((subpage, j) => {
      output += `${j + 1}. [${subpage.title || 'Untitled'}](${subpage.url})\n`;
      if (subpage.summary) output += `   ${subpage.summary}\n`;
    });
    output += '\n';
  }
  return `${output}---\n\n`;
}

export function formatSearchResults(response: SearchResponse): string {
  let output = header(
    'Search Results',
    response.requestId,
    response.costDollars?.total
  );

  if (response.output) {
    output += `## Output\n\n${content(response.output.content)}`;
    output += formatGrounding(response.output.grounding);
  }

  const failed = (response.statuses ?? []).filter(
    (s) => s.status !== 'success'
  );
  if (failed.length > 0) {
    output += '## Failed URLs\n\n';
    for (const status of failed) {
      const reason = status.error?.tag ?? status.status;
      output += `- ${status.id}: ${reason}\n`;
    }
    output += '\n';
  }

  const results = response.results ?? [];
  if (results.length === 0) return `${output}No results found.\n`;
  return output + results.map(formatResult).join('');
}

export function formatAnswerResponse(response: AnswerResponse): string {
  return (
    header('Answer', response.requestId, response.costDollars?.total) +
    `## Response\n\n${content(response.answer)}` +
    formatCitations(response.citations ?? [])
  );
}

export function formatAgentRun(run: AgentRun): string {
  let output = '# Agent Run\n\n';
  output += bullets([
    ['ID', run.id],
    ['Status', run.status],
    ['Stop reason', run.stopReason],
    ['Effort', run.request?.effort],
    ['Query', run.request?.query],
    ['Created', run.createdAt],
    ['Completed', run.completedAt],
    [
      'Cost',
      run.costDollars?.total === undefined
        ? undefined
        : `$${run.costDollars.total.toFixed(COST_DECIMALS)}`,
    ],
    ['Error', run.error?.message],
  ]);
  output += '\n';

  if (run.output?.text) output += `## Output\n\n${run.output.text}\n\n`;
  if (run.output?.structured !== undefined && run.output.structured !== null) {
    output += `## Structured Output\n\n${jsonBlock(run.output.structured)}`;
  }
  output += formatGrounding(run.output?.grounding);

  if (run.status === 'queued' || run.status === 'running') {
    output += `Check progress with: exacli agent get ${run.id}\n`;
  }
  return output;
}

export function formatAgentRunList(list: ListResponse<AgentRun>): string {
  let output = '# Agent Runs\n\n';
  if (list.data.length === 0) return `${output}No agent runs found.\n`;
  for (const run of list.data) {
    const query = run.request?.query ? ` ${run.request.query}` : '';
    output += `- ${run.id}: ${run.status}${query}\n`;
  }
  return `${output}\n${moreHint(list)}`;
}

export function formatAgentEvents(
  list: ListResponse<{ id?: string; event: string; createdAt?: string }>
): string {
  let output = '# Agent Run Events\n\n';
  if (list.data.length === 0) return `${output}No events found.\n`;
  for (const event of list.data) {
    output += `- ${event.createdAt ? `[${event.createdAt}] ` : ''}${event.event}\n`;
  }
  return `${output}\n${moreHint(list)}`;
}

export function formatMonitor(monitor: Monitor): string {
  let output = '# Monitor\n\n';
  output += bullets([
    ['ID', monitor.id],
    ['Name', monitor.name],
    ['Status', monitor.status],
    ['Query', monitor.search?.query],
    [
      'Schedule',
      monitor.trigger?.period ? `every ${monitor.trigger.period}` : 'manual',
    ],
    ['Next run', monitor.nextRunAt],
    ['Webhook', monitor.webhook?.url],
    ['Created', monitor.createdAt],
  ]);
  if (monitor.webhookSecret) {
    output += `\nWebhook secret (shown once): ${monitor.webhookSecret}\n`;
  }
  return output;
}

export function formatMonitorList(list: ListResponse<Monitor>): string {
  let output = '# Monitors\n\n';
  if (list.data.length === 0) return `${output}No monitors found.\n`;
  for (const m of list.data) {
    const label = m.name ? `${m.name} ` : '';
    output += `- ${m.id}: ${label}[${m.status}] ${m.search?.query ?? ''}\n`;
  }
  return `${output}\n${moreHint(list)}`;
}

export function formatMonitorRun(run: MonitorRun): string {
  let output = '# Monitor Run\n\n';
  output += bullets([
    ['ID', run.id],
    ['Monitor', run.monitorId],
    ['Status', run.status],
    ['Fail reason', run.failReason],
    ['Created', run.createdAt],
    ['Completed', run.completedAt],
    ['Duration (ms)', run.durationMs],
  ]);
  output += '\n';
  if (run.output?.content !== undefined) {
    output += `## Output\n\n${content(run.output.content)}`;
  }
  if (run.output?.results && run.output.results.length > 0) {
    output += run.output.results.map(formatResult).join('');
  }
  return output;
}

export function formatMonitorRunList(list: ListResponse<MonitorRun>): string {
  let output = '# Monitor Runs\n\n';
  if (list.data.length === 0) return `${output}No runs found.\n`;
  for (const run of list.data) {
    output += `- ${run.id}: ${run.status}${run.createdAt ? ` (${run.createdAt})` : ''}\n`;
  }
  return `${output}\n${moreHint(list)}`;
}

export function formatMonitorBatch(result: {
  action: string;
  affected: number;
  ids: string[];
  dry_run: boolean;
}): string {
  const verb = result.dry_run ? 'Would' : 'Did';
  let output = `# Monitor Batch (${result.dry_run ? 'dry run' : 'executed'})\n\n`;
  output += `${verb} ${result.action} ${result.affected} monitor(s)\n\n`;
  output += result.ids.map((id) => `- ${id}\n`).join('');
  if (result.dry_run) output += '\nRe-run with --execute to apply.\n';
  return output;
}

export function formatBatch(batch: Batch): string {
  const counts = batch.requestCounts;
  let output = '# Batch\n\n';
  output += bullets([
    ['ID', batch.id],
    ['Status', batch.status],
    [
      'Requests',
      counts
        ? `${counts.completed}/${counts.total} completed, ${counts.failed} failed`
        : undefined,
    ],
    ['Created', batch.createdAt],
    ['Ended', batch.endedAt],
    ['Expires', batch.expiresAt],
  ]);
  if (batch.resultsUrl) {
    output += `\nDownload results with: exacli batch results ${batch.id}\n`;
  }
  return output;
}

export function formatBatchList(list: ListResponse<Batch>): string {
  let output = '# Batches\n\n';
  if (list.data.length === 0) return `${output}No batches found.\n`;
  for (const batch of list.data) {
    const counts = batch.requestCounts
      ? ` (${batch.requestCounts.completed}/${batch.requestCounts.total})`
      : '';
    output += `- ${batch.id}: ${batch.status}${counts}\n`;
  }
  return `${output}\n${moreHint(list)}`;
}

export function formatSuccess(message: string): string {
  return `[OK] ${message}`;
}

const SUMMARY_FIELDS = [
  'id',
  'object',
  'title',
  'name',
  'status',
  'type',
  'description',
  'format',
  'url',
  'websetId',
  'createdAt',
  'updatedAt',
];

function scalar(value: unknown): string | undefined {
  return ['string', 'number', 'boolean'].includes(typeof value)
    ? String(value)
    : undefined;
}

/** Generic formatter for Websets resources: key fields plus the full JSON. */
export function formatResource(
  title: string
): (resource: Record<string, unknown>) => string {
  return (resource) => {
    const shown = SUMMARY_FIELDS.map((field): [string, unknown] => [
      field,
      scalar(resource[field]),
    ]);
    const rest = Object.fromEntries(
      Object.entries(resource).filter(
        ([key, value]) =>
          !(SUMMARY_FIELDS.includes(key) && scalar(value) !== undefined) &&
          value !== null
      )
    );
    let output = `# ${title}\n\n${bullets(shown)}`;
    if (Object.keys(rest).length > 0) output += `\n${jsonBlock(rest)}`;
    return output;
  };
}

export function formatResourceList(
  title: string
): (list: ListResponse<Record<string, unknown>>) => string {
  return (list) => {
    let output = `# ${title}\n\n`;
    if (list.data.length === 0) return `${output}None found.\n`;
    for (const item of list.data) {
      const label =
        scalar(item.title) ?? scalar(item.name) ?? scalar(item.type);
      const status = scalar(item.status);
      output += `- ${scalar(item.id) ?? '?'}${status ? `: ${status}` : ''}${label ? ` ${label}` : ''}\n`;
    }
    return `${output}\n${moreHint(list)}`;
  };
}
