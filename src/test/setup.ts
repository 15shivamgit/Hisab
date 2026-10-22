// expo-crypto is native; in Node tests, use Node's crypto for UUIDs.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));
