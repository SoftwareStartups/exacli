import { mock } from 'bun:test';

export function stubProcessExit(): () => void {
  const original = process.exit;
  process.exit = mock(() => {
    throw new Error('process.exit called');
  }) as unknown as (code?: number) => never;
  return () => {
    process.exit = original;
  };
}
