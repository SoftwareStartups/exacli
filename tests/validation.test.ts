import { describe, expect, test } from 'bun:test';
import {
  UsageError,
  isValidUrl,
  parseEnum,
  parseEnumList,
  parseInteger,
  parseJsonObject,
  parseNumber,
  parseStringList,
  requireArg,
} from '../src/utils/validation.js';

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
    const path = `${import.meta.dir}/.tmp-schema.json`;
    await Bun.write(path, '{"type":"object"}');
    try {
      expect(await parseJsonObject('schema', `@${path}`)).toEqual({
        type: 'object',
      });
    } finally {
      await Bun.file(path).delete();
    }
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
