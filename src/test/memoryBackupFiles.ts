import type { BackupFiles } from '@/platform/backupFiles';
import type { FileEntry, ReceiptFileStore } from '@/platform/receiptFiles';

import { CACHE, DOC } from '@/test/fakeReceiptFiles';

/**
 * In-memory file system with the same contract as deviceBackupFiles. Folders exist when
 * something is inside them or they were created by a write. `receiptStore` is a
 * ReceiptFileStore view over the same files, so receipt code and backup code share them.
 */
export function memoryBackupFiles(freeBytes = 1024 * 1024 * 1024) {
  const files = new Map<string, { bytes: Uint8Array; modifiedMs: number }>();
  const dirs = new Set<string>();
  let free = freeBytes;
  let now = 0;
  /** Throws when a write or move touches a URI containing this text (failure tests). */
  let failOn: string | null = null;

  const trim = (uri: string) => uri.replace(/\/+$/, '');
  const parentOf = (uri: string) => trim(uri).slice(0, trim(uri).lastIndexOf('/'));
  const isDir = (uri: string) => {
    const prefix = `${trim(uri)}/`;
    return dirs.has(trim(uri)) || [...files.keys()].some((k) => k.startsWith(prefix));
  };
  const addParents = (uri: string) => {
    for (let p = parentOf(uri); p.length > 'file://'.length; p = parentOf(p)) dirs.add(p);
  };
  const check = (uri: string) => {
    if (failOn && uri.includes(failOn)) throw new Error(`simulated failure: ${uri}`);
  };
  const put = (uri: string, bytes: Uint8Array) => {
    check(uri);
    addParents(uri);
    files.set(trim(uri), { bytes, modifiedMs: now });
  };
  const get = (uri: string) => {
    const file = files.get(trim(uri));
    if (!file) throw new Error(`no such file: ${uri}`);
    return file;
  };
  const relative = (base: string, path: string) => {
    if (path.split('/').some((p) => p === '' || p === '.' || p === '..')) {
      throw new Error('Unsafe relative path');
    }
    return `${base}${path}`;
  };

  const store: BackupFiles = {
    documentUri: (path) => relative(DOC, path),
    cacheUri: (path) => relative(CACHE, path),
    exists: (uri) => files.has(trim(uri)) || isDir(uri),
    size: (uri) => files.get(trim(uri))?.bytes.length ?? null,
    readAll: async (uri) => get(uri).bytes.slice(),
    writeAll: async (uri, bytes) => put(uri, bytes.slice()),
    openRead(uri) {
      const bytes = get(uri).bytes;
      return {
        size: bytes.length,
        read: async (at, length) => bytes.slice(at, at + length),
        close: () => undefined,
      };
    },
    openWrite(uri) {
      put(uri, new Uint8Array(0));
      const chunks: Uint8Array[] = [];
      return {
        async write(bytes) {
          check(uri);
          chunks.push(bytes.slice());
          put(uri, Buffer.concat(chunks));
        },
        close: () => undefined,
      };
    },
    copy: async (from, to) => put(to, get(from).bytes.slice()),
    async move(from, to) {
      check(to);
      if (store.exists(to)) throw new Error('Move destination already exists');
      const src = trim(from);
      if (files.has(src)) {
        const file = get(src);
        files.delete(src);
        addParents(to);
        files.set(trim(to), file);
        return;
      }
      if (!isDir(src)) throw new Error(`no such file: ${from}`);
      for (const [key, file] of [...files.entries()]) {
        if (key.startsWith(`${src}/`)) {
          files.delete(key);
          const moved = `${trim(to)}${key.slice(src.length)}`;
          addParents(moved);
          files.set(moved, file);
        }
      }
      for (const d of [...dirs]) {
        if (d === src || d.startsWith(`${src}/`)) {
          dirs.delete(d);
          dirs.add(`${trim(to)}${d.slice(src.length)}`);
        }
      }
      addParents(to);
    },
    remove(uri) {
      const target = trim(uri);
      files.delete(target);
      for (const key of [...files.keys()]) if (key.startsWith(`${target}/`)) files.delete(key);
      for (const d of [...dirs]) if (d === target || d.startsWith(`${target}/`)) dirs.delete(d);
    },
    list(uri) {
      const prefix = `${trim(uri)}/`;
      const names = new Set<string>();
      for (const key of [...files.keys(), ...dirs]) {
        if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0] ?? '');
      }
      names.delete('');
      return [...names].sort();
    },
    makeDir(uri) {
      check(uri);
      addParents(`${trim(uri)}/x`);
    },
    freeBytes: () => free,
  };

  const listFiles = (folder: string): FileEntry[] =>
    store
      .list(folder)
      .map((name) => `${trim(folder)}/${name}`)
      .filter((uri) => files.has(uri))
      .map((uri) => ({
        name: uri.slice(uri.lastIndexOf('/') + 1),
        uri,
        modifiedMs: files.get(uri)?.modifiedMs ?? null,
      }));

  const receiptStore: ReceiptFileStore = {
    documentUri: (path) => `${DOC}${path}`,
    exists: (uri) => files.has(trim(uri)),
    size: (uri) => store.size(uri),
    move: (from, to) => store.move(from, to),
    remove: (uri) => {
      files.delete(trim(uri));
    },
    listDocumentFolder: (folder) => listFiles(`${DOC}${folder}`),
    stagingUri: (name) => `${CACHE}staging/${name}`,
    listStaging: () => listFiles(`${CACHE}staging`),
    freeBytes: () => free,
  };

  return {
    store,
    receiptStore,
    files,
    put: (uri: string, bytes: Uint8Array) => put(uri, bytes),
    text: (uri: string) => new TextDecoder().decode(get(uri).bytes),
    uris: (prefix = '') => [...files.keys()].filter((k) => k.startsWith(prefix)).sort(),
    setFree(bytes: number) {
      free = bytes;
    },
    setNow(ms: number) {
      now = ms;
    },
    failWhen(text: string | null) {
      failOn = text;
    },
  };
}
