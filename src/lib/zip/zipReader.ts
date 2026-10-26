// Reads a ZIP archive through its central directory (the table at the end of the file),
// so every entry's name, size, and position are known before anything is extracted.
// We don't use fflate's streaming Unzip for this: for entries written with a data
// descriptor (which fflate's own Zip always does) it finds the end of an entry by
// scanning for a 4-byte signature, and those bytes can occur inside a JPEG.
//
// Only what Hisaab backups need: no ZIP64, no encryption, no multi-disk archives.

import { strFromU8 } from 'fflate';

/** Random-access reads from a file (FileHandle on the phone, a buffer in tests). */
export interface ByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  localHeaderOffset: number;
}

export class ZipFormatError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid ZIP: ${reason}`);
    this.name = 'ZipFormatError';
  }
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const EOCD_MIN = 22;
const MAX_COMMENT = 0xffff;
const ZIP64_MARK = 0xffffffff;

function u16(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
}

function u32(b: Uint8Array, at: number): number {
  return (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0;
}

// fflate's decoder works without TextDecoder (not guaranteed on Hermes). Odd names
// don't need special handling: callers check every name against an allowlist.
function decodeName(bytes: Uint8Array, isUtf8: boolean): string {
  try {
    return strFromU8(bytes, !isUtf8);
  } catch {
    throw new ZipFormatError('bad file name encoding');
  }
}

/** Lists the archive's entries. Rejects anything outside the supported subset. */
export async function readZipDirectory(
  source: ByteSource,
  limits: { maxEntries: number },
): Promise<ZipEntry[]> {
  if (source.size < EOCD_MIN) throw new ZipFormatError('too small');

  // The end-of-central-directory record sits in the last 22 bytes plus an optional comment.
  const tailLength = Math.min(source.size, EOCD_MIN + MAX_COMMENT);
  const tailStart = source.size - tailLength;
  const tail = await source.read(tailStart, tailLength);
  let eocd = -1;
  for (let i = tail.length - EOCD_MIN; i >= 0; i--) {
    if (u32(tail, i) === EOCD_SIG && i + EOCD_MIN + u16(tail, i + 20) === tail.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipFormatError('no end of central directory');

  const diskNumber = u16(tail, eocd + 4);
  const centralDisk = u16(tail, eocd + 6);
  const entriesOnDisk = u16(tail, eocd + 8);
  const totalEntries = u16(tail, eocd + 10);
  const centralSize = u32(tail, eocd + 12);
  const centralOffset = u32(tail, eocd + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new ZipFormatError('multi-disk archive');
  }
  if (totalEntries === 0xffff || centralSize === ZIP64_MARK || centralOffset === ZIP64_MARK) {
    throw new ZipFormatError('zip64 not supported');
  }
  if (totalEntries > limits.maxEntries) throw new ZipFormatError('too many entries');
  if (centralOffset + centralSize > tailStart + eocd) {
    throw new ZipFormatError('central directory out of range');
  }

  const central = await source.read(centralOffset, centralSize);
  const entries: ZipEntry[] = [];
  let at = 0;
  for (let n = 0; n < totalEntries; n++) {
    if (at + 46 > central.length || u32(central, at) !== CENTRAL_SIG) {
      throw new ZipFormatError('bad central directory entry');
    }
    const flags = u16(central, at + 8);
    const method = u16(central, at + 10);
    const crc32 = u32(central, at + 16);
    const compressedSize = u32(central, at + 20);
    const uncompressedSize = u32(central, at + 24);
    const nameLength = u16(central, at + 28);
    const extraLength = u16(central, at + 30);
    const commentLength = u16(central, at + 32);
    const localHeaderOffset = u32(central, at + 42);
    if (flags & 1) throw new ZipFormatError('encrypted entry');
    if (method !== 0 && method !== 8) throw new ZipFormatError('unsupported compression');
    if (
      compressedSize === ZIP64_MARK ||
      uncompressedSize === ZIP64_MARK ||
      localHeaderOffset === ZIP64_MARK
    ) {
      throw new ZipFormatError('zip64 not supported');
    }
    if (method === 0 && compressedSize !== uncompressedSize) {
      throw new ZipFormatError('stored entry size mismatch');
    }
    if (localHeaderOffset + 30 + compressedSize > centralOffset) {
      throw new ZipFormatError('entry out of range');
    }
    const nameEnd = at + 46 + nameLength;
    if (nameEnd > central.length) throw new ZipFormatError('bad central directory entry');
    const name = decodeName(central.subarray(at + 46, nameEnd), (flags & 0x800) !== 0);
    entries.push({ name, method, compressedSize, uncompressedSize, crc32, localHeaderOffset });
    at = nameEnd + extraLength + commentLength;
  }
  return entries;
}

/**
 * Byte offset where the entry's data starts. Checks the local header agrees with the
 * central directory, so a crafted archive can't point two names at different data.
 */
export async function entryDataOffset(source: ByteSource, entry: ZipEntry): Promise<number> {
  const header = await source.read(entry.localHeaderOffset, 30);
  if (header.length < 30 || u32(header, 0) !== LOCAL_SIG) {
    throw new ZipFormatError('bad local header');
  }
  if (u16(header, 8) !== entry.method) throw new ZipFormatError('local header mismatch');
  const nameLength = u16(header, 26);
  const extraLength = u16(header, 28);
  const nameBytes = await source.read(entry.localHeaderOffset + 30, nameLength);
  const name = decodeName(nameBytes, (u16(header, 6) & 0x800) !== 0);
  if (name !== entry.name) throw new ZipFormatError('local header mismatch');
  const start = entry.localHeaderOffset + 30 + nameLength + extraLength;
  if (start + entry.compressedSize > source.size) throw new ZipFormatError('entry out of range');
  return start;
}
