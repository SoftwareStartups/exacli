import { describe, test, expect } from 'bun:test';
import {
  isValidNumber,
  parseNumber,
  isValidUrl,
  parseStringList,
  isValidSearchType,
  isValidAnswerModel,
  isValidLivecrawl,
} from '../src/utils/validation.js';

describe('isValidNumber', () => {
  test('returns true for valid numbers', () => {
    expect(isValidNumber(42)).toBe(true);
    expect(isValidNumber(3.14)).toBe(true);
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(-10)).toBe(true);
  });

  test('returns true for numeric strings', () => {
    expect(isValidNumber('42')).toBe(true);
    expect(isValidNumber('3.14')).toBe(true);
    expect(isValidNumber('0')).toBe(true);
    expect(isValidNumber('-10')).toBe(true);
  });

  test('returns false for invalid values', () => {
    expect(isValidNumber('abc')).toBe(false);
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber({})).toBe(false);
    expect(isValidNumber([])).toBe(false);
    expect(isValidNumber(NaN)).toBe(false);
  });
});

describe('parseNumber', () => {
  test('parses valid numbers', () => {
    expect(parseNumber(42)).toBe(42);
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('3.14')).toBe(3.14);
  });

  test('returns undefined for invalid values', () => {
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber(null)).toBeUndefined();
    expect(parseNumber(undefined)).toBeUndefined();
    expect(parseNumber({})).toBeUndefined();
  });
});

describe('isValidUrl', () => {
  test('returns true for valid HTTP/HTTPS URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
  });

  test('returns false for non-HTTP/HTTPS URLs', () => {
    expect(isValidUrl('ftp://files.example.com')).toBe(false);
    expect(isValidUrl('file:///path/to/file')).toBe(false);
  });

  test('returns false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('/path/to/resource')).toBe(false);
  });
});

describe('parseStringList', () => {
  test('parses comma-separated strings', () => {
    expect(parseStringList('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseStringList('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
  });

  test('handles single values', () => {
    expect(parseStringList('single')).toEqual(['single']);
  });

  test('filters empty strings', () => {
    expect(parseStringList('a,,b,,c')).toEqual(['a', 'b', 'c']);
    expect(parseStringList(',,,')).toEqual([]);
  });

  test('returns undefined for non-strings', () => {
    expect(parseStringList(123)).toBeUndefined();
    expect(parseStringList(null)).toBeUndefined();
    expect(parseStringList(undefined)).toBeUndefined();
    expect(parseStringList(['a', 'b'])).toBeUndefined();
  });
});

describe('isValidSearchType', () => {
  test('accepts non-deep search types', () => {
    for (const type of [
      'auto',
      'fast',
      'instant',
      'keyword',
      'neural',
      'hybrid',
    ]) {
      expect(isValidSearchType(type)).toBe(true);
    }
  });

  test('accepts deep search variants', () => {
    expect(isValidSearchType('deep-lite')).toBe(true);
    expect(isValidSearchType('deep')).toBe(true);
    expect(isValidSearchType('deep-reasoning')).toBe(true);
  });

  test('rejects unknown types', () => {
    expect(isValidSearchType('magic')).toBe(false);
    expect(isValidSearchType('')).toBe(false);
    expect(isValidSearchType(undefined)).toBe(false);
  });
});

describe('isValidAnswerModel', () => {
  test('accepts exa', () => {
    expect(isValidAnswerModel('exa')).toBe(true);
  });

  test('rejects deprecated exa-pro', () => {
    expect(isValidAnswerModel('exa-pro')).toBe(false);
  });

  test('rejects unknown models', () => {
    expect(isValidAnswerModel('gpt')).toBe(false);
    expect(isValidAnswerModel(undefined)).toBe(false);
  });
});

describe('isValidLivecrawl', () => {
  test('accepts valid livecrawl modes', () => {
    for (const mode of ['never', 'fallback', 'always', 'auto', 'preferred']) {
      expect(isValidLivecrawl(mode)).toBe(true);
    }
  });

  test('rejects unknown modes', () => {
    expect(isValidLivecrawl('sometimes')).toBe(false);
    expect(isValidLivecrawl('')).toBe(false);
    expect(isValidLivecrawl(undefined)).toBe(false);
  });
});
