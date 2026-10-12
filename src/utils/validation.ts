/**
 * CLI input parsing and validation. Parsers throw UsageError on bad input;
 * runCommand reports it and exits non-zero.
 */

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseNumber(
  flag: string,
  value: string | undefined
): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  if (value.trim() === '' || Number.isNaN(num)) {
    throw new UsageError(`--${flag} must be a number, got "${value}"`);
  }
  return num;
}

export function parseInteger(
  flag: string,
  value: string | undefined
): number | undefined {
  const num = parseNumber(flag, value);
  if (num !== undefined && !Number.isInteger(num)) {
    throw new UsageError(`--${flag} must be an integer, got "${value}"`);
  }
  return num;
}

export function parseStringList(
  value: string | undefined
): string[] | undefined {
  if (value === undefined) return undefined;
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : undefined;
}

export function parseEnum<T extends string>(
  flag: string,
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`--${flag} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parseEnumList<T extends string>(
  flag: string,
  value: string | undefined,
  allowed: readonly T[]
): T[] | undefined {
  return parseStringList(value)?.map(
    (item) => parseEnum(flag, item, allowed) as T
  );
}

/**
 * Parses a JSON object given inline or as `@path/to/file.json`.
 */
export async function parseJsonObject(
  flag: string,
  value: string | undefined
): Promise<Record<string, unknown> | undefined> {
  if (value === undefined) return undefined;
  const source = value.startsWith('@')
    ? await Bun.file(value.slice(1)).text()
    : value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new UsageError(`--${flag} must be valid JSON or @file`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UsageError(`--${flag} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function requireArg(value: string | undefined, usage: string): string {
  if (!value) throw new UsageError(`Usage: exacli ${usage}`);
  return value;
}
