import { describe, expect, test } from 'bun:test';
import {
  isValidUrl,
  parseEnum,
  parseEnumList,
  parseInteger,
  parseJsonObject,
  parseMetadata,
  parseNumber,
  parseStringList,
  pathSegment,
  requireArg,
  UsageError,
} from '../src/utils/validation.js';
import { withTempFile } from './helpers/temp-file.js';

describe('parseNumber', () => {
  test('parses numeric strings', () => {
    expect(parseNumber('n', '42')).toBe(42);
    expect(parseNumber('n', '-1')).toBe(-1);
    expect(parseNumber('n', '2.5')).toBe(2.5);
  });

  test('returns undefined when the flag is absent', () => {
    expect(parseNumber('n', undefined)).toBeUndefined();
  });

  test('rejects non-numeric input instead of dropping it', () => {
    expect(() => parseNumber('num-results', 'ten')).toThrow(
      '--num-results must be a number, got "ten"'
    );
    expect(() => parseNumber('num-results', ' ')).toThrow(UsageError);
  });
});

describe('parseInteger', () => {
  test('accepts integers and rejects fractions', () => {
    expect(parseInteger('limit', '10')).toBe(10);
    expect(() => parseInteger('limit', '1.5')).toThrow(
      '--limit must be an integer'
    );
  });
});

describe('parseStringList', () => {
  test('splits, trims, and drops empty entries', () => {
    expect(parseStringList('a.com, b.com,,')).toEqual(['a.com', 'b.com']);
  });

  test('returns undefined for absent or empty input', () => {
    expect(parseStringList(undefined)).toBeUndefined();
    expect(parseStringList(' , ')).toBeUndefined();
  });
});

describe('parseEnum', () => {
  const allowed = ['auto', 'fast'] as const;

  test('accepts allowed values', () => {
    expect(parseEnum('type', 'fast', allowed)).toBe('fast');
    expect(parseEnum('type', undefined, allowed)).toBeUndefined();
  });

  test('lists allowed values on rejection', () => {
    expect(() => parseEnum('type', 'neural', allowed)).toThrow(
      '--type must be one of: auto, fast'
    );
  });

  test('parseEnumList validates every item', () => {
    expect(parseEnumList('s', 'body,footer', ['body', 'footer'])).toEqual([
      'body',
      'footer',
    ]);
    expect(() => parseEnumList('s', 'body,nav', ['body'])).toThrow(
      '--s must be one of: body'
    );
  });
});

describe('parseJsonObject', () => {
  test('parses inline JSON objects', async () => {
    expect(await parseJsonObject('schema', '{"type":"text"}')).toEqual({
      type: 'text',
    });
  });

  test('reads @file references', async () => {
    await withTempFile('.json', '{"type":"object"}', async (path) => {
      expect(await parseJsonObject('schema', `@${path}`)).toEqual({
        type: 'object',
      });
    });
  });

  test('reports a missing @file as a usage error naming the flag', async () => {
    await expect(
      parseJsonObject('schema', '@/does/not/exist.json')
    ).rejects.toThrow('--schema: cannot read file "/does/not/exist.json"');
  });

  test('rejects invalid JSON and non-objects', async () => {
    expect(parseJsonObject('schema', '{nope')).rejects.toThrow(
      '--schema must be valid JSON or @file'
    );
    expect(parseJsonObject('schema', '[1]')).rejects.toThrow(
      '--schema must be a JSON object'
    );
  });
});

describe('isValidUrl', () => {
  test('accepts only http and https URLs', () => {
    expect(isValidUrl('https://example.com/a?b=c')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
  });
});

describe('requireArg', () => {
  test('returns the value or throws a usage hint', () => {
    expect(requireArg('x', 'search <query>')).toBe('x');
    expect(() => requireArg('', 'search <query>')).toThrow(
      'Usage: exacli search <query>'
    );
  });
});

describe('parseNumber edge cases', () => {
  test('accepts decimal and exponent notation', () => {
    expect(parseNumber('n', '1e3')).toBe(1000);
    expect(parseNumber('n', '-2.5')).toBe(-2.5);
    expect(parseNumber('n', '.5')).toBe(0.5);
  });

  test('rejects values that are not finite decimals', () => {
    for (const value of ['Infinity', '-Infinity', '1e400', '0x10', '1_000']) {
      expect(() => parseNumber('n', value)).toThrow(UsageError);
    }
  });
});

describe('parseMetadata', () => {
  test('accepts string values', async () => {
    expect(await parseMetadata('metadata', '{"team":"growth"}')).toEqual({
      team: 'growth',
    });
  });

  test('rejects non-string values, which the API refuses', async () => {
    await expect(parseMetadata('metadata', '{"priority":1}')).rejects.toThrow(
      '--metadata values must be strings (key "priority")'
    );
  });
});

describe('pathSegment', () => {
  test('encodes IDs', () => {
    expect(pathSegment('a/b c')).toBe('a%2Fb%20c');
  });

  test('rejects IDs that would change the request path', () => {
    for (const id of ['', '.', '..']) {
      expect(() => pathSegment(id)).toThrow(UsageError);
    }
  });
});
