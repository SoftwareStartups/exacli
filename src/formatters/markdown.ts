/**
 * Markdown output formatter
 */

const COST_DECIMALS = 4;
const SCORE_DECIMALS = 3;
const HIGHLIGHT_SCORE_DECIMALS = 2;

export function formatSearchResults(
  response: unknown,
  options: { json?: boolean } = {}
) {
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
      subpages?: Array<{
        title?: string | null;
        url: string;
        text?: string;
        summary?: string;
      }>;
      extras?: {
        links?: string[];
        imageLinks?: string[];
      };
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

    if (result.extras) {
      if (result.extras.links && result.extras.links.length > 0) {
        output += '### Links\n\n';
        for (const link of result.extras.links) {
          output += `- ${link}\n`;
        }
        output += '\n';
      }
      if (result.extras.imageLinks && result.extras.imageLinks.length > 0) {
        output += '### Image Links\n\n';
        for (const link of result.extras.imageLinks) {
          output += `- ${link}\n`;
        }
        output += '\n';
      }
    }

    if (result.subpages && result.subpages.length > 0) {
      output += '### Subpages\n\n';
      for (let j = 0; j < result.subpages.length; j++) {
        const subpage = result.subpages[j];
        if (!subpage) continue;
        output += `${j + 1}. [${subpage.title || 'Untitled'}](${subpage.url})\n`;
        if (subpage.summary) {
          output += `   ${subpage.summary}\n`;
        }
      }
      output += '\n';
    }

    output += '---\n\n';
  }

  return output;
}

export function formatAnswerResponse(
  response: unknown,
  options: { json?: boolean } = {}
) {
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

export function formatResearchTask(
  task: unknown,
  options: { json?: boolean } = {}
) {
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

export function formatError(error: unknown) {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

export function formatSuccess(message: string) {
  return `[OK] ${message}`;
}
