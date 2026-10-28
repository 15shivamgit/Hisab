// Udhaar return-by reminders (UDH-08, UDHAAR.md § Return-by date and reminders,
// ARCHITECTURE.md § Notifications). reconcile() is idempotent: cancel everything this app
// scheduled, then schedule one notification per eligible person. No IDs are stored.

import type { DbClient } from '@/db/client';
import { personRepository } from '@/db/repositories/personRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import type { Clock } from '@/lib/clock';
import { localDateToDate, todayLocal, type LocalDate } from '@/lib/dates';
import { reminderNotification } from '@/content/templates';
import type { LocalNotifications, NotificationPermission } from '@/platform/notifications';

/** reminder_time ('09:00') on a local date. */
export function reminderMoment(date: LocalDate, time: string): Date {
  const [hours = 9, minutes = 0] = time.split(':').map(Number);
  const moment = localDateToDate(date);
  moment.setHours(hours, minutes, 0, 0);
  return moment;
}

export function createReminderService(notifications: LocalNotifications) {
  return {
    ensureChannel: () => notifications.ensureChannel(),

    permission: (): Promise<NotificationPermission> => notifications.permission(),

    /** Asked only when the user sets a return-by date with reminders on. */
    ensurePermission: (): Promise<NotificationPermission> => notifications.requestPermission(),

    /** Returns how many reminders are now scheduled. */
    async reconcile(db: DbClient, clock: Clock): Promise<number> {
      await notifications.cancelAll();
      const settings = await settingsRepository.getAll(db);
      if (!settings.reminders_enabled) return 0;
      if ((await notifications.permission()) !== 'granted') return 0;
      const now = clock.now();
      let scheduled = 0;
      for (const c of await personRepository.reminderCandidates(db, todayLocal(now))) {
        const date = reminderMoment(c.returnByDate, settings.reminder_time);
        // Set for today after the reminder time: the in-app badge is enough.
        if (date.getTime() <= now.getTime()) continue;
        const text = reminderNotification(c, settings.app_lock_enabled);
        await notifications.schedule({ ...text, date, personId: c.personId });
        scheduled++;
      }
      return scheduled;
    },
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
