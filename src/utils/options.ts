/**
 * Builders that map CLI flags onto Exa API request fields.
 */

import {
  type CliArgs,
  DYNAMIC_HIGHLIGHTS_BETA,
  HIGHLIGHTS_VERBOSITY,
  LIVECRAWL_MODES,
  SECTION_TAGS,
  TEXT_VERBOSITY,
} from '../commands/types.js';
import {
  UsageError,
  parseEnum,
  parseEnumList,
  parseInteger,
  parseJsonObject,
  parseNumber,
  parseStringList,
} from './validation.js';

type Body = Record<string, unknown>;

/** Drops undefined values so request bodies only carry set fields. */
export function compact(body: Body): Body {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined)
  );
}

export function nonEmpty(body: Body): Body | undefined {
  const result = compact(body);
  return Object.keys(result).length > 0 ? result : undefined;
}

export interface ContentsRequest {
  contents?: Body;
  /** Exa-Beta tokens the selected options require. */
  betas: string[];
}

export async function buildContents(args: CliArgs): Promise<ContentsRequest> {
  const betas: string[] = [];

  const textOptions = nonEmpty({
    maxCharacters: parseInteger('max-characters', args['max-characters']),
    includeHtmlTags: args['include-html-tags'] || undefined,
    verbosity: parseEnum(
      'text-verbosity',
      args['text-verbosity'],
      TEXT_VERBOSITY
    ),
    includeSections: parseEnumList(
      'include-sections',
      args['include-sections'],
      SECTION_TAGS
    ),
    excludeSections: parseEnumList(
      'exclude-sections',
      args['exclude-sections'],
      SECTION_TAGS
    ),
  });

  const highlightOptions = nonEmpty({
    query: args['highlights-query'],
    maxCharacters: parseInteger(
      'highlights-max-characters',
      args['highlights-max-characters']
    ),
    verbosity: parseEnum(
      'highlights-verbosity',
      args['highlights-verbosity'],
      HIGHLIGHTS_VERBOSITY
    ),
    dynamic: args['dynamic-highlights'] || undefined,
  });
  if (highlightOptions?.dynamic && highlightOptions.maxCharacters) {
    throw new UsageError(
      '--dynamic-highlights cannot be combined with --highlights-max-characters'
    );
  }
  if (highlightOptions?.dynamic || highlightOptions?.verbosity) {
    betas.push(DYNAMIC_HIGHLIGHTS_BETA);
  }

  const summarySchema = await parseJsonObject(
    'summary-schema',
    args['summary-schema']
  );
  const summaryOptions = nonEmpty({
    query: args['summary-query'],
    schema: summarySchema,
  });

  const maxAgeHours = parseInteger('max-age-hours', args['max-age-hours']);
  const livecrawl = parseEnum('livecrawl', args.livecrawl, LIVECRAWL_MODES);
  if (maxAgeHours !== undefined && livecrawl !== undefined) {
    throw new UsageError('Use either --max-age-hours or --livecrawl, not both');
  }

  const contents = nonEmpty({
    text: textOptions ?? (args.text ? true : undefined),
    highlights: highlightOptions ?? (args.highlights ? true : undefined),
    summary: summaryOptions ?? (args.summary ? true : undefined),
    maxAgeHours,
    livecrawl,
    livecrawlTimeout: parseInteger(
      'livecrawl-timeout',
      args['livecrawl-timeout']
    ),
    snapshotAsOf: args['snapshot-as-of'],
    subpages: parseInteger('subpages', args.subpages),
    subpageTarget: parseStringList(args['subpage-target']),
    extras: nonEmpty({
      links: parseInteger('extras-links', args['extras-links']),
      imageLinks: parseInteger(
        'extras-image-links',
        args['extras-image-links']
      ),
      richLinks: parseInteger('extras-rich-links', args['extras-rich-links']),
      richImageLinks: parseInteger(
        'extras-rich-image-links',
        args['extras-rich-image-links']
      ),
      codeBlocks: parseInteger(
        'extras-code-blocks',
        args['extras-code-blocks']
      ),
    }),
  });

  return { contents, betas };
}

/** Result filters shared by /search and /findSimilar. */
export function buildResultFilters(args: CliArgs): Body {
  return {
    numResults: parseInteger('num-results', args['num-results']),
    includeDomains: parseStringList(args['include-domains']),
    excludeDomains: parseStringList(args['exclude-domains']),
    startPublishedDate: args['start-date'],
    endPublishedDate: args['end-date'],
    category: args.category,
  };
}

/** `--user-location US` and/or `--latitude`/`--longitude`. */
export function buildUserLocation(args: CliArgs): string | Body | undefined {
  const latitude = parseNumber('latitude', args.latitude);
  const longitude = parseNumber('longitude', args.longitude);
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new UsageError('--latitude and --longitude must be set together');
  }
  if (latitude === undefined) return args['user-location'];
  return compact({ country: args['user-location'], latitude, longitude });
}

export function betaHeaders(
  betas: string[]
): Record<string, string> | undefined {
  return betas.length > 0 ? { 'Exa-Beta': betas.join(',') } : undefined;
}

export function paginationQuery(args: CliArgs): {
  limit?: number;
  cursor?: string;
} {
  return compact({
    limit: parseInteger('limit', args.limit),
    cursor: args.cursor,
  });
}
