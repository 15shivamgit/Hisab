// expo-crypto is native; in Node tests, use Node's crypto for UUIDs and SHA-256.
jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    randomUUID: () => nodeCrypto.randomUUID(),
    digest: async (_algorithm: string, data: Uint8Array) => {
      const hash = nodeCrypto.createHash('sha256').update(data).digest();
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    },
  };
});

// Native views/modules that can't run in Node. Icons render nothing; the date picker
// is a spy that tests can drive.
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));
