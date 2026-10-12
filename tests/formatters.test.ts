import { describe, expect, test } from 'bun:test';
import {
  formatAgentRun,
  formatAgentRunList,
  formatAnswerResponse,
  formatBatch,
  formatMonitor,
  formatMonitorBatch,
  formatSearchResults,
} from '../src/formatters/markdown.js';

describe('formatSearchResults', () => {
  test('renders metadata, contents, extras, and subpages', () => {
    const output = formatSearchResults({
      requestId: 'req-1',
      costDollars: { total: 0.007 },
      results: [
        {
          id: 'https://a.com',
          url: 'https://a.com',
          title: 'A',
          author: 'Ann',
          publishedDate: '2026-01-15',
          score: 0.95,
          text: 'Body text',
          highlights: ['key line'],
          summary: 'Short summary',
          extras: { links: ['https://a.com/x'], codeBlocks: ['const a = 1'] },
          subpages: [{ id: 's', url: 'https://a.com/about', title: 'About' }],
          entities: [{ type: 'company', properties: { name: 'Acme' } }],
        },
      ],
    });

    expect(output).toContain('Request ID: req-1');
    expect(output).toContain('Cost: $0.0070');
    expect(output).toContain('## 1. A');
    expect(output).toContain('- **Score:** 0.950');
    expect(output).toContain('Entity (company): Acme');
    expect(output).toContain('### Content\n\nBody text');
    expect(output).toContain('- key line');
    expect(output).toContain('### Summary\n\nShort summary');
    expect(output).toContain('### Links\n\n- https://a.com/x');
    expect(output).toContain('### Code Blocks\n\n- const a = 1');
    expect(output).toContain('1. [About](https://a.com/about)');
  });

  test('renders synthesized output with grounding', () => {
    const output = formatSearchResults({
      output: {
        content: { founders: ['Will Bryk'] },
        grounding: [
          {
            field: 'founders',
            confidence: 'high',
            citations: [{ url: 'https://exa.ai/about' }],
          },
        ],
      },
      results: [],
    });
    expect(output).toContain('"founders"');
    expect(output).toContain('- **founders** (high): https://exa.ai/about');
    expect(output).toContain('No results found.');
  });

  test('lists URLs that failed content retrieval', () => {
    const output = formatSearchResults({
      results: [],
      statuses: [
        { id: 'https://ok.com', status: 'success' },
        {
          id: 'https://bad.com',
          status: 'error',
          error: { tag: 'CRAWL_NOT_FOUND' },
        },
      ],
    });
    expect(output).toContain('- https://bad.com: CRAWL_NOT_FOUND');
    expect(output).not.toContain('https://ok.com:');
  });
});

describe('formatAnswerResponse', () => {
  test('renders text answers with citations', () => {
    const output = formatAnswerResponse({
      answer: 'Paris',
      citations: [{ url: 'https://w.org/Paris', title: null }],
    });
    expect(output).toContain('## Response\n\nParis');
    expect(output).toContain('1. [Untitled](https://w.org/Paris)');
  });

  test('renders structured answers as JSON', () => {
    expect(formatAnswerResponse({ answer: { city: 'Paris' } })).toContain(
      '"city": "Paris"'
    );
  });
});

describe('formatAgentRun', () => {
  test('renders a completed run with output and cost', () => {
    const output = formatAgentRun({
      id: 'r1',
      status: 'completed',
      stopReason: 'schema_satisfied',
      request: { query: 'q', effort: 'low' },
      costDollars: { total: 0.012 },
      output: { text: 'Answer', structured: { a: 1 } },
    });
    expect(output).toContain('- **Stop reason:** schema_satisfied');
    expect(output).toContain('- **Cost:** $0.0120');
    expect(output).toContain('## Output\n\nAnswer');
    expect(output).toContain('## Structured Output');
    expect(output).not.toContain('Check progress');
  });

  test('suggests a follow-up for runs still in progress', () => {
    expect(formatAgentRun({ id: 'r1', status: 'queued' })).toContain(
      'Check progress with: exacli agent get r1'
    );
  });

  test('lists runs with a pagination hint', () => {
    const output = formatAgentRunList({
      data: [{ id: 'r1', status: 'running' }],
      hasMore: true,
      nextCursor: 'c2',
    });
    expect(output).toContain('- r1: running');
    expect(output).toContain('Use --cursor c2');
  });
});

describe('formatMonitor', () => {
  test('shows the schedule and the one-time webhook secret', () => {
    const output = formatMonitor({
      id: 'm1',
      status: 'active',
      search: { query: 'q' },
      trigger: { type: 'interval', period: '1d' },
      webhookSecret: 'whsec_1',
    });
    expect(output).toContain('- **Schedule:** every 1d');
    expect(output).toContain('Webhook secret (shown once): whsec_1');
  });

  test('labels monitors without a trigger as manual', () => {
    expect(formatMonitor({ id: 'm1', status: 'active' })).toContain(
      '- **Schedule:** manual'
    );
  });

  test('explains dry runs of batch actions', () => {
    const output = formatMonitorBatch({
      action: 'delete',
      affected: 2,
      ids: ['m1', 'm2'],
      dry_run: true,
    });
    expect(output).toContain('Would delete 2 monitor(s)');
    expect(output).toContain('--execute');
  });
});

describe('formatBatch', () => {
  test('shows request counts and the results hint', () => {
    const output = formatBatch({
      id: 'b1',
      status: 'completed',
      requestCounts: { total: 3, completed: 2, failed: 1 },
      resultsUrl: 'https://files/x',
    });
    expect(output).toContain('2/3 completed, 1 failed');
    expect(output).toContain('exacli batch results b1');
  });
});
