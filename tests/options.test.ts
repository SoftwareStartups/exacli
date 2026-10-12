import { describe, expect, test } from 'bun:test';
import { DYNAMIC_HIGHLIGHTS_BETA } from '../src/commands/types.js';
import {
  betaHeaders,
  buildContents,
  buildResultFilters,
  buildUserLocation,
  compact,
} from '../src/utils/options.js';

describe('buildContents', () => {
  test('returns no contents when no content flags are set', async () => {
    expect(await buildContents({})).toEqual({
      contents: undefined,
      betas: [],
    });
  });

  test('maps boolean content flags to true', async () => {
    const { contents } = await buildContents({
      text: true,
      highlights: true,
      summary: true,
    });
    expect(contents).toEqual({ text: true, highlights: true, summary: true });
  });

  test('builds text options from text-specific flags', async () => {
    const { contents } = await buildContents({
      'max-characters': '500',
      'include-html-tags': true,
      'text-verbosity': 'full',
      'include-sections': 'body,header',
      'exclude-sections': 'footer',
    });
    expect(contents?.text).toEqual({
      maxCharacters: 500,
      includeHtmlTags: true,
      verbosity: 'full',
      includeSections: ['body', 'header'],
      excludeSections: ['footer'],
    });
  });

  test('builds highlight and summary options', async () => {
    const { contents, betas } = await buildContents({
      'highlights-query': 'pricing',
      'highlights-max-characters': '300',
      'summary-query': 'key facts',
      'summary-schema': '{"type":"object"}',
    });
    expect(contents).toEqual({
      highlights: { query: 'pricing', maxCharacters: 300 },
      summary: { query: 'key facts', schema: { type: 'object' } },
    });
    expect(betas).toEqual([]);
  });

  test('adds the beta token for dynamic highlights', async () => {
    const { contents, betas } = await buildContents({
      'dynamic-highlights': true,
      'highlights-verbosity': 'low',
    });
    expect(contents?.highlights).toEqual({ dynamic: true, verbosity: 'low' });
    expect(betas).toEqual([DYNAMIC_HIGHLIGHTS_BETA]);
  });

  test('rejects dynamic highlights with a character cap', async () => {
    expect(
      buildContents({
        'dynamic-highlights': true,
        'highlights-max-characters': '100',
      })
    ).rejects.toThrow('--dynamic-highlights cannot be combined');
  });

  test('maps freshness, subpage, and extras options', async () => {
    const { contents } = await buildContents({
      'max-age-hours': '0',
      'livecrawl-timeout': '5000',
      'snapshot-as-of': '2026-01-15',
      subpages: '2',
      'subpage-target': 'about,pricing',
      'extras-links': '5',
      'extras-image-links': '1',
      'extras-rich-links': '2',
      'extras-rich-image-links': '3',
      'extras-code-blocks': '4',
    });
    expect(contents).toEqual({
      maxAgeHours: 0,
      livecrawlTimeout: 5000,
      snapshotAsOf: '2026-01-15',
      subpages: 2,
      subpageTarget: ['about', 'pricing'],
      extras: {
        links: 5,
        imageLinks: 1,
        richLinks: 2,
        richImageLinks: 3,
        codeBlocks: 4,
      },
    });
  });

  test('rejects livecrawl together with max-age-hours', async () => {
    expect(
      buildContents({ livecrawl: 'always', 'max-age-hours': '1' })
    ).rejects.toThrow('Use either --max-age-hours or --livecrawl');
  });

  test('rejects the removed livecrawl mode "auto"', async () => {
    expect(buildContents({ livecrawl: 'auto' })).rejects.toThrow(
      '--livecrawl must be one of'
    );
  });
});

describe('buildResultFilters', () => {
  test('maps filter flags to API field names', () => {
    expect(
      compact(
        buildResultFilters({
          'num-results': '5',
          'include-domains': 'a.com,b.com/docs',
          'exclude-domains': '*.spam.com',
          'start-date': '2026-01-01',
          'end-date': '2026-06-30',
          category: 'news',
        })
      )
    ).toEqual({
      numResults: 5,
      includeDomains: ['a.com', 'b.com/docs'],
      excludeDomains: ['*.spam.com'],
      startPublishedDate: '2026-01-01',
      endPublishedDate: '2026-06-30',
      category: 'news',
    });
  });
});

describe('buildUserLocation', () => {
  test('uses the country code string form by default', () => {
    expect(buildUserLocation({ 'user-location': 'NL' })).toBe('NL');
  });

  test('uses the object form when coordinates are given', () => {
    expect(
      buildUserLocation({
        'user-location': 'NL',
        latitude: '52.37',
        longitude: '4.89',
      })
    ).toEqual({ country: 'NL', latitude: 52.37, longitude: 4.89 });
  });

  test('requires latitude and longitude together', () => {
    expect(() => buildUserLocation({ latitude: '52.37' })).toThrow(
      '--latitude and --longitude must be set together'
    );
  });
});

describe('betaHeaders', () => {
  test('joins beta tokens into one Exa-Beta header', () => {
    expect(betaHeaders([])).toBeUndefined();
    expect(betaHeaders(['a', 'b'])).toEqual({ 'Exa-Beta': 'a,b' });
  });
});
