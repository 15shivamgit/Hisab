// SHA-256 for backup checksums (BACKUP_AND_RESTORE.md). expo-crypto hashes a whole
// buffer at once; every hashed item is size-limited (receipt ≤ 10 MB, data.json ≤ 50 MB).

import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>),
  );
  let hex = '';
  for (const byte of hash) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
