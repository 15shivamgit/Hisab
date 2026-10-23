import type { ImageProcessor } from '@/platform/images';
import type { FileEntry, ReceiptFileStore } from '@/platform/receiptFiles';

export const DOC = 'file:///doc/';
export const CACHE = 'file:///cache/';

interface FakeFile {
  size: number;
  modifiedMs: number;
}

/** In-memory file system with the same contract as deviceReceiptFiles. */
export function fakeReceiptFiles(freeBytes = 1024 * 1024 * 1024) {
  const files = new Map<string, FakeFile>();
  let free = freeBytes;
  let failMoves = false;

  const listUnder = (prefix: string): FileEntry[] =>
    [...files.entries()]
      .filter(([uri]) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
      .map(([uri, f]) => ({ name: uri.slice(prefix.length), uri, modifiedMs: f.modifiedMs }));

  const store: ReceiptFileStore = {
    documentUri: (relativePath) => `${DOC}${relativePath}`,
    exists: (uri) => files.has(uri),
    size: (uri) => files.get(uri)?.size ?? null,
    async move(fromUri, toUri) {
      const file = files.get(fromUri);
      if (!file || failMoves) throw new Error(`move failed: ${fromUri}`);
      files.delete(fromUri);
      files.set(toUri, file);
    },
    remove: (uri) => {
      files.delete(uri);
    },
    listDocumentFolder: (folder) => listUnder(`${DOC}${folder}/`),
    stagingUri: (name) => `${CACHE}staging/${name}`,
    listStaging: () => listUnder(`${CACHE}staging/`),
    freeBytes: () => free,
  };

  return {
    store,
    files,
    put(uri: string, size = 1000, modifiedMs = 0) {
      files.set(uri, { size, modifiedMs });
    },
    setFree(bytes: number) {
      free = bytes;
    },
    setFailMoves(value: boolean) {
      failMoves = value;
    },
    receiptUris: () => [...files.keys()].filter((u) => u.startsWith(`${DOC}receipts/`)),
    stagingUris: () => [...files.keys()].filter((u) => u.startsWith(`${CACHE}staging/`)),
  };
}

/**
 * Fake image processor: "decodes" sizes from a table (default 4000×3000), scales the
 * longest edge down to maxEdge, and writes an output file of `outputBytes`.
 */
export function fakeImages(
  fs: ReturnType<typeof fakeReceiptFiles>,
  sizes: Record<string, { width: number; height: number }> = {},
  outputBytes = 300_000,
) {
  let counter = 0;
  const calls: { uri: string; maxEdge: number; quality: number }[] = [];
  let fail = false;
  const images: ImageProcessor = {
    async toJpeg(uri, maxEdge, quality) {
      calls.push({ uri, maxEdge, quality });
      if (fail) throw new Error('decode failed');
      const { width, height } = sizes[uri] ?? { width: 4000, height: 3000 };
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const out = `${CACHE}manip/${++counter}.jpg`;
      fs.put(out, outputBytes);
      return { uri: out, width: Math.round(width * scale), height: Math.round(height * scale) };
    },
  };
  return {
    images,
    calls,
    setFail(value: boolean) {
      fail = value;
    },
  };
}
