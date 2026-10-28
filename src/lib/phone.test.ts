import { normalizePhone, smsUrl, whatsappDigits, whatsappUrl } from '@/lib/phone';

test('normalises typed numbers; empty is null; junk is invalid', () => {
  expect(normalizePhone('98765 43210')).toBe('9876543210');
  expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
  expect(normalizePhone('(022) 2345 6789')).toBe('02223456789');
  expect(normalizePhone('   ')).toBeNull();
  expect(normalizePhone(undefined)).toBeNull();
  expect(normalizePhone('12345')).toBe('invalid');
  expect(normalizePhone('call me')).toBe('invalid');
  expect(normalizePhone('98+76')).toBe('invalid');
  expect(normalizePhone('1'.repeat(21))).toBe('invalid');
});

test('WhatsApp gets the country code; SMS keeps the number', () => {
  expect(whatsappDigits('9876543210')).toBe('919876543210');
  expect(whatsappDigits('09876543210')).toBe('919876543210');
  expect(whatsappDigits('+919876543210')).toBe('919876543210');
  expect(whatsappDigits('+14155550100')).toBe('14155550100');
  expect(whatsappUrl('9876543210', 'Hi Rahul, ₹7,000?')).toBe(
    'https://wa.me/919876543210?text=Hi%20Rahul%2C%20%E2%82%B97%2C000%3F',
  );
  expect(smsUrl('+919876543210', 'a&b')).toBe('sms:+919876543210?body=a%26b');
});
