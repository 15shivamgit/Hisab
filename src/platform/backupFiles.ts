// File access for backup, restore, export, and delete-all (BACKUP_AND_RESTORE.md,
// ARCHITECTURE.md § Files on disk). Big files are read and written through file handles
// in pieces, never loaded whole. Tests use src/test/memoryBackupFiles.ts.

import { Directory, File, FileMode, Paths } from 'expo-file-system';

import type { ByteSource } from '@/lib/zip/zipReader';
import type { ByteSink } from '@/lib/zip/zipWriter';

export interface ByteReader extends ByteSource {
  close(): void;
}

export interface ByteWriter extends ByteSink {
  close(): void;
}

export interface BackupFiles {
  /** URI of a path relative to the document folder, e.g. 'backups/x.hisaab'. */
  documentUri(relativePath: string): string;
  /** URI of a path relative to the cache folder, e.g. 'exports/x.csv'. */
  cacheUri(relativePath: string): string;
  exists(uri: string): boolean;
  /** Bytes, or null if the file doesn't exist. */
  size(uri: string): number | null;
  readAll(uri: string): Promise<Uint8Array>;
  /** Creates parent folders; replaces an existing file. */
  writeAll(uri: string, bytes: Uint8Array): Promise<void>;
  openRead(uri: string): ByteReader;
  /** Creates parent folders; starts an empty file. */
  openWrite(uri: string): ByteWriter;
  copy(fromUri: string, toUri: string): Promise<void>;
  /** Renames a file or a folder; creates the destination's parent. Destination must not exist. */
  move(fromUri: string, toUri: string): Promise<void>;
  /** Deletes a file or a whole folder; never throws if it is missing. */
  remove(uri: string): void;
  /** Names of the files and folders directly inside a folder ([] if missing). */
  list(uri: string): string[];
  /** Creates a folder (and its parents) if it doesn't exist. */
  makeDir(uri: string): void;
  freeBytes(): number;
}

function relative(base: Directory, relativePath: string): string {
  const parts = relativePath.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw new Error('Unsafe relative path');
  }
  return new File(base, ...parts).uri;
}

function ensureParent(file: File): void {
  const dir = file.parentDirectory;
  if (!dir.exists) dir.create({ intermediates: true });
}

const asDirectory = (uri: string) => new Directory(uri);

export const deviceBackupFiles: BackupFiles = {
  documentUri: (relativePath) => relative(Paths.document, relativePath),
  cacheUri: (relativePath) => relative(Paths.cache, relativePath),

  exists: (uri) => new File(uri).exists || asDirectory(uri).exists,

  size(uri) {
    const file = new File(uri);
    return file.exists ? file.size : null;
  },

  readAll: (uri) => new File(uri).bytes(),

  async writeAll(uri, bytes) {
    const file = new File(uri);
    ensureParent(file);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
  },

  openRead(uri) {
    const handle = new File(uri).open(FileMode.ReadOnly);
    const size = handle.size ?? 0;
    return {
      size,
      async read(offset, length) {
        handle.offset = offset;
        // readBytes may return fewer bytes than asked for; loop until done or EOF.
        const first = await handle.readBytes(length);
        if (first.length >= length) return first;
        const out = new Uint8Array(length);
        out.set(first);
        let filled = first.length;
        while (filled < length) {
          const more = await handle.readBytes(length - filled);
          if (more.length === 0) break;
          out.set(more, filled);
          filled += more.length;
        }
        return out.subarray(0, filled);
      },
      close: () => handle.close(),
    };
  },

  openWrite(uri) {
    const file = new File(uri);
    ensureParent(file);
    if (!file.exists) file.create();
    const handle = file.open(FileMode.Truncate);
    return {
      write: (bytes) => handle.writeBytes(bytes),
      close: () => handle.close(),
    };
  },

  async copy(fromUri, toUri) {
    const target = new File(toUri);
    ensureParent(target);
    if (target.exists) target.delete();
    await new File(fromUri).copy(target);
  },

  async move(fromUri, toUri) {
    // expo-file-system moves a folder *into* an existing destination folder; we only
    // ever want a rename, so an existing destination is an error.
    if (new File(toUri).exists || asDirectory(toUri).exists) {
      throw new Error('Move destination already exists');
    }
    const dir = asDirectory(fromUri);
    if (dir.exists) {
      const parent = asDirectory(toUri).parentDirectory;
      if (!parent.exists) parent.create({ intermediates: true });
      await dir.move(asDirectory(toUri));
      return;
    }
    const target = new File(toUri);
    ensureParent(target);
    await new File(fromUri).move(target);
  },

  remove(uri) {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
      return;
    }
    const dir = asDirectory(uri);
    if (dir.exists) dir.delete();
  },

  list(uri) {
    const dir = asDirectory(uri);
    return dir.exists ? dir.list().map((item) => item.name) : [];
  },

  makeDir(uri) {
    const dir = asDirectory(uri);
    if (!dir.exists) dir.create({ intermediates: true });
  },

  freeBytes: () => Paths.availableDiskSpace,
};
