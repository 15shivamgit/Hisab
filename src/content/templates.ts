// Reminder messages and notification text (docs/07-content/MESSAGE_TEMPLATES.md).
// English in v1 (owner decision Q2).

import { formatPaise, type Paise } from '@/lib/money';
import { formatLocalDate, type LocalDate } from '@/lib/dates';

interface ReminderInput {
  name: string;
  /** Signed person balance: > 0 the friend owes the user. */
  balancePaise: Paise;
  returnByDate: LocalDate | null;
}

const amount = (balance: Paise) => formatPaise(Math.abs(balance), { compact: true });

/** The editable message for WhatsApp / SMS / share (UDH-09). */
export function reminderMessage({ name, balancePaise, returnByDate }: ReminderInput): string {
  if (balancePaise < 0) {
    return `Hi ${name}, I haven't forgotten the ${amount(balancePaise)} I owe you. I'll return it soon. Thanks for your help!`;
  }
  if (returnByDate) {
    return `Hi ${name}, just a reminder about the ${amount(balancePaise)}. You had said you'd return it by ${formatLocalDate(returnByDate, 'short')}. Thanks!`;
  }
  return `Hi ${name}, just a gentle reminder about the ${amount(balancePaise)} I gave you. Please return it when you can. Thanks!`;
}

/** Local notification on the return-by date (UDH-08). Generic while app lock is on. */
export function reminderNotification(
  input: { name: string; balancePaise: Paise },
  appLockOn: boolean,
): { title: string; body: string } {
  if (appLockOn) return { title: 'Hisaab', body: 'You have an udhaar reminder.' };
  const body =
    input.balancePaise > 0
      ? `${input.name} was to return ${amount(input.balancePaise)} today.`
      : `You planned to return ${amount(input.balancePaise)} to ${input.name} today.`;
  return { title: 'Udhaar reminder', body };
}
