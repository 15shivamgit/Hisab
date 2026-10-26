import { inflateSync, strToU8, unzipSync, zipSync } from 'fflate';

import {
  entryDataOffset,
  readZipDirectory,
  ZipFormatError,
  type ByteSource,
} from '@/lib/zip/zipReader';
import { createZipWriter } from '@/lib/zip/zipWriter';

const LIMITS = { maxEntries: 100 };
const WHEN = new Date('2026-10-21T21:40:00+05:30');

function bufferSource(bytes: Uint8Array): ByteSource {
  return { size: bytes.length, read: async (at, length) => bytes.slice(at, at + length) };
}

async function writeZip(
  entries: { name: string; bytes: Uint8Array; deflate?: boolean }[],
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const writer = createZipWriter({ write: async (b) => void chunks.push(b) }, WHEN);
  for (const e of entries) {
    if (e.deflate) await writer.addDeflated(e.name, e.bytes);
    else await writer.addStored(e.name, e.bytes);
  }
  await writer.finish();
  return Buffer.concat(chunks);
}

async function readEntry(zip: Uint8Array, name: string): Promise<Uint8Array> {
  const source = bufferSource(zip);
  const entry = (await readZipDirectory(source, LIMITS)).find((e) => e.name === name);
  if (!entry) throw new Error(`missing ${name}`);
  const start = await entryDataOffset(source, entry);
  const raw = await source.read(start, entry.compressedSize);
  return entry.method === 8 ? inflateSync(raw) : raw;
}

// Bytes that contain every ZIP signature a scanning reader could mistake for a boundary.
function trickyJpeg(): Uint8Array {
  const bytes = new Uint8Array(4096);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff;
  bytes.set([0x50, 0x4b, 0x07, 0x08], 100); // data descriptor
  bytes.set([0x50, 0x4b, 0x03, 0x04], 900); // local header
  bytes.set([0x50, 0x4b, 0x01, 0x02], 2000); // central directory
  return bytes;
}

describe('ZIP writer + central-directory reader', () => {
  test('round trip of stored and deflated entries, including signature bytes in data', async () => {
    const jpeg = trickyJpeg();
    const json = strToU8(JSON.stringify({ hello: 'नमस्ते ₹', n: [1, 2, 3] }));
    const zip = await writeZip([
      { name: 'manifest.json', bytes: json, deflate: true },
      { name: 'receipts/a.jpg', bytes: jpeg },
      { name: 'receipts/b.jpg', bytes: jpeg.slice(0, 10) },
    ]);

    const entries = await readZipDirectory(bufferSource(zip), LIMITS);
    expect(entries.map((e) => [e.name, e.method, e.uncompressedSize])).toEqual([
      ['manifest.json', 8, json.length],
      ['receipts/a.jpg', 0, 4096],
      ['receipts/b.jpg', 0, 10],
    ]);
    expect(await readEntry(zip, 'receipts/a.jpg')).toEqual(jpeg);
    expect(await readEntry(zip, 'manifest.json')).toEqual(json);
    // Other ZIP readers can open it too.
    expect(unzipSync(zip)['receipts/a.jpg']).toEqual(jpeg);
  });

  test('empty archive', async () => {
    const zip = await writeZip([]);
    expect(await readZipDirectory(bufferSource(zip), LIMITS)).toEqual([]);
  });

  test('reads archives made by other tools (fflate zipSync)', async () => {
    const zip = zipSync({
      'data.json': strToU8('{}'),
      'receipts/x.jpg': [trickyJpeg(), { level: 0 }],
    });
    expect(await readEntry(zip, 'receipts/x.jpg')).toEqual(trickyJpeg());
    expect(new TextDecoder().decode(await readEntry(zip, 'data.json'))).toBe('{}');
  });
});

describe('ZIP reader rejects', () => {
  const reject = (bytes: Uint8Array, limits = LIMITS) =>
    expect(readZipDirectory(bufferSource(bytes), limits)).rejects.toBeInstanceOf(ZipFormatError);

  test('non-ZIP and truncated files', async () => {
    await reject(strToU8('this is not a zip file at all, just text'));
    await reject(new Uint8Array(10));
    const zip = await writeZip([{ name: 'a.json', bytes: strToU8('{}') }]);
    await reject(zip.slice(0, zip.length - 5));
  });

  test('too many entries', async () => {
    const zip = await writeZip([
      { name: 'a', bytes: strToU8('1') },
      { name: 'b', bytes: strToU8('2') },
    ]);
    await reject(zip, { maxEntries: 1 });
  });

  test('encrypted entries and ZIP64 markers', async () => {
    const zip = await writeZip([{ name: 'a.json', bytes: strToU8('{}') }]);
    const central = Buffer.from(zip).indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));

    const encrypted = zip.slice();
    encrypted[central + 8] = (encrypted[central + 8] ?? 0) | 1;
    await reject(encrypted);

    const zip64 = zip.slice();
    zip64.set([0xff, 0xff, 0xff, 0xff], central + 20);
    await reject(zip64);
  });

  test('a local header whose name differs from the central directory', async () => {
    const zip = await writeZip([{ name: 'receipts/a.jpg', bytes: trickyJpeg() }]);
    const tampered = zip.slice();
    tampered[30] = 'X'.charCodeAt(0); // first byte of the local file name
    const source = bufferSource(tampered);
    const [entry] = await readZipDirectory(source, LIMITS);
    await expect(entryDataOffset(source, entry!)).rejects.toBeInstanceOf(ZipFormatError);
  });
});
