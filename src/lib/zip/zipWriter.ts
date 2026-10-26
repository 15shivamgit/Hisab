// Writes a ZIP archive to a sink one entry at a time with fflate (ADR-009), so memory
// holds at most one entry plus its header — never the whole archive.

import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

/** Sequential writes to a file (FileHandle on the phone, an array in tests). */
export interface ByteSink {
  write(bytes: Uint8Array): Promise<void>;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1 && chunks[0]) return chunks[0];
  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export function createZipWriter(sink: ByteSink, modified: Date) {
  let pending: Uint8Array[] = [];
  let failure: Error | null = null;
  let ended = false;

  const zip = new Zip((error, chunk, final) => {
    if (error) failure = error;
    else pending.push(chunk);
    if (final) ended = true;
  });

  // fflate calls back synchronously; the queued bytes are written before the next entry.
  async function flush(): Promise<void> {
    if (failure) throw failure;
    if (pending.length === 0) return;
    const bytes = concat(pending);
    pending = [];
    await sink.write(bytes);
  }

  return {
    /** For data that is already compressed, such as JPEG receipts. */
    async addStored(name: string, bytes: Uint8Array): Promise<void> {
      const entry = new ZipPassThrough(name);
      entry.mtime = modified;
      zip.add(entry);
      entry.push(bytes, true);
      await flush();
    },

    async addDeflated(name: string, bytes: Uint8Array): Promise<void> {
      const entry = new ZipDeflate(name, { level: 6 });
      entry.mtime = modified;
      zip.add(entry);
      entry.push(bytes, true);
      await flush();
    },

    async finish(): Promise<void> {
      zip.end();
      await flush();
      if (!ended) throw new Error('ZIP did not finish');
    },
  };
}
