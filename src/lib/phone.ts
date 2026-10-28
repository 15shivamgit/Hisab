// Phone numbers for udhaar reminders (UDHAAR.md § Add / edit person, § Remind). No
// contacts permission: the user types the number.

/**
 * Input may contain digits, spaces, '+', '-' (also '(' ')'). Stored as digits with an
 * optional leading '+', 6–20 characters. Returns null for empty input, 'invalid' otherwise.
 */
export function normalizePhone(input: string | null | undefined): string | null | 'invalid' {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) return 'invalid';
  const plus = trimmed.startsWith('+') ? '+' : '';
  const normalised = plus + trimmed.replace(/[^0-9]/g, '');
  return normalised.length >= 6 && normalised.length <= 20 ? normalised : 'invalid';
}

/** wa.me wants digits with the country code; Indian 10-digit numbers get 91. */
export function whatsappDigits(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!phone.startsWith('+') && digits.length === 10) return `91${digits}`;
  if (!phone.startsWith('+') && digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function smsUrl(phone: string, text: string): string {
  return `sms:${phone}?body=${encodeURIComponent(text)}`;
}
