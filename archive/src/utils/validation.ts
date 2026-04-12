/**
 * Validation utilities
 */

export function isValidNumber(value: unknown): value is number {
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return !Number.isNaN(num);
  }
  return false;
}

export function parseNumber(value: unknown): number | undefined {
  if (!isValidNumber(value)) return undefined;
  return typeof value === 'number' ? value : Number(value);
}

export function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseStringList(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isValidSearchType(value: unknown): value is string {
  const validTypes = [
    'auto',
    'fast',
    'deep',
    'instant',
    'neural',
    'keyword',
    'hybrid',
    'deep-lite',
    'deep-reasoning',
  ];
  return typeof value === 'string' && validTypes.includes(value);
}

export function isValidAnswerModel(value: unknown): value is string {
  const validModels = ['exa', 'exa-pro'];
  return typeof value === 'string' && validModels.includes(value);
}

export function isValidResearchModel(value: unknown): value is string {
  const validModels = ['fast', 'regular', 'pro'];
  return typeof value === 'string' && validModels.includes(value);
}
