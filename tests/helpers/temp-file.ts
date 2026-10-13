import { tmpdir } from 'node:os';

/** Writes `content` to a unique temp file, runs `fn`, then deletes the file. */
export async function withTempFile<T>(
  extension: string,
  content: string | Uint8Array,
  fn: (path: string) => Promise<T>
): Promise<T> {
  const path = `${tmpdir()}/exacli-${crypto.randomUUID()}${extension}`;
  await Bun.write(path, content);
  try {
    return await fn(path);
  } finally {
    await Bun.file(path).delete();
  }
}
