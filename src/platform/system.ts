// System screens opened from Hisaab: links (WhatsApp/SMS), Android app settings, and
// text sharing. Each runs without app lock (ADR-016).

import { Linking, Share } from 'react-native';

import { runWithoutLock } from '@/platform/lockSession';

export function openUrl(url: string): Promise<void> {
  return runWithoutLock(() => Linking.openURL(url) as Promise<void>);
}

export function openAppSettings(): Promise<void> {
  return runWithoutLock(() => Linking.openSettings());
}

export async function shareText(message: string): Promise<void> {
  await runWithoutLock(() => Share.share({ message }));
}
