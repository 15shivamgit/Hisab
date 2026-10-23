// File operations for receipts (RECEIPTS.md). Paths inside the DB are always
// 'receipts/<id>.jpg' relative to the document directory; this wrapper turns them into
// URIs and moves files. Tests use an in-memory fake (src/test/fakeReceiptFiles.ts).

import { Directory, File, Paths } from 'expo-file-system';

export interface FileEntry {
  name: string;
  uri: string;
  /** Milliseconds since epoch, or null if unknown. */
  modifiedMs: number | null;
}

export interface ReceiptFileStore {
  /** Absolute URI for a document-relative path such as 'receipts/<id>.jpg'. */
  documentUri(relativePath: string): string;
  exists(uri: string): boolean;
  /** Bytes, or null if the file doesn't exist or can't be read. */
  size(uri: string): number | null;
  /** Moves a file, creating the destination folder if needed. */
  move(fromUri: string, toUri: string): Promise<void>;
  /** Deletes if present; never throws for a missing file. */
  remove(uri: string): void;
  /** Files directly inside a document-relative folder (e.g. 'receipts'). */
  listDocumentFolder(relativeFolder: string): FileEntry[];
  /** URI inside cache/staging (folder created on demand). */
  stagingUri(fileName: string): string;
  listStaging(): FileEntry[];
  /** Free internal storage in bytes. */
  freeBytes(): number;
}

const STAGING = 'staging';

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true });
}

function entriesOf(dir: Directory): FileEntry[] {
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((item): item is File => item instanceof File)
    .map((file) => ({ name: file.name, uri: file.uri, modifiedMs: file.lastModified }));
}

export const deviceReceiptFiles: ReceiptFileStore = {
  documentUri: (relativePath) => new File(Paths.document, ...relativePath.split('/')).uri,

  exists: (uri) => new File(uri).exists,

  size(uri) {
    const file = new File(uri);
    return file.exists ? file.size : null;
  },

  async move(fromUri, toUri) {
    const target = new File(toUri);
    ensureDir(target.parentDirectory);
    await new File(fromUri).move(target);
  },

  remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  listDocumentFolder: (relativeFolder) =>
    entriesOf(new Directory(Paths.document, ...relativeFolder.split('/'))),

  stagingUri(fileName) {
    const dir = new Directory(Paths.cache, STAGING);
    ensureDir(dir);
    return new File(dir, fileName).uri;
  },

  listStaging: () => entriesOf(new Directory(Paths.cache, STAGING)),

  freeBytes: () => Paths.availableDiskSpace,
};
