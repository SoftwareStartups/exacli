/** Replaces global fetch with `handler` while `fn` runs. */
export async function withFetch<T>(
  handler: (url: URL | string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<T>
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = handler as unknown as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}
