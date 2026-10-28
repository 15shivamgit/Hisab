// Local notifications only (UDH-08, ADR-005). No push: no tokens, no Firebase config
// (expo-notifications bundles firebase-messaging on Android, but without
// google-services.json it never starts, and release builds have no INTERNET permission).

import * as Notifications from 'expo-notifications';
// Named import: eslint's import/namespace can't follow the package's re-export of this enum.
import { AndroidImportance } from 'expo-notifications';

export const REMINDER_CHANNEL_ID = 'udhaar-reminders';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface LocalNotifications {
  ensureChannel(): Promise<void>;
  permission(): Promise<NotificationPermission>;
  /** Shows the system prompt only if the user hasn't answered yet. */
  requestPermission(): Promise<NotificationPermission>;
  cancelAll(): Promise<void>;
  schedule(input: { title: string; body: string; date: Date; personId: string }): Promise<void>;
}

function toPermission(status: Notifications.NotificationPermissionsStatus): NotificationPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export const deviceNotifications: LocalNotifications = {
  async ensureChannel() {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Udhaar reminders',
      importance: AndroidImportance.DEFAULT,
    });
  },
  permission: async () => toPermission(await Notifications.getPermissionsAsync()),
  async requestPermission() {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) return toPermission(current);
    return toPermission(await Notifications.requestPermissionsAsync());
  },
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  async schedule({ title, body, date, personId }) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { personId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  },
};

/** Show reminders that arrive while the app is open, too. Call once at startup. */
export function configureNotificationDisplay(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** The person a tapped reminder was about (from a cold start or while running). */
export function lastTappedPersonId(): string | null {
  const data = Notifications.getLastNotificationResponse()?.notification.request.content.data;
  return typeof data?.personId === 'string' ? data.personId : null;
}

export function clearLastTap(): void {
  Notifications.clearLastNotificationResponse();
}

export function onReminderTapped(listener: (personId: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const personId = response.notification.request.content.data?.personId;
    if (typeof personId === 'string') listener(personId);
  });
  return () => subscription.remove();
}
