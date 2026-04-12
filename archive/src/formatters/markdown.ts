/**
 * Markdown output formatter
 */

async function loadEncode(): Promise<
  (input: unknown, options?: { keyFolding?: 'off' | 'safe' }) => string
> {
  try {
    const mod = await import('@toon-format/toon');
    return mod.encode;
  } catch {
    throw new Error(
      'TOON output requires @toon-format/toon to be installed. Run: bun install'
    );
  }
}

async function toToon(data: unknown): Promise<string> {
  const encode = await loadEncode();
  return encode(data, { keyFolding: 'safe' });
}

const COST_DECIMALS = 4;
const SCORE_DECIMALS = 3;
const HIGHLIGHT_SCORE_DECIMALS = 2;

export async function formatSearchResults(
  response: unknown,
  options: { json?: boolean; toon?: boolean } = {}
): Promise<string> {
  if (options.toon) {
    return toToon(response);
  }
  if (options.json) {
    return JSON.stringify(response, null, 2);
  }

  const data = response as {
    requestId?: string;
    costDollars?: { total?: number };
    results?: Array<{
      title?: string | null;
      url: string;
      id: string;
      publishedDate?: string;
      author?: string | null;
      score?: number;
      text?: string;
      highlights?: string[];
      highlightScores?: number[];
      summary?: string;
    }>;
  };

  let output = '# Search Results\n\n';

  if (data.requestId) {
    output += `Request ID: ${data.requestId}\n\n`;
  }

  if (data.costDollars) {
    output += `Cost: $${data.costDollars.total?.toFixed(COST_DECIMALS) || '0.0000'}\n\n`;
  }

  if (!data.results || data.results.length === 0) {
    output += 'No results found.\n';
    return output;
  }

  for (let i = 0; i < data.results.length; i++) {
    const result = data.results[i];
    if (!result) continue;

    output += `## ${i + 1}. ${result.title || 'Untitled'}\n\n`;
    output += `- **URL:** ${result.url}\n`;
    output += `- **ID:** ${result.id}\n`;

    if (result.publishedDate) {
      output += `- **Published:** ${result.publishedDate}\n`;
    }

    if (result.author) {
      output += `- **Author:** ${result.author}\n`;
    }

    if (result.score) {
      output += `- **Relevance Score:** ${result.score.toFixed(SCORE_DECIMALS)}\n`;
    }

    output += '\n';

    if (result.text) {
      output += `### Content\n\n${result.text}\n\n`;
    }

    if (result.highlights && result.highlights.length > 0) {
      output += '### Highlights\n\n';
      for (let j = 0; j < result.highlights.length; j++) {
        const score = result.highlightScores?.[j];
        output += `- ${result.highlights[j]}${score ? ` (score: ${score.toFixed(HIGHLIGHT_SCORE_DECIMALS)})` : ''}\n`;
      }
      output += '\n';
    }

    if (result.summary) {
      output += `### Summary\n\n${result.summary}\n\n`;
    }

    output += '---\n\n';
  }

  return output;
}

export async function formatAnswerResponse(
  response: unknown,
  options: { json?: boolean; toon?: boolean } = {}
): Promise<string> {
  if (options.toon) {
    return toToon(response);
  }
  if (options.json) {
    return JSON.stringify(response, null, 2);
  }

  const data = response as {
    requestId?: string;
    costDollars?: { total?: number };
    answer: string | Record<string, unknown>;
    citations?: Array<{
      title?: string | null;
      url: string;
    }>;
  };

  let output = '# Answer\n\n';

  if (data.requestId) {
    output += `Request ID: ${data.requestId}\n\n`;
  }

  if (data.costDollars) {
    output += `Cost: $${data.costDollars.total?.toFixed(COST_DECIMALS) || '0.0000'}\n\n`;
  }

  output += '## Response\n\n';

  if (typeof data.answer === 'string') {
    output += `${data.answer}\n\n`;
  } else {
    output += '```json\n';
    output += JSON.stringify(data.answer, null, 2);
    output += '\n```\n\n';
  }

  if (data.citations && data.citations.length > 0) {
    output += '## Citations\n\n';
    for (let i = 0; i < data.citations.length; i++) {
      const citation = data.citations[i];
      if (!citation) continue;
      output += `${i + 1}. [${citation.title || 'Untitled'}](${citation.url})\n`;
    }
    output += '\n';
  }

  return output;
}

export async function formatResearchTask(
  task: unknown,
  options: { json?: boolean; toon?: boolean } = {}
): Promise<string> {
  if (options.toon) {
    return toToon(task);
  }
  if (options.json) {
    return JSON.stringify(task, null, 2);
  }

  const data = task as {
    researchId: string;
    status: string;
    instructions?: string;
    costDollars?: {
      total: number;
      numSearches: number;
      numPages: number;
      reasoningTokens: number;
    };
    output?: {
      parsed?: Record<string, unknown>;
      content?: string;
    };
    citations?: Array<{
      url: string;
      title?: string | null;
    }>;
    events?: Array<{
      createdAt: number;
      eventType: string;
      message?: string;
    }>;
  };

  let output = '# Research Task\n\n';
  output += `- **ID:** ${data.researchId}\n`;
  output += `- **Status:** ${data.status}\n`;

  if (data.instructions) {
    output += `- **Instructions:** ${data.instructions}\n`;
  }

  if (data.costDollars) {
    output += `- **Cost:** $${data.costDollars.total.toFixed(COST_DECIMALS)} (${data.costDollars.numSearches} searches, ${data.costDollars.numPages} pages, ${data.costDollars.reasoningTokens} reasoning tokens)\n`;
  }

  output += '\n';

  if (data.output) {
    output += '## Output\n\n';
    if (data.output.parsed) {
      output += '```json\n';
      output += JSON.stringify(data.output.parsed, null, 2);
      output += '\n```\n\n';
    }
    if (data.output.content) {
      output += `${data.output.content}\n\n`;
    }
  }

  if (data.citations && data.citations.length > 0) {
    output += '## Sources\n\n';
    for (let i = 0; i < data.citations.length; i++) {
      const citation = data.citations[i];
      if (!citation) continue;
      output += `${i + 1}. [${citation.title || 'Untitled'}](${citation.url})\n`;
    }
    output += '\n';
  }

  if (data.events && data.events.length > 0) {
    output += '## Events\n\n';
    for (const event of data.events) {
      const timestamp = new Date(event.createdAt).toISOString();
      output += `- [${timestamp}] ${event.eventType}${event.message ? `: ${event.message}` : ''}\n`;
    }
    output += '\n';
  }

  return output;
}

export async function formatError(
  error: unknown,
  options: { toon?: boolean } = {}
): Promise<string> {
  const message = error instanceof Error ? error.message : String(error);
  if (options.toon) {
    return toToon({ error: message });
  }
  return `Error: ${message}`;
}

export async function formatSuccess(
  message: string,
  options: { toon?: boolean } = {}
): Promise<string> {
  if (options.toon) {
    return toToon({ message });
  }
  return `[OK] ${message}`;
}
