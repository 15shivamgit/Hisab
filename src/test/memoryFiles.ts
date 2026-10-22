import type { TextFileStore } from '@/platform/files';

/** In-memory TextFileStore for service tests. */
export function memoryFiles(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const store: TextFileStore = {
    read: async (path) => files.get(path) ?? null,
    write: async (path, text) => {
      files.set(path, text);
    },
  };
  return { store, files };
}
