import { isUuid, newId } from '@/lib/ids';
import { isSafeReceiptPath, receiptRelativePath, toAbsolute } from '@/lib/paths';

describe('ids', () => {
  test('newId gives distinct lowercase UUID v4 values', () => {
    const a = newId();
    const b = newId();
    expect(isUuid(a)).toBe(true);
    expect(a).toBe(a.toLowerCase());
    expect(a).not.toBe(b);
  });
  test('isUuid rejects other shapes', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('3F0C2B9E-1D4A-4C6B-9E2F-8A1B2C3D4E5F')).toBe(false);
  });
});

describe('receipt paths', () => {
  const id = '3f0c2b9e-1d4a-4c6b-9e2f-8a1b2c3d4e5f';

  test('built from the attachment id', () =>
    expect(receiptRelativePath(id)).toBe(`receipts/${id}.jpg`));

  test.each([`receipts/${id}.jpg`])('safe: %s', (path) =>
    expect(isSafeReceiptPath(path)).toBe(true),
  );

  test.each([
    '../evil.jpg',
    `receipts/../${id}.jpg`,
    `receipts/${id}.png`,
    `/receipts/${id}.jpg`,
    `receipts\\${id}.jpg`,
    'receipts/x.jpg',
  ])('unsafe: %s', (path) => expect(isSafeReceiptPath(path)).toBe(false));

  test('toAbsolute joins onto the document directory', () =>
    expect(toAbsolute(`receipts/${id}.jpg`, 'file:///data/user/0/app/files/')).toBe(
      `file:///data/user/0/app/files/receipts/${id}.jpg`,
    ));

  test('toAbsolute refuses unsafe paths', () =>
    expect(() => toAbsolute('../evil.jpg', 'file:///x/')).toThrow());
});
